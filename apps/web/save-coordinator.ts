import type { Content, Document } from "../../packages/document-schema/index";
import { mergeContent } from "./merge-content";
export type SaveStatus =
  "Saved" | "Unsaved" | "Saving" | "Offline draft" | "Conflict" | "Save failed";
export type Checkpoint = {
  content: Content;
  revision: number;
  generation: number;
  mutationId?: string;
  base?: Content;
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
  load?: () => Promise<Document>;
  archive?: (draft: Checkpoint) => Promise<void>;
};
export class SaveCoordinator {
  status: SaveStatus = "Saved";
  error = "";
  content: Content;
  revision: number;
  generation = 0;
  editorVersion = 0;
  base?: Content;
  remote?: Document;
  conflicts: string[] = [];
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
  private automaticReviews = 0;
  constructor(
    doc: Document,
    private deps: Dependencies,
  ) {
    this.content = {
      title: doc.title,
      icon: doc.icon,
      blocks: doc.blocks,
      linkPreviews: doc.linkPreviews,
    };
    this.revision = doc.revision;
    this.base = structuredClone(this.content);
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
      base: this.base,
    });
    this.deps.changed();
    if (this.status === "Conflict") return;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.flush(), 3000);
    this.maxWait ??= setTimeout(() => void this.flush(), 10000);
  }
  recover(draft: Checkpoint) {
    const currentRevision = this.revision;
    this.content = draft.content;
    this.generation = draft.generation || 1;
    this.base = draft.base;
    this.revision = draft.revision;
    this.status = draft.revision === currentRevision ? "Unsaved" : "Conflict";
    if (this.status === "Unsaved") this.edit(draft.content);
    else {
      this.error =
        "A recovered draft was based on an older revision. Review both versions to resolve it.";
      this.deps.changed();
    }
  }
  async review(): Promise<void> {
    if (!this.deps.load) return;
    const remote = await this.deps.load();
    this.remote = remote;
    const result = mergeContent(
      this.base,
      this.content,
      this.toContent(remote),
    );
    this.conflicts = result.conflicts;
    if (!result.conflicts.length) await this.resolve("merge");
    else this.deps.changed();
  }
  private toContent(doc: Document): Content {
    return {
      title: doc.title,
      icon: doc.icon,
      blocks: doc.blocks,
      linkPreviews: doc.linkPreviews,
    };
  }
  async resolve(choice: "merge" | "local" | "server"): Promise<void> {
    if (!this.remote || this.inFlight) return;
    const generation = this.generation;
    const local = structuredClone(this.content);
    const remote = this.remote;
    const result = mergeContent(this.base, local, this.toContent(remote));
    if (choice === "merge" && result.conflicts.length) return;
    await this.deps.archive?.({
      content: local,
      base: this.base,
      revision: this.revision,
      generation,
    });
    if (generation !== this.generation)
      throw new Error(
        "The draft changed during resolution. Please review again.",
      );
    this.pending = undefined;
    this.base = this.toContent(remote);
    this.revision = remote.revision;
    this.content =
      choice === "server"
        ? this.base
        : choice === "local"
          ? local
          : result.content;
    this.remote = undefined;
    this.conflicts = [];
    this.error = "";
    this.status = "Unsaved";
    this.editorVersion++;
    this.edit(this.content);
    await this.flush();
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
        this.base = structuredClone(snapshot.content);
        this.savedGeneration = snapshot.generation;
        this.pending = undefined;
        this.failures = 0;
        this.automaticReviews = 0;
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
                base: this.base,
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
    if (
      (this.status as SaveStatus) === "Conflict" &&
      this.deps.load &&
      !this.remote &&
      this.automaticReviews++ === 0
    ) {
      try {
        await this.review();
      } catch (error) {
        this.error = `Could not load conflict versions: ${(error as Error).message}`;
        this.deps.changed();
      }
    }
  }
  dispose() {
    clearTimeout(this.debounce);
    clearTimeout(this.maxWait);
    clearTimeout(this.retry);
  }
}
