import type { CSSProperties } from "react";

export function Spacer({ height }: { height?: number | string }) {
  const allowed = new Set(["var(--space-4)", "var(--space-8)", "var(--space-16)", "var(--space-24)", "var(--space-32)", "var(--space-48)"]);
  if (height == null) return <div style={{ height: "var(--space-16)" }} />;
  if (typeof height === "string" && allowed.has(height)) return <div style={{ height }} />;
  if (typeof height === "number") {
    const map: Record<number, string> = {
      4: "var(--space-4)",
      8: "var(--space-8)",
      16: "var(--space-16)",
      24: "var(--space-24)",
      32: "var(--space-32)",
      48: "var(--space-48)",
    };
    return <div style={{ height: map[height] || "var(--space-16)" }} />;
  }
  return <div style={{ height: "var(--space-16)" }} />;
}

export function Divider({ thickness, color }: { thickness?: number; color?: string }) {
  const h = Number(thickness ?? 1);
  const style: CSSProperties = {
    height: Number.isFinite(h) ? h : 1,
    backgroundColor: color || "#e5e7eb",
    width: "100%",
  };
  return <div style={style} />;
}

export function TextBlock({ text, color }: { text?: string; color?: string }) {
  return (
    <p className="text-[length:var(--font-body)] font-normal text-[color:var(--app-text)]" style={color ? { color } : undefined}>
      {text}
    </p>
  );
}

export function Heading({
  level,
  text,
  color,
}: {
  level?: number;
  text?: string;
  color?: string;
}) {
  const l = level === 1 ? 1 : 2;
  const className =
    l === 1
      ? "text-[length:var(--font-h1)] font-[var(--font-weight-h1)]"
      : "text-[length:var(--font-h2)] font-[var(--font-weight-h2)]";
  return (
    <div className={className} style={{ color: color || "var(--app-text)" }}>
      {text}
    </div>
  );
}
