import { expect, it } from "vitest";
import { clipboardLines } from "../../apps/web/clipboard-lines";
import { contentSchema } from "../../packages/document-schema/index";

it("validates each line as plain text, preserving blanks and unsafe-looking strings", () => {
  const blocks = clipboardLines(
    "# Heading\r\n\r\n  **bold**\r<script>alert(1)</script>\n[x](javascript:alert(1))",
  );
  expect(blocks.map((b) => b.content)).toEqual(
    [
      "# Heading",
      "",
      "  **bold**",
      "<script>alert(1)</script>",
      "[x](javascript:alert(1))",
    ].map((text) => [{ type: "text", text, styles: {} }]),
  );
  expect(contentSchema.safeParse({ title: "Paste", blocks }).success).toBe(
    true,
  );
});

it("rejects an oversized paste instead of silently dropping lines", () => {
  expect(() => clipboardLines("x\n".repeat(10000))).toThrow("10,000 lines");
});
