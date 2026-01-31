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
      className="bg-white rounded-lg border border-gray-200 overflow-hidden text-left hover:bg-gray-50"
      onClick={() => {
        const productId = String(product?.id || product?.productId || "").trim();
        onAction(`product:${productId || "unknown"}`, product);
      }}
    >
      <SafeImage
        src={product?.image || product?.imageUrl || product?.src}
        alt={product?.name || product?.title || "Product"}
        className="w-full h-24 object-cover"
        placeholderClassName="w-full h-24 bg-gray-100"
      />
      <div className="p-2">
        <div className="text-xs font-medium truncate">{product?.name || product?.title || "Product"}</div>
        <div className="flex items-center justify-between mt-1">
          <div className="text-sm font-bold" style={{ color: themeColor }}>
            {product?.price || product?.amount || ""}
          </div>
          {product?.rating && <div className="text-[10px] text-amber-600">★ {product.rating}</div>}
        </div>
      </div>
    </button>
  );
}
