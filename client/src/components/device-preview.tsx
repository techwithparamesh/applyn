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

interface DevicePreviewProps {
  url?: string;
  appName?: string;
  primaryColor?: string;
  icon?: string;
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
  availablePlatforms = ["android", "ios"],
  defaultPlatform = "ios",
  onPlatformChange,
  showToggle = true,
}: DevicePreviewProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<DevicePlatform>(defaultPlatform);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

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
        {/* iOS Status Bar */}
        <div className="h-7 bg-gray-900 flex items-center justify-between px-5 text-[10px] font-medium text-white select-none z-20">
          <span>9:41</span>
          <div className="flex gap-1 items-center">
            {/* Signal Bars */}
            <div className="flex gap-[2px]">
              <div className="w-[3px] h-[6px] bg-white rounded-sm opacity-40"></div>
              <div className="w-[3px] h-[8px] bg-white rounded-sm opacity-60"></div>
              <div className="w-[3px] h-[10px] bg-white rounded-sm opacity-80"></div>
              <div className="w-[3px] h-[12px] bg-white rounded-sm"></div>
            </div>
            <span className="ml-1">100%</span>
          </div>
        </div>

        {/* App Header Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`h-11 flex items-center justify-between px-4 shadow-md z-10 shrink-0 ${!primaryColor ? 'bg-gray-800' : ''}`}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          <div className="text-white font-bold flex items-center gap-2 text-sm">
            {icon && (icon.startsWith("data:") || icon.startsWith("http")) ? (
              <img src={icon} alt="App icon" className="w-6 h-6 rounded object-contain" />
            ) : icon ? (
              <span className="text-base">{icon}</span>
            ) : null}
            <span className="truncate max-w-[180px]">{appName}</span>
          </div>
          <Menu className="w-5 h-5 text-white/80" />
        </motion.div>

        {/* Website Screenshot Content */}
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
          />
        </div>

        {/* iOS Bottom Navigation */}
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
        {/* Android Status Bar */}
        <div className="h-6 bg-gray-900 flex items-center justify-between px-4 text-[10px] font-medium text-white select-none z-20">
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
          className={`h-12 flex items-center justify-between px-4 shadow-md z-10 shrink-0 ${!primaryColor ? 'bg-gray-800' : ''}`}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          <div className="text-white font-bold flex items-center gap-3 text-sm">
            {/* Android back arrow style */}
            <ChevronLeft className="w-5 h-5 text-white/80" />
            {icon && (icon.startsWith("data:") || icon.startsWith("http")) ? (
              <img src={icon} alt="App icon" className="w-6 h-6 rounded object-contain" />
            ) : icon ? (
              <span className="text-base">{icon}</span>
            ) : null}
            <span className="truncate max-w-[160px]">{appName}</span>
          </div>
          {/* Android three-dot menu */}
          <div className="flex flex-col gap-0.5 p-2">
            <div className="w-1 h-1 bg-white/80 rounded-full"></div>
            <div className="w-1 h-1 bg-white/80 rounded-full"></div>
            <div className="w-1 h-1 bg-white/80 rounded-full"></div>
          </div>
        </motion.div>

        {/* Website Screenshot Content */}
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
}: PreviewContentProps) {
  const [useIframe, setUseIframe] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  
  // Check if URL is valid (not just "https://" or empty)
  const isValidUrl = domain && domain.length > 3 && domain.includes(".");
  
  // Get the full URL for iframe - use url prop if available, otherwise build from domain
  const fullUrl = url || (domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "");

  // Auto-switch to iframe if screenshot fails or takes too long
  useEffect(() => {
    if (!isValidUrl) return;
    
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
            sandbox="allow-scripts allow-same-origin"
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
