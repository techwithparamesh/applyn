import type { CSSProperties } from "react";

export function Spacer({ height }: { height?: number | string }) {
  if (height == null) return <div style={{ height: "var(--space-3)" }} />;
  return <div style={{ height }} />;
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
    <p className="text-sm text-gray-700" style={color ? { color } : undefined}>
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
  const l = level === 1 ? 1 : level === 3 ? 3 : level === 4 ? 4 : 2;
  const className = l === 1 ? "text-2xl font-bold" : l === 2 ? "text-xl font-bold" : l === 3 ? "text-lg font-semibold" : "text-base font-semibold";
  return (
    <div className={className} style={{ color: color || "#111827" }}>
      {text}
    </div>
  );
}
