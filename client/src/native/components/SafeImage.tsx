import { useState } from "react";
import { resolveImageSrc } from "@/lib/images";

export function SafeImage({
  src,
  alt,
  className,
  placeholderClassName,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const effectiveSrc = resolveImageSrc(src);

  const canRender = Boolean(effectiveSrc) && !failed;
  if (!canRender) {
    return <div className={placeholderClassName || "bg-gray-100"} aria-hidden />;
  }

  return (
    <img
      src={effectiveSrc}
      alt={alt || ""}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
