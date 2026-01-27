/**
 * DevicePreview Component
 * 
 * A reusable component that displays a website preview inside either an
 * Android or iOS device frame. Includes toggle functionality to switch
 * between devices with smooth animations.
 * 
 * Features:
 * - CSS-based device frames (no images)
 * - Accurate status bars for each platform
 * - Android navigation bar (Back / Home / Recent)
 * - iOS notch and home indicator
 * - Plan-based locking for iOS preview
 * - Smooth transition animations
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { 
  Globe, 
  Home, 
  Search, 
  User, 
  Menu, 
  Loader2, 
  RefreshCw,
  Lock,
  Smartphone,
  Apple,
  ChevronLeft,
  Circle,
  Square
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Types for the component
type DevicePlatform = "android" | "ios";

// Screen/component types for native apps
interface NativeScreen {
  id: string;
  name: string;
  icon: string;
  isHome?: boolean;
  components: NativeComponent[];
}

interface NativeComponent {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: NativeComponent[];
}

interface DevicePreviewProps {
  url?: string;
  appName?: string;
  primaryColor?: string;
  icon?: string;
  /** Prefer a live iframe preview (more accurate/interactive) over screenshots for website apps */
  preferLivePreview?: boolean;
  /** Native app screens for preview */
  screens?: NativeScreen[];
  /** Industry type for generating demo content */
  industry?: string;
  /** Whether app is native only (no website) */
  isNativeOnly?: boolean;
  /** Platforms available based on user's plan */
  availablePlatforms?: DevicePlatform[];
  /** Initial selected platform */
  defaultPlatform?: DevicePlatform;
  /** Callback when platform changes */
  onPlatformChange?: (platform: DevicePlatform) => void;
  /** Whether to show the platform toggle */
  showToggle?: boolean;
}

// Android device icon (Material design style)
function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
    </svg>
  );
}

export function DevicePreview({
  url = "https://example.com",
  appName = "My App",
  primaryColor = "", // Empty = no custom color, show neutral
  icon = "📱",
  preferLivePreview = false,
  screens,
  industry,
  isNativeOnly = false,
  availablePlatforms = ["android", "ios"],
  defaultPlatform = "ios",
  onPlatformChange,
  showToggle = true,
}: DevicePreviewProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<DevicePlatform>(defaultPlatform);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);

  // Determine if this is a native-only app (no website)
  const isNativeApp = isNativeOnly || url?.startsWith("native://") || !url || url === "https://example.com";

  // Check if a platform is available based on user's plan
  const isPlatformAvailable = (platform: DevicePlatform) => {
    return availablePlatforms.includes(platform);
  };

  // Handle platform change
  const handlePlatformChange = (platform: DevicePlatform) => {
    if (!isPlatformAvailable(platform)) return;
    setSelectedPlatform(platform);
    onPlatformChange?.(platform);
  };

  // Reset image loading state when URL changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [url, retryCount]);

  // Extract domain for display
  const domain = url.replace(/^https?:\/\//, "").replace(/\/$/, "").split('/')[0];
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  // Use thum.io for screenshot preview
  const screenshotUrl = `https://image.thum.io/get/viewportWidth/414/width/414/noanimate/${normalizedUrl}?v=${retryCount}`;

  const handleRetry = () => {
    setImageError(false);
    setImageLoaded(false);
    setRetryCount(prev => prev + 1);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Platform Toggle */}
      {showToggle && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview as</span>
          <TooltipProvider>
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
              {/* Android Toggle Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handlePlatformChange("android")}
                    disabled={!isPlatformAvailable("android")}
                    className={`
                      relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
                      ${selectedPlatform === "android" 
                        ? "bg-green-500/20 text-green-400 shadow-lg shadow-green-500/10" 
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                      }
                      ${!isPlatformAvailable("android") ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    <AndroidIcon className="w-4 h-4" />
                    <span>Android</span>
                    {!isPlatformAvailable("android") && (
                      <Lock className="w-3 h-3 ml-1 text-yellow-500" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900 border-white/10">
                  {isPlatformAvailable("android") 
                    ? "Preview how your app will appear on Android devices"
                    : "Android app build available in Premium plan"
                  }
                </TooltipContent>
              </Tooltip>

              {/* iOS Toggle Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handlePlatformChange("ios")}
                    disabled={!isPlatformAvailable("ios")}
                    className={`
                      relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
                      ${selectedPlatform === "ios" 
                        ? "bg-white/20 text-white shadow-lg shadow-white/10" 
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                      }
                      ${!isPlatformAvailable("ios") ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    <Apple className="w-4 h-4" />
                    <span>iOS</span>
                    {!isPlatformAvailable("ios") && (
                      <Lock className="w-3 h-3 ml-1 text-yellow-500" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900 border-white/10">
                  {isPlatformAvailable("ios") 
                    ? "Preview how your app will appear on iOS devices"
                    : "iOS app build available in Premium plan"
                  }
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      )}

      {/* Device Frame Container with Animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedPlatform}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {selectedPlatform === "ios" ? (
            <IOSDeviceFrame
              url={normalizedUrl}
              appName={appName}
              primaryColor={primaryColor}
              icon={icon}
              imageLoaded={imageLoaded}
              imageError={imageError}
              screenshotUrl={screenshotUrl}
              domain={domain}
              onImageLoad={() => setImageLoaded(true)}
              onImageError={() => setImageError(true)}
              onRetry={handleRetry}
              isNativeApp={isNativeApp}
              preferLivePreview={preferLivePreview}
              screens={screens}
              industry={industry}
              activeScreenIndex={activeScreenIndex}
              onScreenChange={setActiveScreenIndex}
            />
          ) : (
            <AndroidDeviceFrame
              url={normalizedUrl}
              appName={appName}
              primaryColor={primaryColor}
              icon={icon}
              imageLoaded={imageLoaded}
              imageError={imageError}
              screenshotUrl={screenshotUrl}
              domain={domain}
              onImageLoad={() => setImageLoaded(true)}
              onImageError={() => setImageError(true)}
              onRetry={handleRetry}
              isNativeApp={isNativeApp}
              preferLivePreview={preferLivePreview}
              screens={screens}
              industry={industry}
              activeScreenIndex={activeScreenIndex}
              onScreenChange={setActiveScreenIndex}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* App name label */}
      <p className="text-sm text-muted-foreground text-center">
        <span className="text-white font-medium">{appName}</span>
      </p>
    </div>
  );
}

// Helper to get app initials for fallback icon
function getAppInitials(appName: string): string {
  const words = appName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return appName.slice(0, 2).toUpperCase();
}

// App Icon component with fallback to initials
function AppIcon({ icon, appName, className = "w-6 h-6" }: { icon: string; appName: string; className?: string }) {
  const [imgError, setImgError] = useState(false);
  const isUrl = icon && (icon.startsWith("data:") || icon.startsWith("http"));
  
  // If it's a URL and loaded successfully, show image
  if (isUrl && !imgError) {
    return (
      <img 
        src={icon} 
        alt="App icon" 
        className={`${className} rounded object-contain`}
        onError={() => setImgError(true)}
      />
    );
  }
  
  // If it's an emoji, show it
  if (icon && !isUrl) {
    return <span className="text-base">{icon}</span>;
  }
  
  // Fallback: show app initials in a nice circle
  return (
    <div className={`${className} rounded bg-white/20 flex items-center justify-center text-xs font-bold text-white`}>
      {getAppInitials(appName)}
    </div>
  );
}

// ============================================
// iOS Device Frame Component
// ============================================

interface DeviceFrameProps {
  url: string;
  appName: string;
  primaryColor: string;
  icon: string;
  imageLoaded: boolean;
  imageError: boolean;
  screenshotUrl: string;
  domain: string;
  onImageLoad: () => void;
  onImageError: () => void;
  onRetry: () => void;
  // Native app props
  isNativeApp?: boolean;
  preferLivePreview?: boolean;
  screens?: NativeScreen[];
  industry?: string;
  activeScreenIndex?: number;
  onScreenChange?: (index: number) => void;
}

function IOSDeviceFrame({
  url,
  appName,
  primaryColor,
  icon,
  imageLoaded,
  imageError,
  screenshotUrl,
  domain,
  onImageLoad,
  onImageError,
  onRetry,
  isNativeApp,
  preferLivePreview,
  screens,
  industry,
  activeScreenIndex,
  onScreenChange,
}: DeviceFrameProps) {
  const phoneScreenWidth = 272;

  return (
    <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl">
      {/* Dynamic Island / Notch */}
      <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute z-10"></div>
      
      {/* Side Buttons */}
      <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
      <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
      <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
      <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>

      <div className="rounded-[2rem] overflow-hidden w-full h-full bg-white relative flex flex-col">
        {/* iOS Status Bar - matches header color */}
        <div 
          className={`h-7 flex items-center justify-between px-5 text-[10px] font-medium text-white select-none z-20 ${!primaryColor ? 'bg-gray-800' : ''}`}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          <span>12:30</span>
          <div className="flex gap-1 items-center">
            {/* Signal Bars */}
            <div className="flex gap-[2px] items-end">
              <div className="w-[3px] h-[4px] bg-white/60 rounded-sm"></div>
              <div className="w-[3px] h-[6px] bg-white/70 rounded-sm"></div>
              <div className="w-[3px] h-[8px] bg-white/80 rounded-sm"></div>
              <div className="w-[3px] h-[10px] bg-white rounded-sm"></div>
            </div>
            {/* Wifi */}
            <svg className="w-4 h-4 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 18c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-4.9-2.3l1.4 1.4C9.6 16.4 10.8 16 12 16s2.4.4 3.5 1.1l1.4-1.4C15.3 14.6 13.7 14 12 14s-3.3.6-4.9 1.7zM2.1 9.1l1.4 1.4C5.7 8.3 8.7 7 12 7s6.3 1.3 8.5 3.5l1.4-1.4C19.1 6.3 15.7 5 12 5S4.9 6.3 2.1 9.1z"/>
            </svg>
            {/* Battery */}
            <div className="flex items-center ml-1">
              <div className="w-6 h-3 border border-white/80 rounded-sm relative">
                <div className="absolute inset-0.5 bg-white rounded-[1px]" style={{width: '85%'}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* App Header Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`h-11 flex items-center justify-between px-4 shadow-md z-10 shrink-0 ${!primaryColor ? 'bg-gray-700' : ''}`}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          <div className="text-white font-bold flex items-center gap-2 text-sm">
            <AppIcon icon={icon} appName={appName} className="w-6 h-6" />
            <span className="truncate max-w-[180px]">{appName}</span>
          </div>
          <Menu className="w-5 h-5 text-white/80" />
        </motion.div>

        {/* Content Area */}
        <div className="flex-1 bg-white relative overflow-hidden">
          <PreviewContent
            imageLoaded={imageLoaded}
            imageError={imageError}
            screenshotUrl={screenshotUrl}
            domain={domain}
            phoneScreenWidth={phoneScreenWidth}
            onImageLoad={onImageLoad}
            onImageError={onImageError}
            onRetry={onRetry}
            url={url}
            isNativeApp={isNativeApp}
            appName={appName}
            primaryColor={primaryColor}
            preferLivePreview={preferLivePreview}
            screens={screens}
            industry={industry}
            activeScreenIndex={activeScreenIndex}
            onScreenChange={onScreenChange}
          />
        </div>

        {/* iOS Bottom Navigation - hide for native apps (they have their own) */}
        {!isNativeApp && (
          <div className="h-12 bg-white border-t border-gray-200 flex items-center justify-around px-4 shrink-0">
            <div className="flex flex-col items-center">
              <Home className="w-5 h-5" style={{ color: primaryColor || '#6B7280' }} />
            </div>
            <div className="flex flex-col items-center">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex flex-col items-center">
              <User className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        )}

        {/* iOS Home Indicator */}
        <div className="h-5 bg-white flex items-center justify-center shrink-0">
          <div className="w-32 h-1 bg-gray-800 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Android Device Frame Component
// ============================================

function AndroidDeviceFrame({
  url,
  appName,
  primaryColor,
  icon,
  imageLoaded,
  imageError,
  screenshotUrl,
  domain,
  onImageLoad,
  onImageError,
  onRetry,
  isNativeApp,
  preferLivePreview,
  screens,
  industry,
  activeScreenIndex,
  onScreenChange,
}: DeviceFrameProps) {
  const phoneScreenWidth = 272;

  return (
    <div className="relative mx-auto bg-gray-900 border-[12px] border-gray-900 rounded-[2rem] h-[600px] w-[300px] shadow-xl">
      {/* Top Speaker/Camera cutout */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-24 h-[6px] bg-gray-800 rounded-full z-20 flex items-center justify-center">
        <div className="w-2 h-2 bg-gray-700 rounded-full"></div>
      </div>

      {/* Side Buttons - Android style */}
      <div className="h-[40px] w-[3px] bg-gray-800 absolute -right-[15px] top-[100px] rounded-r-lg"></div>
      <div className="h-[60px] w-[3px] bg-gray-800 absolute -right-[15px] top-[160px] rounded-r-lg"></div>

      <div className="rounded-[1.25rem] overflow-hidden w-full h-full bg-white relative flex flex-col">
        {/* Android Status Bar - matches header color */}
        <div 
          className={`h-6 flex items-center justify-between px-4 text-[10px] font-medium text-white select-none z-20 ${!primaryColor ? 'bg-gray-800' : ''}`}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          <span>12:30</span>
          <div className="flex gap-2 items-center">
            {/* WiFi Icon */}
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C7.03 3 2.26 4.45 0 7l2 2a12.12 12.12 0 0 1 8-3c2.89 0 5.57.97 7.72 2.6l2.28-2.28C17.34 4.18 14.68 3 12 3zm0 4c-2.48 0-4.78.77-6.68 2.08L8 11.8c1.21-.84 2.67-1.35 4.22-1.35s3.01.51 4.22 1.35l2.68-2.72C17.78 7.77 14.48 7 12 7zm0 4.35c-1.35 0-2.6.43-3.62 1.17L12 16l3.62-3.48c-1.02-.74-2.27-1.17-3.62-1.17z"/>
            </svg>
            {/* Signal */}
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 22h20V2z"/>
            </svg>
            {/* Battery */}
            <div className="flex items-center gap-0.5">
              <div className="w-5 h-2.5 border border-white/80 rounded-sm relative">
                <div className="absolute inset-0.5 bg-white rounded-[1px]"></div>
              </div>
              <div className="w-0.5 h-1.5 bg-white/80 rounded-r"></div>
            </div>
          </div>
        </div>

        {/* App Header Bar with Android styling */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`h-12 flex items-center justify-between px-4 shadow-md z-10 shrink-0 ${!primaryColor ? 'bg-gray-700' : ''}`}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          <div className="text-white font-bold flex items-center gap-3 text-sm">
            {/* Android back arrow style */}
            <ChevronLeft className="w-5 h-5 text-white/80" />
            <AppIcon icon={icon} appName={appName} className="w-6 h-6" />
            <span className="truncate max-w-[160px]">{appName}</span>
          </div>
          {/* Android three-dot menu */}
          <div className="flex flex-col gap-0.5 p-2">
            <div className="w-1 h-1 bg-white/80 rounded-full"></div>
            <div className="w-1 h-1 bg-white/80 rounded-full"></div>
            <div className="w-1 h-1 bg-white/80 rounded-full"></div>
          </div>
        </motion.div>

        {/* Content Area */}
        <div className="flex-1 bg-white relative overflow-hidden">
          <PreviewContent
            imageLoaded={imageLoaded}
            imageError={imageError}
            screenshotUrl={screenshotUrl}
            domain={domain}
            phoneScreenWidth={phoneScreenWidth}
            onImageLoad={onImageLoad}
            onImageError={onImageError}
            onRetry={onRetry}
            url={url}
            isNativeApp={isNativeApp}
            appName={appName}
            primaryColor={primaryColor}
            preferLivePreview={preferLivePreview}
            screens={screens}
            industry={industry}
            activeScreenIndex={activeScreenIndex}
            onScreenChange={onScreenChange}
          />
        </div>

        {/* Android Navigation Bar (Back / Home / Recent) */}
        <div className="h-12 bg-gray-900 flex items-center justify-around px-8 shrink-0">
          {/* Back Button - Triangle */}
          <button className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>
          {/* Home Button - Circle */}
          <button className="w-10 h-10 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white/70 rounded-full hover:border-white transition-colors"></div>
          </button>
          {/* Recent Apps - Square */}
          <button className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <div className="w-4 h-4 border-2 border-current rounded-sm"></div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Native App Content Component (for apps without website)
// ============================================

interface NativeAppContentProps {
  appName: string;
  primaryColor: string;
  screens?: NativeScreen[];
  industry?: string;
  activeScreenIndex: number;
  onScreenChange: (index: number) => void;
}

function NativeComponentPreview({
  component,
  themeColor,
  activeCategory,
  setActiveCategory,
}: {
  component: NativeComponent;
  themeColor: string;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
}) {
  const render = () => {
    switch (component.type) {
      case "text":
        return <p className="text-sm text-gray-700" style={{ color: component.props?.color }}>{component.props?.text}</p>;
      case "heading": {
        const level = component.props?.level || 2;
        const text = component.props?.text;
        const className = level === 1 ? "text-2xl font-bold" : level === 2 ? "text-xl font-bold" : "text-lg font-semibold";
        return <div className={className} style={{ color: component.props?.color || "#111827" }}>{text}</div>;
      }
      case "image":
        return component.props?.src ? (
          <img src={component.props.src} alt={component.props?.alt || ""} className="w-full rounded-lg" />
        ) : (
          <div className="w-full h-32 bg-gray-100 rounded-lg" />
        );
      case "button": {
        const text: string = component.props?.text || "Button";
        const isCategory = ["All", "Vegetables", "Fruits", "Dairy"].includes(text);
        const isActive = isCategory && text === activeCategory;
        return (
          <button
            onClick={() => {
              if (isCategory) setActiveCategory(text);
            }}
            className={
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors " +
              (isActive
                ? "text-white border-transparent"
                : "bg-white text-gray-700 border-gray-200")
            }
            style={isActive ? { backgroundColor: themeColor } : undefined}
          >
            {text}
          </button>
        );
      }
      case "container":
        return (
          <div className="rounded-lg" style={{ padding: component.props?.padding ?? 0, backgroundColor: component.props?.backgroundColor }}>
            {component.children?.map((child) => (
              <NativeComponentPreview
                key={child.id}
                component={child}
                themeColor={themeColor}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
              />
            ))}
          </div>
        );
      case "grid": {
        const cols = component.props?.columns || 2;
        const gap = component.props?.gap ?? 8;
        return (
          <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
            {component.children?.map((child) => (
              <NativeComponentPreview
                key={child.id}
                component={child}
                themeColor={themeColor}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
              />
            ))}
          </div>
        );
      }
      case "section":
        return (
          <div className="rounded-lg" style={{ padding: component.props?.padding ?? 0 }}>
            {component.props?.title && <div className="text-lg font-semibold mb-2">{component.props.title}</div>}
            {component.children?.map((child) => (
              <NativeComponentPreview
                key={child.id}
                component={child}
                themeColor={themeColor}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
              />
            ))}
          </div>
        );
      case "list": {
        const items: any[] = Array.isArray(component.props?.items) ? component.props.items : [];
        const variant = component.props?.variant;

        if (variant === "menu") {
          return (
            <div className="bg-white rounded-lg divide-y divide-gray-100 border border-gray-200">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3">
                  <span className="text-lg">{item?.icon || "➡️"}</span>
                  <span className="text-sm flex-1 truncate">{item?.label || item?.name || item?.title}</span>
                  <span className="text-gray-400">›</span>
                </div>
              ))}
            </div>
          );
        }

        if (variant === "menu-item") {
          return (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  {item?.image ? (
                    <img src={item.image} alt={item?.name || "Item"} className="w-16 h-16 rounded-md object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold truncate">{item?.name || "Untitled"}</div>
                      <div className="text-sm font-semibold whitespace-nowrap" style={{ color: themeColor }}>
                        {item?.price || ""}
                      </div>
                    </div>
                    {item?.description && (
                      <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{item.description}</div>
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
                      <button className="ml-auto text-[11px] px-3 py-1 rounded-full text-white" style={{ backgroundColor: themeColor }}>
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
                <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200">
                  {item?.image ? (
                    <img src={item.image} alt={item?.name || "Item"} className="w-14 h-14 rounded object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded bg-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item?.name || item?.label || "Item"}</div>
                    <div className="text-[11px] text-gray-500">
                      {item?.quantity ? `Qty: ${item.quantity}` : item?.status || ""}
                    </div>
                  </div>
                  <div className="text-sm font-semibold whitespace-nowrap">{item?.price || item?.total || ""}</div>
                </div>
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
      case "hero":
        return (
          <div
            className="relative rounded-xl overflow-hidden"
            style={{
              backgroundImage: component.props?.backgroundImage ? `url(${component.props.backgroundImage})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              height: component.props?.height || 180,
              backgroundColor: component.props?.backgroundImage ? undefined : themeColor,
            }}
          >
            <div className="absolute inset-0" style={{ backgroundColor: component.props?.overlayColor || "rgba(0,0,0,0.35)" }} />
            <div className="relative z-10 h-full p-4 flex flex-col justify-end text-white">
              <div className="text-xl font-bold">{component.props?.title}</div>
              {component.props?.subtitle && <div className="text-xs text-white/80 mt-1">{component.props.subtitle}</div>}
              {component.props?.buttonText && (
                <div className="mt-3">
                  <button className="px-4 py-2 bg-white text-gray-900 rounded-full text-xs font-semibold">{component.props.buttonText}</button>
                </div>
              )}
            </div>
          </div>
        );
      case "productGrid": {
        const products: any[] = Array.isArray(component.props?.products) ? component.props.products : [];
        const columns = component.props?.columns || 2;
        const categoryLower = String(activeCategory || "All").toLowerCase();
        const filtered = categoryLower === "all"
          ? products
          : products.filter((p) => String(p?.category || "").toLowerCase() === categoryLower);
        const visible = filtered.length > 0 ? filtered : products;

        return (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {visible.slice(0, 6).map((product, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {product.image && <img src={product.image} alt={product.name} className="w-full h-24 object-cover" />}
                <div className="p-2">
                  <div className="text-xs font-medium truncate">{product.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-sm font-bold" style={{ color: themeColor }}>{product.price}</div>
                    {product.rating && <div className="text-[10px] text-amber-600">★ {product.rating}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  // Avoid extra wrappers when component renderer returns null.
  const rendered = render();
  if (!rendered) return null;
  return <div className="space-y-2">{rendered}</div>;
}

function NativeScreensPreview({
  screens,
  themeColor,
  activeScreenIndex,
  onScreenChange,
}: {
  screens: NativeScreen[];
  themeColor: string;
  activeScreenIndex: number;
  onScreenChange: (index: number) => void;
}) {
  const [activeCategory, setActiveCategory] = useState("All");
  const activeScreen = screens[activeScreenIndex] || screens[0];

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="space-y-4">
          {activeScreen?.components?.map((component) => (
            <NativeComponentPreview
              key={component.id}
              component={component}
              themeColor={themeColor}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
            />
          ))}
        </div>
      </div>

      {/* Native-style bottom navigation */}
      <div className="h-14 bg-white border-t border-gray-200 flex items-center justify-around px-2 shrink-0">
        {screens.slice(0, 4).map((screen, i) => (
          <button
            key={screen.id}
            onClick={() => onScreenChange(i)}
            className="flex flex-col items-center gap-0.5 min-w-0"
          >
            <span className="text-lg">{screen.icon || "📄"}</span>
            <span
              className={"text-[10px] font-medium truncate max-w-[64px] " + (i === activeScreenIndex ? "" : "text-gray-400")}
              style={i === activeScreenIndex ? { color: themeColor } : undefined}
            >
              {screen.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function NativeAppContent({
  appName,
  primaryColor,
  screens,
  industry,
  activeScreenIndex,
  onScreenChange,
}: NativeAppContentProps) {
  const themeColor = primaryColor || "#2563EB";

  // If real native screens exist, preview those (matches Visual Editor output)
  if (screens && Array.isArray(screens) && screens.length > 0) {
    return (
      <NativeScreensPreview
        screens={screens}
        themeColor={themeColor}
        activeScreenIndex={activeScreenIndex}
        onScreenChange={onScreenChange}
      />
    );
  }
  
  // Generate demo content based on app name and industry
  const getDemoContent = () => {
    const name = appName.toLowerCase();
    
    // Detect app type from name
    if (name.includes("farm") || name.includes("food") || name.includes("fresh") || name.includes("organic") || industry === "ecommerce") {
      return {
        hero: {
          image: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&q=80",
          title: appName,
          subtitle: "Fresh from local farms, delivered to your door",
          buttonText: "Shop Now"
        },
        products: [
          { image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300&q=80", name: "Organic Vegetables", price: "$12.99", desc: "Farm fresh daily" },
          { image: "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=300&q=80", name: "Free-Range Eggs", price: "$6.99", desc: "From happy hens" },
          { image: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=300&q=80", name: "Artisan Cheese", price: "$15.99", desc: "Locally crafted" },
        ]
      };
    }
    
    if (name.includes("salon") || name.includes("beauty") || name.includes("spa") || industry === "salon") {
      return {
        hero: {
          image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80",
          title: appName,
          subtitle: "Your beauty, our passion",
          buttonText: "Book Now"
        },
        products: [
          { image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&q=80", name: "Hair Styling", price: "$45", desc: "Expert stylists" },
          { image: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=300&q=80", name: "Spa Treatment", price: "$89", desc: "Relax & rejuvenate" },
          { image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=300&q=80", name: "Manicure", price: "$35", desc: "Nail perfection" },
        ]
      };
    }
    
    if (name.includes("restaurant") || name.includes("food") || name.includes("cafe") || name.includes("kitchen") || industry === "restaurant") {
      return {
        hero: {
          image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
          title: appName,
          subtitle: "Delicious food, delivered fast",
          buttonText: "Order Now"
        },
        products: [
          { image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80", name: "Gourmet Burger", price: "$14.99", desc: "100% Angus beef" },
          { image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&q=80", name: "Wood-Fired Pizza", price: "$18.99", desc: "Italian style" },
          { image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300&q=80", name: "Sweet Desserts", price: "$8.99", desc: "House special" },
        ]
      };
    }
    
    if (name.includes("fitness") || name.includes("gym") || name.includes("health") || industry === "fitness") {
      return {
        hero: {
          image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
          title: appName,
          subtitle: "Transform your body, transform your life",
          buttonText: "Start Free Trial"
        },
        products: [
          { image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=300&q=80", name: "Personal Training", price: "$59/session", desc: "1-on-1 coaching" },
          { image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=300&q=80", name: "Group Classes", price: "$29/month", desc: "Yoga, HIIT & more" },
          { image: "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=300&q=80", name: "Gym Access", price: "$49/month", desc: "24/7 access" },
        ]
      };
    }
    
    // Default business content
    return {
      hero: {
        image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
        title: appName,
        subtitle: "Welcome to our app",
        buttonText: "Get Started"
      },
      products: [
        { image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&q=80", name: "Premium Service", price: "Contact Us", desc: "Best quality" },
        { image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=300&q=80", name: "Consultation", price: "Free", desc: "Expert advice" },
        { image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=300&q=80", name: "Support", price: "24/7", desc: "Always here" },
      ]
    };
  };
  
  const content = getDemoContent();
  
  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <div className="relative h-48 overflow-hidden">
          <img 
            src={content.hero.image} 
            alt={content.hero.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h1 className="text-xl font-bold mb-1">{content.hero.title}</h1>
            <p className="text-xs text-white/80 mb-3">{content.hero.subtitle}</p>
            <button 
              className="px-4 py-2 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: themeColor }}
            >
              {content.hero.buttonText}
            </button>
          </div>
        </div>
        
        {/* Products/Services Section */}
        <div className="p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Featured</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {content.products.map((product, i) => (
              <div key={i} className="flex-shrink-0 w-32 bg-white rounded-xl shadow-sm overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-20 object-cover"
                />
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-800 truncate">{product.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{product.desc}</p>
                  <p className="text-xs font-bold mt-1" style={{ color: themeColor }}>{product.price}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            {["🏠 Home", "🔍 Search", "❤️ Saved", "👤 Profile"].map((item, i) => (
              <div key={i} className="flex flex-col items-center p-2 bg-white rounded-lg">
                <span className="text-lg">{item.split(" ")[0]}</span>
                <span className="text-[9px] text-gray-500 mt-1">{item.split(" ")[1]}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* More Content Placeholder */}
        <div className="px-4 pb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Popular Now</h2>
          <div className="space-y-2">
            {content.products.slice(0, 2).map((product, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-lg shadow-sm">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-14 h-14 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800">{product.name}</p>
                  <p className="text-[10px] text-gray-500">{product.desc}</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: themeColor }}>{product.price}</p>
                </div>
                <button 
                  className="px-3 py-1.5 rounded-full text-[10px] font-medium text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Shared Preview Content Component
// ============================================

interface PreviewContentProps {
  imageLoaded: boolean;
  imageError: boolean;
  screenshotUrl: string;
  domain: string;
  phoneScreenWidth: number;
  onImageLoad: () => void;
  onImageError: () => void;
  onRetry: () => void;
  url?: string;
  // Native app props
  isNativeApp?: boolean;
  appName?: string;
  primaryColor?: string;
  preferLivePreview?: boolean;
  screens?: NativeScreen[];
  industry?: string;
  activeScreenIndex?: number;
  onScreenChange?: (index: number) => void;
}

function PreviewContent({
  imageLoaded,
  imageError,
  screenshotUrl,
  domain,
  phoneScreenWidth,
  onImageLoad,
  onImageError,
  onRetry,
  url,
  isNativeApp = false,
  appName = "My App",
  primaryColor = "#2563EB",
  preferLivePreview = false,
  screens,
  industry,
  activeScreenIndex = 0,
  onScreenChange,
}: PreviewContentProps) {
  const [useIframe, setUseIframe] = useState(preferLivePreview);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  
  // For native apps, show native content
  if (isNativeApp) {
    return (
      <NativeAppContent
        appName={appName}
        primaryColor={primaryColor}
        screens={screens}
        industry={industry}
        activeScreenIndex={activeScreenIndex}
        onScreenChange={onScreenChange || (() => {})}
      />
    );
  }
  
  // Check if URL is valid (not just "https://" or empty)
  const isValidUrl = domain && domain.length > 3 && domain.includes(".");
  
  // Get the full URL for iframe - use url prop if available, otherwise build from domain
  const fullUrl = url || (domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "");

  useEffect(() => {
    setIframeLoaded(false);
  }, [fullUrl]);

  // If we prefer live preview but the site blocks iframes, don't spin forever.
  // After a short timeout, fall back to screenshot.
  useEffect(() => {
    if (!isValidUrl) return;
    if (!preferLivePreview) return;
    if (!useIframe) return;

    const timeout = setTimeout(() => {
      if (!iframeLoaded) {
        setUseIframe(false);
      }
    }, 8000);

    return () => clearTimeout(timeout);
  }, [isValidUrl, preferLivePreview, useIframe, iframeLoaded, fullUrl]);

  // Auto-switch to iframe if screenshot fails or takes too long
  useEffect(() => {
    if (!isValidUrl) return;
    if (preferLivePreview) return;
    
    // After 5 seconds, if still loading, switch to iframe
    const timeout = setTimeout(() => {
      if (!imageLoaded && !imageError) {
        setUseIframe(true);
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [isValidUrl, imageLoaded, imageError, domain]);

  // Switch to iframe on error
  useEffect(() => {
    if (imageError && isValidUrl) {
      setUseIframe(true);
    }
  }, [imageError, isValidUrl]);

  return (
    <>
      {/* Invalid URL State - show placeholder */}
      {!isValidUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 z-10 p-4">
          <Globe className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 font-medium text-center">Enter your website URL</p>
          <p className="text-xs text-gray-400 text-center mt-1">Preview will appear here</p>
        </div>
      )}

      {/* Loading State for Screenshot */}
      {isValidUrl && !useIframe && !imageLoaded && !imageError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-3" />
          <p className="text-xs text-gray-500 font-medium">Loading preview...</p>
          <p className="text-xs text-gray-400 mt-1">{domain}</p>
        </div>
      )}

      {/* Iframe Preview (fallback) */}
      {isValidUrl && useIframe && (
        <>
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-3" />
              <p className="text-xs text-gray-500 font-medium">Loading live preview...</p>
              <p className="text-xs text-gray-400 mt-1">{domain}</p>
            </div>
          )}
          <iframe
            src={fullUrl}
            className={`w-full h-full border-0 transition-opacity duration-300 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setIframeLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
            title={`Preview of ${domain}`}
          />
        </>
      )}

      {/* Screenshot Preview (primary) */}
      {isValidUrl && !useIframe && (
        <div
          className={`w-full transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{
            transform: `scale(${phoneScreenWidth / 414})`,
            transformOrigin: 'top left',
            width: '414px',
          }}
        >
          <img
            src={screenshotUrl}
            alt={`Preview of ${domain}`}
            className="w-full"
            onLoad={onImageLoad}
            onError={onImageError}
          />
        </div>
      )}
    </>
  );
}

// Export for backward compatibility with existing MobilePreview usage
export { DevicePreview as MobilePreview };
