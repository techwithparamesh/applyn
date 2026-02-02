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

    // Global design tokens (strict, opinionated)
    el.style.setProperty("--space-0", "0px");
    el.style.setProperty("--space-4", "4px");
    el.style.setProperty("--space-8", "8px");
    el.style.setProperty("--space-16", "16px");
    el.style.setProperty("--space-24", "24px");
    el.style.setProperty("--space-32", "32px");
    el.style.setProperty("--space-48", "48px");
    el.style.setProperty("--space-section-y", "var(--space-32)");
    el.style.setProperty("--space-hero-y", "var(--space-48)");
    el.style.setProperty("--space-grid-gap", "var(--space-24)");
    el.style.setProperty("--space-card", "var(--space-16)");

    el.style.setProperty("--font-h1", "32px");
    el.style.setProperty("--font-h2", "20px");
    el.style.setProperty("--font-body", "16px");
    el.style.setProperty("--font-small", "14px");
    el.style.setProperty("--font-weight-h1", "750");
    el.style.setProperty("--font-weight-h2", "650");

    // Shadow system: soft + medium only
    el.style.setProperty("--app-shadow-soft", "0 10px 24px -18px rgba(0,0,0,0.70)");
    el.style.setProperty("--app-shadow-medium", "0 18px 36px -24px rgba(0,0,0,0.85)");
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
