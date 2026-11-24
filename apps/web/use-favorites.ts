import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { prefs } from "./browser-prefs";

/** Favorites kept by an older version in this browser; uploaded to the server once. */
export function readLocalFavorites(): string[] {
  return prefs.json<string[]>("favorites", [], (value) =>
    Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === "string"))]
      : null,
  );
}

/**
 * Favorite pages, shared by every browser and device (stored on the server).
 * Reloaded whenever the tab becomes visible; a toggle shows at once and the
 * server's answer is then the truth (rolled back on failure).
 */
export function useFavorites(onError: (error: unknown) => void) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const load = useCallback(async () => {
    const local = readLocalFavorites();
    if (local.length) {
      // first run after the move to the server: keep this browser's favorites
      for (const id of local)
        await api(`/api/favorites/${encodeURIComponent(id)}`, {
          method: "PUT",
        }).catch(() => undefined);
      prefs.remove("favorites");
    }
    const { ids } = await api<{ ids: string[] }>("/api/favorites");
    setFavorites(ids);
  }, []);
  useEffect(() => {
    const reload = () => {
      if (document.visibilityState === "visible")
        void load().catch(() => undefined);
    };
    reload();
    document.addEventListener("visibilitychange", reload);
    return () => document.removeEventListener("visibilitychange", reload);
  }, [load]);

  function toggleFavorite(id: string) {
    const adding = !favorites.includes(id);
    const before = favorites;
    setFavorites(
      adding ? [...favorites, id] : favorites.filter((f) => f !== id),
    );
    void api<{ ids: string[] }>(`/api/favorites/${encodeURIComponent(id)}`, {
      method: adding ? "PUT" : "DELETE",
    })
      .then(({ ids }) => setFavorites(ids))
      .catch((error) => {
        setFavorites(before);
        onError(error);
      });
  }
  return { favorites, toggleFavorite };
}
