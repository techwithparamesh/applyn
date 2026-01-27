import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isHttpUrl(url?: string | null) {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

export function getAppUrlDisplay(url?: string | null, isNativeOnly?: boolean | null) {
  if (isNativeOnly || !url || url === "native://app" || url.startsWith("native://")) {
    return "Native App";
  }
  return url;
}
