import type { RefObject } from "react";
import type {
  Block,
  Document,
  LinkPreview,
  TreeNode,
} from "../../packages/document-schema/index";
import type { FormattingShortcuts } from "./format-shortcuts";
import type { SaveCoordinator } from "./save-coordinator";
import { ConflictPanel } from "./ConflictPanel";
import Editor from "./Editor";
import { PageIconPicker } from "./PageIconPicker";

type ActiveDocumentProps = {
  active: Document;
  coordinator: SaveCoordinator;
  title: string;
  theme: "light" | "dark";
  formattingShortcuts: FormattingShortcuts;
  pages: TreeNode[];
  iconPicker: boolean;
  iconQuery: string;
  iconPickerRef: RefObject<HTMLDivElement | null>;
  titleInputRef: RefObject<HTMLInputElement | null>;
  onToggleIconPicker: () => void;
  onIconQuery: (query: string) => void;
  onChooseIcon: (emoji: string) => void;
  onTitleChange: (title: string) => void;
  refresh: () => Promise<unknown>;
  openPage: (id: string) => Promise<void>;
  handleError: (error: unknown) => void;
  createSubpage: () => Promise<Document>;
  copyBlockLink: (blockId: string) => Promise<void>;
  onLinkPreview: (url: string, preview: LinkPreview) => void;
  onBlocksChange: (blocks: Block[]) => void;
  onBackgroundImage: (id: string, url: string, name: string) => void;
};

export function ActiveDocument({
  active,
  coordinator,
  title,
  theme,
  formattingShortcuts,
  pages,
  iconPicker,
  iconQuery,
  iconPickerRef,
  titleInputRef,
  onToggleIconPicker,
  onIconQuery,
  onChooseIcon,
  onTitleChange,
  refresh,
  openPage,
  handleError,
  createSubpage,
  copyBlockLink,
  onLinkPreview,
  onBlocksChange,
  onBackgroundImage,
}: ActiveDocumentProps) {
  return (
    <article className="document">
      <div className="page-topline">
        <button
          className="document-icon"
          aria-label="Change page icon"
          onClick={onToggleIconPicker}
        >
          {coordinator.content.icon || active.icon || "📄"}
        </button>
        <span className="document-kind">PERSONAL PAGE</span>
      </div>
      {iconPicker && (
        <PageIconPicker
          iconQuery={iconQuery}
          setIconQuery={onIconQuery}
          iconPickerRef={iconPickerRef}
          onChoose={onChooseIcon}
        />
      )}
      <input
        className="document-title"
        aria-label="Page title"
        ref={titleInputRef}
        value={title}
        placeholder="Untitled"
        onChange={(event) => onTitleChange(event.target.value)}
      />
      <div className="document-meta">
        <span>In your workspace</span>
        <span>·</span>
        <span>
          {new Date(active.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span className="meta-line" />
      </div>
      <ConflictPanel
        coordinator={coordinator}
        title={title}
        refresh={refresh}
        openPage={openPage}
        handleError={handleError}
      />
      <Editor
        initial={coordinator.content}
        theme={theme}
        formattingShortcuts={formattingShortcuts}
        pages={pages}
        onCreateSubpage={createSubpage}
        onCopyBlockLink={copyBlockLink}
        onOpenPage={(id) => void openPage(id)}
        onLinkPreview={onLinkPreview}
        onChange={onBlocksChange}
        onBackgroundImage={onBackgroundImage}
      />
      <div className="document-bottom">
        <span>✧</span> A place for ideas to become something.
      </div>
    </article>
  );
}
