import { expect, it } from "vitest";
import {
  editorFonts,
  readBoolean,
  readChoice,
} from "../../apps/web/preferences";

function memoryStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

it("reads supported choices and rejects stale preference values", () => {
  expect(
    readChoice(
      memoryStorage({ "lotion-page-width": "wide" }),
      "page-width",
      ["comfortable", "wide"],
      "comfortable",
    ),
  ).toBe("wide");
  expect(
    readChoice(
      memoryStorage({ "lotion-page-width": "unsupported" }),
      "page-width",
      ["comfortable", "wide"],
      "comfortable",
    ),
  ).toBe("comfortable");
});

it("reads boolean preferences without treating arbitrary strings as true", () => {
  expect(
    readBoolean(
      memoryStorage({ "lotion-sidebar-on-start": "false" }),
      "sidebar-on-start",
      true,
    ),
  ).toBe(false);
  expect(
    readBoolean(
      memoryStorage({ "lotion-sidebar-on-start": "later" }),
      "sidebar-on-start",
      true,
    ),
  ).toBe(true);
});

it("accepts only supported workspace fonts", () => {
  expect(
    readChoice(
      memoryStorage({ "lotion-editor-font": "serif" }),
      "editor-font",
      editorFonts,
      "dm-sans",
    ),
  ).toBe("serif");
  expect(
    readChoice(
      memoryStorage({ "lotion-editor-font": "Comic Sans" }),
      "editor-font",
      editorFonts,
      "dm-sans",
    ),
  ).toBe("dm-sans");
});
