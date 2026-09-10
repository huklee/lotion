import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Repository } from "../../packages/persistence/repository";
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "yestion-benchmark-"));
let repo = await new Repository(dir).init();
const measure = async <T>(fn: () => T | Promise<T>) => {
  const start = performance.now();
  const result = await fn();
  return { ms: Math.round((performance.now() - start) * 100) / 100, result };
};
try {
  const input = Array.from({ length: 10000 }, (_, i) => ({
    key: `page-${i}`,
    parentKey: null,
    title: `Benchmark page ${i}`,
    blocks: [
      {
        id: `block-${i}`,
        type: "paragraph",
        content: [
          { type: "text", text: "A synthetic benchmark page.", styles: {} },
        ],
      },
    ],
  }));
  const imported = await measure(() =>
    repo.importDocuments(input, crypto.randomUUID()),
  );
  const tree = await measure(() => repo.tree());
  const d = imported.result[0];
  const blocks = Array.from({ length: 500 }, (_, i) => ({
    id: `active-${i}`,
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "A paragraph with enough text to exercise serialization and validation. ".repeat(
          3,
        ),
        styles: {},
      },
    ],
  }));
  const saved = await measure(() =>
    repo.save(
      d.id,
      1,
      { title: "500-block active document", blocks },
      crypto.randomUUID(),
    ),
  );
  const opened = await measure(() => repo.get(d.id));
  await repo.close();
  const startup = await measure(async () => {
    repo = await new Repository(dir).init();
  });
  const result = {
    timestamp: new Date().toISOString(),
    runtime: process.version,
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model,
    pages: tree.result.length,
    activeBlocks: opened.result.blocks.length,
    importMs: imported.ms,
    treeProjectionMs: tree.ms,
    save500BlocksMs: saved.ms,
    open500BlocksMs: opened.ms,
    startupMs: startup.ms,
    heapMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    budgets: {
      treeProjectionMs: 200,
      save500BlocksMs: 500,
      open500BlocksMs: 50,
      startupMs: 15000,
    },
  };
  console.log(JSON.stringify(result, null, 2));
  if (
    result.treeProjectionMs > 200 ||
    result.save500BlocksMs > 500 ||
    result.open500BlocksMs > 50 ||
    result.startupMs > 15000
  )
    process.exitCode = 1;
} finally {
  await repo.close();
  await fs.rm(dir, { recursive: true, force: true });
}
