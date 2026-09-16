const svgDataUrl = (svg: string) =>
  `data:image/svg+xml,${encodeURIComponent(svg)}`;

export const applicationFavicon = svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="#37352f"/>
    <path d="M20 14h9v28h17v8H20z" fill="#fff"/>
  </svg>
`);

export const pageFavicon = (icon?: string) => {
  const label = icon?.trim() || "📄";
  const escaped = label
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <text x="32" y="34" dominant-baseline="middle" text-anchor="middle" font-size="52">${escaped}</text>
    </svg>
  `);
};

export function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"][data-lotion-favicon]',
  );
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.dataset.lotionFavicon = "";
    document.head.append(link);
  }
  link.href = href;
}
