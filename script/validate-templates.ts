import { ALL_TEMPLATES } from "../client/src/lib/app-templates";
import { isSpacingToken } from "../shared/blueprints";
import { NATIVE_ICON_IDS } from "../client/src/native/icons";

type ErrorItem = { path: string; message: string };
type WarningItem = { path: string; message: string };

const EMOJI_RE = /\p{Extended_Pictographic}/u;

function isIconId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return NATIVE_ICON_IDS.includes(v);
}

function hasEmoji(value: unknown): boolean {
  return typeof value === "string" && EMOJI_RE.test(value);
}

function pushError(errors: ErrorItem[], path: string, message: string) {
  errors.push({ path, message });
}

function pushWarning(warnings: WarningItem[], path: string, message: string) {
  warnings.push({ path, message });
}

function validateIcon(errors: ErrorItem[], path: string, value: unknown) {
  if (value == null || value === "") return;
  if (hasEmoji(value)) {
    pushError(errors, path, `Icon contains emoji: ${JSON.stringify(value)}`);
    return;
  }
  if (!isIconId(value)) {
    pushError(errors, path, `Icon must be a known icon ID (NativeIcon). Got: ${JSON.stringify(value)}`);
  }
}

// Soft warning only: we do NOT reject emojis in general content.
// This is intentionally scoped to navigation-facing labels only (template/screen names).
function warnOnEmojiInNavLabel(warnings: WarningItem[], path: string, value: unknown) {
  if (value == null || value === "") return;
  if (hasEmoji(value)) {
    pushWarning(
      warnings,
      path,
      `Emoji found in navigation label (warning only). Consider removing for a more consistent premium look. Got: ${JSON.stringify(value)}`,
    );
  }
}

function validateSpacingToken(errors: ErrorItem[], path: string, value: unknown) {
  if (value == null) return;
  if (typeof value === "number") {
    pushError(errors, path, `Spacing must be a token string, not a number: ${value}`);
    return;
  }
  if (typeof value === "string" && value.includes("px")) {
    pushError(errors, path, `Spacing must not use raw 'px' strings: ${JSON.stringify(value)}`);
    return;
  }
  if (!isSpacingToken(value)) {
    pushError(errors, path, `Spacing must be a var(--space-*) token. Got: ${JSON.stringify(value)}`);
  }
}

function validateNoArbitraryStyle(errors: ErrorItem[], path: string, props: any) {
  if (!props || typeof props !== "object") return;
  if ("style" in props) pushError(errors, `${path}.style`, "Templates must not include raw style objects");
  if ("className" in props) pushError(errors, `${path}.className`, "Templates must not include raw className strings");
}

function validateComponent(errors: ErrorItem[], path: string, component: any) {
  if (!component || typeof component !== "object") return;

  const type = String(component.type || "");
  const props = component.props && typeof component.props === "object" ? component.props : {};

  validateNoArbitraryStyle(errors, `${path}.props`, props);

  if ("padding" in props) validateSpacingToken(errors, `${path}.props.padding`, props.padding);
  if ("gap" in props) validateSpacingToken(errors, `${path}.props.gap`, props.gap);

  if (type === "spacer" && "height" in props) {
    validateSpacingToken(errors, `${path}.props.height`, props.height);
  }

  // Common icon prop
  if ("icon" in props) {
    validateIcon(errors, `${path}.props.icon`, props.icon);
  }

  // List menu item icons (and similar)
  if (Array.isArray(props.items)) {
    props.items.forEach((it: any, idx: number) => {
      if (it && typeof it === "object" && "icon" in it) {
        validateIcon(errors, `${path}.props.items[${idx}].icon`, it.icon);
      }
    });
  }

  if (Array.isArray(component.children)) {
    component.children.forEach((child: any, idx: number) => validateComponent(errors, `${path}.children[${idx}]`, child));
  }
}

function validateTemplate(templateId: string, tpl: any): { errors: ErrorItem[]; warnings: WarningItem[] } {
  const errors: ErrorItem[] = [];
  const warnings: WarningItem[] = [];

  warnOnEmojiInNavLabel(warnings, `${templateId}.name`, tpl?.name);

  validateIcon(errors, `${templateId}.icon`, tpl?.icon);

  const screens = Array.isArray(tpl?.screens) ? tpl.screens : [];
  screens.forEach((s: any, sIdx: number) => {
    warnOnEmojiInNavLabel(warnings, `${templateId}.screens[${sIdx}].name`, s?.name);
    validateIcon(errors, `${templateId}.screens[${sIdx}].icon`, s?.icon);

    const components = Array.isArray(s?.components) ? s.components : [];
    components.forEach((c: any, cIdx: number) => validateComponent(errors, `${templateId}.screens[${sIdx}].components[${cIdx}]`, c));
  });

  return { errors, warnings };
}

function main() {
  const allErrors: ErrorItem[] = [];
  const allWarnings: WarningItem[] = [];

  for (const [id, tpl] of Object.entries(ALL_TEMPLATES)) {
    const { errors, warnings } = validateTemplate(id, tpl);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  if (allErrors.length) {
    // Print a stable, readable report.
    for (const e of allErrors) {
      // eslint-disable-next-line no-console
      console.error(`${e.path}: ${e.message}`);
    }
    // eslint-disable-next-line no-console
    console.error(`\nTemplate validation failed with ${allErrors.length} error(s).`);
    process.exit(1);
  }

  if (allWarnings.length) {
    for (const w of allWarnings) {
      // eslint-disable-next-line no-console
      console.warn(`${w.path}: ${w.message}`);
    }
    // eslint-disable-next-line no-console
    console.warn(`\nTemplate validation produced ${allWarnings.length} warning(s).`);
  }

  // eslint-disable-next-line no-console
  console.log(`Template validation passed (${Object.keys(ALL_TEMPLATES).length} templates).`);
}

main();
