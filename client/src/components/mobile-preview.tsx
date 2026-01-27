import { DevicePreview } from "@/components/device-preview";

interface MobilePreviewProps {
  url?: string;
  appName?: string;
  primaryColor?: string; // Empty = transparent header
  icon?: string; // URL or emoji
  /** Prefer a live (iframe) preview over screenshots when possible */
  preferLivePreview?: boolean;
}

export function MobilePreview({ 
  url = "https://example.com", 
  appName = "My App", 
  primaryColor, // No default - will show transparent if not set
  icon = "📱",
  preferLivePreview = true,
}: MobilePreviewProps) {
  return (
    <DevicePreview
      url={url}
      appName={appName}
      primaryColor={primaryColor || ""}
      icon={icon}
      preferLivePreview={preferLivePreview}
      showToggle={false}
      availablePlatforms={["android"]}
      defaultPlatform="android"
    />
  );
}