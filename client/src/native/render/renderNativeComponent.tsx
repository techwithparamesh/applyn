import type { ReactNode } from "react";
import type { NativeComponent, NativeRenderContext } from "@/native/types";
import { SafeImage } from "@/native/components/SafeImage";
import { ChipButton, PrimaryButton } from "@/native/components/ChipButton";
import { HeroSection } from "@/native/components/HeroSection";
import { ProductGrid } from "@/native/components/ProductGrid";
import { Divider, Heading, Spacer, TextBlock } from "@/native/components/Primitives";
import { NativeIcon } from "@/native/icons";

const SPACE_PX_TO_VAR: Record<number, string> = {
  0: "0px",
  4: "var(--space-4)",
  8: "var(--space-8)",
  16: "var(--space-16)",
  24: "var(--space-24)",
  32: "var(--space-32)",
  48: "var(--space-48)",
};

function paddingClass(padding: unknown): string | null {
  if (padding === 0 || padding === "0" || padding === "0px") return "p-0";
  if (
    typeof padding === "string" &&
    /^var\(--space-(4|8|16|24|32|48|section-y|hero-y|grid-gap|card)\)$/.test(padding)
  ) {
    return `p-[${padding}]`;
  }
  if (typeof padding === "number" && padding in SPACE_PX_TO_VAR) {
    return `p-[${SPACE_PX_TO_VAR[padding]}]`;
  }
  return null;
}

function gapStyleClass(gap: unknown): string | null {
  if (gap === 0 || gap === "0" || gap === "0px") return "gap-0";
  if (
    typeof gap === "string" &&
    /^var\(--space-(4|8|16|24|32|48|section-y|hero-y|grid-gap|card)\)$/.test(gap)
  ) {
    return `gap-[${gap}]`;
  }
  if (typeof gap === "number" && gap in SPACE_PX_TO_VAR) {
    return `gap-[${SPACE_PX_TO_VAR[gap]}]`;
  }
  return null;
}

function gridColsClass(cols: unknown): string | null {
  const c = typeof cols === "number" ? cols : Number(cols);
  if (!Number.isFinite(c)) return null;
  if (c === 1) return "grid-cols-1";
  if (c === 2) return "grid-cols-2";
  if (c === 3) return "grid-cols-3";
  if (c === 4) return "grid-cols-4";
  return null;
}

export function renderNativeComponent(
  component: NativeComponent,
  ctx: NativeRenderContext,
): ReactNode {
  switch (component.type) {
    case "spacer": {
      const height = component.props?.height;
      return <Spacer height={height ?? "var(--space-3)"} />;
    }
    case "divider": {
      const thickness = Number(component.props?.thickness ?? 1);
      const color = component.props?.color || "#e5e7eb";
      return <Divider thickness={thickness} color={color} />;
    }
    case "text":
      return <TextBlock text={component.props?.text} color={component.props?.color} />;
    case "heading":
      return <Heading level={component.props?.level} text={component.props?.text} color={component.props?.color} />;
    case "image":
      return component.props?.src ? (
        <SafeImage
          src={component.props.src}
          alt={component.props?.alt || ""}
          className="w-full rounded-[var(--app-radius-card)]"
          placeholderClassName="w-full h-32 bg-white/5 rounded-[var(--app-radius-card)]"
        />
      ) : (
        <div className="w-full h-32 bg-white/5 rounded-[var(--app-radius-card)]" />
      );
    case "button": {
      const text: string = component.props?.text || "Button";
      const explicitAction = component.props?.action || component.props?.buttonAction;

      const isChip =
        (component.props?.size === "sm" || component.props?.variant === "outline" || component.props?.variant === "primary") &&
        !(typeof explicitAction === "string" && explicitAction.trim());

      const isCategory =
        isChip ||
        ["All", "Vegetables", "Fruits", "Dairy", "New Drops", "Hoodies", "Tees", "Sneakers", "Accessories"].includes(text);

      const isActive = isCategory && text === ctx.activeCategory;

      if (isCategory) {
        return (
          <ChipButton
            text={text}
            isActive={isActive}
            themeColor={ctx.themeColor}
            onClick={() => ctx.setActiveCategory(text)}
          />
        );
      }

      // Heuristic for older templates: checkout button often has text only.
      const fallbackAction = !explicitAction && /checkout/i.test(text) ? "navigate:checkout" : undefined;
      const action = typeof explicitAction === "string" && explicitAction.trim() ? explicitAction.trim() : fallbackAction;

      return (
        <ChipButton
          text={text}
          isActive={false}
          themeColor={ctx.themeColor}
          onClick={() => {
            if (action) ctx.onAction(action);
          }}
        />
      );
    }
    case "card": {
      const title = component.props?.title;
      const subtitle = component.props?.subtitle;
      const description = component.props?.description;
      const icon = component.props?.icon;
      const image = component.props?.image;
      const compact = !!component.props?.compact;
      const horizontal = !!component.props?.horizontal;
      const backgroundColor = component.props?.backgroundColor;

      if (horizontal) {
        return (
          <div
            className="app-card app-card-hover app-press flex items-center gap-[var(--space-16)] p-[var(--space-card)]"
            style={backgroundColor ? { backgroundColor } : undefined}
          >
            {image ? (
              <SafeImage
                src={image}
                alt={title || "Card"}
                className="w-14 aspect-square rounded-[var(--app-radius-card)] object-cover"
                placeholderClassName="w-14 aspect-square rounded-[var(--app-radius-card)] bg-white/5"
              />
            ) : (
              <div className="w-14 aspect-square rounded-[var(--app-radius-card)] bg-white/5 flex items-center justify-center">
                <NativeIcon name={icon || "package"} className="h-5 w-5 text-[color:var(--app-muted-text)]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {title && (
                <div className="text-[length:var(--font-body)] font-semibold text-[color:var(--app-text)] truncate">{title}</div>
              )}
              {subtitle && (
                <div className="text-[length:var(--font-small)] text-[color:var(--app-muted-text)] truncate mt-[var(--space-4)]">
                  {subtitle}
                </div>
              )}
            </div>
            <div className="text-[color:var(--app-muted-text)]">›</div>
          </div>
        );
      }

      return (
        <div
          className={"app-card app-card-hover " + (compact ? "p-[var(--space-16)]" : "p-[var(--space-card)]")}
          style={backgroundColor ? { backgroundColor } : undefined}
        >
          <div className="flex items-start gap-[var(--space-16)]">
            {icon && (
              <div className="mt-[2px]">
                <NativeIcon name={icon} className="h-5 w-5 text-[color:var(--app-muted-text)]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {title && (
                <div className="text-[length:var(--font-body)] font-semibold text-[color:var(--app-text)] truncate">{title}</div>
              )}
              {subtitle && (
                <div className="text-[length:var(--font-small)] text-[color:var(--app-muted-text)] truncate mt-[var(--space-4)]">
                  {subtitle}
                </div>
              )}
              {description && !compact && (
                <div className="text-[length:var(--font-small)] text-[color:var(--app-muted-text)] mt-[var(--space-8)] line-clamp-2">
                  {description}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    case "container": {
      const padding = component.props?.padding ?? "var(--space-card)";
      const backgroundColor = component.props?.backgroundColor;
      const pClass = paddingClass(padding) || "p-[var(--space-card)]";
      return (
        <div
          className={(pClass ? `${pClass} ` : "") + "rounded-[var(--app-radius-card)]"}
          style={backgroundColor ? { backgroundColor } : undefined}
        >
          {component.children?.map((child) => (
            <NativeComponentRenderer key={child.id} component={child} ctx={ctx} />
          ))}
        </div>
      );
    }
    case "grid": {
      const cols = component.props?.columns || 2;
      const gap = component.props?.gap ?? "var(--space-grid-gap)";
      const colsClass = gridColsClass(cols);
      const gapClass = gapStyleClass(gap) || "gap-[var(--space-grid-gap)]";
      return (
        <div
          className={
            "grid " +
            (colsClass ? colsClass + " " : "") +
            (gapClass ? gapClass : "")
          }
          style={!colsClass ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined}
        >
          {component.children?.map((child) => (
            <NativeComponentRenderer key={child.id} component={child} ctx={ctx} />
          ))}
        </div>
      );
    }
    case "section": {
      const padding = component.props?.padding;
      const yClass =
        typeof padding === "string" && /^var\(--space-(4|8|16|24|32|48|section-y|hero-y|grid-gap|card)\)$/.test(padding)
          ? `py-[${padding}]`
          : padding === 0
            ? "py-0"
            : "py-[var(--space-section-y)]";
      return (
        <div className={"px-[var(--space-24)] " + yClass}>
          {component.props?.title && (
            <div className="text-[length:var(--font-h2)] font-[var(--font-weight-h2)] mb-[var(--space-16)] text-[color:var(--app-text)]">
              {component.props.title}
            </div>
          )}
          {component.children?.map((child) => (
            <NativeComponentRenderer key={child.id} component={child} ctx={ctx} />
          ))}
        </div>
      );
    }
    case "list": {
      const items: any[] = Array.isArray(component.props?.items) ? component.props.items : [];
      const variant = component.props?.variant;

      if (variant === "menu") {
        return (
          <div className="app-card overflow-hidden divide-y divide-white/5">
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="w-full flex items-center gap-[var(--space-16)] px-[var(--space-24)] py-[var(--space-16)] text-left hover:bg-white/5 app-press"
                onClick={() => {
                  const action = typeof item?.action === "string" ? item.action : "";
                  if (action) ctx.onAction(action, item);
                  else ctx.onAction("navigate:" + String(item?.label || item?.name || "").toLowerCase().replace(/\s+/g, ""), item);
                }}
              >
                <NativeIcon name={item?.icon || "list"} className="h-4 w-4 text-[color:var(--app-muted-text)]" />
                <span className="text-[length:var(--font-body)] flex-1 truncate text-[color:var(--app-text)]">
                  {item?.label || item?.name || item?.title}
                </span>
                <NativeIcon name="chevron-right" className="h-4 w-4 text-[color:var(--app-muted-text)]" />
              </button>
            ))}
          </div>
        );
      }

      if (variant === "menu-item") {
        return (
          <div className="space-y-[var(--space-16)]">
            {items.map((item, idx) => (
              <div key={idx} className="app-card flex gap-[var(--space-16)] p-[var(--space-card)]">
                <SafeImage
                  src={item?.image || item?.imageUrl || item?.src}
                  alt={item?.name || item?.title || "Item"}
                  className="w-16 aspect-square rounded-[var(--app-radius-card)] object-cover"
                  placeholderClassName="w-16 aspect-square rounded-[var(--app-radius-card)] bg-white/5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[length:var(--font-body)] font-semibold truncate text-[color:var(--app-text)]">
                      {item?.name || item?.title || item?.label || "Untitled"}
                    </div>
                    <div className="text-sm font-semibold whitespace-nowrap" style={{ color: ctx.themeColor }}>
                      {item?.price || item?.amount || item?.total || ""}
                    </div>
                  </div>
                  {(item?.description || item?.desc) && (
                    <div className="text-[length:var(--font-small)] text-[color:var(--app-muted-text)] mt-[var(--space-8)] line-clamp-2">
                      {item.description || item.desc}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {item?.badge && (
                      <span
                        className={
                          "text-[10px] px-2 py-0.5 rounded-full border " +
                          (String(item.badge).toLowerCase().includes("veg")
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200")
                        }
                      >
                        {item.badge}
                      </span>
                    )}
                    <button className="ml-auto text-[11px] px-3 py-1 rounded-full text-white app-press" style={{ backgroundColor: ctx.themeColor }}>
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }

      if (variant === "cart" || variant === "orders") {
        return (
          <div className="space-y-[var(--space-16)]">
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="app-card app-press w-full flex items-center gap-[var(--space-16)] p-[var(--space-16)] text-left hover:bg-white/5"
                onClick={() => {
                  if (variant === "orders") {
                    const orderId = String(item?.id || item?.name || item?.label || "");
                    ctx.onAction(orderId ? `order:${orderId}` : "order:unknown", item);
                    return;
                  }
                  const productId = String(item?.id || item?.productId || "");
                  ctx.onAction(productId ? `product:${productId}` : "product:unknown", item);
                }}
              >
                <SafeImage
                  src={item?.image || item?.imageUrl || item?.src}
                  alt={item?.name || item?.title || "Item"}
                  className="w-14 aspect-square rounded-[var(--app-radius-card)] object-cover"
                  placeholderClassName="w-14 aspect-square rounded-[var(--app-radius-card)] bg-white/5"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[length:var(--font-body)] font-semibold truncate text-[color:var(--app-text)]">
                    {item?.name || item?.title || item?.label || "Item"}
                  </div>
                  <div className="text-[length:var(--font-small)] text-[color:var(--app-muted-text)] mt-[var(--space-4)]">
                    {item?.quantity || item?.qty ? `Qty: ${item.quantity || item.qty}` : item?.status || item?.variant || ""}
                  </div>
                </div>
                <div className="text-[length:var(--font-body)] font-semibold whitespace-nowrap text-[color:var(--app-text)]">
                  {item?.price || item?.amount || item?.total || ""}
                </div>
              </button>
            ))}
          </div>
        );
      }

      return (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="text-sm text-gray-700">
              {typeof item === "string" ? item : item?.label || item?.name || item?.title}
            </div>
          ))}
        </div>
      );
    }
    case "input":
      return (
        <input
          className="w-full px-[var(--space-16)] py-[var(--space-16)] border border-[color:var(--app-border)] rounded-[var(--app-radius-card)] text-[length:var(--font-body)] bg-[color:var(--app-surface)] text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted-text)]"
          placeholder={component.props?.placeholder}
          type={component.props?.type || "text"}
        />
      );
    case "carousel": {
      const items: any[] = Array.isArray(component.props?.items) ? component.props.items : [];
      return (
        <div className="-mx-4 px-4">
          <div className="flex gap-[var(--space-16)] overflow-x-auto pb-[var(--space-16)]">
            {items.slice(0, 10).map((item, idx) => (
              <div key={idx} className="flex-shrink-0 w-44 app-card overflow-hidden">
                {item?.image && (
                  <SafeImage
                    src={item.image}
                    alt={item?.title || ""}
                    className="w-full h-24 object-cover"
                    placeholderClassName="w-full h-24 bg-white/5"
                  />
                )}
                <div className="p-[var(--space-16)]">
                  <div className="text-[length:var(--font-small)] font-semibold text-[color:var(--app-text)] truncate">
                    {item?.title || item?.name || "Item"}
                  </div>
                  {item?.subtitle && (
                    <div className="text-[length:var(--font-small)] text-[color:var(--app-muted-text)] mt-[var(--space-4)] line-clamp-2">
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-[length:var(--font-small)] text-[color:var(--app-muted-text)]">No items</div>
            )}
          </div>
        </div>
      );
    }
    case "testimonial": {
      const items: any[] = Array.isArray(component.props?.items) ? component.props.items : [];
      return (
        <div className="space-y-[var(--space-16)]">
          {items.slice(0, 4).map((t, idx) => (
            <div key={idx} className="app-card p-[var(--space-card)]">
              <div className="text-[length:var(--font-body)] text-[color:var(--app-text)] leading-relaxed">“{t?.quote || t?.text || "Great experience!"}”</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-[length:var(--font-small)] font-semibold text-[color:var(--app-text)] truncate">{t?.name || "Customer"}</div>
                {t?.rating && (
                  <div className="text-[length:var(--font-small)] text-[color:var(--app-muted-text)] flex items-center gap-[var(--space-4)]">
                    <NativeIcon name="star" className="h-4 w-4" />
                    {t.rating}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "stats": {
      const items: any[] = Array.isArray(component.props?.items) ? component.props.items : [];
      const columns = component.props?.columns || 2;
      return (
        <div className="grid gap-[var(--space-16)]" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {items.slice(0, 6).map((s, idx) => (
            <div key={idx} className="app-card p-[var(--space-card)]">
              <div className="text-lg font-bold text-[color:var(--app-primary)]">
                {s?.value ?? s?.number ?? "0"}
              </div>
              <div className="text-[length:var(--font-small)] text-[color:var(--app-muted-text)] mt-[var(--space-4)]">
                {s?.label || s?.title || "Stat"}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "team": {
      const members: any[] = Array.isArray(component.props?.members) ? component.props.members : [];
      return (
        <div className="grid grid-cols-2 gap-[var(--space-16)]">
          {members.slice(0, 6).map((m, idx) => (
            <div key={idx} className="app-card overflow-hidden">
              {m?.image ? (
                <SafeImage
                  src={m.image}
                  alt={m?.name || "Member"}
                  className="w-full h-20 object-cover"
                  placeholderClassName="w-full h-20 bg-white/5"
                />
              ) : (
                <div className="w-full h-20 bg-white/5" />
              )}
              <div className="p-[var(--space-16)]">
                <div className="text-[length:var(--font-small)] font-semibold text-[color:var(--app-text)] truncate">{m?.name || "Team"}</div>
                {m?.role && (
                  <div className="text-[length:var(--font-small)] text-[color:var(--app-muted-text)] truncate mt-[var(--space-4)]">
                    {m.role}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "socialLinks": {
      const links: any[] = Array.isArray(component.props?.links) ? component.props.links : [];
      return (
        <div className="flex flex-wrap gap-[var(--space-8)]">
          {links.slice(0, 8).map((l, idx) => (
            <button
              key={idx}
              className="app-card app-press px-[var(--space-16)] py-[var(--space-16)] text-[length:var(--font-small)] font-semibold text-[color:var(--app-text)] inline-flex items-center gap-[var(--space-8)]"
              style={l?.color ? { borderColor: `${l.color}40` } : undefined}
            >
              <NativeIcon name={l?.icon || "link"} className="h-4 w-4 text-[color:var(--app-muted-text)]" />
              {l?.label || l?.name || "Link"}
            </button>
          ))}
        </div>
      );
    }
    case "contactForm": {
      const fields: any[] = Array.isArray(component.props?.fields) ? component.props.fields : [];
      const buttonText = component.props?.buttonText || "Send";
      return (
        <div className="app-card p-[var(--space-card)] space-y-[var(--space-16)]">
          {fields.slice(0, 6).map((f, idx) => (
            <label key={idx} className="block">
              <div className="text-[length:var(--font-small)] font-semibold text-[color:var(--app-muted-text)] mb-[var(--space-8)]">
                {f?.label || "Field"}
              </div>
              <input
                className="w-full px-[var(--space-16)] py-[var(--space-16)] border border-[color:var(--app-border)] rounded-[var(--app-radius-card)] text-[length:var(--font-body)] bg-[color:var(--app-surface)] text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted-text)]"
                placeholder={f?.placeholder || ""}
                type={f?.type || "text"}
              />
            </label>
          ))}
          <PrimaryButton text={buttonText} themeColor={ctx.themeColor} action={component.props?.buttonAction} onAction={ctx.onAction} />
        </div>
      );
    }
    case "map": {
      const height = Number(component.props?.height ?? 150);
      const latitude = component.props?.latitude;
      const longitude = component.props?.longitude;
      return (
        <div
          className="w-full rounded-[var(--app-radius-card)] border border-[color:var(--app-border)] bg-gradient-to-br from-white/5 to-white/0 flex items-center justify-center text-[length:var(--font-small)] text-[color:var(--app-muted-text)]"
          style={{ height: Number.isFinite(height) ? height : 150 }}
        >
          Map preview {latitude != null && longitude != null ? `(${latitude}, ${longitude})` : ""}
        </div>
      );
    }
    case "hero":
      return (
        <HeroSection
          title={component.props?.title}
          subtitle={component.props?.subtitle}
          buttonText={component.props?.buttonText}
          buttonAction={component.props?.buttonAction}
          themeColor={ctx.themeColor}
          backgroundImage={component.props?.backgroundImage}
          overlayColor={component.props?.overlayColor}
          onAction={ctx.onAction}
        />
      );
    case "productGrid": {
      const products: any[] = Array.isArray(component.props?.products) ? component.props.products : [];
      return (
        <ProductGrid
          products={products}
          columns={component.props?.columns}
          activeCategory={ctx.activeCategory}
          themeColor={ctx.themeColor}
          onAction={ctx.onAction}
        />
      );
    }
    default:
      return (
        <div className="p-3 rounded-xl border border-dashed border-gray-300 bg-white text-[11px] text-gray-500">
          Unsupported component: <span className="font-semibold">{String(component.type || "unknown")}</span>
        </div>
      );
  }
}

export function NativeComponentRenderer({
  component,
  ctx,
}: {
  component: NativeComponent;
  ctx: NativeRenderContext;
}) {
  const rendered = renderNativeComponent(component, ctx);
  if (!rendered) return null;
  return <div className="app-fade-in">{rendered}</div>;
}
