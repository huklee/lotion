import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { diagnoseWorkspace } from "../../packages/persistence/diagnostics";
import { applyReconciliation } from "../../packages/persistence/reconciliation";
import { Repository } from "../../packages/persistence/repository";

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-doctor-"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const documentFile = (id: string, revision: number) =>
  path.join(dir, "documents", `${id}.${revision}.json`);
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

it("detects missing, malformed, and orphaned snapshots without changing files", async () => {
  const repo = await new Repository(dir).init();
  const missing = await repo.create("Missing", null, randomUUID());
  const saved = await repo.save(
    missing.id,
    1,
    { title: "Missing latest", blocks: missing.blocks },
    randomUUID(),
  );
  const malformed = await repo.create("Malformed", null, randomUUID());
  await repo.close();

  await fs.unlink(documentFile(saved.id, saved.revision));
  await fs.writeFile(documentFile(malformed.id, 1), "not json");
  const orphan = { ...missing, id: "recoverable-orphan", title: "Orphan" };
  await fs.writeFile(documentFile(orphan.id, 1), JSON.stringify(orphan));
  const manifestBefore = await fs.readFile(
    path.join(dir, "workspace.json"),
    "utf8",
  );

  const report = await diagnoseWorkspace(dir);
  expect(report.canStart).toBe(false);
  expect(report.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "referenced-missing",
        documentId: missing.id,
        candidates: [1],
      }),
      expect.objectContaining({
        code: "document-malformed",
        documentId: malformed.id,
      }),
      expect.objectContaining({
        code: "orphaned-snapshot",
        documentId: orphan.id,
      }),
    ]),
  );
  expect(await fs.readFile(path.join(dir, "workspace.json"), "utf8")).toBe(
    manifestBefore,
  );
});

it("detects a valid canonical snapshot changed outside Lotion", async () => {
  const repo = await new Repository(dir).init();
  const page = await repo.create("Original", null, randomUUID());
  await repo.close();
  const file = documentFile(page.id, 1);
  const changed = JSON.parse(await fs.readFile(file, "utf8"));
  changed.title = "Changed outside";
  await fs.writeFile(file, JSON.stringify(changed));

  const report = await diagnoseWorkspace(dir);
  expect(report.issues).toContainEqual(
    expect.objectContaining({ code: "external-change", documentId: page.id }),
  );
  await expect(new Repository(dir).init()).rejects.toThrow(
    "changed outside Lotion",
  );
});

it("migrates a complete legacy manifest but rejects a partial integrity map", async () => {
  const repo = await new Repository(dir).init();
  const page = await repo.create("Legacy", null, randomUUID());
  await repo.close();
  const manifestFile = path.join(dir, "workspace.json");
  const legacy = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  delete legacy.documentHashes;
  await fs.writeFile(manifestFile, JSON.stringify(legacy));

  const migrated = await new Repository(dir).init();
  await migrated.close();
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  expect(manifest.documentHashes[page.id]).toMatch(/^[a-f0-9]{64}$/);
  manifest.documentHashes = {};
  await fs.writeFile(manifestFile, JSON.stringify(manifest));
  const report = await diagnoseWorkspace(dir);
  expect(report.issues).toContainEqual(
    expect.objectContaining({
      code: "manifest-entry-invalid",
      documentId: page.id,
    }),
  );
  await expect(new Repository(dir).init()).rejects.toThrow("corrupt workspace");
});

it("applies only an exact reviewed recovery plan and retains recovery metadata", async () => {
  const repo = await new Repository(dir).init();
  const page = await repo.create("Revision one", null, randomUUID());
  const latest = await repo.save(
    page.id,
    1,
    { title: "Revision two", blocks: page.blocks },
    randomUUID(),
  );
  await repo.close();
  await fs.unlink(documentFile(page.id, latest.revision));
  const before = await diagnoseWorkspace(dir);

  const result = await applyReconciliation(dir, {
    reportToken: before.token,
    actions: [{ type: "recover", documentId: page.id, sourceRevision: 1 }],
  });
  expect(result.report.summary.blockers).toBe(0);
  expect(result.report.summary.warnings).toBe(0);
  expect(await fs.readdir(result.backup)).toEqual(
    expect.arrayContaining([
      "diagnostic-report.json",
      "reconciliation-plan.json",
      "workspace.json",
    ]),
  );
  const reopened = await new Repository(dir).init();
  expect(reopened.get(page.id)).toMatchObject({
    title: "Revision one",
    revision: 3,
  });
  await reopened.close();
  await expect(
    applyReconciliation(dir, {
      reportToken: before.token,
      actions: [{ type: "recover", documentId: page.id, sourceRevision: 1 }],
    }),
  ).rejects.toThrow("changed after diagnosis");
});

it("reports cycles and requires an explicit detach recovery", async () => {
  const repo = await new Repository(dir).init();
  const first = await repo.create("First", null, randomUUID());
  const second = await repo.create("Second", null, randomUUID());
  await repo.close();
  const firstDoc = JSON.parse(
    await fs.readFile(documentFile(first.id, 1), "utf8"),
  );
  const secondDoc = JSON.parse(
    await fs.readFile(documentFile(second.id, 1), "utf8"),
  );
  firstDoc.parentId = second.id;
  secondDoc.parentId = first.id;
  await fs.writeFile(documentFile(first.id, 1), JSON.stringify(firstDoc));
  await fs.writeFile(documentFile(second.id, 1), JSON.stringify(secondDoc));
  const manifestFile = path.join(dir, "workspace.json");
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  manifest.documentHashes[first.id] = digest(firstDoc);
  manifest.documentHashes[second.id] = digest(secondDoc);
  await fs.writeFile(manifestFile, JSON.stringify(manifest));

  const report = await diagnoseWorkspace(dir);
  expect(report.issues).toContainEqual(
    expect.objectContaining({ code: "hierarchy-cycle" }),
  );
  const result = await applyReconciliation(dir, {
    reportToken: report.token,
    actions: [
      {
        type: "recover",
        documentId: first.id,
        sourceRevision: 1,
        parentId: null,
      },
    ],
  });
  expect(result.report.summary.blockers).toBe(0);
  const reopened = await new Repository(dir).init();
  expect(reopened.get(first.id).parentId).toBeNull();
  expect(reopened.get(second.id).parentId).toBe(first.id);
  await reopened.close();
});

it("rejects a drop that would orphan a child and never deletes snapshots", async () => {
  const repo = await new Repository(dir).init();
  const parent = await repo.create("Parent", null, randomUUID());
  await repo.create("Child", parent.id, randomUUID());
  await repo.close();
  const report = await diagnoseWorkspace(dir);
  const parentFile = documentFile(parent.id, 1);

  await expect(
    applyReconciliation(dir, {
      reportToken: report.token,
      actions: [{ type: "drop-reference", documentId: parent.id }],
    }),
  ).rejects.toThrow("missing parent");
  expect(await fs.readFile(parentFile, "utf8")).toContain('"title":"Parent"');
  const reopened = await new Repository(dir).init();
  expect(reopened.get(parent.id).title).toBe("Parent");
  await reopened.close();
});
