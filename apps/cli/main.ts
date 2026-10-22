import { readFileSync } from "node:fs";
import { run } from "./lotion";

const stop = new AbortController();
process.once("SIGINT", () => stop.abort());

process.exitCode = await run(process.argv.slice(2), {
  env: process.env,
  fetch,
  out: (text) => console.log(text),
  err: (text) => console.error(text),
  stdin: () => readFileSync(0, "utf8"),
  signal: stop.signal,
});
