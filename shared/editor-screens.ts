import { z } from "zod";
import type { SpacingToken } from "./blueprints";
import { isSpacingToken } from "./blueprints";

function spacingPxToToken(px: number): SpacingToken {
  if (px <= 0) return "var(--space-0)";
  if (px <= 4) return "var(--space-4)";
  if (px <= 8) return "var(--space-8)";
  if (px <= 16) return "var(--space-16)";
  if (px <= 24) return "var(--space-24)";
  if (px <= 32) return "var(--space-32)";
  return "var(--space-48)";
}

export function migrateLegacySpacingValue(value: unknown): SpacingToken | null {
  if (isSpacingToken(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return spacingPxToToken(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isSpacingToken(trimmed)) return trimmed;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum)) return spacingPxToToken(asNum);
  }
  return null;
}

export function migrateLegacySpacingInEditorScreens<T>(screens: T): {
  screens: T;
  didMigrate: boolean;
} {
  if (!Array.isArray(screens)) return { screens, didMigrate: false };

  let didMigrate = false;
  const migrateComponent = (c: any): any => {
    if (!c || typeof c !== "object") return c;
    const next: any = { ...c };
    const props: any = c.props && typeof c.props === "object" ? { ...c.props } : {};

    if ("padding" in props) {
      const migrated = migrateLegacySpacingValue(props.padding);
      if (migrated && migrated !== props.padding) {
        props.padding = migrated;
        didMigrate = true;
      }
    }

    if ("gap" in props) {
      const migrated = migrateLegacySpacingValue(props.gap);
      if (migrated && migrated !== props.gap) {
        props.gap = migrated;
        didMigrate = true;
      }
    }

    if (c.type === "spacer" && "height" in props) {
      const migrated = migrateLegacySpacingValue(props.height);
      if (migrated && migrated !== props.height) {
        props.height = migrated;
        didMigrate = true;
      }
    }

    next.props = props;
    if (Array.isArray(c.children)) next.children = c.children.map(migrateComponent);
    return next;
  };

  const migratedScreens = (screens as any[]).map((s) => {
    const next = { ...s };
    if (Array.isArray((s as any).components)) {
      (next as any).components = (s as any).components.map(migrateComponent);
    }
    return next;
  });

  return { screens: migratedScreens as any as T, didMigrate };
}

// Component types that are supported by the native preview renderer.
// This is intentionally an allowlist so ad-hoc types cannot be persisted.
export const editorComponentTypeSchema = z.enum([
  "spacer",
  "divider",
  "text",
  "heading",
  "image",
  "button",
  "card",
  "container",
  "grid",
  "section",
  "list",
  "input",
  "carousel",
  "testimonial",
  "stats",
  "team",
  "socialLinks",
  "contactForm",
  "map",
  "hero",
  "productGrid",
]);
export type EditorComponentType = z.infer<typeof editorComponentTypeSchema>;

export type EditorComponent = {
  id: string;
  type: EditorComponentType;
  props: Record<string, any>;
  children?: EditorComponent[];
};

type EditorComponentInput = {
  id: string;
  type: EditorComponentType;
  props?: Record<string, any>;
  children?: EditorComponentInput[];
};

export const editorComponentSchema: z.ZodType<EditorComponent, z.ZodTypeDef, EditorComponentInput> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(200),
    type: editorComponentTypeSchema,
    props: z.record(z.any()).optional().default({}),
    children: z.array(editorComponentSchema).optional(),
  }).superRefine((component, ctx) => {
    const props: any = component.props && typeof component.props === "object" ? component.props : {};

    if ("padding" in props && props.padding != null && !isSpacingToken(props.padding)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid spacing token for props.padding (must be a var(--space-*) token)",
        path: ["props", "padding"],
      });
    }

    if ("gap" in props && props.gap != null && !isSpacingToken(props.gap)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid spacing token for props.gap (must be a var(--space-*) token)",
        path: ["props", "gap"],
      });
    }

    if (component.type === "spacer" && "height" in props && props.height != null && !isSpacingToken(props.height)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid spacing token for spacer props.height (must be a var(--space-*) token)",
        path: ["props", "height"],
      });
    }
  })
);

export const editorScreenSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(80),
  icon: z.string().max(20).optional().default("file-text"),
  isHome: z.boolean().optional(),
  components: z.array(editorComponentSchema).default([]),
});

export const editorScreensSchema = z
  .array(editorScreenSchema)
  .max(50)
  .refine((screens) => {
    // Lightweight size guard: avoid pathological payloads.
    let nodes = 0;
    const walk = (c: any, depth: number) => {
      if (!c || typeof c !== "object") return;
      nodes++;
      if (nodes > 5000) return;
      if (depth > 30) return;
      const children = Array.isArray((c as any).children) ? (c as any).children : [];
      for (const child of children) walk(child, depth + 1);
    };
    for (const s of screens) {
      const comps = Array.isArray((s as any).components) ? (s as any).components : [];
      for (const c of comps) walk(c, 1);
    }
    return nodes <= 5000;
  }, "Editor screens payload too large")
  .optional();

export type EditorScreen = z.infer<typeof editorScreenSchema>;
