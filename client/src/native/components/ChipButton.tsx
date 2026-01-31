import type { NativeActionHandler } from "@/native/types";

export function ChipButton({
  text,
  isActive,
  themeColor,
  onClick,
}: {
  text: string;
  isActive: boolean;
  themeColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors " +
        (isActive
          ? "text-white border-transparent bg-[var(--app-primary)]"
          : "bg-[var(--app-surface)] text-gray-200 border-[color:var(--app-border)]")
      }
      // themeColor is kept for API stability; PreviewThemeProvider sets --app-primary.
      style={themeColor && themeColor !== "var(--app-primary)" ? ({ "--app-primary": themeColor } as any) : undefined}
    >
      {text}
    </button>
  );
}

export function PrimaryButton({
  text,
  themeColor,
  action,
  onAction,
}: {
  text: string;
  themeColor: string;
  action?: string;
  onAction: NativeActionHandler;
}) {
  return (
    <button
      type="button"
      className="w-full px-3 py-2 rounded-[var(--app-radius-button)] text-white text-sm font-semibold bg-[var(--app-primary)]"
      style={themeColor && themeColor !== "var(--app-primary)" ? ({ "--app-primary": themeColor } as any) : undefined}
      onClick={() => {
        const a = String(action || "").trim();
        if (a) onAction(a);
      }}
    >
      {text}
    </button>
  );
}
