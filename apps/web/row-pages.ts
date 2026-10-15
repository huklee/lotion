import { createContext, type ComponentType } from "react";
import type { Document, TreeNode } from "../../packages/document-schema/index";
import type { FormattingShortcuts } from "./format-shortcuts";
import type { SaveCoordinator } from "./save-coordinator";

/**
 * What a database feed needs to read row pages inline and edit them in place with
 * the same save pipeline (coordinator, drafts, conflicts) as the main editor.
 */
export type RowPages = {
  load: (id: string) => Promise<Document>;
  coordinator: (id: string) => Promise<SaveCoordinator>;
  /** Bumps whenever any coordinator's status changes. */
  version: number;
  theme: "light" | "dark";
  formattingShortcuts: FormattingShortcuts;
  pages: TreeNode[];
  openPage: (id: string) => void;
  createSubpage: (parentId: string, title?: string) => Promise<Document>;
  copyBlockLink: (pageId: string, blockId: string) => Promise<void>;
  /** Provided by the app so the database block does not import the editor (import cycle). */
  InlineEditor: ComponentType<{ pageId: string }>;
};

export const RowPagesContext = createContext<RowPages | null>(null);
