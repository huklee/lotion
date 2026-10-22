import { readFileSync } from "node:fs";
import { issueClient } from "../cli/issues-client";
import { createMcpServer, serve } from "./issues-mcp";

const version = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
).version;
const author = process.env.LOTION_AUTHOR || "agent";
const { handle } = createMcpServer(
  issueClient({ env: process.env, fetch, author }),
  author,
  version,
);
process.stdin.setEncoding("utf8");
await serve(process.stdin, (line) => process.stdout.write(`${line}\n`), handle);
