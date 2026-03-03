import type { NativeActionHandler } from "@/native/types";

/** Premium hero for all industries — Play Store ready: image or gradient, two CTAs like Appy Pie. */
export function HeroSection({
  title,
  subtitle,
  buttonText,
  buttonAction,
  secondaryButtonText,
  secondaryButtonAction,
  themeColor,
  backgroundImage,
  overlayColor,
  onAction,
}: {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonAction?: string;
  secondaryButtonText?: string;
  secondaryButtonAction?: string;
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
        {(buttonText || secondaryButtonText) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {buttonText && (
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
            )}
            {secondaryButtonText && (
              <button
                type="button"
                className="inline-flex items-center justify-center px-5 py-3 bg-white/20 text-white border border-white/40 rounded-xl text-sm font-semibold backdrop-blur-sm active:opacity-90"
                onClick={() => {
                  const a = String(secondaryButtonAction || "").trim();
                  if (a) onAction(a);
                }}
              >
                {secondaryButtonText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
