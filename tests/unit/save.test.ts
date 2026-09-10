import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveCoordinator } from "../../apps/web/save-coordinator";
import type { Content, Document } from "../../packages/document-schema/index";
type Save = (
  revision: number,
  content: Content,
  mutationId: string,
) => Promise<Document>;
const doc: Document = {
  schemaVersion: 1,
  id: "doc",
  revision: 1,
  title: "First",
  blocks: [{ id: "a", type: "paragraph", content: [] }],
  parentId: null,
  position: "a0",
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
};
let coordinators: SaveCoordinator[] = [];
function setup(save = vi.fn<Save>(async () => ({ ...doc, revision: 2 }))) {
  const checkpoint = vi.fn(async () => {}),
    changed = vi.fn();
  const c = new SaveCoordinator(doc, { save, checkpoint, changed });
  coordinators.push(c);
  return { c, save, checkpoint };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  coordinators.forEach((c) => c.dispose());
  coordinators = [];
  vi.useRealTimers();
});
describe("save coordination", () => {
  it("allows corrected content after a validation failure", async () => {
    const save = vi
      .fn<Save>()
      .mockRejectedValueOnce(
        Object.assign(new Error("Invalid content"), { status: 400 }),
      )
      .mockResolvedValue({ ...doc, revision: 2 });
    const { c } = setup(save);
    c.edit({ ...c.content, title: "Invalid" });
    await c.flush();
    expect(c.status).toBe("Save failed");
    c.edit({ ...c.content, title: "Corrected" });
    await c.flush();
    expect(save.mock.calls[1][1].title).toBe("Corrected");
    expect(c.status).toBe("Saved");
  });
  it("debounces content changes for three seconds", async () => {
    const { c, save } = setup();
    c.edit({ ...c.content, title: "A" });
    await vi.advanceTimersByTimeAsync(2000);
    c.edit({ ...c.content, title: "AB" });
    await vi.advanceTimersByTimeAsync(2999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1].title).toBe("AB");
    expect(c.status).toBe("Saved");
  });
  it("saves within ten seconds of continuous typing", async () => {
    const { c, save } = setup();
    for (let i = 0; i < 10; i++) {
      c.edit({ ...c.content, title: String(i) });
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("does not save an unchanged document", async () => {
    const { c, save } = setup();
    await c.flush();
    expect(save).not.toHaveBeenCalled();
  });
  it("late acknowledgment never marks newer edits saved", async () => {
    let resolve!: (doc: Document) => void;
    const save = vi.fn<Save>(() => new Promise<Document>((r) => (resolve = r)));
    const { c } = setup(save);
    c.edit({ ...c.content, title: "A" });
    const first = c.flush();
    c.edit({ ...c.content, title: "B" });
    resolve({ ...doc, title: "A", revision: 2 });
    await first;
    expect(c.status).toBe("Unsaved");
    expect(c.content.title).toBe("B");
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toBe(2);
    resolve({ ...doc, title: "B", revision: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(c.status).toBe("Saved");
  });
  it("preserves a draft and stops retries on a conflict", async () => {
    const save = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("Conflict"), { status: 412 }));
    const { c, checkpoint } = setup(save);
    c.edit({ ...c.content, title: "Mine" });
    await c.flush();
    await vi.advanceTimersByTimeAsync(30000);
    expect(c.status).toBe("Conflict");
    expect(save).toHaveBeenCalledTimes(1);
    expect(checkpoint).not.toHaveBeenCalledWith(null);
    c.edit({ ...c.content, title: "Still mine" });
    await c.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("retries the same mutation and immutable payload after a network error", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue({ ...doc, revision: 2 });
    const { c } = setup(save);
    c.edit({ ...c.content, title: "A" });
    await c.flush();
    c.edit({ ...c.content, title: "B" });
    await c.flush();
    expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
    expect(c.content.title).toBe("B");
  });
  it("recovers stale drafts as conflicts", () => {
    const { c } = setup();
    c.recover({
      content: { ...c.content, title: "Recovered" },
      revision: 0,
      generation: 5,
    });
    expect(c.status).toBe("Conflict");
    expect(c.content.title).toBe("Recovered");
  });
  it("reports checkpoint failure without preventing server save", async () => {
    const c = new SaveCoordinator(doc, {
      save: async () => ({ ...doc, revision: 2 }),
      checkpoint: async () => {
        throw new Error("Quota");
      },
      changed: () => {},
    });
    coordinators.push(c);
    c.edit({ ...c.content, title: "New" });
    await vi.advanceTimersByTimeAsync(1);
    expect(c.error).toContain("storage is unavailable");
    await c.flush();
    expect(c.status).toBe("Saved");
  });
});
