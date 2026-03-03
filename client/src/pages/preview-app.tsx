import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, RefreshCw, ExternalLink, QrCode, Share2, Copy, CheckCircle2, AlertTriangle, MoreHorizontal, UploadCloud, Edit, Crown, Sparkles, Smartphone, Lock } from "lucide-react";
import { useLocation, useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { DevicePreview } from "@/components/device-preview";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getAppUrlDisplay, isHttpUrl } from "@/lib/utils";
import { AppBuilderStepper } from "@/components/app-builder-stepper";
import { PageLoading, PageState } from "@/components/page-state";
import { formatPlanLabel, requiredPlanForFeature, usePlanGate } from "@/lib/plan-gate";

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
  generatedPrompt?: string | null;
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
  const { requirePlan, isAllowed, subscriptionLoading } = usePlanGate();
  
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

  const requiredPublishPlan = requiredPlanForFeature("publish_play");
  const showPublishPlanHint = !subscriptionLoading && !isAllowed("publish_play");

  useEffect(() => {
    // Track that the Preview hub was opened at least once (client-only).
    // TODO: Replace with server-side tracking if/when analytics/events are persisted.
    if (!appId) return;
    try {
      const atKey = `app:${appId}:previewOpenedAt`;
      const countKey = `app:${appId}:previewOpenedCount`;
      localStorage.setItem(atKey, new Date().toISOString());
      const nextCount = Number(localStorage.getItem(countKey) || "0") + 1;
      localStorage.setItem(countKey, String(nextCount));
    } catch {
      // Ignore storage errors (private mode, disabled storage, etc.)
    }
  }, [appId]);

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
        <main className="container mx-auto px-4 md:px-6 py-8">
          <PageLoading label="Loading preview…" />
        </main>
      </div>
    );
  }

  if (appError) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 md:px-6 py-8 max-w-3xl">
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
        <main className="container mx-auto px-4 md:px-6 py-8 max-w-3xl">
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
        title: "Published for Google Play testing",
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
    const base = "rounded-full px-2 py-0.5 text-xs font-medium border-0";
    if (isPreviewOnly) {
      return <Badge className={`${base} bg-slate-800/60 text-slate-300`}>Preview</Badge>;
    }
    switch (app.status) {
      case "live":
        return <Badge className={`${base} bg-green-900/30 text-green-300`}>Live</Badge>;
      case "processing":
        return <Badge className={`${base} bg-amber-900/30 text-amber-300`}>Processing</Badge>;
      case "failed":
        return <Badge className={`${base} bg-red-900/30 text-red-300`}>Failed</Badge>;
      default:
        return <Badge className={`${base} bg-slate-800/60 text-slate-300`}>Draft</Badge>;
    }
  };

  const handleDownload = (platform: string) => {
    if (platform === "ios") {
      if (!requirePlan("download_build", { requiredPlan: "pro", reason: "iOS build downloads require Pro or Agency." })) return;
      window.location.href = `/api/apps/${app.id}/download-ios`;
    } else {
      if (!requirePlan("download_build", { requiredPlan: "starter", reason: "Build downloads require a paid plan." })) return;
      window.location.href = `/api/apps/${app.id}/download`;
    }
  };

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        {/* Header — clear hierarchy: back, app identity, primary actions */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8 shadow-lg shadow-black/5"
        >
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              className="text-muted-foreground hover:text-white hover:bg-white/[0.08] shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center text-2xl border border-white/[0.08] shrink-0 shadow-inner"
                style={{ backgroundColor: `${app.primaryColor}18` }}
              >
                {app.iconUrl ? (
                  <img src={app.iconUrl} alt={app.name} className="h-11 w-11 rounded-xl object-cover" />
                ) : (
                  app.icon
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight truncate">{app.name}</h1>
                  {getStatusBadge()}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{getAppUrlDisplay(app.url, app.isNativeOnly)}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setLocation(`/apps/${app.id}/publish`)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
            >
              <UploadCloud className="mr-2 h-4 w-4" /> Continue to Publish
            </Button>

            {showPublishPlanHint ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                <Lock className="h-3.5 w-3.5" /> Requires {formatPlanLabel(requiredPublishPlan)} plan
              </span>
            ) : null}

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
                {app.packageName && app.status === "live" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void publishToPlayInternal()} disabled={publishingPlay}>
                      <UploadCloud className="mr-2 h-4 w-4" />
                      {publishingPlay ? "Publishing…" : "Publish for testing (Google Play)"}
                    </DropdownMenuItem>
                  </>
                )}
                {isHttpUrl(app.url) && (
                  <DropdownMenuItem onClick={() => window.open(app.url, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="mr-2 h-4 w-4" /> Visit website
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
          </div>

          {/* Step navigation */}
          <div className="w-full pt-3 border-t border-white/[0.06]">
            <AppBuilderStepper appId={app.id} current="preview" tone="app" />
          </div>
        </motion.div>

        {app.generatedPrompt ? (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3 mb-6 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-purple-400 shrink-0" />
            <p className="text-sm text-slate-300">
              Built from your description — edit any section in the Visual Editor or use the buttons above to customize and publish.
            </p>
          </div>
        ) : null}

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

          {/* Sidebar — primary: Share & preview; secondary: Settings & info (accordion); compact Upgrade */}
          <div className="w-full lg:w-80 space-y-4">
            {/* Primary: Share & preview — one clear CTA block */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden shadow-lg shadow-black/10">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h2 className="text-base font-semibold text-white">Share & preview</h2>
                <p className="text-xs text-muted-foreground mt-1">Test on device or share the link with your team.</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-muted-foreground truncate font-mono">
                    {getPreviewUrl()}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copyUrlToClipboard(getPreviewUrl())}
                    className="border-white/10 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl h-10 w-10 p-0 shrink-0"
                    aria-label="Copy preview link"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl h-11"
                    onClick={() => setShowQRModal(true)}
                  >
                    <QrCode className="mr-2 h-4 w-4 text-cyan-400" /> QR Code
                  </Button>
                  <Button
                    className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl h-11 font-medium"
                    onClick={() => window.open(getPreviewUrl(), "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> Open
                  </Button>
                </div>
              </div>
            </div>

            {/* Settings & info — single accordion (Manage + Details) */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-hidden">
              <Accordion type="single" collapsible defaultValue="">
                <AccordionItem value="settings" className="border-none">
                  <AccordionTrigger className="px-5 py-3 text-sm font-semibold text-white hover:no-underline hover:bg-white/[0.03] transition-colors data-[state=open]:bg-white/[0.02]">
                    <div className="text-left">
                      <div>Settings & info</div>
                      <div className="text-xs font-normal text-muted-foreground mt-0.5">Manage app, platform, theme.</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5 pt-1 space-y-4">
                    <div className="space-y-1">
                      <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl" onClick={() => setLocation(`/apps/${app.id}/editor`)}>
                        <Edit className="mr-3 h-4 w-4" /> Open Settings
                      </Button>
                      <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl" onClick={() => setLocation(`/apps/${app.id}/push`)}>
                        <RefreshCw className="mr-3 h-4 w-4" /> Push Notifications
                      </Button>
                      {isHttpUrl(app.url) && (
                        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl" onClick={() => window.open(app.url, "_blank", "noopener,noreferrer")}>
                          <ExternalLink className="mr-3 h-4 w-4" /> Visit Website
                        </Button>
                      )}
                    </div>
                    {!isPreviewOnly && app.status === "live" && (
                      <div className="pt-3 border-t border-white/[0.06] space-y-2">
                        {(app.platform === "android" || app.platform === "both") && (
                          <Button size="sm" onClick={() => handleDownload("android")} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl">
                            <Download className="mr-2 h-4 w-4" /> Download Android (APK)
                          </Button>
                        )}
                        {(app.platform === "ios" || app.platform === "both") && (
                          <Button size="sm" onClick={() => handleDownload("ios")} className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                            <Download className="mr-2 h-4 w-4" /> Download iOS
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="pt-3 border-t border-white/[0.06] space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Platform</span>
                        <span className="text-white capitalize px-2 py-0.5 rounded-md bg-white/5">{app.platform}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Status</span>
                        <span className="text-white capitalize">{app.status}</span>
                      </div>
                      {app.packageName && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 shrink-0">Package</span>
                          <span className="text-white text-xs truncate font-mono bg-white/5 px-2 py-0.5 rounded">{app.packageName}</span>
                        </div>
                      )}
                      {app.versionCode != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Version</span>
                          <span className="text-white">{app.versionCode}</span>
                        </div>
                      )}
                      {app.artifactSize != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Size</span>
                          <span className="text-white">{(app.artifactSize / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Theme</span>
                        <div className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: app.primaryColor }} title={app.primaryColor} />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Compact upgrade CTA — only for preview tier */}
            {isPreviewOnly && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <Crown className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">Download & publish</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Upgrade to get your app file and publish to stores.</p>
                    <Button size="sm" className="mt-3 w-full bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium" onClick={() => setLocation(`/pricing?upgrade=${app.id}`)}>
                      <Sparkles className="mr-2 h-3.5 w-3.5" /> View plans
                    </Button>
                  </div>
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
                  <label className="text-xs font-medium text-slate-300/80 mb-2 block">
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
