import type { IssueStatus } from "../../packages/issues/model";
import {
  LotionError,
  editLabels,
  resolveStatus,
  workingStatus,
  type IssueClient,
  type IssueInput,
} from "../cli/issues-client";

/**
 * A Model Context Protocol server for the Lotion issue tracker (ADR-026
 * stage 3): newline-delimited JSON-RPC 2.0 over stdio with the tools below.
 * `handle` is pure transport-free logic, so tests call it directly.
 */

const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Json = Record<string, unknown>;
type Request = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Json;
};
type Response = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

const num = {
  type: "integer",
  minimum: 1,
  description: "Issue number, e.g. 12 for #12",
};
const status = {
  type: "string",
  description:
    "Status key or name, e.g. backlog, todo, doing / In progress, done",
};
const priority = {
  type: "string",
  enum: ["none", "low", "medium", "high", "urgent"],
};

export const TOOLS = [
  {
    name: "list_issues",
    description:
      "List issues on the board (without their notes), optionally filtered. Returns statuses and issue summaries in board order.",
    inputSchema: {
      type: "object",
      properties: {
        status,
        label: { type: "string" },
        priority,
        query: {
          type: "string",
          description: "Text in title or body, or #number",
        },
      },
    },
  },
  {
    name: "get_issue",
    description: "One issue with its body and the full thread of status notes.",
    inputSchema: {
      type: "object",
      properties: { number: num },
      required: ["number"],
    },
  },
  {
    name: "create_issue",
    description:
      "Create an issue (at the end of its column; first column by default).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string", description: "Markdown" },
        status,
        labels: { type: "array", items: { type: "string" } },
        priority,
      },
      required: ["title"],
    },
  },
  {
    name: "update_issue",
    description:
      "Change title, body, labels (replace, or add/remove with add_labels/remove_labels), priority or status.",
    inputSchema: {
      type: "object",
      properties: {
        number: num,
        title: { type: "string" },
        body: { type: "string" },
        labels: { type: "array", items: { type: "string" } },
        add_labels: { type: "array", items: { type: "string" } },
        remove_labels: { type: "array", items: { type: "string" } },
        priority,
        status,
      },
      required: ["number"],
    },
  },
  {
    name: "move_issue",
    description:
      "Move an issue to a status column; optionally before another issue of that column. Adds a status note.",
    inputSchema: {
      type: "object",
      properties: {
        number: num,
        status,
        before: {
          ...num,
          description: "Place before this issue (same column)",
        },
      },
      required: ["number", "status"],
    },
  },
  {
    name: "add_note",
    description:
      "Add a status note (progress, findings, next step) to an issue.",
    inputSchema: {
      type: "object",
      properties: { number: num, text: { type: "string" } },
      required: ["number", "text"],
    },
  },
  {
    name: "claim_issue",
    description: "Start work: move to In progress and note who claimed it.",
    inputSchema: {
      type: "object",
      properties: { number: num },
      required: ["number"],
    },
  },
  {
    name: "close_issue",
    description:
      "Move an issue to the last column (Done), with an optional closing note.",
    inputSchema: {
      type: "object",
      properties: { number: num, note: { type: "string" } },
      required: ["number"],
    },
  },
] as const;

function str(args: Json, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}
function int(args: Json, key: string): number {
  const value = Number(args[key]);
  if (!Number.isSafeInteger(value) || value < 1)
    throw new LotionError(`${key} must be an issue number`, 400);
  return value;
}
const list = (args: Json, key: string) =>
  Array.isArray(args[key]) ? (args[key] as unknown[]).map(String) : undefined;

export function createMcpServer(
  api: IssueClient,
  author: string,
  version: string,
) {
  let statuses: IssueStatus[] | null = null;
  const known = async () => (statuses ??= (await api.board()).statuses);

  async function callTool(name: string, args: Json): Promise<unknown> {
    switch (name) {
      case "list_issues": {
        const s = str(args, "status");
        return api.board({
          status: s ? resolveStatus(await known(), s) : undefined,
          label: str(args, "label"),
          priority: str(args, "priority"),
          q: str(args, "query"),
        });
      }
      case "get_issue":
        return api.get(int(args, "number"));
      case "create_issue": {
        const input: IssueInput = { title: str(args, "title") ?? "" };
        if (typeof args.body === "string") input.body = args.body;
        const s = str(args, "status");
        if (s) input.status = resolveStatus(await known(), s);
        const labels = list(args, "labels");
        if (labels) input.labels = editLabels([], labels);
        if (str(args, "priority")) input.priority = str(args, "priority");
        return api.create(input);
      }
      case "update_issue": {
        const n = int(args, "number");
        const input: IssueInput = {};
        if (str(args, "title")) input.title = str(args, "title");
        if (typeof args.body === "string") input.body = args.body;
        if (str(args, "priority")) input.priority = str(args, "priority");
        const s = str(args, "status");
        if (s) input.status = resolveStatus(await known(), s);
        const replace = list(args, "labels");
        const add = list(args, "add_labels") ?? [];
        const remove = list(args, "remove_labels") ?? [];
        if (replace || add.length || remove.length) {
          const current = replace ?? (await api.get(n)).labels;
          input.labels = editLabels(current, [
            ...add.map((l) => `+${l}`),
            ...remove.map((l) => `-${l}`),
          ]);
        }
        if (!Object.keys(input).length)
          throw new LotionError("Nothing to update", 400);
        return api.patch(n, input);
      }
      case "move_issue": {
        const before =
          args.before === undefined ? undefined : int(args, "before");
        return api.move(
          int(args, "number"),
          resolveStatus(await known(), str(args, "status") ?? ""),
          before,
        );
      }
      case "add_note":
        return api.note(int(args, "number"), str(args, "text") ?? "");
      case "claim_issue": {
        const n = int(args, "number");
        const target = workingStatus(await known());
        if ((await api.get(n)).status !== target) await api.move(n, target);
        return api.note(n, `Claimed by ${author}`);
      }
      case "close_issue": {
        const n = int(args, "number");
        const last = (await known()).at(-1)!.key;
        let issue = await api.move(n, last);
        const note = str(args, "note");
        if (note) issue = await api.note(n, note);
        return issue;
      }
      default:
        throw new LotionError(`Unknown tool: ${name}`, 404);
    }
  }

  /** One JSON-RPC message in, the reply out (null for notifications). */
  async function handle(message: Request): Promise<Response | null> {
    const id = message.id ?? null;
    const reply = (result: unknown): Response => ({
      jsonrpc: "2.0",
      id,
      result,
    });
    const fail = (code: number, text: string): Response => ({
      jsonrpc: "2.0",
      id,
      error: { code, message: text },
    });
    if (message.id === undefined) return null; // notifications need no reply
    switch (message.method) {
      case "initialize": {
        const asked = String(message.params?.protocolVersion ?? "");
        return reply({
          protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "lotion-issues", version },
          instructions:
            "Lotion issue tracker. Use list_issues to see the board, get_issue for notes, add_note to report progress, claim_issue before working on an issue and close_issue when done.",
        });
      }
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: TOOLS });
      case "tools/call": {
        const params = message.params ?? {};
        try {
          const result = await callTool(
            String(params.name ?? ""),
            (params.arguments as Json) ?? {},
          );
          return reply({
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            isError: false,
          });
        } catch (error) {
          return reply({
            content: [{ type: "text", text: (error as Error).message }],
            isError: true,
          });
        }
      }
      default:
        return fail(-32601, `Method not found: ${message.method}`);
    }
  }

  return { handle };
}

/** Reads newline-delimited JSON-RPC from a stream and writes replies. */
export async function serve(
  input: AsyncIterable<string | Buffer>,
  write: (line: string) => void,
  handle: (message: Request) => Promise<Response | null>,
) {
  let buffer = "";
  for await (const chunk of input) {
    buffer += chunk.toString();
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let message: Request;
      try {
        message = JSON.parse(line);
      } catch {
        write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error" },
          }),
        );
        continue;
      }
      const response = await handle(message);
      if (response) write(JSON.stringify(response));
    }
  }
}
