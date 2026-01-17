import { motion } from "framer-motion";

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
  return (
    <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl">
      <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute z-10"></div>
      <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
      <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
      <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
      <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
      
      <div className="rounded-[2rem] overflow-hidden w-full h-full bg-white relative flex flex-col">
        {/* Status Bar */}
        <div className="h-8 bg-white flex items-center justify-between px-4 text-[10px] font-medium text-black select-none z-20">
          <span>9:41</span>
          <div className="flex gap-1">
            <span>Signal</span>
            <span>WiFi</span>
            <span>100%</span>
          </div>
        </div>

        {/* App Content Simulation */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* Splash Screen Simulation if needed, otherwise WebView */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col"
            >
                {/* Simulated WebView Header */}
                <div 
                  className="h-14 flex items-center px-4 shadow-sm z-10"
                  style={{ backgroundColor: primaryColor }}
                >
                    <div className="text-white font-semibold flex items-center gap-2">
                        {/* {icon && <span className="text-lg">{icon}</span>} */}
                        <span>{appName}</span>
                    </div>
                </div>

                {/* Simulated WebView Content */}
                <div className="flex-1 bg-gray-50 p-4 overflow-y-auto">
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="h-32 rounded-xl bg-gray-200 w-full animate-pulse" />
                        <div className="flex gap-2">
                            <div className="h-24 rounded-xl bg-gray-200 flex-1 animate-pulse delay-100" />
                            <div className="h-24 rounded-xl bg-gray-200 flex-1 animate-pulse delay-200" />
                        </div>
                        <div className="h-8 w-3/4 rounded bg-gray-200 animate-pulse delay-300" />
                        <div className="space-y-2">
                            <div className="h-4 w-full rounded bg-gray-200 animate-pulse delay-400" />
                            <div className="h-4 w-full rounded bg-gray-200 animate-pulse delay-500" />
                            <div className="h-4 w-2/3 rounded bg-gray-200 animate-pulse delay-500" />
                        </div>
                        
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 mt-4 text-xs text-blue-800">
                            <p className="font-semibold mb-1">Preview Mode</p>
                            <p>Loading content from: <span className="font-mono">{url}</span></p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
        
        {/* Bottom Nav Simulation (Optional) */}
        <div className="h-14 bg-white border-t flex items-center justify-around px-2 pb-2">
            <div className="flex flex-col items-center gap-1 text-primary">
                <div className="w-5 h-5 rounded bg-current opacity-20" />
                <div className="h-1 w-8 rounded-full bg-current opacity-20" />
            </div>
             <div className="flex flex-col items-center gap-1 text-gray-400">
                <div className="w-5 h-5 rounded bg-current opacity-20" />
                <div className="h-1 w-8 rounded-full bg-current opacity-20" />
            </div>
             <div className="flex flex-col items-center gap-1 text-gray-400">
                <div className="w-5 h-5 rounded bg-current opacity-20" />
                <div className="h-1 w-8 rounded-full bg-current opacity-20" />
            </div>
        </div>
      </div>
    </div>
  );
}