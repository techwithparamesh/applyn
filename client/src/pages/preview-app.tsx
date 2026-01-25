import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Download, RefreshCw, ExternalLink, QrCode, Smartphone, Share2, Copy, CheckCircle2, Sparkles, Crown, Wand2 } from "lucide-react";
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
              className="border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400 rounded-xl"
            >
              <QrCode className="mr-2 h-4 w-4" /> QR Preview
            </Button>
            
            {/* Visual Editor Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation(`/apps/${app.id}/visual-editor`)}
              className="border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400 rounded-xl"
            >
              <Wand2 className="mr-2 h-4 w-4" /> Visual Editor
            </Button>
            
            {/* Settings/Edit Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation(`/apps/${app.id}/edit`)}
              className="border-white/10 bg-white/5 hover:bg-white/10 rounded-xl"
            >
              <Edit className="mr-2 h-4 w-4" /> Settings
            </Button>
            
            {/* Download buttons - Only for paid plans with live status */}
            {!isPreviewOnly && app.status === "live" && (
              <>
                {(app.platform === "android" || app.platform === "both") && (
                  <Button 
                    size="sm"
                    onClick={() => handleDownload("android")}
                    className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl"
                  >
                    <Download className="mr-2 h-4 w-4" /> APK
                  </Button>
                )}
                {(app.platform === "ios" || app.platform === "both") && (
                  <Button 
                    size="sm"
                    onClick={() => handleDownload("ios")}
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl"
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
            {/* App Details Card - Clean Design */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white">App Details</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Platform</span>
                  <span className="text-sm text-white capitalize px-2.5 py-1 rounded-full bg-white/5 border border-white/10">{app.platform}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm text-white capitalize">{app.status}</span>
                </div>
                {app.packageName && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Package</span>
                    <span className="text-white text-xs truncate max-w-[150px] font-mono bg-white/5 px-2 py-0.5 rounded">{app.packageName}</span>
                  </div>
                )}
                {app.versionCode && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Version</span>
                    <span className="text-sm text-white">{app.versionCode}</span>
                  </div>
                )}
                {app.artifactSize && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Size</span>
                    <span className="text-sm text-white">{(app.artifactSize / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm text-white">{new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Color Info - Clean Design */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white">Theme Colors</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Primary</span>
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-7 w-7 rounded-full border-2 border-white/20 shadow-lg"
                      style={{ backgroundColor: app.primaryColor }}
                    />
                    <span className="text-xs text-white font-mono bg-white/5 px-2 py-0.5 rounded">{app.primaryColor}</span>
                  </div>
                </div>
                {app.splashColor && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Splash</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-7 w-7 rounded-lg border-2 border-white/20 shadow-lg"
                        style={{ backgroundColor: app.splashColor }}
                      />
                      <span className="text-xs text-white font-mono bg-white/5 px-2 py-0.5 rounded">{app.splashColor}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions - Clean Design */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
              </div>
              <div className="p-3 space-y-1">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-xl"
                  onClick={() => setLocation(`/apps/${app.id}/visual-editor`)}
                >
                  <Wand2 className="mr-3 h-4 w-4" /> Visual Editor
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl"
                  onClick={() => setLocation(`/apps/${app.id}/edit`)}
                >
                  <Edit className="mr-3 h-4 w-4" /> Edit App Settings
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl"
                  onClick={() => setLocation(`/apps/${app.id}/push`)}
                >
                  <RefreshCw className="mr-3 h-4 w-4" /> Push Notifications
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl"
                  onClick={() => window.open(app.url, "_blank")}
                >
                  <ExternalLink className="mr-3 h-4 w-4" /> Visit Website
                </Button>
              </div>
            </div>
            
            {/* Upgrade Prompt for Preview Tier */}
            {isPreviewOnly && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-9 w-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <Crown className="h-5 w-5 text-cyan-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Upgrade to Download</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    You're on the free preview tier. Upgrade to download your app and publish to app stores.
                  </p>
                  <Button 
                    className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 rounded-xl"
                    onClick={() => setLocation(`/pricing?upgrade=${app.id}`)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" /> View Plans & Upgrade
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </main>
      
      {/* QR Code Modal - Clean Design */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="sm:max-w-md bg-[#0d1117] border-white/[0.06] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <QrCode className="h-5 w-5 text-cyan-400" />
              </div>
              Preview on Your Phone
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Scan this QR code with your phone to preview the app experience
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-5 py-4">
            {/* QR Code */}
            <div className="p-5 bg-white rounded-2xl shadow-xl">
              <QRCodeSVG 
                value={getPreviewUrl()} 
                size={180}
                level="H"
                includeMargin={false}
                bgColor="#FFFFFF"
                fgColor="#0a0a0a"
              />
            </div>
            
            {/* Preview URL */}
            <div className="w-full">
              <label className="text-xs text-muted-foreground mb-2 block font-medium">Preview Link</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/[0.06] text-sm text-muted-foreground truncate font-mono">
                  {getPreviewUrl()}
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={copyPreviewUrl}
                  className="border-white/10 bg-white/5 hover:bg-white/10 rounded-xl h-10 w-10 p-0"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            {/* Instructions */}
            <div className="w-full p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <Smartphone className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-cyan-400 mb-2">How to preview:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                    <li>Open camera app on your phone</li>
                    <li>Point at the QR code</li>
                    <li>Tap the notification to open</li>
                    <li>Add to Home Screen for full experience</li>
                  </ol>
                </div>
              </div>
            </div>
            
            {/* Share buttons */}
            <div className="flex gap-3 w-full">
              <Button 
                variant="outline" 
                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 rounded-xl h-11"
                onClick={copyPreviewUrl}
              >
                <Share2 className="mr-2 h-4 w-4" /> Share Link
              </Button>
              <Button 
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl h-11"
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
