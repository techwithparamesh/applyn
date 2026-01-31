import type { NativeActionHandler } from "@/native/types";
import { ProductCard } from "@/native/components/ProductCard";

export function ProductGrid({
  products,
  columns,
  activeCategory,
  themeColor,
  onAction,
}: {
  products: any[];
  columns?: number;
  activeCategory: string;
  themeColor: string;
  onAction: NativeActionHandler;
}) {
  const cols = columns || 2;
  const categoryLower = String(activeCategory || "All").toLowerCase();
  const filtered = categoryLower === "all"
    ? products
    : products.filter((p) => String(p?.category || "").toLowerCase() === categoryLower);
  const visible = filtered.length > 0 ? filtered : products;

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {visible.slice(0, 12).map((product, idx) => (
        <ProductCard key={String(product?.id ?? idx)} product={product} themeColor={themeColor} onAction={onAction} />
      ))}
    </div>
  );
}
