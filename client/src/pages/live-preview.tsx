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
import { ExternalLink, Share2, Copy, CheckCircle2, ArrowUp, Smartphone, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { DevicePreview } from "@/components/device-preview";
import { isHttpUrl } from "@/lib/utils";
import { PageLoading, PageState } from "@/components/page-state";

type AppData = {
  id: string;
  name: string;
  url: string;
  icon: string;
  iconUrl?: string | null;
  primaryColor: string;
  industry?: string | null;
  isNativeOnly?: boolean | null;
  editorScreens?: any[] | null;
  status: string;
};

export default function LivePreview() {
  const { id } = useParams<{ id: string }>();
  const [showAddToHome, setShowAddToHome] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect platform
  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsAndroid(/Android/.test(ua));
    setIsMobile(window.matchMedia?.("(max-width: 768px)")?.matches ?? window.innerWidth <= 768);
    
    // Show add-to-home prompt a bit later, and avoid nagging repeatedly.
    const dismissed = window.localStorage.getItem("livePreviewA2hsDismissed") === "1";
    const timer = setTimeout(() => {
      if (!dismissed) setShowAddToHome(true);
    }, 6000);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <PageLoading label="Loading preview…" />
      </div>
    );
  }

  // Error state
  if (error || !app) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <PageState
            icon={<ExternalLink className="h-5 w-5 text-red-300" />}
            title="Preview not available"
            description="This preview may have expired, or the app doesn’t exist."
          >
            <Button
              variant="outline"
              className="border-white/[0.10] bg-white/[0.03] hover:bg-white/[0.06]"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
            <Button
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
              onClick={() => {
                window.location.href = "https://applyn.in";
              }}
            >
              Go to Applyn
            </Button>
          </PageState>
        </div>
      </div>
    );
  }

  const isWebsite = isHttpUrl(app.url);
  const canSuggestA2hs = isWebsite && (isIOS || isAndroid) && isMobile;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: app.name,
          url: window.location.href,
        });
        return;
      }
    } catch {
      // fall back to copy
    }
    await copyLink();
  };

  const openApp = () => {
    if (isWebsite) {
      window.open(app.url, "_blank", "noopener,noreferrer");
      return;
    }
    // Native-only: you're already in the preview; just dismiss prompt.
    setShowAddToHome(false);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 flex flex-col">
      {/* Header Bar */}
      <header 
        className="shrink-0 px-4 py-3 border-b border-white/10 backdrop-blur-xl z-50"
        style={{ backgroundColor: `${app.primaryColor}15` }}
      >
        <div className="flex items-center justify-between gap-3">
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

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-white/70 hover:text-white"
              onClick={() => {
                void shareLink();
              }}
              aria-label="Share preview"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white/70 hover:text-white"
              onClick={() => void copyLink()}
              aria-label="Copy preview link"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Preview Frame - Full remaining height iframe */}
      <div className="flex-1 min-h-0 relative overflow-auto">
        <div className="min-h-full w-full flex items-center justify-center p-4">
          <DevicePreview
            url={app.url}
            appName={app.name}
            primaryColor={app.primaryColor}
            icon={app.iconUrl || app.icon}
            preferLivePreview={true}
            screens={app.editorScreens || undefined}
            industry={app.industry || undefined}
            isNativeOnly={!!app.isNativeOnly || app.url?.startsWith("native://")}
            availablePlatforms={["android", "ios"]}
            defaultPlatform={isIOS ? "ios" : "android"}
            showToggle={false}
          />
        </div>
      </div>

      {/* Add to Home Screen Prompt */}
      {showAddToHome && canSuggestA2hs && (
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
                    onClick={openApp}
                  >
                    <Smartphone className="mr-1 h-3 w-3" /> {isWebsite ? "Open Website" : "Continue Preview"}
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-xs"
                    onClick={() => {
                      setShowAddToHome(false);
                      window.localStorage.setItem("livePreviewA2hsDismissed", "1");
                    }}
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
