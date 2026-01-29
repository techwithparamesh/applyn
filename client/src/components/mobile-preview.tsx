import { DevicePreview } from "@/components/device-preview";
import type { ComponentProps } from "react";

type DevicePreviewProps = ComponentProps<typeof DevicePreview>;

interface MobilePreviewProps {
  url?: DevicePreviewProps["url"];
  appName?: DevicePreviewProps["appName"];
  primaryColor?: DevicePreviewProps["primaryColor"]; // Empty = transparent header
  icon?: DevicePreviewProps["icon"]; // URL or emoji
  /** Prefer a live (iframe) preview over screenshots when possible */
  preferLivePreview?: DevicePreviewProps["preferLivePreview"];
  /** Native app screens for preview */
  screens?: DevicePreviewProps["screens"];
  /** Industry type for generating demo content */
  industry?: DevicePreviewProps["industry"];
  /** Whether app is native only (no website) */
  isNativeOnly?: DevicePreviewProps["isNativeOnly"];
  /** Platforms available based on user's plan */
  availablePlatforms?: DevicePreviewProps["availablePlatforms"];
  /** Initial selected platform */
  defaultPlatform?: DevicePreviewProps["defaultPlatform"];
}

export function MobilePreview({ 
  url = "https://example.com", 
  appName = "My App", 
  primaryColor, // No default - will show transparent if not set
  icon = "📱",
  preferLivePreview = true,
  screens,
  industry,
  isNativeOnly,
  availablePlatforms,
  defaultPlatform,
}: MobilePreviewProps) {
  return (
    <DevicePreview
      url={url}
      appName={appName}
      primaryColor={primaryColor || ""}
      icon={icon}
      preferLivePreview={preferLivePreview}
      screens={screens}
      industry={industry}
      isNativeOnly={isNativeOnly}
      showToggle={false}
      availablePlatforms={availablePlatforms ?? ["android"]}
      defaultPlatform={defaultPlatform ?? "android"}
    />
  );
}