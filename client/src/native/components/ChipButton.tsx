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
        "px-[var(--space-16)] py-[var(--space-8)] rounded-[var(--app-radius-button)] text-[length:var(--font-small)] font-medium border transition-colors app-press " +
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
      className="w-full px-[var(--space-24)] py-[var(--space-16)] rounded-[var(--app-radius-button)] text-white text-[length:var(--font-body)] font-semibold bg-[var(--app-primary)] app-press"
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
