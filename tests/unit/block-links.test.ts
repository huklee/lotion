import { expect, it } from "vitest";
import {
  blockIdFromHash,
  directBlockUrl,
  pageHash,
  pageIdFromHash,
} from "../../apps/web/block-links";

it("builds and parses page and block hashes", () => {
  expect(pageHash("page-1", "block_2")).toBe("#/page/page-1#block=block_2");
  expect(pageIdFromHash("#/page/page-1#block=block_2")).toBe("page-1");
  expect(blockIdFromHash("#/page/page-1#block=block_2")).toBe("block_2");
  expect(blockIdFromHash("#/page/page-1")).toBeNull();
});

it("rejects malformed or unsafe deep-link identifiers", () => {
  expect(pageIdFromHash("#/page/a#block=bad%20id")).toBeNull();
  expect(pageIdFromHash("#/page/a#unknown=b")).toBeNull();
  expect(blockIdFromHash("https://example.com/#/page/a#block=b")).toBeNull();
});

it("creates an absolute same-application direct URL", () => {
  expect(
    directBlockUrl(
      "https://notes.example.test/lotion/?view=wide#/home",
      "page-1",
      "block-2",
    ),
  ).toBe(
    "https://notes.example.test/lotion/?view=wide#/page/page-1#block=block-2",
  );
});
