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
        (isActive ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-200")
      }
      style={isActive ? { backgroundColor: themeColor } : undefined}
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
      className="w-full px-3 py-2 rounded-lg text-white text-sm font-semibold"
      style={{ backgroundColor: themeColor }}
      onClick={() => {
        const a = String(action || "").trim();
        if (a) onAction(a);
      }}
    >
      {text}
    </button>
  );
}
