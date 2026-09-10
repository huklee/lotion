import type { Content, Document } from "../../packages/document-schema/index";
export type SaveStatus =
  "Saved" | "Unsaved" | "Saving" | "Offline draft" | "Conflict" | "Save failed";
export type Checkpoint = {
  content: Content;
  revision: number;
  generation: number;
  mutationId?: string;
};
type Dependencies = {
  save: (
    revision: number,
    content: Content,
    mutationId: string,
  ) => Promise<Document>;
  checkpoint: (draft: Checkpoint | null) => Promise<void>;
  changed: () => void;
  committed?: (doc: Document) => void;
};
export class SaveCoordinator {
  status: SaveStatus = "Saved";
  error = "";
  content: Content;
  revision: number;
  generation = 0;
  private savedGeneration = 0;
  private debounce?: ReturnType<typeof setTimeout>;
  private maxWait?: ReturnType<typeof setTimeout>;
  private retry?: ReturnType<typeof setTimeout>;
  private inFlight?: Promise<void>;
  private pending?: {
    revision: number;
    content: Content;
    mutationId: string;
    generation: number;
  };
  private draftQueue = Promise.resolve();
  private failures = 0;
  constructor(
    doc: Document,
    private deps: Dependencies,
  ) {
    this.content = { title: doc.title, icon: doc.icon, blocks: doc.blocks, linkPreviews: doc.linkPreviews };
    this.revision = doc.revision;
  }
  private checkpoint(draft: Checkpoint | null) {
    this.draftQueue = this.draftQueue
      .then(() => this.deps.checkpoint(draft))
      .catch(() => {
        this.error =
          "Browser draft storage is unavailable. Keep this tab open until saved.";
        this.deps.changed();
      });
  }
  edit(content: Content) {
    this.content = content;
    this.generation++;
    if (this.status !== "Conflict") this.status = "Unsaved";
    this.checkpoint({
      content: structuredClone(content),
      revision: this.revision,
      generation: this.generation,
    });
    this.deps.changed();
    if (this.status === "Conflict") return;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.flush(), 3000);
    this.maxWait ??= setTimeout(() => void this.flush(), 10000);
  }
  recover(draft: Checkpoint) {
    this.content = draft.content;
    this.generation = draft.generation || 1;
    this.status = draft.revision === this.revision ? "Unsaved" : "Conflict";
    if (this.status === "Unsaved") this.edit(draft.content);
    else this.deps.changed();
  }
  async flush(): Promise<void> {
    clearTimeout(this.debounce);
    clearTimeout(this.maxWait);
    clearTimeout(this.retry);
    this.debounce = undefined;
    this.maxWait = undefined;
    if (this.inFlight) {
      await this.inFlight;
      if (
        this.generation !== this.savedGeneration &&
        this.status !== "Conflict" &&
        this.status !== "Save failed" &&
        this.status !== "Offline draft"
      )
        await this.flush();
      return;
    }
    if (this.generation === this.savedGeneration || this.status === "Conflict")
      return;
    const snapshot = this.pending ?? {
      revision: this.revision,
      content: structuredClone(this.content),
      mutationId: crypto.randomUUID(),
      generation: this.generation,
    };
    this.pending = snapshot;
    this.status = "Saving";
    this.deps.changed();
    this.inFlight = (async () => {
      try {
        const doc = await this.deps.save(
          snapshot.revision,
          snapshot.content,
          snapshot.mutationId,
        );
        this.revision = doc.revision;
        this.savedGeneration = snapshot.generation;
        this.pending = undefined;
        this.failures = 0;
        this.error = "";
        this.deps.committed?.(doc);
        this.status =
          this.generation === this.savedGeneration ? "Saved" : "Unsaved";
        this.checkpoint(
          this.status === "Saved"
            ? null
            : {
                content: structuredClone(this.content),
                revision: this.revision,
                generation: this.generation,
              },
        );
      } catch (error: any) {
        this.error = error.message;
        this.status =
          error.status === 412 || error.status === 409
            ? "Conflict"
            : error.status && error.status < 500
              ? "Save failed"
              : "Offline draft";
        if (this.status === "Save failed") this.pending = undefined;
        if (this.status === "Offline draft")
          this.retry = setTimeout(
            () => void this.flush(),
            Math.min(30000, 1000 * 2 ** this.failures++) + Math.random() * 250,
          );
      } finally {
        this.inFlight = undefined;
        this.deps.changed();
        if (this.status === "Unsaved")
          this.debounce = setTimeout(() => void this.flush(), 0);
      }
    })();
    await this.inFlight;
  }
  dispose() {
    clearTimeout(this.debounce);
    clearTimeout(this.maxWait);
    clearTimeout(this.retry);
  }
}
