import { useState } from "react";
import type { ConfluenceOutput } from "../../packages/confluence/convert";

/** Styles that make the preview read like a Confluence page. */
const PAGE_CSS = `
body{margin:0;padding:24px 28px;font:14px/1.714 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans","Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#172b4d;background:#fff}
h1{font-size:24px;font-weight:500;letter-spacing:-.01em;margin:28px 0 0}h1:first-child{margin-top:0}
h2{font-size:20px;font-weight:500;margin:24px 0 0}h3{font-size:16px;font-weight:600;margin:20px 0 0}
h4,h5,h6{font-size:14px;font-weight:600;margin:16px 0 0}
p{margin:10px 0 0}ul,ol{margin:10px 0 0;padding-left:24px}li>ul,li>ol{margin-top:4px}
a{color:#0052cc;text-decoration:none}a:hover{text-decoration:underline}
code{font-family:"SFMono-Medium","SF Mono",Menlo,Consolas,monospace;font-size:12px;background:#f4f5f7;border-radius:3px;padding:2px 4px;color:#172b4d}
.code-panel{margin:12px 0 0;border:1px solid #dfe1e6;border-radius:3px;background:#f4f5f7;overflow:auto}
.code-title{padding:6px 12px;border-bottom:1px solid #dfe1e6;font-weight:600;font-size:12px;background:#ebecf0}
.code-panel pre{margin:0;padding:10px 12px}.code-panel code{background:none;padding:0;font-size:12px;line-height:1.6}
table{border-collapse:collapse;margin:12px 0 0;min-width:40%}th,td{border:1px solid #c1c7d0;padding:7px 10px;text-align:left;vertical-align:top}
th{background:#f4f5f7;font-weight:600}
blockquote{margin:12px 0 0;padding-left:16px;border-left:2px solid #dfe1e6;color:#6b778c}
hr{border:0;border-top:1px solid #dfe1e6;margin:20px 0}
ul.task-list{list-style:none;padding-left:4px}ul.task-list input{margin-right:6px;vertical-align:-2px}
.toc-macro{margin:12px 0 0;padding:8px 12px;border:1px dashed #c1c7d0;border-radius:3px;color:#6b778c;font-size:12px}
img{max-width:100%}
`;

export function ConfluencePreview({
  converted,
  copy,
  back,
}: {
  converted: ConfluenceOutput;
  copy: (storageOnly: boolean) => void;
  back: () => void;
}) {
  const [tab, setTab] = useState<"preview" | "storage">("preview");
  return (
    <div className="confluence-preview">
      <div className="confluence-preview-bar">
        <div role="tablist" aria-label="Confluence view">
          <button
            role="tab"
            aria-selected={tab === "preview"}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
          <button
            role="tab"
            aria-selected={tab === "storage"}
            onClick={() => setTab("storage")}
          >
            Storage format
          </button>
        </div>
        <span className="confluence-preview-actions">
          <button onClick={back}>Back</button>
          <button onClick={() => copy(true)}>Copy storage format</button>
          <button className="primary" onClick={() => copy(false)}>
            Copy for Confluence
          </button>
        </span>
      </div>
      {tab === "preview" ? (
        <iframe
          title="Confluence preview"
          className="confluence-preview-frame"
          // no scripts, no same-origin access: the converted page is only displayed
          sandbox=""
          srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head><body>${converted.html}</body></html>`}
        />
      ) : (
        <pre
          className="confluence-preview-source"
          aria-label="Confluence storage format"
        >
          {converted.storage}
        </pre>
      )}
    </div>
  );
}
