import { useEffect, useMemo, useRef } from "react";
import { getThemePreset } from "@/design/theme-presets";
import type { ThemePresetId } from "@shared/blueprints";

type PreviewThemeProviderProps = {
  themeId: ThemePresetId;
  primaryOverride?: string;
  secondaryOverride?: string;
  children: React.ReactNode;
};

/**
 * Applies theme CSS variables to a scoped container for deterministic native previews.
 * Side-effects are contained in an effect (never during render).
 */
export function PreviewThemeProvider({
  themeId,
  primaryOverride,
  secondaryOverride,
  children,
}: PreviewThemeProviderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const preset = useMemo(() => getThemePreset(themeId), [themeId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const primary = primaryOverride?.trim() || preset.primary;
    const secondary = secondaryOverride?.trim() || preset.secondary;

    el.style.setProperty("--app-primary", primary);
    el.style.setProperty("--app-secondary", secondary);
    el.style.setProperty("--app-bg", preset.background);
    el.style.setProperty("--app-surface", preset.surface);
    el.style.setProperty("--app-text", preset.text);
    el.style.setProperty("--app-muted-text", preset.mutedText);
    el.style.setProperty("--app-border", preset.border);
    el.style.setProperty("--app-radius-card", preset.radiusCard);
    el.style.setProperty("--app-radius-button", preset.radiusButton);
    el.style.setProperty("--app-shadow-card", preset.shadowCard);
  }, [preset, primaryOverride, secondaryOverride]);

  return (
    <div
      ref={containerRef}
      data-preview-theme={themeId}
      className="h-full w-full"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text)",
      }}
    >
      {children}
    </div>
  );
}
