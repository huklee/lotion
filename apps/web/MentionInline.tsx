import { createReactInlineContentSpec } from "@blocknote/react";

export type MentionKind = "page" | "external";

export const mentionInline = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      kind: { default: "page", values: ["page", "external"] as const },
      href: { default: "" },
      label: { default: "Untitled" },
      icon: { default: "📄" },
    },
    content: "none",
  } as const,
  {
    render: ({ inlineContent }) => (
      <a
        className="lotion-mention"
        data-lotion-mention={inlineContent.props.kind}
        href={inlineContent.props.href}
      >
        <span className="lotion-mention-icon" aria-hidden="true">
          {inlineContent.props.icon}
        </span>{" "}
        <span>{inlineContent.props.label}</span>
      </a>
    ),
    toExternalHTML: ({ inlineContent }) => (
      <a
        data-lotion-mention={inlineContent.props.kind}
        data-lotion-mention-icon={inlineContent.props.icon}
        href={inlineContent.props.href}
      >
        {inlineContent.props.label}
      </a>
    ),
    parse: (element) => {
      const kind = element.dataset.lotionMention;
      if (kind !== "page" && kind !== "external") return undefined;
      return {
        kind: kind as MentionKind,
        href: element.getAttribute("href") ?? "",
        label: element.textContent ?? "Untitled",
        icon:
          element.dataset.lotionMentionIcon ??
          (kind === "external" ? "🌐" : "📄"),
      };
    },
  },
);
