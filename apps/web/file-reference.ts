import { authHeaders } from "./api";

export async function downloadFileReference(href: string, name: string) {
  if (!/^\/api\/assets\/[a-f0-9]{64}\.(?:png|jpg|gif|webp|bin)$/.test(href))
    throw new Error("This file reference is invalid.");
  const response = await fetch(href, { headers: authHeaders() });
  if (!response.ok) throw new Error("Could not download this file.");
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = name || "attachment";
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
