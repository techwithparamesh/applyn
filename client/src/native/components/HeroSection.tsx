import type { NativeActionHandler } from "@/native/types";

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
  return (
    <div
      className="relative overflow-hidden rounded-[var(--app-radius-card)] app-shadow-soft"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: backgroundImage ? undefined : themeColor,
      }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: overlayColor || "rgba(0,0,0,0.42)" }} />
      <div className="relative z-10 aspect-[16/9] flex flex-col justify-end px-[var(--space-24)] py-[var(--space-hero-y)] text-white">
        <div className="text-[length:var(--font-h1)] font-[var(--font-weight-h1)] leading-tight tracking-[-0.01em]">
          {title}
        </div>
        {subtitle && (
          <div className="text-[length:var(--font-body)] font-normal text-white/85 mt-[var(--space-8)] max-w-[28ch]">
            {subtitle}
          </div>
        )}
        {buttonText && (
          <div className="mt-[var(--space-16)]">
            <button
              type="button"
              className="inline-flex items-center justify-center px-[var(--space-24)] py-[var(--space-16)] bg-white/95 text-gray-900 rounded-[var(--app-radius-button)] text-[length:var(--font-small)] font-semibold app-press"
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
