import { motion } from "framer-motion";
import { useState } from "react";
import { Globe, Home, Search, User, Menu, Loader2, RefreshCw } from "lucide-react";

interface MobilePreviewProps {
  url?: string;
  appName?: string;
  primaryColor?: string;
  icon?: string; // URL or emoji
}

export function MobilePreview({ 
  url = "https://example.com", 
  appName = "My App", 
  primaryColor = "#2563EB",
  icon = "📱"
}: MobilePreviewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Extract domain for display
  const domain = url.replace(/^https?:\/\//, "").replace(/\/$/, "").split('/')[0];
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  
  // Use thum.io for free website screenshots (no API key needed)
  // Format: https://image.thum.io/get/width/600/https://example.com
  const screenshotUrl = `https://image.thum.io/get/width/600/crop/800/noanimate/${normalizedUrl}?${retryCount}`;
  
  const handleRetry = () => {
    setImageError(false);
    setImageLoaded(false);
    setRetryCount(prev => prev + 1);
  };
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl">
        <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute z-10"></div>
        <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
        <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
        <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
        <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
        
        <div className="rounded-[2rem] overflow-hidden w-full h-full bg-white relative flex flex-col">
          {/* Status Bar */}
          <div className="h-7 bg-gray-900 flex items-center justify-between px-5 text-[10px] font-medium text-white select-none z-20">
            <span>9:41</span>
            <div className="flex gap-1 items-center">
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
            className="h-12 flex items-center justify-between px-4 shadow-md z-10 shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="text-white font-bold flex items-center gap-2 text-sm">
              {icon && !icon.startsWith("http") && <span className="text-base">{icon}</span>}
              <span className="truncate max-w-[180px]">{appName}</span>
            </div>
            <Menu className="w-5 h-5 text-white/80" />
          </motion.div>

          {/* Website Screenshot Content */}
          <div className="flex-1 bg-gray-100 relative overflow-hidden">
            {/* Loading State */}
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-3" />
                <p className="text-xs text-gray-500 font-medium">Loading website preview...</p>
                <p className="text-[10px] text-gray-400 mt-1">This may take a few seconds</p>
              </div>
            )}
            
            {/* Error State */}
            {imageError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10 p-4">
                <Globe className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-xs text-gray-500 font-medium text-center">Unable to load preview</p>
                <p className="text-[10px] text-gray-400 mt-1 text-center">The website might be temporarily unavailable</p>
                <button 
                  onClick={handleRetry}
                  className="mt-3 flex items-center gap-1 text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Try again
                </button>
              </div>
            )}
            
            {/* Actual Screenshot */}
            <motion.img
              src={screenshotUrl}
              alt={`Preview of ${domain}`}
              className={`w-full h-full object-cover object-top transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </div>
          
          {/* Bottom Navigation */}
          <div className="h-14 bg-white border-t border-gray-200 flex items-center justify-around px-4 pb-1 shrink-0">
            <div className="flex flex-col items-center gap-1">
              <Home className="w-5 h-5" style={{ color: primaryColor }} />
              <div className="h-1 w-1 rounded-full" style={{ backgroundColor: primaryColor }}></div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <User className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Preview Label */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Live Preview: <span className="text-white font-medium">{appName}</span>
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          Showing actual website content from {domain}
        </p>
      </div>
    </div>
  );
}