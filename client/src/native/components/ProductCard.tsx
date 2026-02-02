import type { NativeActionHandler } from "@/native/types";
import { SafeImage } from "@/native/components/SafeImage";

export function ProductCard({
  product,
  themeColor,
  onAction,
}: {
  product: any;
  themeColor: string;
  onAction: NativeActionHandler;
}) {
  return (
    <button
      type="button"
      className="app-card app-card-hover overflow-hidden text-left app-press"
      onClick={() => {
        const productId = String(product?.id || product?.productId || "").trim();
        onAction(`product:${productId || "unknown"}`, product);
      }}
    >
      <SafeImage
        src={product?.image || product?.imageUrl || product?.src}
        alt={product?.name || product?.title || "Product"}
        className="w-full aspect-square object-cover"
        placeholderClassName="w-full aspect-square bg-white/5"
      />
      <div className="p-[var(--space-card)]">
        <div className="text-[length:var(--font-body)] font-medium text-[color:var(--app-text)] truncate">
          {product?.name || product?.title || "Product"}
        </div>
        <div className="flex items-center justify-between mt-[var(--space-8)]">
          <div className="text-[length:var(--font-h2)] font-[var(--font-weight-h2)]" style={{ color: themeColor }}>
            {product?.price || product?.amount || ""}
          </div>
          {product?.rating && <div className="text-[10px] text-amber-600">★ {product.rating}</div>}
        </div>
      </div>
    </button>
  );
}
