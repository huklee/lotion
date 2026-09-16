import { useMemo, type RefObject } from "react";
import emojiData from "emojibase-data/en/data.json";
const emojiCatalog = emojiData.flatMap((item) => [
  item,
  ...(item.skins ?? []).map((skin) => ({ ...skin, tags: item.tags ?? [] })),
]);

type PageIconPickerProps = {
  iconQuery: string;
  setIconQuery: (query: string) => void;
  iconPickerRef: RefObject<HTMLDivElement | null>;
  onChoose: (emoji: string) => void;
};
export function PageIconPicker({
  iconQuery,
  setIconQuery,
  iconPickerRef,
  onChoose,
}: PageIconPickerProps) {
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

  return (
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
            onClick={() => onChoose(item.emoji)}
          >
            {item.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
