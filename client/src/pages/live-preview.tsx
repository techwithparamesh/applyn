/**
 * Live Preview Page
 * 
 * Public-facing page for previewing apps via QR code scan.
 * No authentication required - allows anyone to preview the app experience.
 * Optimized for mobile viewing with "Add to Home Screen" instructions.
 */

import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Home, Share2, Download, ArrowUp, Smartphone, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

type AppData = {
  id: string;
  name: string;
  url: string;
  icon: string;
  iconUrl?: string | null;
  primaryColor: string;
  status: string;
};

export default function LivePreview() {
  const { id } = useParams<{ id: string }>();
  const [showAddToHome, setShowAddToHome] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  
  // Detect platform
  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsAndroid(/Android/.test(ua));
    
    // Show add to home screen prompt after 3 seconds
    const timer = setTimeout(() => setShowAddToHome(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const { data: app, isLoading, error } = useQuery<AppData | null>({
    queryKey: [`/api/apps/${id}/public-preview`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!id,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading preview...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !app) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="h-16 w-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Preview Not Available</h1>
          <p className="text-slate-400 text-sm mb-6">This app preview may have expired or doesn't exist.</p>
          <Button 
            onClick={() => window.location.href = "https://applyn.in"}
            className="bg-gradient-to-r from-cyan-500 to-purple-500"
          >
            Go to Applyn
          </Button>
        </div>
      </div>
    );
  }

  // Open the website in fullscreen mode
  const openFullscreen = () => {
    window.location.href = app.url;
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 flex flex-col">
      {/* Header Bar */}
      <header 
        className="shrink-0 px-4 py-3 border-b border-white/10 backdrop-blur-xl z-50"
        style={{ backgroundColor: `${app.primaryColor}15` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: `${app.primaryColor}30` }}
            >
              {app.iconUrl ? (
                <img src={app.iconUrl} alt={app.name} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                app.icon
              )}
            </div>
            <div>
              <h1 className="font-semibold text-white text-sm">{app.name}</h1>
              <Badge 
                className="text-[10px] px-1.5 py-0"
                style={{ 
                  backgroundColor: `${app.primaryColor}20`,
                  color: app.primaryColor,
                  borderColor: `${app.primaryColor}30`
                }}
              >
                Preview
              </Badge>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="ghost"
            className="text-white/70 hover:text-white"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: app.name,
                  url: window.location.href
                });
              }
            }}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Preview Frame - Full remaining height iframe */}
      <div className="flex-1 min-h-0 relative bg-white">
        <iframe 
          src={app.url}
          className="absolute inset-0 w-full h-full border-0"
          title={`${app.name} Preview`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation"
          allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone"
        />
      </div>

      {/* Add to Home Screen Prompt */}
      {showAddToHome && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent"
        >
          <div className="glass rounded-2xl p-4 border border-white/10 max-w-md mx-auto">
            <div className="flex items-start gap-3">
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: `${app.primaryColor}30` }}
              >
                {app.iconUrl ? (
                  <img src={app.iconUrl} alt={app.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  app.icon
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white text-sm mb-1">Add to Home Screen</h3>
                <p className="text-xs text-slate-400 mb-3">
                  {isIOS 
                    ? "Tap the share button below, then 'Add to Home Screen'" 
                    : isAndroid 
                    ? "Tap the menu (⋮) and select 'Add to Home screen'"
                    : "Add this app to your home screen for the full experience"
                  }
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    className="flex-1 text-xs"
                    style={{ backgroundColor: app.primaryColor }}
                    onClick={openFullscreen}
                  >
                    <Smartphone className="mr-1 h-3 w-3" /> Open App
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-xs"
                    onClick={() => setShowAddToHome(false)}
                  >
                    Later
                  </Button>
                </div>
              </div>
            </div>
            
            {/* iOS Share indicator */}
            {isIOS && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-slate-400">
                <ArrowUp className="h-4 w-4" />
                <span>Tap Share then "Add to Home Screen"</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Powered by Applyn */}
      <div className="fixed top-16 right-2 z-50">
        <a 
          href="https://applyn.in" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900/80 border border-white/10 text-[10px] text-slate-400 hover:text-white transition-colors"
        >
          <Sparkles className="h-3 w-3 text-cyan-400" />
          Made with Applyn
        </a>
      </div>
    </div>
  );
}
