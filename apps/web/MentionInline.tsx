import { createReactInlineContentSpec } from "@blocknote/react";

export type MentionKind = "page" | "external" | "file" | "date";

export type MentionProperties = {
  kind: MentionKind;
  icon: string;
  value?: string;
};

export const mentionInline = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      kind: {
        default: "page",
        values: ["page", "external", "file", "date"] as const,
      },
      href: { default: "" },
      label: { default: "Untitled" },
      icon: { default: "📄" },
      value: { default: "" },
    },
    content: "none",
  } as const,
  {
    render: ({ inlineContent }) => {
      const { href, icon, kind, label, value } = inlineContent.props;
      const contents = (
        <>
          <span className="lotion-mention-icon" aria-hidden="true">
            {icon}
          </span>{" "}
          <span>{label}</span>
        </>
      );
      return kind === "date" ? (
        <time
          className="lotion-mention"
          data-lotion-mention={kind}
          data-lotion-mention-value={value}
          dateTime={value}
        >
          {contents}
        </time>
      ) : (
        <a
          className="lotion-mention"
          data-lotion-mention={kind}
          data-lotion-mention-label={label}
          download={kind === "file" ? label : undefined}
          href={href}
        >
          {contents}
        </a>
      );
    },
    toExternalHTML: ({ inlineContent }) => {
      const { href, icon, kind, label, value } = inlineContent.props;
      return kind === "date" ? (
        <time
          data-lotion-mention={kind}
          data-lotion-mention-icon={icon}
          data-lotion-mention-value={value}
          dateTime={value}
        >
          {label}
        </time>
      ) : (
        <a
          data-lotion-mention={kind}
          data-lotion-mention-icon={icon}
          data-lotion-mention-label={label}
          download={kind === "file" ? label : undefined}
          href={href}
        >
          {label}
        </a>
      );
    },
    parse: (element) => {
      const kind = element.dataset.lotionMention;
      if (!kind || !["page", "external", "file", "date"].includes(kind))
        return undefined;
      return {
        kind: kind as MentionKind,
        href: kind === "date" ? "" : (element.getAttribute("href") ?? ""),
        label:
          element.dataset.lotionMentionLabel ??
          element.textContent ??
          "Untitled",
        icon:
          element.dataset.lotionMentionIcon ??
          ({ page: "📄", external: "🌐", file: "📎", date: "📅" } as const)[
            kind as MentionKind
          ],
        value:
          kind === "date"
            ? (element.dataset.lotionMentionValue ??
              element.getAttribute("datetime") ??
              "")
            : "",
      };
    },
  },
);
