import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get, set, del } from "idb-keyval";
import emojiData from "emojibase-data/en/data.json";
const emojiCatalog = emojiData.flatMap((item) => [
  item,
  ...(item.skins ?? []).map((skin) => ({ ...skin, tags: item.tags ?? [] })),
]);
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  FileText,
  FolderOpen,
  Home,
  Menu,
  Moon,
  Plus,
  Search,
  Settings2,
  Sun,
  Trash2,
  X,
  ArrowLeft,
  Move,
  RotateCcw,
  LockKeyhole,
} from "lucide-react";
import type { Document, TreeNode } from "../../packages/document-schema/index";
import { api, ApiError, authHeaders } from "./api";
import { SaveCoordinator, type Checkpoint } from "./save-coordinator";
import Editor from "./Editor";

const sessionId =
  sessionStorage.getItem("yestion-session") ?? crypto.randomUUID();
sessionStorage.setItem("yestion-session", sessionId);
const draftKey = (id: string) => `yestion-draft:${sessionId}:${id}`;
export default function App() {
  const [tree, setTree] = useState<TreeNode[]>([]),
    [treeTag, setTreeTag] = useState(""),
    [active, setActive] = useState<Document | null>(null),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [auth, setAuth] = useState(false),
    [token, setToken] = useState("");
  const [themeMode, setThemeMode] = useState(
      localStorage.getItem("yestion-theme") ?? "system",
    ),
    [systemDark, setSystemDark] = useState(
      matchMedia("(prefers-color-scheme: dark)").matches,
    ),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(false),
    [trash, setTrash] = useState(false),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [sidebar, setSidebar] = useState(true),
    [dialog, setDialog] = useState<
      "import" | "export" | "move" | "help" | null
    >(null),
    [importMode, setImportMode] = useState<"auto" | "markdown" | "snapshot">(
      "auto",
    ),
    [notice, setNotice] = useState("");
  const [iconPicker, setIconPicker] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const coordinators = useRef(new Map<string, SaveCoordinator>()),
    loadNumber = useRef(0),
    fileInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null),
    titleInput = useRef<HTMLInputElement>(null),
    iconPickerRef = useRef<HTMLDivElement>(null),
    newId = useRef<string | null>(null);
  const theme =
    themeMode === "system"
      ? systemDark
        ? "dark"
        : "light"
      : (themeMode as "dark" | "light");
  const coordinator = active ? coordinators.current.get(active.id) : undefined;
  const visibleEmojis = useMemo(() => {
    const query = iconQuery.trim().toLocaleLowerCase();
    return emojiCatalog.filter((item) => {
      if (!item.emoji) return false;
      if (!query) return true;
      return [item.label, ...(item.tags ?? [])].some((term) =>
        term.toLocaleLowerCase().includes(query),
      );
    });
  }, [iconQuery]);
  const visible = useMemo(() => tree.filter((d) => !d.hidden), [tree]);
  const breadcrumbPages = useMemo(() => {
    if (!active) return [];
    const byId = new Map(tree.map((node) => [node.id, node]));
    const path: TreeNode[] = [];
    const seen = new Set<string>();
    let current: TreeNode | undefined =
      byId.get(active.id) ?? ({ ...active, hidden: false } as TreeNode);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      path.unshift(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return path;
  }, [active, tree]);
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
  const [treeLimit, setTreeLimit] = useState(100);
  const title = coordinator?.content.title ?? active?.title ?? "";
  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) setAuth(true);
    else setError((e as Error).message);
  }, []);
  const refresh = useCallback(async () => {
    const response = await api<{ nodes: TreeNode[]; tag: string }>("/api/tree");
    setTree(response.nodes);
    setTreeTag(response.tag);
    return response.nodes;
  }, []);
  const openPage = useCallback(
    async (id: string) => {
      const sequence = ++loadNumber.current;
      setError("");
      setTrash(false);
      setIconPicker(false);
      setIconQuery("");
      try {
        const [doc] = await Promise.all([
          api<Document>(`/api/documents/${id}`),
          refresh(),
        ]);
        if (sequence !== loadNumber.current) return;
        let save = coordinators.current.get(id);
        if (
          !save ||
          (save.status === "Saved" && save.revision !== doc.revision)
        ) {
          save?.dispose();
          save = new SaveCoordinator(doc, {
            save: (revision, content, mutationId) =>
              api<Document>(`/api/documents/${id}/content`, {
                method: "PUT",
                headers: { "If-Match": String(revision) },
                body: JSON.stringify({ ...content, mutationId }),
              }),
            checkpoint: (draft) =>
              draft ? set(draftKey(id), draft) : del(draftKey(id)),
            changed: () => setVersion((v) => v + 1),
            committed: (committed) =>
              setTree((nodes) =>
                nodes.map((node) =>
                  node.id === id
                    ? {
                        ...node,
                        revision: committed.revision,
                        updatedAt: committed.updatedAt,
                      }
                    : node,
                ),
              ),
          });
          coordinators.current.set(id, save);
          try {
            const draft = await get<Checkpoint>(draftKey(id));
            if (draft) save.recover(draft);
          } catch {
            setNotice(
              "Browser draft recovery is unavailable. Server auto-save remains active.",
            );
          }
        }
        if (sequence !== loadNumber.current) return;
        setActive(doc);
        setSearch(false);
        history.replaceState(null, "", `#/page/${id}`);
        if (newId.current === id) {
          newId.current = null;
          setTimeout(() => {
            titleInput.current?.focus();
            titleInput.current?.select();
          }, 50);
        }
      } catch (e) {
        if (sequence === loadNumber.current) handleError(e);
      }
    },
    [handleError, refresh],
  );
  useEffect(() => {
    let alive = true;
    void refresh()
      .then((nodes) => {
        if (!alive || loadNumber.current > 0) return;
        const id =
          location.hash.match(/^#\/page\/([^#]+)/)?.[1] ??
          nodes.find((n) => !n.hidden)?.id;
        if (id) void openPage(id);
      })
      .catch(handleError);
    return () => {
      alive = false;
    };
  }, [refresh, openPage, handleError]);
  useEffect(() => {
    const refreshTree = () => void refresh().catch(handleError);
    const visibleAgain = () => {
      if (document.visibilityState === "visible") refreshTree();
    };
    window.addEventListener("focus", refreshTree);
    document.addEventListener("visibilitychange", visibleAgain);
    return () => {
      window.removeEventListener("focus", refreshTree);
      document.removeEventListener("visibilitychange", visibleAgain);
    };
  }, [refresh, handleError]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("yestion-theme", themeMode);
  }, [theme, themeMode]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const changed = () => setSystemDark(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    document.title = title ? `${title} — Yestion` : "Yestion";
  }, [title]);
  useEffect(() => {
    if (!dialog && !search && !auth) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>(".modal");
    const focusable = () =>
      [
        ...(modal?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([hidden]),select,a[href]",
        ) ?? []),
      ].filter((e) => e.offsetParent !== null);
    if (!modal?.contains(document.activeElement)) focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [dialog, search, auth]);
  useEffect(() => {
    const navigate = () => {
      const id = location.hash.match(/^#\/page\/([^#]+)/)?.[1];
      if (id) void openPage(id);
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, [openPage]);
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden")
        for (const c of coordinators.current.values()) void c.flush();
    };
    document.addEventListener("visibilitychange", flush);
    const unload = (event: BeforeUnloadEvent) => {
      if (
        [...coordinators.current.values()].some((c) => c.status !== "Saved")
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  async function create(parentId: string | null = null) {
    ++loadNumber.current;
    setActive(null);
    try {
      const doc = await api<Document>("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled",
          parentId,
          mutationId: crypto.randomUUID(),
        }),
      });
      await refresh();
      newId.current = doc.id;
      await openPage(doc.id);
    } catch (e) {
      handleError(e);
    }
  }
  async function createSubpage(parentId: string) {
    try {
      const doc = await api<Document>("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled",
          parentId,
          mutationId: crypto.randomUUID(),
        }),
      });
      await refresh();
      setCollapsed((current) => {
        const next = new Set(current);
        next.delete(parentId);
        return next;
      });
      return doc;
    } catch (error) {
      handleError(error);
      throw error;
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        for (const c of coordinators.current.values()) void c.flush();
      }
      if (e.key === "Escape") {
        setDialog(null);
        setSearch(false);
        setIconPicker(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!iconPicker) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest('[aria-label="Change page icon"]') &&
        !iconPickerRef.current?.contains(target)
      )
        setIconPicker(false);
    };
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, [iconPicker]);
  async function mutate(
    id: string,
    action: "trash" | "restore" | "move",
    options: Record<string, unknown> = {},
  ) {
    try {
      const c = coordinators.current.get(id);
      await c?.flush();
      if (c && c.status !== "Saved")
        throw new Error("Resolve the unsaved draft before changing this page.");
      const nodes = await refresh();
      const node = nodes.find((n) => n.id === id)!;
      const fresh = await api<{ tag: string }>("/api/tree");
      const changed = await api<Document>(`/api/documents/${id}/${action}`, {
        method: "POST",
        headers: { "If-Match": String(node.revision) },
        body: JSON.stringify({ ...options, treeTag: fresh.tag }),
      });
      await refresh();
      if (action === "trash" && active?.id === id) {
        setActive(null);
        history.replaceState(null, "", "#");
      } else if (active?.id === id || action === "restore") {
        c?.dispose();
        coordinators.current.delete(id);
        await openPage(changed.id);
      }
      setDialog(null);
    } catch (e) {
      handleError(e);
    }
  }
  async function exportWorkspace(rootId?: string, portable = false) {
    setBusy(true);
    try {
      await Promise.all(
        [...coordinators.current.values()].map((c) => c.flush()),
      );
      if ([...coordinators.current.values()].some((c) => c.status !== "Saved"))
        throw new Error("Resolve pending saves before exporting.");
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ rootId, portable }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = "yestion-workspace.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDialog(null);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function importFiles(files: { file: File; path: string }[]) {
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      for (const item of files)
        body.append(encodeURIComponent(item.path), item.file, item.file.name);
      const result = await api<{ documents: Document[]; warnings: string[] }>(
        `/api/imports?mutationId=${crypto.randomUUID()}&mode=${importMode}`,
        { method: "POST", body },
      );
      await refresh();
      setNotice(
        result.warnings.length
          ? `Imported ${result.documents.length} pages. ${result.warnings.join(" · ")}`
          : `Imported ${result.documents.length} pages with their folder structure.`,
      );
      setDialog(null);
      if (result.documents[0]) await openPage(result.documents[0].id);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function dropFolder(event: React.DragEvent) {
    event.preventDefault();
    const items = [...event.dataTransfer.items];
    const files: { file: File; path: string }[] = [];
    async function read(entry: any, prefix = ""): Promise<void> {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          entry.file(resolve, reject),
        );
        files.push({ file, path: prefix + entry.name });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        let found = false;
        while (true) {
          const children: any[] = await new Promise((resolve, reject) =>
            reader.readEntries(resolve, reject),
          );
          if (!children.length) break;
          found = true;
          for (const child of children)
            await read(child, prefix + entry.name + "/");
        }
        if (!found)
          files.push({
            file: new File([], "directory", {
              type: "application/x-yestion-directory",
            }),
            path: prefix + entry.name + "/",
          });
      }
    }
    try {
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) await read(entry);
        else {
          const file = item.getAsFile();
          if (file) files.push({ file, path: file.name });
        }
      }
      await importFiles(files);
    } catch (e) {
      handleError(e);
    }
  }
  function pageRow(node: TreeNode, depth = 0) {
    const children = childrenByParent.get(node.id) ?? [],
      isCollapsed = collapsed.has(node.id);
    return (
      <div key={node.id}>
        <div
          className={`page-row ${active?.id === node.id && !trash ? "active" : ""}`}
          style={{ paddingLeft: 12 + depth * 16 }}
          draggable
          onDragStart={(e) =>
            e.dataTransfer.setData("application/yestion-page", node.id)
          }
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("application/yestion-page")) {
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
            const id = e.dataTransfer.getData("application/yestion-page");
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
          <button className="page-open" onClick={() => void openPage(node.id)}>
            <span className="page-tree-icon" aria-hidden="true">
              {coordinators.current.get(node.id)?.content.icon ||
                node.icon ||
                "📄"}
            </span>
            <span>
              {coordinators.current.get(node.id)?.content.title ||
                node.title ||
                "Untitled"}
            </span>
          </button>
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
  const status = coordinator?.status ?? "Saved";
  void version;
  void treeTag;
  return (
    <div className={`app ${sidebar ? "" : "sidebar-hidden"}`}>
      <aside className="sidebar">
        <div className="workspace">
          <div className="brand-mark">
            y<span>.</span>
          </div>
          <div>
            <strong>Yestion</strong>
            <span>Personal workspace</span>
          </div>
          <ChevronsUpDown size={14} className="muted" />
        </div>
        <div className="sidebar-primary">
          <button onClick={() => setSearch(true)}>
            <Search size={16} />
            Search<span className="keycap">⌘ K</span>
          </button>
          <button
            onClick={() => {
              setActive(null);
              setTrash(false);
            }}
          >
            <Home size={16} />
            Home
          </button>
        </div>
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
          <button
            onClick={() => {
              setTrash(true);
              setSearch(false);
              void refresh().catch(handleError);
            }}
          >
            <Trash2 size={15} />
            Trash
            <span className="count">
              {tree.filter((n) => n.deletedAt).length || ""}
            </span>
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
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button"
              aria-label="Toggle sidebar"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu size={17} />
            </button>
            <span className="muted">Workspace</span>
            {trash ? (
              <>
                <span className="breadcrumb-slash">/</span>
                <span>Trash</span>
              </>
            ) : breadcrumbPages.length ? (
              breadcrumbPages.map((page, index) => (
                <span className="breadcrumb-page" key={page.id}>
                  <span className="breadcrumb-slash">/</span>
                  <span aria-hidden="true">{page.icon || "📄"}</span>
                  {index < breadcrumbPages.length - 1 ? (
                    <button onClick={() => void openPage(page.id)}>
                      {page.title || "Untitled"}
                    </button>
                  ) : (
                    <span>{title || "Untitled"}</span>
                  )}
                </span>
              ))
            ) : (
              <>
                <span className="breadcrumb-slash">/</span>
                <span>Home</span>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {active && !trash && (
              <>
                <span
                  className={`save-status ${status === "Conflict" || status === "Save failed" ? "danger" : ""}`}
                  role="status"
                >
                  {status === "Saved" ? (
                    <Check size={13} />
                  ) : (
                    <span className="status-dot" />
                  )}
                  {status}
                </span>
                <button className="quiet" onClick={() => setDialog("export")}>
                  <ArrowDownToLine size={14} />
                  Export
                </button>
                <button
                  className="icon-button"
                  aria-label="Move page"
                  onClick={() => setDialog("move")}
                >
                  <Move size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Move page to trash"
                  onClick={() => void mutate(active.id, "trash")}
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
            <div className="avatar">Y</div>
          </div>
        </header>
        {error && (
          <div className="message error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}
        {notice && (
          <div className="message notice" role="status">
            {notice}
            <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className="main-scroll">
          {trash ? (
            <section className="home-content">
              <div className="eyebrow">A SECOND CHANCE</div>
              <h1>Trash</h1>
              <p className="subtitle">
                Your pages stay here until you bring them back.
              </p>
              {tree
                .filter((n) => n.deletedAt)
                .map((n) => (
                  <div className="trash-row" key={n.id}>
                    <FileText size={18} />
                    <span>{n.title || "Untitled"}</span>
                    <button
                      className="quiet"
                      onClick={() => void mutate(n.id, "restore")}
                    >
                      <RotateCcw size={14} />
                      Restore
                    </button>
                  </div>
                ))}
              {!tree.some((n) => n.deletedAt) && (
                <p className="empty-copy">
                  Nothing here. Everything is where it belongs.
                </p>
              )}
            </section>
          ) : active && coordinator ? (
            <article className="document" key={active.id}>
              <div className="page-topline">
                <button
                  className="document-icon"
                  aria-label="Change page icon"
                  onClick={() => {
                    setIconQuery("");
                    setIconPicker((open) => !open);
                  }}
                >
                  {coordinator.content.icon || active.icon || "📄"}
                </button>
                <span className="document-kind">PERSONAL PAGE</span>
              </div>
              {iconPicker && (
                <div
                  className="page-icon-picker"
                  role="dialog"
                  aria-label="Page icon picker"
                  ref={iconPickerRef}
                >
                  <input
                    autoFocus
                    aria-label="Search emojis"
                    placeholder="Search emojis…"
                    value={iconQuery}
                    onChange={(event) => setIconQuery(event.target.value)}
                  />
                  <div className="page-icon-grid">
                    {visibleEmojis.map((item) => (
                      <button
                        key={item.hexcode}
                        title={item.label}
                        aria-label={`Use ${item.emoji} ${item.label} icon`}
                        onClick={() => {
                          coordinator.edit({
                            ...coordinator.content,
                            icon: item.emoji,
                          });
                          setTree((nodes) =>
                            nodes.map((node) =>
                              node.id === active.id
                                ? { ...node, icon: item.emoji }
                                : node,
                            ),
                          );
                          setIconPicker(false);
                          setIconQuery("");
                        }}
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input
                className="document-title"
                aria-label="Page title"
                ref={titleInput}
                value={title}
                placeholder="Untitled"
                onChange={(e) => {
                  coordinator.edit({
                    ...coordinator.content,
                    title: e.target.value,
                  });
                  setTree((nodes) =>
                    nodes.map((n) =>
                      n.id === active.id ? { ...n, title: e.target.value } : n,
                    ),
                  );
                }}
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
              {coordinator.error && (
                <div className="conflict-box">
                  <p>{coordinator.error}</p>
                  {status === "Conflict" ? (
                    <>
                      <button
                        onClick={async () => {
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
                          await refresh();
                          await openPage(copy.id);
                        }}
                      >
                        Save draft as a copy
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Discard the local draft and load the server version?",
                            )
                          ) {
                            coordinator.dispose();
                            coordinators.current.delete(active.id);
                            void del(draftKey(active.id)).then(() =>
                              openPage(active.id),
                            );
                          }
                        }}
                      >
                        Reload server version
                      </button>
                    </>
                  ) : (
                    <button onClick={() => void coordinator.flush()}>
                      Retry save
                    </button>
                  )}
                </div>
              )}
              <Editor
                key={`${active.id}:${active.revision}`}
                initial={coordinator.content}
                theme={theme}
                pages={visible}
                onCreateSubpage={() => createSubpage(active.id)}
                onOpenPage={(id) => void openPage(id)}
                onLinkPreview={(url, preview) =>
                  coordinator.edit({
                    ...coordinator.content,
                    linkPreviews: {
                      ...coordinator.content.linkPreviews,
                      [url]: preview,
                    },
                  })
                }
                onChange={(blocks) =>
                  coordinator.edit({ ...coordinator.content, blocks })
                }
                onBackgroundImage={(id, url, name) => {
                  let found = false;
                  const update = (
                    blocks: Document["blocks"],
                  ): Document["blocks"] =>
                    blocks.map((block) => {
                      if (block.id === id) {
                        found = true;
                        return {
                          ...block,
                          props: { ...block.props, url, name, caption: "" },
                        };
                      }
                      return {
                        ...block,
                        children: update(block.children ?? []),
                      };
                    });
                  const blocks = update(coordinator.content.blocks);
                  if (found)
                    coordinator.edit({ ...coordinator.content, blocks });
                }}
              />
              <div className="document-bottom">
                <span>✧</span> A place for ideas to become something.
              </div>
            </article>
          ) : (
            <section className="home-content">
              <div className="eyebrow">YOUR OWN LITTLE CORNER</div>
              <h1>
                Make room for
                <br />
                <span>what’s on your mind.</span>
              </h1>
              <p className="subtitle">
                Notes, plans, half-formed ideas.
                <br />
                Keep them together. Make them yours.
              </p>
              <button className="primary" onClick={() => void create()}>
                <Plus size={17} />
                Create a page
              </button>
              <div className="home-section">
                <h2>
                  Your pages <span>{visible.length}</span>
                </h2>
                <button
                  className="quiet"
                  onClick={() => setDialog("export")}
                  disabled={!visible.length}
                >
                  Export workspace <ArrowDownToLine size={14} />
                </button>
              </div>
              <div className="page-cards">
                {roots.slice(0, 12).map((n) => (
                  <button
                    className="page-card"
                    key={n.id}
                    onClick={() => void openPage(n.id)}
                  >
                    <div className="card-icon">
                      <FileText size={23} />
                    </div>
                    <strong>{n.title || "Untitled"}</strong>
                    <span>
                      Edited{" "}
                      {new Date(n.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </button>
                ))}
                <button
                  className="page-card new-card"
                  onClick={() => void create()}
                >
                  <Plus size={24} />
                  <span>Start something new</span>
                </button>
              </div>
              <div className="home-tip">
                <FolderOpen size={20} />
                <div>
                  <strong>Your notes, at home.</strong>
                  <p>
                    Bring a whole folder of Markdown files. Your structure and
                    images come along.
                  </p>
                </div>
                <button className="quiet" onClick={() => setDialog("import")}>
                  Import <ArrowUpFromLine size={14} />
                </button>
              </div>
            </section>
          )}
        </div>
        <footer className="bottom-bar">
          <span>
            <span className="local-dot" /> LOCAL WORKSPACE
          </span>
          <span>No distractions. Just your thoughts.</span>
          <button onClick={() => setDialog("help")}>?</button>
        </footer>
      </main>
      {(dialog || search || auth) && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !auth) {
              setDialog(null);
              setSearch(false);
            }
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
                  : (dialog ?? "Dialog")
            }
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => {
                setDialog(null);
                setSearch(false);
              }}
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
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <button
                  className="primary"
                  onClick={() => {
                    sessionStorage.setItem("yestion-token", token);
                    setAuth(false);
                    void refresh().catch(handleError);
                  }}
                >
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
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="search-results">
                  {visible
                    .filter((n) =>
                      n.title.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((n) => (
                      <button key={n.id} onClick={() => void openPage(n.id)}>
                        <FileText size={17} />
                        {n.title || "Untitled"}
                        <ArrowLeft size={14} />
                      </button>
                    ))}
                </div>
              </>
            ) : dialog === "import" ? (
              <>
                <div className="modal-symbol">
                  <ArrowUpFromLine size={24} />
                </div>
                <h2>Bring your ideas along.</h2>
                <p>
                  Import Markdown, a whole folder, or a Yestion ZIP. Nested
                  pages and images stay together.
                </p>
                <div
                  className="folder-drop"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => void dropFolder(e)}
                >
                  <FolderOpen size={32} />
                  <strong>Drop a folder or files here</strong>
                  <span>Markdown · Images · ZIP · Up to 100 MB</span>
                </div>
                <div className="button-row">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => folderInput.current?.click()}
                  >
                    Choose folder
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    Choose files or ZIP
                  </button>
                </div>
                <label className="field-label">
                  When a bundle has edited Markdown
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as any)}
                  >
                    <option value="auto">
                      Detect and ask before importing
                    </option>
                    <option value="markdown">Use Markdown files</option>
                    <option value="snapshot">Use exact snapshots</option>
                  </select>
                </label>
                {busy && <p role="status">Importing your folder…</p>}
              </>
            ) : dialog === "export" ? (
              <>
                <div className="modal-symbol">
                  <ArrowDownToLine size={24} />
                </div>
                <h2>Take your workspace with you.</h2>
                <p>
                  Download a complete folder tree as a ZIP, including Markdown,
                  images, and exact document snapshots.
                </p>
                <div className="export-options">
                  <button
                    disabled={busy}
                    onClick={() => void exportWorkspace()}
                  >
                    Entire workspace <span>{visible.length} pages</span>
                  </button>
                  {active && (
                    <button
                      disabled={busy}
                      onClick={() => void exportWorkspace(active.id)}
                    >
                      This page & subpages <span>{title || "Untitled"}</span>
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => void exportWorkspace(undefined, true)}
                  >
                    Portable Markdown <span>Without rich-layout snapshots</span>
                  </button>
                </div>
                {busy && (
                  <p role="status">Saving and preparing your download…</p>
                )}
              </>
            ) : dialog === "move" ? (
              <>
                <h2>Move this page</h2>
                <p>
                  Choose a parent. Drag pages in the sidebar to nest them, too.
                </p>
                <div className="search-results">
                  <button
                    onClick={() =>
                      active &&
                      void mutate(active.id, "move", { parentId: null })
                    }
                  >
                    <Home size={16} />
                    Workspace root
                  </button>
                  {visible
                    .filter((n) => n.id !== active?.id)
                    .map((n) => (
                      <button
                        key={n.id}
                        onClick={() =>
                          active &&
                          void mutate(active.id, "move", { parentId: n.id })
                        }
                      >
                        <FileText size={16} />
                        {n.title || "Untitled"}
                      </button>
                    ))}
                </div>
              </>
            ) : (
              <>
                <div className="modal-symbol">
                  <Settings2 size={24} />
                </div>
                <h2>A little less friction.</h2>
                <div className="shortcut-row">
                  <span>Find a page</span>
                  <kbd>⌘ / Ctrl K</kbd>
                </div>
                <div className="shortcut-row">
                  <span>Save immediately</span>
                  <kbd>⌘ / Ctrl S</kbd>
                </div>
                <div className="shortcut-row">
                  <span>Insert a block</span>
                  <kbd>/</kbd>
                </div>
                <div className="shortcut-row">
                  <span>Undo</span>
                  <kbd>⌘ / Ctrl Z</kbd>
                </div>
                <p>
                  Drag in the editor’s left margin to select blocks. Use “Select
                  section” to move a heading with its content. Drop images into
                  your page or use the image slash command.
                </p>
                <p className="muted">
                  Changes save after 3 seconds of quiet, or every 10 seconds
                  while typing. Keep this tab open when a draft hasn’t reached
                  the server.
                </p>
              </>
            )}
          </section>
        </div>
      )}
      <input
        hidden
        ref={fileInput}
        type="file"
        multiple
        accept=".md,.zip,image/*"
        onChange={(e) => {
          void importFiles(
            [...(e.target.files ?? [])].map((file) => ({
              file,
              path: file.name,
            })),
          );
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={folderInput}
        type="file"
        multiple
        {...({ webkitdirectory: "", directory: "" } as any)}
        onChange={(e) => {
          void importFiles(
            [...(e.target.files ?? [])].map((file) => ({
              file,
              path: file.webkitRelativePath || file.name,
            })),
          );
          e.target.value = "";
        }}
      />
    </div>
  );
}
