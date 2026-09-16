import { useMemo, type Dispatch, type SetStateAction } from "react";
import {
  ChevronsUpDown,
  Search,
  Home,
  Star,
  Plus,
  ArrowUpFromLine,
  Trash2,
  Moon,
  Sun,
  Settings2,
  CircleHelp,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { TreeNode, Content } from "../../packages/document-schema/index";
import type { ThemeMode } from "./preferences";

type WorkspaceSidebarProps = {
  activeId: string | undefined;
  trash: boolean;
  visible: TreeNode[];
  favorites: string[];
  collapsed: Set<string>;
  setCollapsed: Dispatch<SetStateAction<Set<string>>>;
  treeLimit: number;
  setTreeLimit: Dispatch<SetStateAction<number>>;
  theme: "light" | "dark";
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  deletedCount: number;
  draftFor: (id: string) => Pick<Content, "title" | "icon"> | undefined;
  openPage: (id: string) => Promise<void>;
  create: (parentId?: string | null) => Promise<void>;
  mutate: (
    id: string,
    action: "move",
    options: Record<string, unknown>,
  ) => Promise<void>;
  toggleFavorite: (id: string) => void;
  setSearch: (open: boolean) => void;
  setDialog: (dialog: "import" | "settings" | "help") => void;
  onHome: () => void;
  onTrash: () => void;
};

export function WorkspaceSidebar({
  activeId,
  trash,
  visible,
  favorites,
  collapsed,
  setCollapsed,
  treeLimit,
  setTreeLimit,
  theme,
  themeMode,
  setThemeMode,
  deletedCount,
  draftFor,
  openPage,
  create,
  mutate,
  toggleFavorite,
  setSearch,
  setDialog,
  onHome,
  onTrash,
}: WorkspaceSidebarProps) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, TreeNode[]>();
    for (const node of visible) {
      const siblings = map.get(node.parentId) ?? [];
      siblings.push(node);
      map.set(node.parentId, siblings);
    }
    return map;
  }, [visible]);
  const roots = childrenByParent.get(null) ?? [];
  function pageLink(node: TreeNode) {
    return (
      <a
        className="page-open"
        href={`#/page/${node.id}`}
        draggable={false}
        aria-current={activeId === node.id && !trash ? "page" : undefined}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          void openPage(node.id);
        }}
      >
        <span className="page-tree-icon" aria-hidden="true">
          {draftFor(node.id)?.icon || node.icon || "📄"}
        </span>
        <span>{draftFor(node.id)?.title || node.title || "Untitled"}</span>
      </a>
    );
  }
  function pageRow(node: TreeNode, depth = 0) {
    const children = childrenByParent.get(node.id) ?? [],
      isCollapsed = collapsed.has(node.id);
    return (
      <div key={node.id}>
        <div
          className={`page-row ${activeId === node.id && !trash ? "active" : ""}`}
          style={{ paddingLeft: 12 + depth * 16 }}
          draggable
          onDragStart={(e) =>
            e.dataTransfer.setData("application/lotion-page", node.id)
          }
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("application/lotion-page")) {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect(),
                ratio = (e.clientY - rect.top) / rect.height;
              e.currentTarget.dataset.dropMode =
                ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
              e.currentTarget.classList.add("drag-target");
            }
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("drag-target");
            delete e.currentTarget.dataset.dropMode;
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("drag-target");
            const id = e.dataTransfer.getData("application/lotion-page");
            const mode = e.currentTarget.dataset.dropMode;
            delete e.currentTarget.dataset.dropMode;
            if (id && id !== node.id) {
              if (mode === "inside")
                void mutate(id, "move", { parentId: node.id });
              else {
                const siblings = childrenByParent.get(node.parentId) ?? [],
                  index = siblings.findIndex((item) => item.id === node.id);
                const beforeId =
                  mode === "after" ? siblings[index + 1]?.id : node.id;
                void mutate(id, "move", { parentId: node.parentId, beforeId });
              }
            }
          }}
        >
          <button
            className={`tree-toggle ${children.length ? "" : "no-children"}`}
            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.title || "Untitled"}`}
            onClick={() =>
              setCollapsed((previous) => {
                const next = new Set(previous);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
              })
            }
          >
            {isCollapsed ? (
              <ChevronRight size={13} />
            ) : (
              <ChevronDown size={13} />
            )}
          </button>
          {pageLink(node)}
          <button
            className="row-add"
            aria-label={`Add child to ${node.title || "Untitled"}`}
            onClick={() => void create(node.id)}
          >
            <Plus size={13} />
          </button>
        </div>
        {!isCollapsed &&
          children
            .slice(0, treeLimit)
            .map((child) => pageRow(child, depth + 1))}
        {!isCollapsed && children.length > treeLimit && (
          <button
            className="add-page"
            onClick={() => setTreeLimit((n) => n + 100)}
          >
            Show more subpages
          </button>
        )}
      </div>
    );
  }

  return (
    <aside className="sidebar">
      <div className="workspace">
        <div className="brand-mark">
          l<span>.</span>
        </div>
        <div>
          <strong>Lotion</strong>
          <span>Personal workspace</span>
        </div>
        <ChevronsUpDown size={14} className="muted" />
      </div>
      <div className="sidebar-primary">
        <button onClick={() => setSearch(true)}>
          <Search size={16} />
          Search<span className="keycap">⌘ K</span>
        </button>
        <button onClick={onHome}>
          <Home size={16} />
          Home
        </button>
      </div>
      {favorites.some((id) => visible.some((node) => node.id === id)) && (
        <>
          <div className="section-label">
            <span>FAVORITES</span>
          </div>
          <nav className="favorite-pages" aria-label="Favorites">
            {favorites.map((id) => {
              const node = visible.find((item) => item.id === id);
              return node ? (
                <div className="page-row" key={id}>
                  {pageLink(node)}
                  <button
                    aria-label={`Remove ${node.title || "Untitled"} from favorites`}
                    onClick={() => toggleFavorite(id)}
                  >
                    <Star size={13} fill="currentColor" />
                  </button>
                </div>
              ) : null;
            })}
          </nav>
        </>
      )}
      <div className="section-label">
        <span>YOUR PAGES</span>
        <button aria-label="New page" onClick={() => void create()}>
          <Plus size={16} />
        </button>
      </div>
      <nav className="page-tree" aria-label="Pages">
        {roots.slice(0, treeLimit).map((n) => pageRow(n))}
        {roots.length > treeLimit && (
          <button
            className="add-page"
            onClick={() => setTreeLimit((n) => n + 100)}
          >
            Show more pages
          </button>
        )}
        {!roots.length && (
          <p className="tree-empty">A little space for your next idea.</p>
        )}
        <button className="add-page" onClick={() => void create()}>
          <Plus size={15} />
          Add a page
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="local-note">
          <span className="local-dot" />
          Stored in your workspace<span>Only yours.</span>
        </div>
        <button onClick={() => setDialog("import")}>
          <ArrowUpFromLine size={15} />
          Import
        </button>
        <button onClick={onTrash}>
          <Trash2 size={15} />
          Trash
          <span className="count">{deletedCount || ""}</span>
        </button>
        <button
          onClick={() =>
            setThemeMode(
              themeMode === "system"
                ? "light"
                : themeMode === "light"
                  ? "dark"
                  : "system",
            )
          }
        >
          {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
          Appearance<span className="mode">{themeMode}</span>
        </button>
        <button onClick={() => setDialog("settings")}>
          <Settings2 size={15} />
          Control panel
        </button>
        <button onClick={() => setDialog("help")}>
          <CircleHelp size={15} />
          Help & shortcuts
        </button>
        <div className="sidebar-footer">
          <span>MADE FOR YOUR MIND</span>
          <span>↗</span>
        </div>
      </div>
    </aside>
  );
}
