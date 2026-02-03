import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Plus,
  Download,
  MoreVertical,
  Smartphone,
  Clock,
  CheckCircle,
  Circle,
  RefreshCw,
  Settings,
  ArrowRight,
  Activity,
  Package,
  AlertCircle,
  Sparkles,
  LifeBuoy,
  CreditCard,
  Wand2,
  Eye,
  Calendar,
  AlertTriangle,
  Crown,
  Mail,
  Loader2,
  X,
  Shield,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { BuildLogsDialog } from "@/components/build-logs-dialog";
import { motion } from "framer-motion";
import { BuildErrorAnalyzer } from "@/components/ai-features";
import { getAppUrlDisplay } from "@/lib/utils";
import { usePlanGate } from "@/lib/plan-gate";
import { EmptyState } from "@/components/empty-state";

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
  editorScreens?: any[] | null;
  primaryColor: string;
  packageName?: string | null;
  versionCode?: number | null;
  artifactSize?: number | null;
  buildLogs?: string | null;
  buildError?: string | null;
  lastBuildAt?: string | Date | null;
  lastPlayTrack?: string | null;
  lastPlayPublishedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type Me = {
  id: string;
  username: string;
  name: string | null;
  role: "admin" | "support" | "user" | string;
  mustChangePassword?: boolean;
  emailVerified?: boolean;
};

type SubscriptionInfo = {
  plan: string | null;
  planStatus: string | null;
  planStartDate: string | null;
  planExpiryDate: string | null;
  remainingRebuilds: number;
  daysUntilExpiry: number | null;
  planDetails: {
    name: string;
    price: number;
    monthlyEquivalent: number;
    rebuildsPerYear: number;
    features: Record<string, boolean>;
  } | null;
  isActive: boolean;
  isExpired: boolean;
  needsRenewal: boolean;
};

type SupportTicket = {
  id: string;
  status: "open" | "closed" | string;
  subject: string;
  createdAt: string | Date;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { requirePlan } = usePlanGate();

  const { data: me, isLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const userRole = me?.role || "user";
  const isStaff = useMemo(() => {
    return userRole === "admin" || userRole === "support";
  }, [userRole]);
  const isSupport = userRole === "support";
  const isAdmin = userRole === "admin";

  const [logsOpen, setLogsOpen] = useState(false);
  const [logsTitle, setLogsTitle] = useState<string>("Build logs");
  const [logsText, setLogsText] = useState<string | null>(null);
  const [viewingAppId, setViewingAppId] = useState<string | null>(null);
  const [verificationBannerDismissed, setVerificationBannerDismissed] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  
  // Filter state for apps
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "processing" | "failed" | "draft">("all");

  // Check if email is unverified
  const showVerificationBanner = me && !me.emailVerified && !verificationBannerDismissed;

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast({
          title: "Verification email sent",
          description: "Please check your inbox and click the verification link.",
        });
      } else {
        const data = await res.json();
        toast({
          title: "Failed to send",
          description: data.message || "Could not send verification email",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to send verification email",
        variant: "destructive",
      });
    } finally {
      setResendingVerification(false);
    }
  };

  const { data: apps, isLoading: appsLoading } = useQuery<AppItem[]>({
    queryKey: ["/api/apps"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me,
    refetchInterval: (query) => {
      const data = query.state.data as AppItem[] | undefined;
      return data?.some((a) => a.status === "processing") ? 2000 : false;
    },
  });

  const { data: tickets } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!me,
  });

  // Subscription status query
  const { data: subscription } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!me,
  });

  // Compute stats
  const stats = useMemo(() => {
    const appList = apps || [];
    return {
      total: appList.length,
      live: appList.filter((a) => a.status === "live").length,
      processing: appList.filter((a) => a.status === "processing").length,
      failed: appList.filter((a) => a.status === "failed").length,
      openTickets: (tickets || []).filter((t) => t.status === "open").length,
    };
  }, [apps, tickets]);

  // Filtered apps based on status filter
  const filteredApps = useMemo(() => {
    if (statusFilter === "all") return apps || [];
    return (apps || []).filter((a) => a.status === statusFilter);
  }, [apps, statusFilter]);

  const progressApp = useMemo(() => {
    const list = apps || [];
    if (!list.length) return null;
    const toTime = (v: any) => {
      const t = new Date(v as any).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    return [...list].sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt))[0] || null;
  }, [apps]);

  const previewOpened = useMemo(() => {
    // Real-ish logic (client-only). If storage isn't available, default to false.
    // TODO: Replace with server-side tracking if/when preview opens are persisted.
    if (!progressApp?.id) return false;
    try {
      const key = `app:${progressApp.id}:previewOpenedAt`;
      return typeof window !== "undefined" && !!localStorage.getItem(key);
    } catch {
      return false;
    }
  }, [progressApp?.id]);

  const progress = useMemo(() => {
    if (!progressApp) return null;
    const hasName = Boolean(String(progressApp.name || "").trim());
    const hasLogo = Boolean(progressApp.iconUrl) || (Boolean(String(progressApp.icon || "").trim()) && progressApp.icon !== "rocket");
    const settingsDone = hasName && hasLogo;

    const screens = Array.isArray(progressApp.editorScreens) ? progressApp.editorScreens : [];
    const screensDone = screens.length >= 1;

    const lastTrack = String((progressApp as any).lastPlayTrack || "");
    const lastPublishedAt = (progressApp as any).lastPlayPublishedAt;
    const hasPublishedAtLeastOnce = Boolean(lastPublishedAt);

    const publishPublicDone = hasPublishedAtLeastOnce && lastTrack === "production";
    const publishTestingDone = publishPublicDone || (hasPublishedAtLeastOnce && lastTrack === "internal");

    return {
      appName: progressApp.name,
      settingsDone,
      screensDone,
      previewDone: previewOpened,
      testingDone: publishTestingDone,
      publicDone: publishPublicDone,
    };
  }, [progressApp, previewOpened]);

  const showMomentumPublishNudge = useMemo(() => {
    if (!progressApp || !progress) return false;
    const lastTrack = String((progressApp as any).lastPlayTrack || "");
    return progress.settingsDone && progress.screensDone && progress.previewDone && lastTrack !== "production";
  }, [progressApp, progress]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !me) {
      setLocation(`/login?returnTo=${encodeURIComponent("/dashboard")}`);
    }
  }, [isLoading, me, setLocation]);

  // Redirect to change password if required (team member first login)
  useEffect(() => {
    if (!isLoading && me && me.mustChangePassword) {
      setLocation("/change-password");
    }
  }, [isLoading, me, setLocation]);

  const handleDelete = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/apps/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
      toast({ title: "Deleted", description: "App removed." });
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleBuild = async (id: string) => {
    try {
      await apiRequest("POST", `/api/apps/${id}/build`);
      await queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
      toast({ title: "Build started", description: "We are building your APK now." });
    } catch (err: any) {
      toast({
        title: "Build failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  // Handle rebuild with plan limit check
  const handleRebuild = async (app: AppItem) => {
    try {
      // First check the plan limits
      const planRes = await apiRequest("GET", `/api/apps/${app.id}/plan`);
      const planData = await planRes.json();
      
      if (!planData.rebuilds?.allowed) {
        // Show upgrade prompt based on the reason
        if (planData.plan === "starter") {
          toast({
            title: "Rebuilds not included",
            description: "Starter plan doesn't include rebuilds. Upgrade to Standard or Pro plan for rebuild access.",
            variant: "destructive",
          });
        } else if (planData.rebuilds?.remaining === 0) {
          toast({
            title: "Rebuild limit reached",
            description: `You've used all ${planData.rebuilds.limit} rebuilds on your ${planData.plan} plan.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Rebuild not available",
            description: "Your rebuild window has expired or no payment found.",
            variant: "destructive",
          });
        }
        return;
      }

      // Confirm with user showing remaining rebuilds
      const remaining = planData.rebuilds.remaining - 1;
      const confirmMessage = remaining > 0 
        ? `This will use 1 of your ${planData.rebuilds.limit} rebuilds. You'll have ${remaining} rebuild(s) remaining.`
        : `This is your last rebuild on the ${planData.plan} plan.`;
      
      if (!window.confirm(`Rebuild ${app.name}?\n\n${confirmMessage}`)) {
        return;
      }

      // Proceed with rebuild
      await apiRequest("POST", `/api/apps/${app.id}/build`);
      await queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
      toast({ 
        title: "Rebuild started", 
        description: `Building ${app.name}. ${remaining} rebuild(s) remaining.` 
      });
    } catch (err: any) {
      const errorData = err?.response ? await err.response.json().catch(() => ({})) : {};
      toast({
        title: "Rebuild failed",
        description: errorData?.message || err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  // Fetch build status for an app
  const fetchBuildStatus = async (appId: string, appName: string) => {
    try {
      const res = await apiRequest("GET", `/api/apps/${appId}/build-status`);
      const data = await res.json();
      
      let logsContent = "";
      
      if (data.job) {
        logsContent += `=== Build Job ===\n`;
        logsContent += `Status: ${data.job.status}\n`;
        logsContent += `Attempts: ${data.job.attempts}\n`;
        logsContent += `Created: ${new Date(data.job.createdAt).toLocaleString()}\n`;
        if (data.job.error) {
          logsContent += `\n=== Error ===\n${data.job.error}\n`;
        }
      }
      
      if (data.buildError) {
        logsContent += `\n=== Build Error ===\n${data.buildError}\n`;
      }
      
      if (data.buildLogs) {
        logsContent += `\n=== Build Logs ===\n${data.buildLogs}`;
      }
      
      if (!logsContent) {
        logsContent = "Build is in progress. No logs available yet.\n\nThe build worker processes jobs periodically. Please check back in a minute.";
      }
      
      setLogsTitle(`${appName} • Build Status`);
      setLogsText(logsContent);
      
      return data.job?.status;
    } catch (err: any) {
      console.error("Failed to fetch build status:", err);
      return null;
    }
  };

  const handleViewBuildStatus = async (app: AppItem) => {
    setViewingAppId(app.id);
    setLogsOpen(true);
    await fetchBuildStatus(app.id, app.name);
  };

  // Auto-refresh build status when modal is open and build is in progress
  useEffect(() => {
    if (!logsOpen || !viewingAppId) return;
    
    const app = apps?.find(a => a.id === viewingAppId);
    if (!app) return;
    
    // Only auto-refresh for processing/queued status
    if (app.status !== "processing") return;
    
    const interval = setInterval(async () => {
      const jobStatus = await fetchBuildStatus(viewingAppId, app.name);
      // Stop refreshing if job completed
      if (jobStatus === "succeeded" || jobStatus === "failed") {
        queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [logsOpen, viewingAppId, apps]);

  // Clear viewingAppId when modal closes
  useEffect(() => {
    if (!logsOpen) {
      setViewingAppId(null);
    }
  }, [logsOpen]);

  const handleDownload = (id: string, platform?: string) => {
    if (platform === "ios") {
      if (!requirePlan("download_build", { requiredPlan: "pro", reason: "iOS build downloads require Pro or Agency." })) return;
      window.location.href = `/api/apps/${id}/download-ios`;
    } else {
      if (!requirePlan("download_build", { requiredPlan: "starter", reason: "Build downloads require a paid plan." })) return;
      window.location.href = `/api/apps/${id}/download`;
    }
  };

  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallthrough
    }
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopyBuildError = async (app: AppItem) => {
    const text = (app.buildError || "").trim();
    if (!text) return;
    const ok = await copyText(text);
    toast({
      title: ok ? "Copied" : "Copy failed",
      description: ok ? "Build error copied to clipboard." : "Could not copy to clipboard.",
      variant: ok ? undefined : "destructive",
    });
  };

  const handleContactSupport = async (app: AppItem) => {
    const subject = `Help needed: build failed for ${app.name}`;
    const message = `Hi Support,\n\nMy app build failed.\n\nApp name: ${app.name}\nApp id: ${app.id}\nWebsite: ${app.url}\n\nPlease help.\n`;
    try {
      await apiRequest("POST", "/api/support/tickets", {
        appId: app.id,
        subject,
        message,
      });
      toast({
        title: "Ticket created",
        description: "Support has been notified. We'll get back to you soon.",
      });
    } catch {
      const qs = new URLSearchParams({ subject, message }).toString();
      setLocation(`/contact?${qs}`);
    }
  };

  const [retryingBuild, setRetryingBuild] = useState<string | null>(null);
  
  const handleRetryBuild = async (appId: string) => {
    setRetryingBuild(appId);
    try {
      await apiRequest("POST", `/api/apps/${appId}/retry-build`);
      toast({
        title: "Build retry started",
        description: "Your app is being rebuilt. You'll receive an email when it's ready.",
      });
      // Refresh apps list
      queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
    } catch (err: any) {
      toast({
        title: "Retry failed",
        description: err?.message || "Could not retry build. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRetryingBuild(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        </main>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-10"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Welcome back, <span className="text-gradient">{me?.name || me?.username?.split("@")[0] || "User"}</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isSupport 
                  ? "Support Dashboard - Help users and manage tickets"
                  : "Here's what's happening with your apps today"
                }
              </p>
            </div>
            {!isSupport && (
              <Link href="/prompt-create">
                <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold">
                  <Plus className="h-4 w-4" /> Create New App
                </Button>
              </Link>
            )}
          </motion.div>

          {/* Email Verification Banner */}
          {showVerificationBanner && (
            <motion.div variants={itemVariants}>
              <Card className="border-amber-500/30 bg-amber-500/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="font-medium text-amber-200">Verify your email address</p>
                        <p className="text-sm text-amber-300/70">
                          Please verify your email to access all features and receive important notifications.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleResendVerification}
                        disabled={resendingVerification}
                      >
                        {resendingVerification ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Mail className="h-4 w-4 mr-1" />
                        )}
                        Resend Email
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setVerificationBannerDismissed(true)}
                        className="text-amber-300 hover:text-amber-200 hover:bg-amber-500/20"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Stats Grid - Role-based */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isSupport ? (
              /* Support Team Stats */
              <>
                <Card 
                  className="glass glass-hover border stat-gradient-4 cursor-pointer transition-colors duration-150 ease-out"
                  onClick={() => setLocation("/tickets")}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-300/80">Open Tickets</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.openTickets}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                        <LifeBuoy className="h-6 w-6 text-yellow-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass glass-hover border stat-gradient-1">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-300/80">Total Apps</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <Package className="h-6 w-6 text-cyan-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass glass-hover border stat-gradient-2">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-300/80">Processing</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.processing}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-purple-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass glass-hover border stat-gradient-3">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-300/80">Failed Builds</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.failed}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-red-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              /* Regular User Stats */
              <>
                <Card 
                  className={`glass glass-hover border stat-gradient-1 cursor-pointer transition-colors duration-150 ease-out ${statusFilter === "all" ? "ring-1 ring-cyan-500/50 bg-white/[0.05]" : ""}`}
                  onClick={() => setStatusFilter("all")}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-300/80">Total Apps</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <Package className="h-6 w-6 text-cyan-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className={`glass glass-hover border stat-gradient-3 cursor-pointer transition-colors duration-150 ease-out ${statusFilter === "live" ? "ring-1 ring-green-500/50 bg-white/[0.05]" : ""}`}
                  onClick={() => setStatusFilter("live")}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-300/80">Live Apps</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.live}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className={`glass glass-hover border stat-gradient-2 cursor-pointer transition-colors duration-150 ease-out ${statusFilter === "processing" ? "ring-1 ring-purple-500/50 bg-white/[0.05]" : ""}`}
                  onClick={() => setStatusFilter("processing")}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-300/80">Processing</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.processing}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-purple-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="glass glass-hover border stat-gradient-4 cursor-pointer transition-colors duration-150 ease-out"
                  onClick={() => setLocation("/tickets")}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-300/80">Open Tickets</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.openTickets}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                        <LifeBuoy className="h-6 w-6 text-yellow-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </motion.div>

          {/* Quick Actions - Role-based */}
          <motion.div variants={itemVariants}>
            <h2 className="text-lg font-semibold text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Support-specific actions */}
              {isSupport ? (
                <>
                  <Link href="/tickets">
                    <Card className="glass glass-hover cursor-pointer group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                          <LifeBuoy className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">All Tickets</p>
                          <p className="text-xs text-muted-foreground">View & respond</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/ops">
                    <Card className="glass glass-hover cursor-pointer group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                          <Activity className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Build Logs</p>
                          <p className="text-xs text-muted-foreground">Debug issues</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/profile">
                    <Card className="glass glass-hover cursor-pointer group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                          <Settings className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Settings</p>
                          <p className="text-xs text-muted-foreground">Profile & more</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Card className="glass border-dashed border-white/10 opacity-60">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gray-500/10 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-400">Support Role</p>
                        <p className="text-xs text-muted-foreground">Read-only access</p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                /* Regular user actions */
                <>
                  <Link href="/prompt-create">
                    <Card className="glass glass-hover cursor-pointer group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                          <Sparkles className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">New App</p>
                          <p className="text-xs text-muted-foreground">Create or convert</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/tickets">
                    <Card className="glass glass-hover cursor-pointer group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                          <LifeBuoy className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Support</p>
                          <p className="text-xs text-muted-foreground">Get help</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/billing">
                    <Card className="glass glass-hover cursor-pointer group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                          <CreditCard className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Billing</p>
                          <p className="text-xs text-muted-foreground">View payments</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/profile">
                    <Card className="glass glass-hover cursor-pointer group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                          <Settings className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Settings</p>
                          <p className="text-xs text-muted-foreground">Profile & more</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </>
              )}
            </div>
          </motion.div>

          {/* Subscription Status - Hidden for support */}
          {subscription && !isSupport && (
            <motion.div variants={itemVariants}>
              <h2 className="text-lg font-semibold text-white mb-4">Plan Status</h2>
              <Card className={`glass ${subscription.needsRenewal ? 'border-yellow-500/50' : subscription.isExpired ? 'border-red-500/50' : 'border-green-500/30'}`}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                        subscription.isExpired 
                          ? 'bg-red-500/10' 
                          : subscription.needsRenewal 
                            ? 'bg-yellow-500/10' 
                            : 'bg-green-500/10'
                      }`}>
                        {subscription.isExpired ? (
                          <AlertTriangle className="h-7 w-7 text-red-400" />
                        ) : subscription.needsRenewal ? (
                          <Clock className="h-7 w-7 text-yellow-400" />
                        ) : (
                          <Crown className="h-7 w-7 text-green-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white text-lg">
                            {subscription.planDetails?.name || subscription.plan || 'No Plan'}
                          </h3>
                          <Badge variant="outline" className={
                            subscription.isExpired 
                              ? 'border-red-500/30 text-red-400' 
                              : subscription.isActive 
                                ? 'border-green-500/30 text-green-400' 
                                : 'border-yellow-500/30 text-yellow-400'
                          }>
                            {subscription.planStatus || 'No Plan'}
                          </Badge>
                        </div>
                        {subscription.planExpiryDate && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {subscription.isExpired 
                              ? `Expired on ${new Date(subscription.planExpiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                              : `Expires ${new Date(subscription.planExpiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (${subscription.daysUntilExpiry} days)`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                      {/* Rebuilds Counter */}
                      {subscription.plan && (
                        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5">
                          <RefreshCw className="h-5 w-5 text-purple-400" />
                          <div>
                            <p className="text-xs font-medium text-slate-300/80">Rebuilds Left</p>
                            <p className="text-lg font-bold text-white">
                              {subscription.remainingRebuilds}
                              <span className="text-sm text-muted-foreground font-normal">
                                /{subscription.planDetails?.rebuildsPerYear || 0}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Action Button */}
                      {subscription.isExpired || subscription.needsRenewal ? (
                        <Link href="/pricing">
                          <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold">
                            {subscription.isExpired ? 'Renew Now' : 'Renew Early'}
                          </Button>
                        </Link>
                      ) : !subscription.plan ? (
                        <Link href="/pricing">
                          <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold">
                            Choose Plan
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  
                  {/* Warning Message */}
                  {subscription.needsRenewal && !subscription.isExpired && (
                    <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm text-yellow-400">
                        ⚠️ Your subscription expires soon! Renew to continue building apps and accessing premium features.
                      </p>
                    </div>
                  )}
                  
                  {subscription.isExpired && (
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-sm text-red-400">
                        ⚠️ Your subscription has expired. Your apps will continue to work, but you cannot rebuild or modify them until you renew.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Apps Section - Hidden for support users */}
          {!isSupport && (
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">My Apps</h2>
                {statusFilter !== "all" && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/10 text-white capitalize flex items-center gap-1">
                    {statusFilter}
                    <button 
                      onClick={() => setStatusFilter("all")}
                      className="ml-1 hover:text-cyan-400 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>

            {progress ? (
              <Card className="glass border-white/10 mb-4">
                <CardContent className="p-5">
                  <div className="text-sm font-medium text-slate-300/80">Your App Setup Progress</div>
                  <div className="mt-1 text-xs text-muted-foreground truncate">{progress.appName}</div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {progress.settingsDone ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Configure Settings</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {progress.screensDone ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Design Screens</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {progress.previewDone ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Preview App</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {progress.testingDone ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Publish for Testing</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {progress.publicDone ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Publish Publicly</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-white/10 bg-white/[0.03] mb-4">
              <CardContent className="p-4 text-sm text-slate-300/80">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-slate-300/70" />
                    <span>Build success rate: 99.8%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-300/70" />
                    <span>Secure payments powered by Razorpay</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-slate-300/70" />
                    <span>Apps published every week</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                  <span>System status: Operational</span>
                </div>
              </CardContent>
            </Card>

            {showMomentumPublishNudge && progressApp ? (
              <Card className="mb-4 border border-green-500/30 bg-green-900/10">
                <CardContent className="p-4 text-sm">
                  <div className="text-white font-medium">Your app is ready to go live 🚀</div>
                  <div className="mt-1 text-muted-foreground">You’ve completed all required steps. Publish now to make it available.</div>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={() => setLocation(`/apps/${progressApp.id}/publish`)}
                    >
                      Publish Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {appsLoading && (
                <Card className="md:col-span-2 lg:col-span-3 glass">
                  <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                    Loading your apps...
                  </CardContent>
                </Card>
              )}

              {!appsLoading && filteredApps.length === 0 && (apps || []).length > 0 && (
                <Card className="md:col-span-2 lg:col-span-3 glass">
                  <CardContent className="p-0">
                    <EmptyState
                      icon={Package}
                      title={statusFilter === "all" ? "No apps yet. Create your first app!" : `No ${statusFilter} apps found.`}
                    >
                      {statusFilter !== "all" ? (
                        <Button variant="ghost" size="sm" className="text-cyan-400" onClick={() => setStatusFilter("all")}>
                          Show all apps
                        </Button>
                      ) : null}
                    </EmptyState>
                  </CardContent>
                </Card>
              )}

              {filteredApps.map((app) => (
                <Card key={app.id} className="border-white/[0.06] bg-[#0d1117] rounded-2xl overflow-hidden group hover:border-white/[0.12] transition-colors duration-150 ease-out">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl overflow-hidden border border-white/[0.06]"
                        style={{ backgroundColor: `${app.primaryColor}15` }}
                      >
                        {app.iconUrl ? (
                          <img src={app.iconUrl} alt={app.name} className="h-full w-full object-cover" />
                        ) : (
                          app.icon
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base text-white">{app.name}</CardTitle>
                        <CardDescription className="text-xs truncate max-w-[160px] text-muted-foreground">
                          {getAppUrlDisplay(app.url, (app as any).isNativeOnly)}
                        </CardDescription>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#0d1117] border-white/[0.06] rounded-xl">
                        {app.status === "live" && (app.platform === "android" || app.platform === "both") && (
                          <DropdownMenuItem onClick={() => handleDownload(app.id, "android")}>
                            <Download className="mr-2 h-4 w-4" /> Download Android App (APK)
                          </DropdownMenuItem>
                        )}
                        {app.status === "live" && (app.platform === "ios" || app.platform === "both") && (
                          <DropdownMenuItem onClick={() => handleDownload(app.id, "ios")}>
                            <Download className="mr-2 h-4 w-4" /> Download iOS
                          </DropdownMenuItem>
                        )}
                        {app.status === "live" && (
                          <DropdownMenuItem onClick={() => handleRebuild(app)}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Rebuild App
                          </DropdownMenuItem>
                        )}
                        {(app.status === "live" || app.status === "failed") && (
                          <DropdownMenuItem
                            onClick={() => handleViewBuildStatus(app)}
                          >
                            View build logs
                          </DropdownMenuItem>
                        )}
                        {app.status === "draft" && (
                          <DropdownMenuItem onClick={() => handleBuild(app.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Build App
                          </DropdownMenuItem>
                        )}
                        {app.status === "failed" && (
                          <DropdownMenuItem onClick={() => handleRebuild(app)}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Rebuild App
                          </DropdownMenuItem>
                        )}
                        {app.status === "processing" && isStaff && (
                          <DropdownMenuItem
                            onClick={() => handleViewBuildStatus(app)}
                          >
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> View Build Status
                          </DropdownMenuItem>
                        )}
                        {app.status === "processing" && !isStaff && (
                          <DropdownMenuItem disabled>
                            <Clock className="mr-2 h-4 w-4" /> Building...
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-white/[0.06]" />
                        <DropdownMenuItem onClick={() => setLocation(`/apps/${app.id}/editor`)}>
                          <Settings className="mr-2 h-4 w-4" /> Open Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`/apps/${app.id}/visual-editor`)}>
                          <Wand2 className="mr-2 h-4 w-4" /> Open Builder
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`/apps/${app.id}/preview`)}>
                          <Eye className="mr-2 h-4 w-4" /> Preview App
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`/apps/${app.id}/publish`)}>
                          <Package className="mr-2 h-4 w-4" /> Continue to Publish
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/[0.06]" />
                        <DropdownMenuLabel>Advanced &amp; Tools</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setLocation(`/apps/${app.id}/store-admin`)}>
                          <Package className="mr-2 h-4 w-4" /> Store Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`/runtime/${app.id}`)}>
                          <Smartphone className="mr-2 h-4 w-4" /> Runtime Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`/apps/${app.id}/integrations`)}>
                          <Activity className="mr-2 h-4 w-4" /> Integrations
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`/apps/${app.id}/push`)}>
                          Push Notifications
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`/apps/${app.id}/analytics`)}>
                          📊 Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-400"
                          onClick={() => handleDelete(app.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>

                  <CardContent className="pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={app.status} />
                      {app.plan === "preview" && (
                        <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] rounded-full">
                          Free Preview
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        • {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Upgrade prompt for preview apps */}
                    {app.plan === "preview" && (
                      <div className="mt-3 p-3 rounded-xl border border-cyan-500/10 bg-gradient-to-r from-cyan-500/5 to-purple-500/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-white">Preview Only</p>
                            <p className="text-[10px] text-muted-foreground">Upgrade to download & publish</p>
                          </div>
                          <Button 
                            size="sm" 
                            className="h-7 text-xs bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg"
                            onClick={() => setLocation(`/pricing?upgrade=${app.id}`)}
                          >
                            <Crown className="h-3 w-3 mr-1" /> Upgrade
                          </Button>
                        </div>
                      </div>
                    )}

                    {app.status === "processing" && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin text-purple-300" />
                        Build in progress...
                      </div>
                    )}

                    {app.status === "failed" && (app.buildError || app.lastBuildAt) && (
                      <div className="mt-3 rounded-xl border border-red-500/15 bg-red-500/5 p-3">
                        <div className="text-xs font-medium text-red-400">Build failed</div>
                        {app.buildError && (
                          <div className="mt-1 text-xs text-muted-foreground break-words line-clamp-2">
                            {app.buildError}
                          </div>
                        )}
                        
                        {/* AI Error Analysis */}
                        <div className="mt-3 pt-3 border-t border-red-500/10">
                          <BuildErrorAnalyzer appId={app.id} />
                        </div>

                        <div className="flex gap-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg"
                            onClick={() => handleRetryBuild(app.id)}
                            disabled={retryingBuild === app.id}
                          >
                            {retryingBuild === app.id ? (
                              <>
                                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                                Retrying...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-1 h-3 w-3" />
                                Retry Build
                              </>
                            )}
                          </Button>
                          {!isStaff && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                              onClick={() => handleContactSupport(app)}
                            >
                              Contact support
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="bg-white/[0.02] border-t border-white/[0.04] p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Smartphone className="h-3.5 w-3.5" />
                      {app.platform === "both" ? "Android & iOS" : app.platform === "ios" ? "iOS" : "Android"}
                    </div>

                    {app.status === "live" && (
                      <div className="flex gap-2">
                        {(app.platform === "android" || app.platform === "both") && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/15 rounded-lg"
                            onClick={() => handleDownload(app.id, "android")}
                          >
                            <Download className="mr-1 h-3 w-3" /> APK
                          </Button>
                        )}
                        {(app.platform === "ios" || app.platform === "both") && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/15 rounded-lg"
                            onClick={() => handleDownload(app.id, "ios")}
                          >
                            <Download className="mr-1 h-3 w-3" /> iOS
                          </Button>
                        )}
                      </div>
                    )}

                    {app.status === "processing" && (
                      <Badge className="rounded-full px-2 py-0.5 text-xs font-medium border-0 bg-amber-900/30 text-amber-300">
                        Processing
                      </Badge>
                    )}
                  </CardFooter>
                </Card>
              ))}

              {!appsLoading && (apps || []).length === 0 && (
                <Card className="md:col-span-2 lg:col-span-3 glass border-dashed border-white/10">
                  <CardContent className="p-0">
                    <EmptyState
                      icon={Sparkles}
                      title="No apps yet"
                      description="Transform your website into a native mobile app in minutes. No coding required."
                    >
                      <Link href="/prompt-create">
                        <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold">
                          <Plus className="h-4 w-4" /> Create Your First App
                        </Button>
                      </Link>
                    </EmptyState>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
          )}

          {/* Support Dashboard - Show prominent ticket view for support users */}
          {isSupport && (
            <motion.div variants={itemVariants}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Tickets to Review</h2>
                <Link href="/tickets">
                  <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold">
                    View All Tickets <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {(tickets || []).filter(t => t.status === "open").length > 0 ? (
                <Card className="glass">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {(tickets || []).filter(t => t.status === "open").slice(0, 5).map((ticket) => (
                        <div
                          key={ticket.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-colors cursor-pointer"
                          onClick={() => setLocation("/tickets")}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                              <LifeBuoy className="h-5 w-5 text-yellow-400" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-white">{ticket.subject}</span>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            Open
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass border-dashed border-white/10">
                  <CardContent className="p-12 text-center">
                    <div className="mx-auto h-16 w-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                      <CheckCircle className="h-8 w-8 text-green-400" />
                    </div>
                    <h3 className="font-semibold text-white text-lg">All caught up!</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                      No open tickets to review. Great job keeping things running smoothly.
                    </p>
                  </CardContent>
                </Card>
              )}
              
              {/* Support Info Card */}
              <Card className="glass mt-6 border-cyan-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Support Role Access</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        As a support team member, you can view and respond to all user tickets, access build logs for debugging, and view user apps (read-only). 
                        You cannot create apps, manage billing, or access team settings.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Recent Tickets - For regular users only */}
          {!isSupport && (tickets || []).length > 0 && (
            <motion.div variants={itemVariants}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Recent Tickets</h2>
                <Link href="/tickets">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-white">
                    View all <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <Card className="glass">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {(tickets || []).slice(0, 3).map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
                        onClick={() => setLocation("/tickets")}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${ticket.status === "open" ? "bg-yellow-400" : "bg-green-400"}`} />
                          <span className="text-sm text-white">{ticket.subject}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </main>

      <Footer />

      <BuildLogsDialog
        open={logsOpen}
        onOpenChange={setLogsOpen}
        title={logsTitle}
        description={isStaff ? "Visible to Admin/Support only" : undefined}
        logs={logsText}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const base = "rounded-full px-2 py-0.5 text-xs font-medium border-0";
  if (status === "live") {
    return (
      <Badge className={`${base} bg-green-900/30 text-green-300`}>Live</Badge>
    );
  }
  if (status === "processing") {
    return (
      <Badge className={`${base} bg-amber-900/30 text-amber-300`}>Processing</Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className={`${base} bg-red-900/30 text-red-300`}>Failed</Badge>
    );
  }
  return (
    <Badge className={`${base} bg-slate-800/60 text-slate-300`}>Draft</Badge>
  );
}
