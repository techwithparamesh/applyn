import type { NativeActionHandler } from "@/native/types";

export function HeroSection({
  title,
  subtitle,
  buttonText,
  buttonAction,
  themeColor,
  backgroundImage,
  overlayColor,
  height,
  onAction,
}: {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonAction?: string;
  themeColor: string;
  backgroundImage?: string;
  overlayColor?: string;
  height?: number;
  onAction: NativeActionHandler;
}) {
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: height || 180,
        backgroundColor: backgroundImage ? undefined : themeColor,
      }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: overlayColor || "rgba(0,0,0,0.35)" }} />
      <div className="relative z-10 h-full p-4 flex flex-col justify-end text-white">
        <div className="text-xl font-bold">{title}</div>
        {subtitle && <div className="text-xs text-white/80 mt-1">{subtitle}</div>}
        {buttonText && (
          <div className="mt-3">
            <button
              type="button"
              className="px-4 py-2 bg-white text-gray-900 rounded-full text-xs font-semibold"
              onClick={() => {
                const a = String(buttonAction || "").trim();
                if (a) onAction(a);
              }}
            >
              {buttonText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
