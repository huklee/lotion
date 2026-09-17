import { useEffect, useState } from "react";
import type { LinkPreview } from "../../packages/document-schema/index";
import { authHeaders } from "./api";

function PreviewImage({ url }: { url: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void fetch(url, { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) return;
        const blob = await response.blob();
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setSource(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return source ? <img src={source} alt="Page preview" /> : null;
}

export function LinkPreviewCard({
  preview,
  refreshing,
  onClose,
}: {
  preview: LinkPreview;
  refreshing?: boolean;
  onClose: () => void;
}) {
  return (
    <aside className="link-preview-card" aria-label="Link preview">
      <button aria-label="Close link preview" onClick={onClose}>
        ×
      </button>
      <strong>{preview.title}</strong>
      {refreshing && <small role="status">Refreshing preview…</small>}
      <p>{preview.description}</p>
      {preview.image && <PreviewImage url={preview.image} />}
    </aside>
  );
}
