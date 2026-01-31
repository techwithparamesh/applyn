import type { ReactNode } from "react";
import type { NativeComponent, NativeRenderContext } from "@/native/types";
import { SafeImage } from "@/native/components/SafeImage";
import { ChipButton, PrimaryButton } from "@/native/components/ChipButton";
import { HeroSection } from "@/native/components/HeroSection";
import { ProductGrid } from "@/native/components/ProductGrid";
import { Divider, Heading, Spacer, TextBlock } from "@/native/components/Primitives";

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
          className="w-full rounded-lg"
          placeholderClassName="w-full h-32 bg-gray-100 rounded-lg"
        />
      ) : (
        <div className="w-full h-32 bg-gray-100 rounded-lg" />
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
            className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white"
            style={backgroundColor ? { backgroundColor } : undefined}
          >
            {image ? (
              <SafeImage
                src={image}
                alt={title || "Card"}
                className="w-14 h-14 rounded-lg object-cover"
                placeholderClassName="w-14 h-14 rounded-lg bg-gray-100"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xl">{icon || "📦"}</div>
            )}
            <div className="flex-1 min-w-0">
              {title && <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>}
              {subtitle && <div className="text-[11px] text-gray-500 truncate">{subtitle}</div>}
            </div>
            <div className="text-gray-400">›</div>
          </div>
        );
      }

      return (
        <div
          className={"rounded-xl border border-gray-200 bg-white " + (compact ? "p-3" : "p-4")}
          style={backgroundColor ? { backgroundColor } : undefined}
        >
          <div className="flex items-start gap-3">
            {icon && <div className="text-2xl leading-none">{icon}</div>}
            <div className="flex-1 min-w-0">
              {title && <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>}
              {subtitle && <div className="text-[11px] text-gray-500 truncate">{subtitle}</div>}
              {description && !compact && (
                <div className="text-[11px] text-gray-600 mt-1 line-clamp-2">{description}</div>
              )}
            </div>
          </div>
        </div>
      );
    }
    case "container": {
      const padding = component.props?.padding ?? 0;
      const backgroundColor = component.props?.backgroundColor;
      return (
        <div className="rounded-lg" style={{ padding, backgroundColor }}>
          {component.children?.map((child) => (
            <NativeComponentRenderer key={child.id} component={child} ctx={ctx} />
          ))}
        </div>
      );
    }
    case "grid": {
      const cols = component.props?.columns || 2;
      const gap = component.props?.gap ?? 8;
      return (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
          {component.children?.map((child) => (
            <NativeComponentRenderer key={child.id} component={child} ctx={ctx} />
          ))}
        </div>
      );
    }
    case "section": {
      const padding = component.props?.padding ?? 0;
      return (
        <div className="rounded-lg" style={{ padding }}>
          {component.props?.title && <div className="text-lg font-semibold mb-2">{component.props.title}</div>}
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
          <div className="bg-white rounded-lg divide-y divide-gray-100 border border-gray-200">
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                onClick={() => {
                  const action = typeof item?.action === "string" ? item.action : "";
                  if (action) ctx.onAction(action, item);
                  else ctx.onAction("navigate:" + String(item?.label || item?.name || "").toLowerCase().replace(/\s+/g, ""), item);
                }}
              >
                <span className="text-lg">{item?.icon || "➡️"}</span>
                <span className="text-sm flex-1 truncate">{item?.label || item?.name || item?.title}</span>
                <span className="text-gray-400">›</span>
              </button>
            ))}
          </div>
        );
      }

      if (variant === "menu-item") {
        return (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-3 p-3 bg-white rounded-lg border border-gray-200">
                <SafeImage
                  src={item?.image || item?.imageUrl || item?.src}
                  alt={item?.name || item?.title || "Item"}
                  className="w-16 h-16 rounded-md object-cover"
                  placeholderClassName="w-16 h-16 rounded-md bg-gray-100"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold truncate">{item?.name || item?.title || item?.label || "Untitled"}</div>
                    <div className="text-sm font-semibold whitespace-nowrap" style={{ color: ctx.themeColor }}>
                      {item?.price || item?.amount || item?.total || ""}
                    </div>
                  </div>
                  {(item?.description || item?.desc) && (
                    <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{item.description || item.desc}</div>
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
                    <button className="ml-auto text-[11px] px-3 py-1 rounded-full text-white" style={{ backgroundColor: ctx.themeColor }}>
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
          <div className="space-y-3">
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="w-full flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200 text-left hover:bg-gray-50"
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
                  className="w-14 h-14 rounded object-cover"
                  placeholderClassName="w-14 h-14 rounded bg-gray-100"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item?.name || item?.title || item?.label || "Item"}</div>
                  <div className="text-[11px] text-gray-500">
                    {item?.quantity || item?.qty ? `Qty: ${item.quantity || item.qty}` : item?.status || item?.variant || ""}
                  </div>
                </div>
                <div className="text-sm font-semibold whitespace-nowrap">{item?.price || item?.amount || item?.total || ""}</div>
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
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          placeholder={component.props?.placeholder}
          type={component.props?.type || "text"}
        />
      );
    case "carousel": {
      const items: any[] = Array.isArray(component.props?.items) ? component.props.items : [];
      return (
        <div className="-mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {items.slice(0, 10).map((item, idx) => (
              <div key={idx} className="flex-shrink-0 w-44 bg-white rounded-xl border border-gray-200 overflow-hidden">
                {item?.image && (
                  <SafeImage
                    src={item.image}
                    alt={item?.title || ""}
                    className="w-full h-24 object-cover"
                    placeholderClassName="w-full h-24 bg-gray-100"
                  />
                )}
                <div className="p-3">
                  <div className="text-xs font-semibold text-gray-900 truncate">{item?.title || item?.name || "Item"}</div>
                  {item?.subtitle && <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{item.subtitle}</div>}
                </div>
              </div>
            ))}
            {items.length === 0 && <div className="text-xs text-gray-500">No items</div>}
          </div>
        </div>
      );
    }
    case "testimonial": {
      const items: any[] = Array.isArray(component.props?.items) ? component.props.items : [];
      return (
        <div className="space-y-3">
          {items.slice(0, 4).map((t, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[11px] text-gray-700 leading-relaxed">“{t?.quote || t?.text || "Great experience!"}”</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold text-gray-900 truncate">{t?.name || "Customer"}</div>
                {t?.rating && <div className="text-[10px] text-amber-600">★ {t.rating}</div>}
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
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {items.slice(0, 6).map((s, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-lg font-bold" style={{ color: ctx.themeColor }}>
                {s?.value ?? s?.number ?? "0"}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">{s?.label || s?.title || "Stat"}</div>
            </div>
          ))}
        </div>
      );
    }
    case "team": {
      const members: any[] = Array.isArray(component.props?.members) ? component.props.members : [];
      return (
        <div className="grid grid-cols-2 gap-3">
          {members.slice(0, 6).map((m, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {m?.image ? (
                <SafeImage
                  src={m.image}
                  alt={m?.name || "Member"}
                  className="w-full h-20 object-cover"
                  placeholderClassName="w-full h-20 bg-gray-100"
                />
              ) : (
                <div className="w-full h-20 bg-gray-100" />
              )}
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-900 truncate">{m?.name || "Team"}</div>
                {m?.role && <div className="text-[10px] text-gray-500 truncate">{m.role}</div>}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "socialLinks": {
      const links: any[] = Array.isArray(component.props?.links) ? component.props.links : [];
      return (
        <div className="flex flex-wrap gap-2">
          {links.slice(0, 8).map((l, idx) => (
            <button
              key={idx}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-800"
              style={l?.color ? { borderColor: `${l.color}40` } : undefined}
            >
              <span className="mr-1">{l?.icon || "🔗"}</span>
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
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
          {fields.slice(0, 6).map((f, idx) => (
            <input
              key={idx}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              placeholder={f?.placeholder || f?.label || "Field"}
              type={f?.type || "text"}
            />
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
          className="w-full rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-xs text-gray-500"
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
          height={component.props?.height}
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
  return <div className="space-y-2">{rendered}</div>;
}
