import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  contentSchema,
  idSchema,
  type Document,
} from "../document-schema/index";

export type StorageManifest = {
  schemaVersion: 1;
  documents: Record<string, number>;
  receipts: Record<string, { digest: string; ids: string[] }>;
  documentHashes?: Record<string, string>;
};

export type DiagnosticIssue = {
  code:
    | "manifest-missing"
    | "manifest-malformed"
    | "manifest-unsupported"
    | "manifest-entry-invalid"
    | "referenced-missing"
    | "referenced-symlink"
    | "document-malformed"
    | "document-envelope-mismatch"
    | "document-schema-invalid"
    | "external-change"
    | "missing-parent"
    | "hierarchy-cycle"
    | "orphaned-snapshot"
    | "orphaned-malformed-snapshot";
  severity: "blocker" | "warning";
  message: string;
  documentId?: string;
  revision?: number;
  path?: string;
  candidates?: number[];
};

export type DiagnosticReport = {
  generatedAt: string;
  root: string;
  token: string;
  canStart: boolean;
  issues: DiagnosticIssue[];
  summary: { blockers: number; warnings: number; validSnapshots: number };
};

export type StoredSnapshot = {
  id: string;
  revision: number;
  file: string;
  document?: Document;
  hash?: string;
  error?: "symlink" | "malformed" | "envelope" | "schema";
};

export const hashStoredValue = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function isStorageManifest(value: any): value is StorageManifest {
  return (
    value?.schemaVersion === 1 &&
    value.documents &&
    typeof value.documents === "object" &&
    !Array.isArray(value.documents) &&
    value.receipts &&
    typeof value.receipts === "object" &&
    !Array.isArray(value.receipts) &&
    (value.documentHashes === undefined ||
      (value.documentHashes &&
        typeof value.documentHashes === "object" &&
        !Array.isArray(value.documentHashes)))
  );
}

export function validateStoredDocument(
  value: any,
  id: string,
  revision: number,
) {
  if (
    value?.schemaVersion !== 1 ||
    value.id !== id ||
    value.revision !== revision
  )
    return "envelope" as const;
  if (!idSchema.safeParse(value.parentId).success && value.parentId !== null)
    return "schema" as const;
  if (
    typeof value.position !== "string" ||
    !value.position ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    (value.deletedAt !== null && typeof value.deletedAt !== "string") ||
    !contentSchema.safeParse(value).success
  )
    return "schema" as const;
  return undefined;
}

async function readSnapshot(file: string, id: string, revision: number) {
  const snapshot: StoredSnapshot = { id, revision, file };
  try {
    if ((await fs.lstat(file)).isSymbolicLink()) {
      snapshot.error = "symlink";
      return snapshot;
    }
    let value: any;
    try {
      value = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      snapshot.error = "malformed";
      return snapshot;
    }
    snapshot.error = validateStoredDocument(value, id, revision);
    if (!snapshot.error) {
      snapshot.document = value;
      snapshot.hash = hashStoredValue(value);
    }
    return snapshot;
  } catch (error: any) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

export async function inventorySnapshots(root: string) {
  const directory = path.join(root, "documents");
  let names: string[] = [];
  try {
    names = await fs.readdir(directory);
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error;
  }
  const snapshots = new Map<string, StoredSnapshot>();
  for (const name of names.sort()) {
    const match = /^([a-zA-Z0-9_-]{1,100})\.(\d+)\.json$/.exec(name);
    if (!match) continue;
    const revision = Number(match[2]);
    if (!Number.isSafeInteger(revision) || revision < 1) continue;
    const snapshot = await readSnapshot(
      path.join(directory, name),
      match[1],
      revision,
    );
    if (snapshot) snapshots.set(`${match[1]}:${revision}`, snapshot);
  }
  return snapshots;
}

function candidateRevisions(
  snapshots: Map<string, StoredSnapshot>,
  id: string,
  excluding: number,
) {
  return [...snapshots.values()]
    .filter(
      (snapshot) =>
        snapshot.id === id &&
        snapshot.revision !== excluding &&
        snapshot.document,
    )
    .map((snapshot) => snapshot.revision)
    .sort((a, b) => b - a);
}

export async function diagnoseWorkspace(
  rootInput: string,
): Promise<DiagnosticReport> {
  const root = path.resolve(rootInput);
  const manifestFile = path.join(root, "workspace.json");
  const issues: DiagnosticIssue[] = [];
  let manifest: StorageManifest | undefined;
  let manifestBytes = "";
  try {
    if ((await fs.lstat(manifestFile)).isSymbolicLink())
      throw new Error("Manifest is a symbolic link");
    manifestBytes = await fs.readFile(manifestFile, "utf8");
    let parsed: any;
    try {
      parsed = JSON.parse(manifestBytes);
    } catch {
      issues.push({
        code: "manifest-malformed",
        severity: "blocker",
        message: "workspace.json is not valid JSON.",
        path: "workspace.json",
      });
    }
    if (parsed && parsed.schemaVersion !== 1)
      issues.push({
        code: "manifest-unsupported",
        severity: "blocker",
        message: "workspace.json uses an unsupported schema version.",
        path: "workspace.json",
      });
    else if (parsed && isStorageManifest(parsed)) manifest = parsed;
    else if (parsed)
      issues.push({
        code: "manifest-malformed",
        severity: "blocker",
        message: "workspace.json does not contain the required maps.",
        path: "workspace.json",
      });
  } catch (error: any) {
    issues.push({
      code: error.code === "ENOENT" ? "manifest-missing" : "manifest-malformed",
      severity: "blocker",
      message:
        error.code === "ENOENT"
          ? "workspace.json is missing."
          : "workspace.json cannot be read safely.",
      path: "workspace.json",
    });
  }

  const snapshots = await inventorySnapshots(root);
  const canonical = new Map<string, StoredSnapshot>();
  if (manifest) {
    if (manifest.documentHashes) {
      for (const [id, value] of Object.entries(manifest.documentHashes)) {
        if (
          manifest.documents[id] === undefined ||
          !idSchema.safeParse(id).success ||
          !/^[a-f0-9]{64}$/.test(value)
        )
          issues.push({
            code: "manifest-entry-invalid",
            severity: "blocker",
            message:
              "The manifest contains an invalid document integrity entry.",
            documentId: id,
          });
      }
    }
    for (const [id, revision] of Object.entries(manifest.documents)) {
      if (
        !idSchema.safeParse(id).success ||
        !Number.isSafeInteger(revision) ||
        revision < 1
      ) {
        issues.push({
          code: "manifest-entry-invalid",
          severity: "blocker",
          message: "The manifest contains an invalid document reference.",
          documentId: id,
        });
        continue;
      }
      const relative = `documents/${id}.${revision}.json`;
      if (manifest.documentHashes && !manifest.documentHashes[id])
        issues.push({
          code: "manifest-entry-invalid",
          severity: "blocker",
          message: "The manifest is missing a document integrity hash.",
          documentId: id,
          revision,
        });
      const snapshot =
        snapshots.get(`${id}:${revision}`) ??
        (await readSnapshot(path.join(root, relative), id, revision));
      if (!snapshot) {
        issues.push({
          code: "referenced-missing",
          severity: "blocker",
          message: "The committed document snapshot is missing.",
          documentId: id,
          revision,
          path: relative,
          candidates: candidateRevisions(snapshots, id, revision),
        });
        continue;
      }
      canonical.set(id, snapshot);
      if (snapshot.error) {
        const code =
          snapshot.error === "symlink"
            ? "referenced-symlink"
            : snapshot.error === "malformed"
              ? "document-malformed"
              : snapshot.error === "envelope"
                ? "document-envelope-mismatch"
                : "document-schema-invalid";
        issues.push({
          code,
          severity: "blocker",
          message: `The committed document snapshot failed ${snapshot.error} validation.`,
          documentId: id,
          revision,
          path: relative,
          candidates: candidateRevisions(snapshots, id, revision),
        });
      } else if (
        manifest.documentHashes?.[id] &&
        manifest.documentHashes[id] !== snapshot.hash
      ) {
        issues.push({
          code: "external-change",
          severity: "blocker",
          message: "The committed snapshot changed outside Lotion.",
          documentId: id,
          revision,
          path: relative,
          candidates: candidateRevisions(snapshots, id, revision),
        });
      }
    }

    const validCanonical = new Map(
      [...canonical].filter(
        (entry): entry is [string, StoredSnapshot & { document: Document }] =>
          Boolean(entry[1].document),
      ),
    );
    for (const [id, snapshot] of validCanonical) {
      const parentId = snapshot.document.parentId;
      if (parentId && !validCanonical.has(parentId))
        issues.push({
          code: "missing-parent",
          severity: "blocker",
          message: "The document parent is missing or invalid.",
          documentId: id,
          revision: snapshot.revision,
        });
    }
    const emittedCycles = new Set<string>();
    for (const [id] of validCanonical) {
      const order: string[] = [];
      const positions = new Map<string, number>();
      let current: string | null = id;
      while (current && validCanonical.has(current)) {
        if (positions.has(current)) {
          const cycle = order.slice(positions.get(current)).sort();
          const key = cycle.join(":");
          if (!emittedCycles.has(key)) {
            emittedCycles.add(key);
            issues.push({
              code: "hierarchy-cycle",
              severity: "blocker",
              message: `The hierarchy contains a cycle involving ${cycle.join(", ")}.`,
              documentId: cycle[0],
            });
          }
          break;
        }
        positions.set(current, order.length);
        order.push(current);
        current = validCanonical.get(current)!.document.parentId;
      }
    }

    for (const snapshot of snapshots.values()) {
      if (manifest.documents[snapshot.id] === snapshot.revision) continue;
      const current = manifest.documents[snapshot.id];
      if (current && snapshot.revision < current && snapshot.document) continue;
      issues.push({
        code: snapshot.document
          ? "orphaned-snapshot"
          : "orphaned-malformed-snapshot",
        severity: "warning",
        message: snapshot.document
          ? "A valid snapshot is not referenced by the manifest."
          : "An invalid unreferenced snapshot was found.",
        documentId: snapshot.id,
        revision: snapshot.revision,
        path: path.relative(root, snapshot.file),
      });
    }
  }

  issues.sort((a, b) =>
    `${a.severity}:${a.code}:${a.documentId ?? ""}:${a.revision ?? 0}`.localeCompare(
      `${b.severity}:${b.code}:${b.documentId ?? ""}:${b.revision ?? 0}`,
    ),
  );
  const token = hashStoredValue({
    manifest: hashStoredValue(manifestBytes),
    snapshots: [...snapshots.values()].map((snapshot) => ({
      id: snapshot.id,
      revision: snapshot.revision,
      hash: snapshot.hash,
      error: snapshot.error,
    })),
    issues,
  });
  const blockers = issues.filter(
    (issue) => issue.severity === "blocker",
  ).length;
  return {
    generatedAt: new Date().toISOString(),
    root,
    token,
    canStart: Boolean(manifest) && blockers === 0,
    issues,
    summary: {
      blockers,
      warnings: issues.length - blockers,
      validSnapshots: [...snapshots.values()].filter((item) => item.document)
        .length,
    },
  };
}
