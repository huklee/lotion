import { FileText, ListTree } from "lucide-react";

/** Phone tab bar: the page tree or the open page, one at a time. */
export function MobileViewSwitch({
  view,
  onChange,
}: {
  view: "page" | "tree";
  onChange: (view: "page" | "tree") => void;
}) {
  return (
    <nav className="mobile-view-switch" aria-label="View">
      <button
        type="button"
        aria-pressed={view === "tree"}
        onClick={() => onChange("tree")}
      >
        <ListTree size={20} aria-hidden="true" />
        <span>Pages</span>
      </button>
      <button
        type="button"
        aria-pressed={view === "page"}
        onClick={() => onChange("page")}
      >
        <FileText size={20} aria-hidden="true" />
        <span>Page</span>
      </button>
    </nav>
  );
}
