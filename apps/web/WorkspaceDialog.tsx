import type { Dispatch, DragEvent, SetStateAction } from "react";
import { ArrowLeft, FileText, LockKeyhole, Search, X } from "lucide-react";
import type { TreeNode } from "../../packages/document-schema/index";
import type { FormattingShortcuts } from "./format-shortcuts";
import type { EditorTextSize, PageWidth, ThemeMode } from "./preferences";
import { ExportPanel } from "./ExportPanel";
import { HelpPanel } from "./HelpPanel";
import { ImportPanel } from "./ImportPanel";
import { MovePagePanel } from "./MovePagePanel";
import { SettingsPanel } from "./SettingsPanel";
import type { ImportMode, WorkspaceDialogKind } from "./workspace.types";

type WorkspaceDialogProps = {
  dialog: WorkspaceDialogKind | null;
  search: boolean;
  auth: boolean;
  token: string;
  setToken: (token: string) => void;
  onUnlock: () => void;
  query: string;
  setQuery: (query: string) => void;
  visible: TreeNode[];
  openPage: (id: string) => Promise<void>;
  close: () => void;
  busy: boolean;
  dropFolder: (event: DragEvent) => Promise<void>;
  chooseFolder: () => void;
  chooseFiles: () => void;
  importMode: ImportMode;
  setImportMode: (mode: ImportMode) => void;
  activeId: string | undefined;
  title: string;
  copyPageMarkdown: () => Promise<void>;
  exportWorkspace: (rootId?: string, portable?: boolean) => Promise<void>;
  movePage: (parentId: string | null) => void;
  themeMode: ThemeMode;
  setThemeMode: Dispatch<SetStateAction<ThemeMode>>;
  editorTextSize: EditorTextSize;
  setEditorTextSize: Dispatch<SetStateAction<EditorTextSize>>;
  pageWidth: PageWidth;
  setPageWidth: Dispatch<SetStateAction<PageWidth>>;
  sidebarOnStart: boolean;
  setSidebarOnStart: Dispatch<SetStateAction<boolean>>;
  formattingShortcuts: FormattingShortcuts;
  setFormattingShortcuts: Dispatch<SetStateAction<FormattingShortcuts>>;
};

export function WorkspaceDialog(props: WorkspaceDialogProps) {
  const { dialog, search, auth } = props;
  if (!dialog && !search && !auth) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !auth) props.close();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={
          auth
            ? "Unlock workspace"
            : search
              ? "Find a page"
              : dialog === "settings"
                ? "Control panel"
                : (dialog ?? "Dialog")
        }
      >
        <button
          className="modal-close icon-button"
          aria-label="Close dialog"
          onClick={props.close}
        >
          <X size={19} />
        </button>
        {auth ? (
          <>
            <LockKeyhole size={28} />
            <h2>Your private workspace</h2>
            <p>Enter the workspace token configured on your server.</p>
            <input
              type="password"
              autoFocus
              aria-label="Workspace token"
              value={props.token}
              onChange={(event) => props.setToken(event.target.value)}
            />
            <button className="primary" onClick={props.onUnlock}>
              Unlock
            </button>
          </>
        ) : search ? (
          <>
            <div className="search-input">
              <Search size={20} />
              <input
                autoFocus
                aria-label="Search pages"
                placeholder="Find a page…"
                value={props.query}
                onChange={(event) => props.setQuery(event.target.value)}
              />
            </div>
            <div className="search-results">
              {props.visible
                .filter((node) =>
                  node.title.toLowerCase().includes(props.query.toLowerCase()),
                )
                .map((node) => (
                  <button
                    key={node.id}
                    onClick={() => void props.openPage(node.id)}
                  >
                    <FileText size={17} />
                    {node.title || "Untitled"}
                    <ArrowLeft size={14} />
                  </button>
                ))}
            </div>
          </>
        ) : dialog === "import" ? (
          <ImportPanel
            busy={props.busy}
            dropFolder={props.dropFolder}
            chooseFolder={props.chooseFolder}
            chooseFiles={props.chooseFiles}
            importMode={props.importMode}
            setImportMode={props.setImportMode}
          />
        ) : dialog === "export" ? (
          <ExportPanel
            busy={props.busy}
            activeId={props.activeId}
            pageCount={props.visible.length}
            title={props.title}
            copyPageMarkdown={props.copyPageMarkdown}
            exportWorkspace={props.exportWorkspace}
          />
        ) : dialog === "move" ? (
          <MovePagePanel
            activeId={props.activeId}
            visible={props.visible}
            onMove={props.movePage}
          />
        ) : dialog === "settings" ? (
          <SettingsPanel
            themeMode={props.themeMode}
            setThemeMode={props.setThemeMode}
            editorTextSize={props.editorTextSize}
            setEditorTextSize={props.setEditorTextSize}
            pageWidth={props.pageWidth}
            setPageWidth={props.setPageWidth}
            sidebarOnStart={props.sidebarOnStart}
            setSidebarOnStart={props.setSidebarOnStart}
            formattingShortcuts={props.formattingShortcuts}
            setFormattingShortcuts={props.setFormattingShortcuts}
          />
        ) : (
          <HelpPanel />
        )}
      </section>
    </div>
  );
}
