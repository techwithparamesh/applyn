import { motion } from "framer-motion";
import { Globe, Home, Search, User, Menu } from "lucide-react";

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
  // Extract domain for display
  const domain = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  
  return (
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
            <span>{appName}</span>
          </div>
          <Menu className="w-5 h-5 text-white/80" />
        </motion.div>

        {/* App Content - Website Representation */}
        <div className="flex-1 bg-gradient-to-b from-gray-50 to-gray-100 relative overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-3 space-y-3"
          >
            {/* URL Bar */}
            <div className="bg-white rounded-full px-3 py-2 flex items-center gap-2 shadow-sm border border-gray-200">
              <Globe className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] text-gray-600 truncate flex-1">{domain}</span>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
            
            {/* Hero Section Mockup */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl overflow-hidden shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="p-4 text-white">
                <div className="h-3 w-24 bg-white/30 rounded mb-2"></div>
                <div className="h-2 w-32 bg-white/20 rounded"></div>
              </div>
              <div className="bg-white/10 h-20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-lg bg-white/20 flex items-center justify-center">
                  <Globe className="w-8 h-8 text-white/60" />
                </div>
              </div>
            </motion.div>

            {/* Content Cards */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 gap-2"
            >
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <div className="w-full h-12 rounded bg-gray-100 mb-2"></div>
                <div className="h-2 w-16 bg-gray-200 rounded mb-1"></div>
                <div className="h-2 w-12 bg-gray-100 rounded"></div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <div className="w-full h-12 rounded bg-gray-100 mb-2"></div>
                <div className="h-2 w-14 bg-gray-200 rounded mb-1"></div>
                <div className="h-2 w-10 bg-gray-100 rounded"></div>
              </div>
            </motion.div>

            {/* Text Content */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
            >
              <div className="space-y-2">
                <div className="h-2 w-full bg-gray-200 rounded"></div>
                <div className="h-2 w-5/6 bg-gray-100 rounded"></div>
                <div className="h-2 w-4/6 bg-gray-100 rounded"></div>
              </div>
            </motion.div>

            {/* CTA Button */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex justify-center pt-1"
            >
              <div 
                className="px-6 py-2 rounded-full text-white text-xs font-medium shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                Explore More
              </div>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Bottom Navigation */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="h-14 bg-white border-t border-gray-200 flex items-center justify-around px-4 pb-1 shrink-0"
        >
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
        </motion.div>
      </div>
    </div>
  );
}