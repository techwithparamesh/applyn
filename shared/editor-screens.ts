import { z } from "zod";

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
  })
);

export const editorScreenSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(80),
  icon: z.string().max(20).optional().default("📄"),
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
