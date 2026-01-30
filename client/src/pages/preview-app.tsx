import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, RefreshCw, ExternalLink, QrCode, Share2, Copy, CheckCircle2, Wand2, AlertTriangle, MoreHorizontal, UploadCloud, Edit, Crown, Sparkles, Smartphone } from "lucide-react";
import { useLocation, useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { DevicePreview } from "@/components/device-preview";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getAppUrlDisplay, isHttpUrl } from "@/lib/utils";
import { AppBuilderStepper } from "@/components/app-builder-stepper";
import { PageLoading, PageState } from "@/components/page-state";

type AppItem = {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  isNativeOnly?: boolean | null;
  industry?: string | null;
  editorScreens?: any[] | null;
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
  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const [qrMode, setQrMode] = useState<"preview" | "play">("preview");
  const [publishingPlay, setPublishingPlay] = useState(false);
  
  // Check if coming from appId query param (create flow)
  const params = new URLSearchParams(search);
  const appIdFromQuery = params.get("appId");
  const appId = id || appIdFromQuery;

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const {
    data: app,
    isLoading: appLoading,
    error: appError,
    refetch: refetchApp,
  } = useQuery<AppItem | null>({
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
          <PageLoading label="Loading preview…" />
        </main>
      </div>
    );
  }

  if (appError) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-3xl">
          <PageState
            icon={<AlertTriangle className="h-5 w-5 text-red-300" />}
            title="Couldn’t load this app"
            description={(appError as any)?.message || "Please try again."}
          >
            <Button variant="outline" className="border-white/[0.10]" onClick={() => void refetchApp()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
            <Button variant="outline" className="border-white/[0.10]" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
          </PageState>
        </main>
      </div>
    );
  }

  // App not found
  if (!app) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-3xl">
          <PageState
            icon={<AlertTriangle className="h-5 w-5 text-amber-300" />}
            title="App not found"
            description="The app you’re looking for doesn’t exist, or you don’t have access."
          >
            <Button variant="outline" className="border-white/[0.10]" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Button>
          </PageState>
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

  const getPlayTestingUrl = () => {
    if (!app.packageName) return null;
    return `https://play.google.com/apps/testing/${app.packageName}`;
  };

  const canUsePlayQr = Boolean(app.packageName);

  const getActiveQrUrl = () => {
    if (qrMode === "play") {
      return getPlayTestingUrl() || getPreviewUrl();
    }
    return getPreviewUrl();
  };

  const copyUrlToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Copied to clipboard.",
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

  const shareOrCopyUrl = async (url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: app.name,
          url,
        });
        return;
      }
    } catch {
      // fall back to copy
    }
    await copyUrlToClipboard(url);
  };

  const publishToPlayInternal = async () => {
    if (!app) return;
    try {
      setPublishingPlay(true);
      const res = await apiRequest("POST", `/api/apps/${app.id}/publish/play/internal`);
      const payload = await res.json().catch(() => null);
      toast({
        title: "Published to Play (Internal testing)",
        description: payload?.testingUrl ? "Tester install link is ready." : "Done.",
      });
      setQrMode("play");
      setShowQRModal(true);
    } catch (err: any) {
      toast({
        title: "Publish failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPublishingPlay(false);
    }
  };

  const getSafeFilename = (raw: string) => {
    const base = (raw || "app")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return base || "app";
  };

  const getQrSvgEl = (): SVGSVGElement | null => {
    const el = qrContainerRef.current?.querySelector("svg");
    return (el as SVGSVGElement) || null;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadQrSvg = () => {
    const svgEl = getQrSvgEl();
    if (!svgEl) {
      toast({ title: "QR not ready", description: "Please try again in a moment.", variant: "destructive" });
      return;
    }
    const cloned = svgEl.cloneNode(true) as SVGSVGElement;
    cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgText = new XMLSerializer().serializeToString(cloned);
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, `${getSafeFilename(app.name)}-qr.svg`);
  };

  const downloadQrPng = async () => {
    const svgEl = getQrSvgEl();
    if (!svgEl) {
      toast({ title: "QR not ready", description: "Please try again in a moment.", variant: "destructive" });
      return;
    }
    try {
      const cloned = svgEl.cloneNode(true) as SVGSVGElement;
      cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const svgText = new XMLSerializer().serializeToString(cloned);
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.decoding = "async";
      img.src = svgUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load QR image"));
      });

      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);

      URL.revokeObjectURL(svgUrl);

      const pngBlob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!pngBlob) throw new Error("Failed to export PNG");
      downloadBlob(pngBlob, `${getSafeFilename(app.name)}-qr.png`);
    } catch (err: any) {
      toast({
        title: "Download failed",
        description: err?.message || "Please try again.",
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
          className="rounded-2xl border border-white/[0.06] bg-[#0d1117] p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/dashboard")}
              className="text-muted-foreground hover:text-white hover:bg-white/[0.06]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl border border-white/[0.06]"
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
                  {getAppUrlDisplay(app.url, app.isNativeOnly)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setLocation(`/apps/${app.id}/visual-editor`)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl"
            >
              <Wand2 className="mr-2 h-4 w-4" /> Open Builder
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/[0.10] bg-white/[0.03] hover:bg-white/[0.06] rounded-xl h-9 w-9 p-0"
                  aria-label="Preview actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => void shareOrCopyUrl(getPreviewUrl())}>
                  <Share2 className="mr-2 h-4 w-4" /> Share / Copy link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowQRModal(true)}>
                  <QrCode className="mr-2 h-4 w-4" /> QR Code
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(getPreviewUrl(), "_blank", "noopener,noreferrer")}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Open preview
                </DropdownMenuItem>
                {app.packageName && app.status === "live" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void publishToPlayInternal()} disabled={publishingPlay}>
                      <UploadCloud className="mr-2 h-4 w-4" />
                      {publishingPlay ? "Publishing to Play…" : "Publish to Play (Internal)"}
                    </DropdownMenuItem>
                  </>
                )}
                {isHttpUrl(app.url) && (
                  <DropdownMenuItem onClick={() => window.open(app.url, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="mr-2 h-4 w-4" /> Visit website
                  </DropdownMenuItem>
                )}
                {!isPreviewOnly && app.status === "live" && (
                  <>
                    <DropdownMenuSeparator />
                    {(app.platform === "android" || app.platform === "both") && (
                      <DropdownMenuItem onClick={() => handleDownload("android")}>
                        <Download className="mr-2 h-4 w-4" /> Download APK
                      </DropdownMenuItem>
                    )}
                    {(app.platform === "ios" || app.platform === "both") && (
                      <DropdownMenuItem onClick={() => handleDownload("ios")}>
                        <Download className="mr-2 h-4 w-4" /> Download iOS
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
          </div>

          {/* Step navigation */}
          <div className="w-full pt-3 border-t border-white/[0.06]">
            <AppBuilderStepper appId={app.id} current="preview" tone="app" />
          </div>
        </motion.div>

        {/* Preview Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col lg:flex-row gap-6 items-start"
        >
          {/* Device Preview */}
          <div className="flex-1 flex justify-center">
            <DevicePreview
              url={app.url}
              appName={app.name}
              primaryColor={app.primaryColor}
              icon={app.iconUrl || app.icon}
              preferLivePreview={true}
              screens={app.editorScreens || undefined}
              industry={app.industry || undefined}
              isNativeOnly={app.isNativeOnly || app.url?.startsWith("native://")}
              availablePlatforms={getAvailablePlatforms()}
              defaultPlatform={app.platform === "ios" ? "ios" : "android"}
              showToggle={true}
            />
          </div>

          {/* App Details Sidebar */}
          <div className="w-full lg:w-80 space-y-3">
            {/* Preview Center */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Preview</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Share, scan, or open on any device.</p>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block font-medium">Shareable link</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/[0.06] text-sm text-muted-foreground truncate font-mono">
                      {getPreviewUrl()}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void copyUrlToClipboard(getPreviewUrl())}
                      className="border-white/[0.10] bg-white/[0.03] hover:bg-white/[0.06] rounded-xl h-10 w-10 p-0"
                      aria-label="Copy preview link"
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Anyone with this link can preview your app.</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-white/[0.10] bg-white/[0.03] hover:bg-white/[0.06] rounded-xl h-11"
                    onClick={() => setShowQRModal(true)}
                  >
                    <QrCode className="mr-2 h-4 w-4 text-cyan-300" /> QR Code
                  </Button>
                  <Button
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl h-11"
                    onClick={() => window.open(getPreviewUrl(), "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> Open Preview
                  </Button>
                </div>
              </div>
            </div>

            {/* Manage */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Manage</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Settings and delivery.</p>
                </div>
              </div>
              <div className="p-3 space-y-1">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl"
                  onClick={() => setLocation(`/apps/${app.id}/edit`)}
                >
                  <Edit className="mr-3 h-4 w-4" /> App Settings
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl"
                  onClick={() => setLocation(`/apps/${app.id}/push`)}
                >
                  <RefreshCw className="mr-3 h-4 w-4" /> Push Notifications
                </Button>
                {isHttpUrl(app.url) && (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl"
                    onClick={() => window.open(app.url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="mr-3 h-4 w-4" /> Visit Website
                  </Button>
                )}

                {!isPreviewOnly && app.status === "live" && (
                  <div className="pt-2 mt-2 border-t border-white/[0.06] space-y-2">
                    {(app.platform === "android" || app.platform === "both") && (
                      <Button
                        size="sm"
                        onClick={() => handleDownload("android")}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                      >
                        <Download className="mr-2 h-4 w-4" /> Download APK
                      </Button>
                    )}
                    {(app.platform === "ios" || app.platform === "both") && (
                      <Button
                        size="sm"
                        onClick={() => handleDownload("ios")}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
                      >
                        <Download className="mr-2 h-4 w-4" /> Download iOS
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Details (collapsed by default) */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-hidden">
              <Accordion type="single" collapsible>
                <AccordionItem value="details" className="border-none">
                  <AccordionTrigger className="px-5 py-3 text-sm font-semibold text-white hover:no-underline hover:bg-white/[0.03] transition-colors data-[state=open]:bg-white/[0.02]">
                    <div className="text-left">
                      <div>Details</div>
                      <div className="text-xs font-normal text-muted-foreground mt-0.5">Platform, status, and theme.</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5 pt-1">
                    <div className="space-y-4">
                      <div className="space-y-3">
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

                      <div className="pt-4 border-t border-white/[0.06] space-y-3">
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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
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
        <DialogContent className="sm:max-w-2xl w-[min(92vw,720px)] bg-[#0d1117] border-white/[0.06] rounded-2xl p-0 overflow-hidden max-h-[85vh]">
          <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-cyan-400" />
                </div>
                Preview on your phone
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Scan the code or share the link to open the live preview.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 overflow-y-auto overflow-x-hidden">
            {canUsePlayQr && (
              <div className="mb-5">
                <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setQrMode("preview")}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      qrMode === "preview" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Live preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrMode("play")}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      qrMode === "play" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Install (Play testing)
                  </button>
                </div>
              </div>
            )}
            <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] items-start">
              {/* QR */}
              <div className="flex flex-col items-center gap-3">
                <div ref={qrContainerRef} className="p-5 bg-white rounded-3xl shadow-xl ring-1 ring-black/10">
                  <QRCodeSVG
                    value={getActiveQrUrl()}
                    size={190}
                    level="M"
                    includeMargin={true}
                    bgColor="#FFFFFF"
                    fgColor="#0a0a0a"
                    imageSettings={
                      app.iconUrl
                        ? {
                            src: app.iconUrl,
                            height: 28,
                            width: 28,
                            excavate: true,
                          }
                        : undefined
                    }
                  />
                </div>
                <div className="text-xs text-muted-foreground text-center">Open your camera and scan.</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-white/5 hover:bg-white/10 rounded-xl"
                    onClick={() => void downloadQrPng()}
                  >
                    <Download className="mr-2 h-4 w-4" /> PNG
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-white/5 hover:bg-white/10 rounded-xl"
                    onClick={() => downloadQrSvg()}
                  >
                    <Download className="mr-2 h-4 w-4" /> SVG
                  </Button>
                </div>
              </div>

              {/* Link + Instructions */}
              <div className="space-y-5 min-w-0">
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block font-medium">
                    {qrMode === "play" ? "Google Play testing link" : "Preview link"}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-white/5 border border-white/[0.06] text-sm text-muted-foreground truncate font-mono">
                      {getActiveQrUrl()}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void copyUrlToClipboard(getActiveQrUrl())}
                      className="border-white/10 bg-white/5 hover:bg-white/10 rounded-xl h-10 w-10 p-0"
                      aria-label="Copy preview link"
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                      <Smartphone className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-cyan-400 mb-2">
                        {qrMode === "play" ? "Install via Google Play (testing)" : "Best experience"}
                      </p>
                      <ul className="space-y-1.5 text-muted-foreground text-sm">
                        {qrMode === "play" ? (
                          <>
                            <li>Opens Google Play’s testing enrollment page</li>
                            <li>User must be added as a tester in Play Console</li>
                            <li>After joining, install/update through Google Play</li>
                          </>
                        ) : (
                          <>
                            <li>Scan the QR code or open the link</li>
                            <li>On iOS/Android, add to Home Screen (optional)</li>
                            <li>Share the link with teammates to review</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-white/[0.06] bg-[#0d1117]/95">
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 rounded-xl h-11"
                onClick={() => void shareOrCopyUrl(getActiveQrUrl())}
              >
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl h-11"
                onClick={() => {
                  setShowQRModal(false);
                  window.open(getActiveQrUrl(), "_blank", "noopener,noreferrer");
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" /> {qrMode === "play" ? "Open Play" : "Open Preview"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
