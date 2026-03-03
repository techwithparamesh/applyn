import type { NativeActionHandler } from "@/native/types";

/** Premium hero for all industries — Play Store ready: image or gradient, no grey placeholder. */
export function HeroSection({
  title,
  subtitle,
  buttonText,
  buttonAction,
  themeColor,
  backgroundImage,
  overlayColor,
  onAction,
}: {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonAction?: string;
  themeColor: string;
  backgroundImage?: string;
  overlayColor?: string;
  onAction: NativeActionHandler;
}) {
  const hasImage = Boolean(backgroundImage?.trim());
  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-lg min-h-[220px]"
      style={{
        backgroundImage: hasImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: themeColor,
      }}
    >
      {hasImage ? (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: overlayColor ?? "rgba(0,0,0,0.45)" }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.25) 100%)`,
          }}
        />
      )}
      <div className="relative z-10 min-h-[220px] flex flex-col justify-end px-5 py-6 text-white">
        <h2 className="text-[20px] font-semibold leading-tight tracking-tight text-white drop-shadow-md break-words">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[15px] font-normal text-white/95 mt-1.5 max-w-[32ch] leading-snug drop-shadow-sm">
            {subtitle}
          </p>
        )}
        {buttonText && (
          <div className="mt-4">
            <button
              type="button"
              className="inline-flex items-center justify-center px-5 py-3 bg-white text-gray-900 rounded-xl text-sm font-semibold shadow-md active:opacity-90"
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
