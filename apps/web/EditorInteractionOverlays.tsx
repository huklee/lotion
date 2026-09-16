import type { RefObject } from "react";
import type { SelectionRectangle } from "./rectangle-selection";
import type { ViewportBlockBox } from "./editor-overlays.types";

type EditorInteractionOverlaysProps = {
  rectangle: SelectionRectangle | null;
  selectedBoxes: ViewportBlockBox[];
  directLinkBox: ViewportBlockBox | null;
  dropLine: number | null;
  host: RefObject<HTMLDivElement | null>;
  uploadState: string;
  failed: { file: File; id: string }[];
  onCancelUploads: () => void;
  onRetryUpload: (file: File, id: string) => Promise<void>;
};

export function EditorInteractionOverlays({
  rectangle,
  selectedBoxes,
  directLinkBox,
  dropLine,
  host,
  uploadState,
  failed,
  onCancelUploads,
  onRetryUpload,
}: EditorInteractionOverlaysProps) {
  return (
    <>
      {rectangle && (
        <div
          className="selection-rectangle"
          style={{
            left: rectangle.x,
            top: rectangle.y,
            width: rectangle.w,
            height: rectangle.h,
          }}
        />
      )}
      {selectedBoxes.map((box) => (
        <div
          className="block-selection-highlight"
          data-block-id={box.id}
          key={box.id}
          style={{
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
          }}
        />
      ))}
      {directLinkBox && (
        <div
          className="direct-link-highlight"
          data-direct-link-target={directLinkBox.id}
          style={{
            left: directLinkBox.x,
            top: directLinkBox.y,
            width: directLinkBox.width,
            height: directLinkBox.height,
          }}
        />
      )}
      {dropLine !== null && (
        <div
          className="drop-line"
          style={{
            top: dropLine,
            left: host.current?.getBoundingClientRect().left ?? 0,
            width: host.current?.clientWidth ?? 0,
          }}
        />
      )}
      {uploadState && (
        <div className="upload-status">
          <p role="status">{uploadState}</p>
          {uploadState.startsWith("Uploading ") && (
            <button onClick={onCancelUploads}>Cancel upload</button>
          )}
        </div>
      )}
      {failed.map((item) => (
        <button
          className="upload-retry"
          key={item.id}
          onClick={() => void onRetryUpload(item.file, item.id)}
        >
          Retry {item.file.name}
        </button>
      ))}
    </>
  );
}
