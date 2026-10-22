import { useWorkspacePreferences } from "./use-workspace-preferences";
import { useMediaQuery } from "./use-media-query";
import { MobileViewSwitch } from "./MobileViewSwitch";
import { WorkspaceHome } from "./WorkspaceHome";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { ActiveDocument } from "./ActiveDocument";
import { WorkspaceTopbar } from "./WorkspaceTopbar";
import { TrashView } from "./TrashView";
import { ChangesView } from "./ChangesView";
import { IssuesView } from "./issues/IssuesView";
import {
  goToIssues,
  parseIssueHash,
  useIssueRoute,
} from "./issues/issues-route";
import { flashBlockWhenRendered } from "./block-flash";
import { useWorkspaceTransfer } from "./use-workspace-transfer";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import type { ImportMode, WorkspaceDialogKind } from "./workspace.types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { set } from "idb-keyval";
import { readSetting, readDraft, writeDraft } from "./storage-compat";
import { X } from "lucide-react";
import type { Document, TreeNode } from "../../packages/document-schema/index";
import { api, ApiError, startSession, upgradeLegacyToken } from "./api";
import { SaveCoordinator } from "./save-coordinator";
import { RowPagesContext } from "./row-pages";
import { InlineRowEditor } from "./InlineRowEditor";
import { VersionButton } from "./VersionPanel";
import { refreshNotifications } from "./NotificationBell";
import { SummaryToasts, useSummaryJobs } from "./summaries";
import { readBoolean } from "./preferences";
import {
  blockIdFromHash,
  directBlockUrl,
  pageHash,
  pageIdFromHash,
} from "./block-links";
import { applicationFavicon, pageFavicon, setFavicon } from "./favicon";
import type { SearchResult } from "../../packages/search/index";

const sessionId = readSetting(sessionStorage, "session") ?? crypto.randomUUID();
sessionStorage.setItem("lotion-session", sessionId);
const draftKey = (id: string) => `lotion-draft:${sessionId}:${id}`;
/** Favorites kept by an older version in this browser; uploaded to the server once. */
const favoritesKey = "lotion-favorites";
function readLocalFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(favoritesKey) ?? "[]",
    );
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === "string"))]
      : [];
  } catch {
    return [];
  }
}
export default function App() {
  const {
    themeMode,
    setThemeMode,
    theme,
    sidebarOnStart,
    setSidebarOnStart,
    editorFont,
    setEditorFont,
    editorTextSize,
    setEditorTextSize,
    pageWidth,
    setPageWidth,
    formattingShortcuts,
    setFormattingShortcuts,
  } = useWorkspacePreferences();
  // Phones show either the page tree or the page, full screen, never both.
  const isMobile = useMediaQuery("(max-width: 650px)");
  const [mobileView, setMobileView] = useState<"page" | "tree">("page");
  // The left panel can be minimized to an icon rail (remembered in this browser).
  const [sidebarMini, setSidebarMini] = useState(() => {
    try {
      return localStorage.getItem("lotion-sidebar-mini") === "1";
    } catch {
      return false;
    }
  });
  const toggleSidebarMini = () =>
    setSidebarMini((mini) => {
      try {
        localStorage.setItem("lotion-sidebar-mini", mini ? "0" : "1");
      } catch {
        /* per-browser convenience */
      }
      return !mini;
    });
  // Favorites are shared by every browser and device (stored on the server).
  const [favorites, setFavorites] = useState<string[]>([]);
  const loadFavorites = useCallback(async () => {
    const local = readLocalFavorites();
    if (local.length) {
      // first run after the move to the server: keep this browser's favorites
      for (const id of local)
        await api(`/api/favorites/${encodeURIComponent(id)}`, {
          method: "PUT",
        }).catch(() => undefined);
      try {
        localStorage.removeItem(favoritesKey);
      } catch {
        /* nothing to clean up */
      }
    }
    const { ids } = await api<{ ids: string[] }>("/api/favorites");
    setFavorites(ids);
  }, []);
  useEffect(() => {
    const reload = () => {
      if (document.visibilityState === "visible")
        void loadFavorites().catch(() => undefined);
    };
    reload();
    document.addEventListener("visibilitychange", reload);
    return () => document.removeEventListener("visibilitychange", reload);
  }, [loadFavorites]);
  const [tree, setTree] = useState<TreeNode[]>([]),
    [treeTag, setTreeTag] = useState(""),
    [active, setActive] = useState<Document | null>(null),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [token, setToken] = useState("");
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(false),
    [trash, setTrash] = useState(false),
    [changes, setChanges] = useState(false),
    cancelFlash = useRef<(() => void) | null>(null),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [sidebar, setSidebar] = useState(() =>
      readBoolean(localStorage, "sidebar-on-start", true),
    ),
    [dialog, setDialog] = useState<WorkspaceDialogKind | null>(null),
    [importMode, setImportMode] = useState<ImportMode>("auto"),
    [notice, setNotice] = useState("");
  const [iconPicker, setIconPicker] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const coordinators = useRef(new Map<string, SaveCoordinator>()),
    loadNumber = useRef(0),
    fileInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null),
    titleInput = useRef<HTMLInputElement>(null),
    iconPickerRef = useRef<HTMLDivElement>(null),
    searchReturnFocus = useRef<HTMLElement | null>(null),
    newId = useRef<string | null>(null);
  const coordinator = active ? coordinators.current.get(active.id) : undefined;
  const issueRoute = useIssueRoute();
  // on a phone, opening a page (or Home, Trash, Recent changes, Issues) shows the page view
  useEffect(() => {
    setMobileView("page");
  }, [active?.id, trash, changes, !!issueRoute]);
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
  const roots = useMemo(
    () => visible.filter((node) => node.parentId === null),
    [visible],
  );
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
  const coordinatorFor = useCallback(async (doc: Document) => {
    const id = doc.id;
    let save = coordinators.current.get(id);
    if (!save || (save.status === "Saved" && save.revision !== doc.revision)) {
      save?.dispose();
      save = new SaveCoordinator(doc, {
        load: () => api<Document>(`/api/documents/${id}`),
        archive: (draft) =>
          set(
            `lotion-recovery:${id}:${new Date().toISOString()}:${crypto.randomUUID()}`,
            draft,
          ),
        save: (revision, content, mutationId) =>
          api<Document>(`/api/documents/${id}/content`, {
            method: "PUT",
            headers: { "If-Match": String(revision) },
            body: JSON.stringify({ ...content, mutationId }),
          }),
        checkpoint: (draft) => writeDraft(draftKey(id), draft),
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
        const draft = await readDraft(draftKey(id));
        if (draft) {
          save.recover(draft);
          if (save.status === "Conflict") await save.review();
        }
      } catch {
        setNotice(
          "Browser draft recovery is unavailable. Server auto-save remains active.",
        );
      }
    }
    return save;
  }, []);
  const summaryJobs = useSummaryJobs(() => {
    void refresh().catch(() => undefined);
    refreshNotifications();
  });
  const openPage = useCallback(
    async (id: string, navigation: "push" | "replace" | "none" = "push") => {
      const sequence = ++loadNumber.current;
      setError("");
      setTrash(false);
      setChanges(false);
      setIconPicker(false);
      setIconQuery("");
      try {
        const [doc] = await Promise.all([
          api<Document>(`/api/documents/${id}`),
          refresh(),
        ]);
        if (sequence !== loadNumber.current) return;
        await coordinatorFor(doc);
        if (sequence !== loadNumber.current) return;
        setActive(doc);
        setSearch(false);
        const hash = pageHash(id);
        const replacementHash =
          navigation === "replace" &&
          pageIdFromHash(location.hash) === id &&
          blockIdFromHash(location.hash)
            ? location.hash
            : hash;
        if (navigation === "replace")
          history.replaceState(null, "", replacementHash);
        else if (navigation === "push" && location.hash !== hash)
          history.pushState(null, "", hash);
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
    void upgradeLegacyToken()
      .then(() => refresh())
      .then((nodes) => {
        if (!alive || loadNumber.current > 0) return;
        if (location.hash === "#/changes") {
          setChanges(true);
          return;
        }
        if (parseIssueHash(location.hash)) return;
        const id =
          pageIdFromHash(location.hash) ?? nodes.find((n) => !n.hidden)?.id;
        if (id && location.hash !== "#/home") void openPage(id, "replace");
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
    document.title = title ? `${title} — Lotion` : "Lotion";
  }, [title]);
  const favicon = active
    ? pageFavicon(coordinator?.content.icon ?? active.icon)
    : applicationFavicon;
  useEffect(() => setFavicon(favicon), [favicon]);
  useEffect(() => {
    if (!dialog && !search && !auth) return;
    const previous = search
      ? searchReturnFocus.current
      : (document.activeElement as HTMLElement | null);
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
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus();
      });
    };
  }, [dialog, search, auth]);
  useEffect(() => {
    const navigate = () => {
      const id = pageIdFromHash(location.hash);
      if (id) void openPage(id, "none");
      else {
        ++loadNumber.current;
        setActive(null);
        setTrash(false);
        setChanges(location.hash === "#/changes");
        setSearch(false);
        setIconPicker(false);
      }
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
      const parentCoordinator = parentId
        ? coordinators.current.get(parentId)
        : undefined;
      await parentCoordinator?.flush();
      if (parentCoordinator && parentCoordinator.status !== "Saved")
        throw new Error("Resolve the parent page draft before adding a child.");
      const doc = await api<Document>("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled",
          parentId,
          mutationId: crypto.randomUUID(),
          linkParent: parentId !== null,
        }),
      });
      await refresh();
      newId.current = doc.id;
      await openPage(doc.id);
    } catch (e) {
      handleError(e);
    }
  }
  async function duplicate(id: string) {
    try {
      const initialNodes = tree.some((item) => item.id === id)
        ? tree
        : await refresh();
      const initialNode = initialNodes.find((item) => item.id === id);
      if (!initialNode) throw new Error("Page not found");
      const relevant = [id, initialNode.parentId].filter(
        (item): item is string => !!item,
      );
      for (const pageId of relevant)
        await coordinators.current.get(pageId)?.flush();
      if (
        relevant.some((pageId) => {
          const coordinator = coordinators.current.get(pageId);
          return coordinator !== undefined && coordinator.status !== "Saved";
        })
      )
        throw new Error("Resolve pending page drafts before duplicating.");
      const nodes = await refresh();
      const node = nodes.find((item) => item.id === id);
      if (!node) throw new Error("Page not found");
      const copy = await api<Document>(`/api/documents/${id}/copy`, {
        method: "POST",
        headers: { "If-Match": String(node.revision) },
        body: JSON.stringify({ mutationId: crypto.randomUUID() }),
      });
      await refresh();
      if (copy.parentId)
        setCollapsed((current) => {
          const next = new Set(current);
          next.delete(copy.parentId!);
          return next;
        });
      newId.current = copy.id;
      await openPage(copy.id);
    } catch (error) {
      handleError(error);
    }
  }
  /** Copy a page next to itself without opening it (database row duplicate). */
  async function copyPage(id: string) {
    for (const pageId of [id]) await coordinators.current.get(pageId)?.flush();
    const nodes = await refresh();
    const node = nodes.find((item) => item.id === id);
    if (!node) throw new Error("Page not found");
    const copy = await api<Document>(`/api/documents/${id}/copy`, {
      method: "POST",
      headers: { "If-Match": String(node.revision) },
      body: JSON.stringify({ mutationId: crypto.randomUUID() }),
    });
    await refresh();
    return copy;
  }
  async function createSubpage(parentId: string, title = "Untitled") {
    try {
      const doc = await api<Document>("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          title,
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
        setSearch((open) => {
          if (!open)
            searchReturnFocus.current =
              document.activeElement as HTMLElement | null;
          return !open;
        });
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
  ): Promise<boolean> {
    try {
      const initialNode = tree.find((node) => node.id === id);
      const destination =
        action === "move" && typeof options.parentId === "string"
          ? options.parentId
          : undefined;
      // Only a move rewrites the parents' page links on the server; trash and restore
      // leave the parent untouched, so its draft (e.g. a database edit) need not block them.
      const relevant = (
        action === "move" ? [id, initialNode?.parentId, destination] : [id]
      ).filter((item): item is string => !!item);
      for (const pageId of relevant)
        await coordinators.current.get(pageId)?.flush();
      if (
        relevant.some((pageId) => {
          const coordinator = coordinators.current.get(pageId);
          return coordinator !== undefined && coordinator.status !== "Saved";
        })
      )
        throw new Error("Resolve the unsaved draft before changing this page.");
      const c = coordinators.current.get(id);
      const nodes = await refresh();
      const node = nodes.find((n) => n.id === id)!;
      const fresh = await api<{ tag: string }>("/api/tree");
      const changed = await api<Document>(`/api/documents/${id}/${action}`, {
        method: "POST",
        headers: { "If-Match": String(node.revision) },
        body: JSON.stringify({ ...options, treeTag: fresh.tag }),
      });
      await refresh();
      const affectedParents =
        action === "move"
          ? [initialNode?.parentId, changed.parentId].filter(
              (item): item is string => !!item,
            )
          : [];
      for (const parentId of new Set(affectedParents)) {
        coordinators.current.get(parentId)?.dispose();
        coordinators.current.delete(parentId);
      }
      if (action === "trash" && active?.id === id) {
        setActive(null);
        history.replaceState(null, "", "#/home");
      } else if (active && affectedParents.includes(active.id)) {
        await openPage(active.id, "none");
      } else if (active?.id === id || action === "restore") {
        c?.dispose();
        coordinators.current.delete(id);
        await openPage(changed.id);
      }
      setDialog(null);
      return true;
    } catch (e) {
      handleError(e);
      return false;
    }
  }
  const {
    busy,
    copyPageMarkdown,
    copyPageConfluence,
    pageConfluence,
    exportWorkspace,
    importFiles,
    dropFolder,
  } = useWorkspaceTransfer({
    importMode,
    getCurrentContent: () =>
      active
        ? (coordinators.current.get(active.id)?.content ?? active)
        : undefined,
    flushSaves: async () => {
      await Promise.all(
        [...coordinators.current.values()].map((c) => c.flush()),
      );
      if ([...coordinators.current.values()].some((c) => c.status !== "Saved"))
        throw new Error("Resolve pending saves before exporting.");
    },
    onImported: async (result) => {
      await refresh();
      // Newly imported roots must remain visible beyond the incremental tree limit.
      setTreeLimit(Number.MAX_SAFE_INTEGER);
      setNotice(
        result.warnings.length
          ? `Imported ${result.documents.length} pages. ${result.warnings.join(" · ")}`
          : `Imported ${result.documents.length} pages with their folder structure.`,
      );
      setDialog(null);
      if (result.documents[0]) await openPage(result.documents[0].id);
    },
    onComplete: () => setDialog(null),
    handleError,
    setError,
    setNotice,
  });
  async function copyBlockLink(blockId: string, pageId = active?.id) {
    if (!pageId) return;
    try {
      await navigator.clipboard.writeText(
        directBlockUrl(location.href, pageId, blockId),
      );
      setNotice("Copied a direct link to this block.");
    } catch (e) {
      handleError(e);
    }
  }
  function toggleFavorite(id: string) {
    const adding = !favorites.includes(id);
    const before = favorites;
    // show it right away; the server's answer is the truth
    setFavorites(
      adding ? [...favorites, id] : favorites.filter((f) => f !== id),
    );
    void api<{ ids: string[] }>(`/api/favorites/${encodeURIComponent(id)}`, {
      method: adding ? "PUT" : "DELETE",
    })
      .then(({ ids }) => setFavorites(ids))
      .catch((error) => {
        setFavorites(before);
        handleError(error);
      });
  }
  const status = coordinator?.status ?? "Saved";
  void version;
  void treeTag;
  return (
    <div
      className={`app ${sidebar ? "" : "sidebar-hidden"}${sidebarMini && !isMobile ? " sidebar-mini" : ""}${isMobile ? ` mobile mobile-${mobileView}` : ""}`}
    >
      <WorkspaceSidebar
        activeId={active?.id}
        trash={trash}
        changes={changes}
        issues={!!issueRoute && !trash && !changes}
        visible={visible}
        favorites={favorites}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        treeLimit={treeLimit}
        setTreeLimit={setTreeLimit}
        theme={theme}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        deletedCount={tree.filter((n) => n.deletedAt).length}
        draftFor={(id) => coordinators.current.get(id)?.content}
        openPage={(id) => {
          setMobileView("page");
          return openPage(id);
        }}
        create={create}
        duplicate={duplicate}
        mutate={mutate}
        toggleFavorite={toggleFavorite}
        mini={sidebarMini && !isMobile}
        onToggleMini={toggleSidebarMini}
        setSearch={(open) => {
          if (open)
            searchReturnFocus.current =
              document.activeElement as HTMLElement | null;
          setSearch(open);
        }}
        setDialog={setDialog}
        onHome={() => {
          setMobileView("page");
          ++loadNumber.current;
          setActive(null);
          setTrash(false);
          setChanges(false);
          setSearch(false);
          setIconPicker(false);
          if (location.hash !== "#/home") history.pushState(null, "", "#/home");
        }}
        onTrash={() => {
          setMobileView("page");
          setTrash(true);
          setChanges(false);
          setSearch(false);
          void refresh().catch(handleError);
        }}
        onIssues={() => {
          setMobileView("page");
          ++loadNumber.current;
          setActive(null);
          setTrash(false);
          setChanges(false);
          setSearch(false);
          setIconPicker(false);
          goToIssues(null);
        }}
        onChanges={() => {
          setMobileView("page");
          ++loadNumber.current;
          setActive(null);
          setTrash(false);
          setChanges(true);
          setSearch(false);
          setIconPicker(false);
          if (location.hash !== "#/changes")
            history.pushState(null, "", "#/changes");
        }}
      />
      <RowPagesContext.Provider
        value={{
          load: (id) => api<Document>(`/api/documents/${id}`),
          coordinator: async (id) =>
            coordinators.current.get(id) ??
            coordinatorFor(await api<Document>(`/api/documents/${id}`)),
          version,
          theme,
          formattingShortcuts,
          pages: visible,
          openPage: (id) => void openPage(id),
          createSubpage,
          copyBlockLink: (pageId, blockId) => copyBlockLink(blockId, pageId),
          InlineEditor: InlineRowEditor,
          activePageId: active?.id ?? null,
          summarize: (request) =>
            summaryJobs.start(request).catch((e) => {
              handleError(e);
              throw e;
            }),
        }}
      >
        <main>
          <WorkspaceTopbar
            sidebar={isMobile ? mobileView === "tree" : sidebar}
            setSidebar={(open) =>
              isMobile
                ? setMobileView(open ? "tree" : "page")
                : setSidebar(open)
            }
            trash={trash}
            changes={changes}
            issues={!!issueRoute && !trash && !changes}
            breadcrumbPages={breadcrumbPages}
            title={title}
            openPage={openPage}
            activeId={active?.id}
            status={status}
            favorite={!!active && favorites.includes(active.id)}
            onExport={() => setDialog("export")}
            onToggleFavorite={() => active && toggleFavorite(active.id)}
            onDuplicate={() => active && void duplicate(active.id)}
            onMove={() => setDialog("move")}
            onTrash={() => active && void mutate(active.id, "trash")}
            wide={pageWidth === "wide"}
            onToggleWide={() =>
              setPageWidth((width) =>
                width === "wide" ? "comfortable" : "wide",
              )
            }
          />
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
            {changes ? (
              <ChangesView
                onOpen={(id, blockId) => {
                  cancelFlash.current?.();
                  cancelFlash.current = null;
                  void openPage(id).then(() => {
                    if (blockId)
                      cancelFlash.current = flashBlockWhenRendered(blockId);
                  });
                }}
                onOpenTrash={() => {
                  setChanges(false);
                  setTrash(true);
                  // the trash has no address of its own; don't keep showing #/changes
                  history.replaceState(null, "", "#/home");
                  void refresh().catch(handleError);
                }}
              />
            ) : trash ? (
              <TrashView
                pages={tree}
                onRestore={(id) => void mutate(id, "restore")}
              />
            ) : issueRoute ? (
              <IssuesView
                openNumber={issueRoute.number}
                onError={handleError}
              />
            ) : active && coordinator ? (
              <ActiveDocument
                key={`${active.id}:${active.revision}:${coordinator.editorVersion}`}
                active={active}
                coordinator={coordinator}
                title={title}
                theme={theme}
                formattingShortcuts={formattingShortcuts}
                pages={visible}
                iconPicker={iconPicker}
                iconQuery={iconQuery}
                iconPickerRef={iconPickerRef}
                titleInputRef={titleInput}
                onToggleIconPicker={() => {
                  setIconQuery("");
                  setIconPicker((open) => !open);
                }}
                onIconQuery={setIconQuery}
                onChooseIcon={(emoji) => {
                  coordinator.edit({ ...coordinator.content, icon: emoji });
                  setTree((nodes) =>
                    nodes.map((node) =>
                      node.id === active.id ? { ...node, icon: emoji } : node,
                    ),
                  );
                  setIconPicker(false);
                  setIconQuery("");
                }}
                onTitleChange={(nextTitle) => {
                  coordinator.edit({
                    ...coordinator.content,
                    title: nextTitle,
                  });
                  setTree((nodes) =>
                    nodes.map((node) =>
                      node.id === active.id
                        ? { ...node, title: nextTitle }
                        : node,
                    ),
                  );
                }}
                refresh={refresh}
                openPage={openPage}
                handleError={handleError}
                createSubpage={(rowTitle) => createSubpage(active.id, rowTitle)}
                duplicateRowPage={copyPage}
                trashRowPage={async (id) => {
                  if (!(await mutate(id, "trash")))
                    throw new Error(
                      "The row page could not be moved to the trash.",
                    );
                }}
                copyBlockLink={copyBlockLink}
                onLinkPreview={(url, preview) =>
                  coordinator.edit({
                    ...coordinator.content,
                    linkPreviews: {
                      ...coordinator.content.linkPreviews,
                      [url]: preview,
                    },
                  })
                }
                onBlocksChange={(blocks) =>
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
            ) : (
              <WorkspaceHome
                roots={roots}
                pageCount={visible.length}
                create={create}
                openPage={openPage}
                onExport={() => setDialog("export")}
                onImport={() => setDialog("import")}
              />
            )}
          </div>
          <footer className="bottom-bar">
            <span>
              <span className="local-dot" /> LOCAL WORKSPACE
            </span>
            <span>No distractions. Just your thoughts.</span>
            <span className="bottom-bar-end">
              <VersionButton />
              <button onClick={() => setDialog("help")}>?</button>
            </span>
          </footer>
        </main>
        {isMobile && (
          <MobileViewSwitch view={mobileView} onChange={setMobileView} />
        )}
        <SummaryToasts
          jobs={summaryJobs.jobs}
          dismiss={summaryJobs.dismiss}
          openPage={(id) => void openPage(id)}
        />
      </RowPagesContext.Provider>
      <WorkspaceDialog
        dialog={dialog}
        search={search}
        auth={auth}
        token={token}
        setToken={setToken}
        onUnlock={() =>
          void startSession(token)
            .then(() => {
              setToken("");
              setAuth(false);
              void refresh().catch(handleError);
            })
            .catch((e) => setError((e as Error).message))
        }
        query={query}
        setQuery={setQuery}
        visible={visible}
        close={() => {
          setDialog(null);
          setSearch(false);
        }}
        busy={busy}
        dropFolder={dropFolder}
        chooseFolder={() => folderInput.current?.click()}
        chooseFiles={() => fileInput.current?.click()}
        importMode={importMode}
        setImportMode={setImportMode}
        activeId={active?.id}
        activeContent={coordinator?.content}
        openSearchResult={(result: SearchResult) => {
          location.hash = pageHash(
            result.documentId,
            result.blockId ?? undefined,
          );
        }}
        title={title}
        copyPageMarkdown={copyPageMarkdown}
        copyPageConfluence={copyPageConfluence}
        pageConfluence={pageConfluence}
        exportWorkspace={exportWorkspace}
        movePage={(parentId) => {
          if (active) void mutate(active.id, "move", { parentId });
        }}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        editorFont={editorFont}
        setEditorFont={setEditorFont}
        editorTextSize={editorTextSize}
        setEditorTextSize={setEditorTextSize}
        pageWidth={pageWidth}
        setPageWidth={setPageWidth}
        sidebarOnStart={sidebarOnStart}
        setSidebarOnStart={setSidebarOnStart}
        formattingShortcuts={formattingShortcuts}
        setFormattingShortcuts={setFormattingShortcuts}
      />
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
