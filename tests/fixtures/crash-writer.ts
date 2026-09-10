import { Repository } from "../../packages/persistence/repository";
const [dir, stage] = process.argv.slice(2);
const repo = await new Repository(dir, (point) => {
  if (stage === "beforeManifest" && point === "beforeManifest")
    process.kill(process.pid, "SIGKILL");
}).init();
const doc = repo.tree()[0];
await repo.save(
  doc.id,
  doc.revision,
  { title: "Committed by child", blocks: repo.get(doc.id).blocks },
  crypto.randomUUID(),
);
process.send?.("committed");
setInterval(() => {}, 1000);
