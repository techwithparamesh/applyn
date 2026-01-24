import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Download, RefreshCw, ExternalLink, QrCode, Smartphone, Share2, Copy, CheckCircle2, Sparkles, Crown } from "lucide-react";
import { useLocation, useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { DevicePreview } from "@/components/device-preview";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type AppItem = {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  status: "draft" | "processing" | "live" | "failed" | string;
  platform: "android" | "ios" | "both" | string;
  plan?: "preview" | "starter" | "standard" | "pro" | "agency" | string;
  icon: string;
  iconUrl?: string | null;
  primaryColor: string;
  splashColor?: string | null;
  packageName?: string | null;
  versionCode?: number | null;
  artifactSize?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type Me = {
  id: string;
  username: string;
  plan?: string;
};

export default function PreviewApp() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  
  // QR Code modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Check if coming from appId query param (create flow)
  const params = new URLSearchParams(search);
  const appIdFromQuery = params.get("appId");
  const appId = id || appIdFromQuery;

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: app, isLoading: appLoading } = useQuery<AppItem | null>({
    queryKey: [`/api/apps/${appId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me && !!appId,
  });

  // Redirect to login if not authenticated
  if (!meLoading && !me) {
    setLocation(`/login?returnTo=${encodeURIComponent(`/apps/${appId}/preview`)}`);
    return null;
  }

  // Loading state
  if (meLoading || appLoading) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        </main>
      </div>
    );
  }

  // App not found
  if (!app) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">App not found</h1>
          <p className="text-muted-foreground mb-6">The app you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </main>
      </div>
    );
  }

  // Determine available platforms based on user plan
  const getAvailablePlatforms = (): ("android" | "ios")[] => {
    const plan = me?.plan || "starter";
    if (plan === "pro" || plan === "enterprise") return ["android", "ios"];
    return ["android"];
  };

  // Check if this is a preview-only app (free tier)
  const isPreviewOnly = app.plan === "preview";

  // Generate QR preview URL
  const getPreviewUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/live-preview/${app.id}`;
  };

  // Copy preview URL to clipboard
  const copyPreviewUrl = async () => {
    try {
      await navigator.clipboard.writeText(getPreviewUrl());
      setCopied(true);
      toast({
        title: "Link copied! 📋",
        description: "Share this link to preview the app on any device.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // Status badge helper
  const getStatusBadge = () => {
    if (isPreviewOnly) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Preview</Badge>;
    }
    switch (app.status) {
      case "live":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>;
      case "processing":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Building</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Draft</Badge>;
    }
  };

  const handleDownload = (platform: string) => {
    if (platform === "ios") {
      window.location.href = `/api/apps/${app.id}/download-ios`;
    } else {
      window.location.href = `/api/apps/${app.id}/download`;
    }
  };

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/dashboard")}
              className="text-muted-foreground hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${app.primaryColor}20` }}
              >
                {app.iconUrl ? (
                  <img src={app.iconUrl} alt={app.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  app.icon
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white">{app.name}</h1>
                  {getStatusBadge()}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {app.url}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* QR Code Button - Always visible */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowQRModal(true)}
              className="border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
            >
              <QrCode className="mr-2 h-4 w-4" /> QR Preview
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation(`/apps/${app.id}/edit`)}
              className="border-white/20 bg-white/5 hover:bg-white/10"
            >
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
            
            {/* Download buttons - Only for paid plans with live status */}
            {!isPreviewOnly && app.status === "live" && (
              <>
                {(app.platform === "android" || app.platform === "both") && (
                  <Button 
                    size="sm"
                    onClick={() => handleDownload("android")}
                    className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
                  >
                    <Download className="mr-2 h-4 w-4" /> APK
                  </Button>
                )}
                {(app.platform === "ios" || app.platform === "both") && (
                  <Button 
                    size="sm"
                    onClick={() => handleDownload("ios")}
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                  >
                    <Download className="mr-2 h-4 w-4" /> iOS
                  </Button>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* Preview Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col lg:flex-row gap-8 items-start"
        >
          {/* Device Preview */}
          <div className="flex-1 flex justify-center">
            <DevicePreview
              url={app.url}
              appName={app.name}
              primaryColor={app.primaryColor}
              icon={app.iconUrl || app.icon}
              availablePlatforms={getAvailablePlatforms()}
              defaultPlatform={app.platform === "ios" ? "ios" : "android"}
              showToggle={true}
            />
          </div>

          {/* App Details Sidebar */}
          <div className="w-full lg:w-80 space-y-4">
            <div className="glass rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-4">App Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="text-white capitalize">{app.platform}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-white capitalize">{app.status}</span>
                </div>
                {app.packageName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Package</span>
                    <span className="text-white text-xs truncate max-w-[150px]">{app.packageName}</span>
                  </div>
                )}
                {app.versionCode && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Version</span>
                    <span className="text-white">{app.versionCode}</span>
                  </div>
                )}
                {app.artifactSize && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Size</span>
                    <span className="text-white">{(app.artifactSize / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-white">{new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Color Info */}
            <div className="glass rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-4">Theme Colors</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Primary</span>
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-6 w-6 rounded-md border border-white/20"
                      style={{ backgroundColor: app.primaryColor }}
                    />
                    <span className="text-xs text-white font-mono">{app.primaryColor}</span>
                  </div>
                </div>
                {app.splashColor && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Splash</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-6 w-6 rounded-md border border-white/20"
                        style={{ backgroundColor: app.splashColor }}
                      />
                      <span className="text-xs text-white font-mono">{app.splashColor}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white"
                  onClick={() => setLocation(`/apps/${app.id}/edit`)}
                >
                  <Edit className="mr-2 h-4 w-4" /> Edit App Settings
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white"
                  onClick={() => setLocation(`/apps/${app.id}/push`)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Push Notifications
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white"
                  onClick={() => window.open(app.url, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" /> Visit Website
                </Button>
              </div>
            </div>
            
            {/* Upgrade Prompt for Preview Tier */}
            {isPreviewOnly && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-xl p-5 border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-purple-500/5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Upgrade to Download</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  You're on the free preview tier. Upgrade to download your app and publish to app stores.
                </p>
                <Button 
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400"
                  onClick={() => setLocation(`/pricing?upgrade=${app.id}`)}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> View Plans & Upgrade
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </main>
      
      {/* QR Code Modal */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="sm:max-w-md bg-slate-900/95 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <QrCode className="h-5 w-5 text-cyan-400" />
              Preview on Your Phone
            </DialogTitle>
            <DialogDescription>
              Scan this QR code with your phone to preview the app experience
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4 py-4">
            {/* QR Code */}
            <div className="p-4 bg-white rounded-xl">
              <QRCodeSVG 
                value={getPreviewUrl()} 
                size={200}
                level="H"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#0a0a0a"
              />
            </div>
            
            {/* Preview URL */}
            <div className="w-full">
              <label className="text-xs text-muted-foreground mb-2 block">Preview Link</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground truncate">
                  {getPreviewUrl()}
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={copyPreviewUrl}
                  className="border-white/20"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            {/* Instructions */}
            <div className="w-full p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-start gap-2">
                <Smartphone className="h-4 w-4 text-cyan-400 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-cyan-400 mb-1">How to preview:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Open camera app on your phone</li>
                    <li>Point at the QR code</li>
                    <li>Tap the notification to open</li>
                    <li>Add to Home Screen for full experience</li>
                  </ol>
                </div>
              </div>
            </div>
            
            {/* Share buttons */}
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                className="flex-1 border-white/20"
                onClick={copyPreviewUrl}
              >
                <Share2 className="mr-2 h-4 w-4" /> Share Link
              </Button>
              <Button 
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500"
                onClick={() => {
                  setShowQRModal(false);
                  window.open(getPreviewUrl(), "_blank");
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" /> Open Preview
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
