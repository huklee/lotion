import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import lockfile from "proper-lockfile";
import { idSchema, type Document } from "../document-schema/index";
import {
  diagnoseWorkspace,
  hashStoredValue,
  inventorySnapshots,
  isStorageManifest,
  validateStoredDocument,
  type StorageManifest,
} from "./diagnostics";

export type ReconciliationPlan = {
  reportToken: string;
  actions: (
    | {
        type: "recover";
        documentId: string;
        sourceRevision: number;
        parentId?: string | null;
      }
    | { type: "drop-reference"; documentId: string }
  )[];
};

async function atomic(file: string, bytes: string) {
  const temp = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.open(temp, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temp, file);
    const directory = await fs.open(path.dirname(file), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await handle?.close();
    await fs.unlink(temp).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

function assertHierarchy(documents: Map<string, Document>) {
  for (const document of documents.values()) {
    const seen = new Set([document.id]);
    let parentId = document.parentId;
    while (parentId) {
      if (seen.has(parentId))
        throw new Error("The reconciliation plan leaves a hierarchy cycle");
      seen.add(parentId);
      const parent = documents.get(parentId);
      if (!parent)
        throw new Error("The reconciliation plan leaves a missing parent");
      parentId = parent.parentId;
    }
  }
}

export async function applyReconciliation(
  rootInput: string,
  plan: ReconciliationPlan,
) {
  const root = path.resolve(rootInput);
  if (!/^[a-f0-9]{64}$/.test(plan.reportToken) || !Array.isArray(plan.actions))
    throw new Error("Invalid reconciliation plan");
  if (plan.actions.length < 1 || plan.actions.length > 1000)
    throw new Error("A reconciliation plan must contain 1 to 1,000 actions");
  await fs.mkdir(root, { recursive: true });
  const release = await lockfile.lock(root, {
    realpath: true,
    stale: 10000,
    update: 2000,
    retries: 0,
  });
  try {
    const before = await diagnoseWorkspace(root);
    if (before.token !== plan.reportToken)
      throw new Error("Workspace changed after diagnosis; create a new plan");
    const manifestFile = path.join(root, "workspace.json");
    const manifestBytes = await fs.readFile(manifestFile, "utf8");
    const manifest: StorageManifest = JSON.parse(manifestBytes);
    if (!isStorageManifest(manifest))
      throw new Error("A valid manifest is required for reconciliation");
    const snapshots = await inventorySnapshots(root);
    const next: StorageManifest = structuredClone(manifest);
    next.documentHashes ??= {};
    const generated = new Map<string, Document>();
    const touched = new Set<string>();
    for (const action of plan.actions) {
      if (
        !idSchema.safeParse(action.documentId).success ||
        touched.has(action.documentId)
      )
        throw new Error(
          "Each reconciliation action must target one valid document once",
        );
      touched.add(action.documentId);
      if (action.type === "drop-reference") {
        if (!next.documents[action.documentId])
          throw new Error("Cannot drop a document that is not referenced");
        delete next.documents[action.documentId];
        delete next.documentHashes[action.documentId];
        continue;
      }
      if (
        !Number.isSafeInteger(action.sourceRevision) ||
        action.sourceRevision < 1 ||
        (action.parentId !== undefined &&
          action.parentId !== null &&
          !idSchema.safeParse(action.parentId).success)
      )
        throw new Error("Invalid recovery action");
      const source = snapshots.get(
        `${action.documentId}:${action.sourceRevision}`,
      );
      if (!source?.document)
        throw new Error("Recovery source is not a valid snapshot");
      const highest = Math.max(
        next.documents[action.documentId] ?? 0,
        ...[...snapshots.values()]
          .filter((item) => item.id === action.documentId)
          .map((item) => item.revision),
      );
      const document: Document = {
        ...structuredClone(source.document),
        revision: highest + 1,
        updatedAt: new Date().toISOString(),
        ...(action.parentId !== undefined ? { parentId: action.parentId } : {}),
      };
      delete document.lastMutationId;
      delete document.lastMutationDigest;
      if (validateStoredDocument(document, document.id, document.revision))
        throw new Error("Recovered document is invalid");
      generated.set(document.id, document);
      next.documents[document.id] = document.revision;
    }

    const finalDocuments = new Map<string, Document>();
    for (const [id, revision] of Object.entries(next.documents)) {
      const document =
        generated.get(id) ?? snapshots.get(`${id}:${revision}`)?.document;
      if (!document)
        throw new Error(
          "The reconciliation plan leaves an invalid document reference",
        );
      finalDocuments.set(id, document);
    }
    assertHierarchy(finalDocuments);
    next.documentHashes = Object.fromEntries(
      [...finalDocuments].map(([id, document]) => [
        id,
        hashStoredValue(document),
      ]),
    );
    next.receipts = Object.fromEntries(
      Object.entries(next.receipts).filter(([, receipt]) =>
        receipt.ids.every((id) => finalDocuments.has(id)),
      ),
    );

    const stamp = new Date()
      .toISOString()
      .replaceAll(":", "-")
      .replaceAll(".", "-");
    const backup = path.join(
      root,
      "recovery",
      `${stamp}-${before.token.slice(0, 12)}`,
    );
    await fs.mkdir(backup, { recursive: true });
    await fs.writeFile(path.join(backup, "workspace.json"), manifestBytes, {
      flag: "wx",
      mode: 0o600,
    });
    await fs.writeFile(
      path.join(backup, "diagnostic-report.json"),
      JSON.stringify(before, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    await fs.writeFile(
      path.join(backup, "reconciliation-plan.json"),
      JSON.stringify(plan, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    for (const document of generated.values())
      await atomic(
        path.join(
          root,
          "documents",
          `${document.id}.${document.revision}.json`,
        ),
        JSON.stringify(document),
      );
    await atomic(manifestFile, JSON.stringify(next));
    return { backup, report: await diagnoseWorkspace(root) };
  } finally {
    await release();
  }
}
