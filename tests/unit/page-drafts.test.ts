import { describe, expect, it } from "vitest";
import {
  saveDraftsOrThrow,
  without,
  type Draft,
} from "../../apps/web/page-drafts";

const draft = (after: string) => {
  const d: Draft & { flushed: number } = {
    status: "Unsaved",
    flushed: 0,
    async flush() {
      d.flushed++;
      d.status = after;
    },
  };
  return d;
};

describe("page drafts", () => {
  it("saves the named drafts and passes when they are saved", async () => {
    const a = draft("Saved");
    const b = draft("Saved");
    const drafts = new Map([
      ["a", a],
      ["b", b],
    ]);
    await saveDraftsOrThrow(drafts, ["a", "missing"], "stop");
    expect(a.flushed).toBe(1);
    expect(b.flushed).toBe(0);
  });

  it("throws the message when a draft stays unsaved", async () => {
    const drafts = new Map([["a", draft("Conflict")]]);
    await expect(
      saveDraftsOrThrow(drafts, ["a"], "Resolve it"),
    ).rejects.toThrow("Resolve it");
  });

  it("without returns a new set lacking the id", () => {
    const set = new Set(["x", "y"]);
    const next = without(set, "x");
    expect([...next]).toEqual(["y"]);
    expect(set.has("x")).toBe(true);
  });
});
