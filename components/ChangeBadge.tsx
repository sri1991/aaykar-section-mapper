"use client";

import type { ChangeType } from "@/lib/types";

const config: Record<
  ChangeType,
  { label: string; bg: string; text: string; dot: string }
> = {
  renumbered: {
    label: "Renumbered",
    bg: "var(--sky-light)",
    text: "var(--sky)",
    dot: "var(--sky)",
  },
  merged: {
    label: "Merged",
    bg: "var(--amber-light)",
    text: "var(--amber)",
    dot: "var(--amber)",
  },
  relocated: {
    label: "Relocated",
    bg: "#ede9fe",
    text: "#5b21b6",
    dot: "#7c3aed",
  },
  amended: {
    label: "Amended",
    bg: "var(--moss-light)",
    text: "var(--moss)",
    dot: "var(--moss)",
  },
  deleted: {
    label: "Deleted",
    bg: "var(--crimson-light)",
    text: "var(--crimson)",
    dot: "var(--crimson)",
  },
};

export function ChangeBadge({ type }: { type: ChangeType }) {
  const c = config[type];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: c.bg,
        color: c.text,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 20,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: c.dot,
          flexShrink: 0,
        }}
      />
      {c.label}
    </span>
  );
}
