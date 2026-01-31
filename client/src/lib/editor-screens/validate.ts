import { editorComponentTypeSchema, editorScreensSchema } from "@shared/editor-screens";

const ALLOWED = new Set<string>(editorComponentTypeSchema.options);

function collectUnsupportedTypes(node: any, out: Set<string>) {
  if (!node || typeof node !== "object") return;
  const t = String((node as any).type || "");
  if (t && !ALLOWED.has(t)) out.add(t);
  const children = Array.isArray((node as any).children) ? (node as any).children : [];
  for (const c of children) collectUnsupportedTypes(c, out);
}

export function validateEditorScreensOrThrow(screens: unknown) {
  const parsed = editorScreensSchema.safeParse(screens);
  if (parsed.success) return parsed.data;

  // Add a more actionable message if the issue is component type related.
  const unsupported = new Set<string>();
  if (Array.isArray(screens)) {
    for (const s of screens as any[]) {
      const comps = Array.isArray((s as any)?.components) ? (s as any).components : [];
      for (const c of comps) collectUnsupportedTypes(c, unsupported);
    }
  }

  if (unsupported.size > 0) {
    const list = Array.from(unsupported).sort().join(", ");
    throw new Error(`Unsupported component type(s): ${list}`);
  }

  // Fall back to generic Zod details.
  const first = parsed.error.issues?.[0];
  const path = first?.path?.length ? first.path.join(".") : "editorScreens";
  throw new Error(`Invalid editor screens at ${path}: ${first?.message || "invalid"}`);
}
