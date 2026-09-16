import { api } from "./api";
import type { Document } from "../../packages/document-schema/index";
import type { SaveCoordinator } from "./save-coordinator";

type ConflictActionsOptions = {
  coordinator: SaveCoordinator;
  title: string;
  refresh: () => Promise<unknown>;
  openPage: (id: string) => Promise<void>;
  handleError: (error: unknown) => void;
};
export function useConflictActions({
  coordinator,
  title,
  refresh,
  openPage,
  handleError,
}: ConflictActionsOptions) {
  async function saveCopy() {
    try {
      const copy = await api<Document>("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          title: title + " (recovered copy)",
          mutationId: crypto.randomUUID(),
        }),
      });
      await api(`/api/documents/${copy.id}/content`, {
        method: "PUT",
        headers: { "If-Match": "1" },
        body: JSON.stringify({
          ...coordinator.content,
          title: title + " (recovered copy)",
          mutationId: crypto.randomUUID(),
        }),
      });
      if (coordinator.remote) await coordinator.resolve("server");
      await refresh();
      await openPage(copy.id);
    } catch (error) {
      handleError(error);
    }
  }
  return { saveCopy };
}
