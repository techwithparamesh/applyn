import type { ThemePresetId } from "@shared/blueprints";

export type ThemePreset = {
  id: ThemePresetId;
  label: string;
  // Core colors
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  // Shape + elevation
  radiusCard: string;
  radiusButton: string;
  shadowCard: string;
};

export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  default: {
    id: "default",
    label: "Default",
    primary: "#2563EB",
    secondary: "#7C3AED",
    background: "#0B1220",
    surface: "#111827",
    text: "#F9FAFB",
    mutedText: "#9CA3AF",
    border: "rgba(255,255,255,0.08)",
    radiusCard: "16px",
    radiusButton: "24px",
    shadowCard: "var(--app-shadow-soft)",
  },
  streetwear: {
    id: "streetwear",
    label: "Streetwear",
    primary: "#F97316",
    secondary: "#A855F7",
    background: "#09090B",
    surface: "#0F172A",
    text: "#F8FAFC",
    mutedText: "#94A3B8",
    border: "rgba(255,255,255,0.10)",
    radiusCard: "16px",
    radiusButton: "24px",
    shadowCard: "var(--app-shadow-soft)",
  },
  grocery: {
    id: "grocery",
    label: "Grocery",
    primary: "#16A34A",
    secondary: "#F59E0B",
    background: "#0B1220",
    surface: "#0F1B2D",
    text: "#F9FAFB",
    mutedText: "#9CA3AF",
    border: "rgba(255,255,255,0.08)",
    radiusCard: "16px",
    radiusButton: "24px",
    shadowCard: "var(--app-shadow-soft)",
  },
  "restaurant-modern": {
    id: "restaurant-modern",
    label: "Restaurant (Modern)",
    primary: "#EF4444",
    secondary: "#F59E0B",
    background: "#0B1220",
    surface: "#111827",
    text: "#F9FAFB",
    mutedText: "#9CA3AF",
    border: "rgba(255,255,255,0.08)",
    radiusCard: "16px",
    radiusButton: "24px",
    shadowCard: "var(--app-shadow-soft)",
  },
  "realestate-minimal": {
    id: "realestate-minimal",
    label: "Real Estate (Minimal)",
    primary: "#0EA5E9",
    secondary: "#64748B",
    background: "#0B1220",
    surface: "#0F172A",
    text: "#F8FAFC",
    mutedText: "#94A3B8",
    border: "rgba(255,255,255,0.08)",
    radiusCard: "16px",
    radiusButton: "24px",
    shadowCard: "var(--app-shadow-soft)",
  },
  "healthcare-calm": {
    id: "healthcare-calm",
    label: "Healthcare (Calm)",
    primary: "#06B6D4",
    secondary: "#22C55E",
    background: "#07121D",
    surface: "#0B1B2B",
    text: "#F8FAFC",
    mutedText: "#93A4B8",
    border: "rgba(255,255,255,0.08)",
    radiusCard: "16px",
    radiusButton: "24px",
    shadowCard: "var(--app-shadow-soft)",
  },
};

export function getThemePreset(id: ThemePresetId): ThemePreset {
  return THEME_PRESETS[id] || THEME_PRESETS.default;
}
