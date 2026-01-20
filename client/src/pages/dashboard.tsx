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
  RefreshCw,
  Settings,
  ArrowRight,
  Activity,
  Package,
  AlertCircle,
  Sparkles,
  LifeBuoy,
  CreditCard,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type AppItem = {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  status: "draft" | "processing" | "live" | "failed" | string;
  platform: "android" | "ios" | "both" | string;
  icon: string;
  primaryColor: string;
  packageName?: string | null;
  versionCode?: number | null;
  artifactSize?: number | null;
  buildLogs?: string | null;
  buildError?: string | null;
  lastBuildAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type Me = {
  id: string;
  username: string;
  name: string | null;
  role: "admin" | "support" | "user" | string;
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

  const { data: me, isLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const isStaff = useMemo(() => {
    const role = me?.role;
    return role === "admin" || role === "support";
  }, [me]);

  const [logsOpen, setLogsOpen] = useState(false);
  const [logsTitle, setLogsTitle] = useState<string>("Build logs");
  const [logsText, setLogsText] = useState<string | null>(null);
  
  // Filter state for apps
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "processing" | "failed" | "draft">("all");

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

  useEffect(() => {
    if (!isLoading && !me) {
      setLocation(`/login?returnTo=${encodeURIComponent("/dashboard")}`);
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

  const handleViewBuildStatus = async (app: AppItem) => {
    try {
      const res = await apiRequest("GET", `/api/apps/${app.id}/build-status`);
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
      
      setLogsTitle(`${app.name} • Build Status`);
      setLogsText(logsContent);
      setLogsOpen(true);
    } catch (err: any) {
      toast({
        title: "Failed to fetch build status",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleDownload = (id: string, platform?: string) => {
    if (platform === "ios") {
      window.location.href = `/api/apps/${id}/download-ios`;
    } else {
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

  if (isLoading) {
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

      <main className="flex-1 container mx-auto px-4 py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Welcome back, <span className="text-gradient">{me?.name || me?.username?.split("@")[0] || "User"}</span>
              </h1>
              <p className="text-muted-foreground mt-1">
                Here's what's happening with your apps today
              </p>
            </div>
            <Link href="/create">
              <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold shadow-lg glow-primary">
                <Plus className="h-4 w-4" /> Create New App
              </Button>
            </Link>
          </motion.div>

          {/* Stats Grid */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card 
              className={`glass glass-hover border stat-gradient-1 cursor-pointer transition-all ${statusFilter === "all" ? "ring-2 ring-cyan-500" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Apps</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Package className="h-6 w-6 text-cyan-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`glass glass-hover border stat-gradient-3 cursor-pointer transition-all ${statusFilter === "live" ? "ring-2 ring-green-500" : ""}`}
              onClick={() => setStatusFilter("live")}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Live Apps</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.live}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`glass glass-hover border stat-gradient-2 cursor-pointer transition-all ${statusFilter === "processing" ? "ring-2 ring-purple-500" : ""}`}
              onClick={() => setStatusFilter("processing")}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Processing</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.processing}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Activity className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="glass glass-hover border stat-gradient-4 cursor-pointer transition-all"
              onClick={() => setLocation("/tickets")}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Open Tickets</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.openTickets}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <LifeBuoy className="h-6 w-6 text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/create">
                <Card className="glass glass-hover cursor-pointer group">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                      <Sparkles className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">New App</p>
                      <p className="text-xs text-muted-foreground">Convert website</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/tickets">
                <Card className="glass glass-hover cursor-pointer group">
                  <CardContent className="p-5 flex items-center gap-4">
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
                  <CardContent className="p-5 flex items-center gap-4">
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
                  <CardContent className="p-5 flex items-center gap-4">
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
            </div>
          </motion.div>

          {/* Apps Section */}
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
              {(apps || []).length > 0 && (
                <Link href="/create">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-white">
                    Create new <Plus className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {appsLoading && (
                <Card className="md:col-span-2 lg:col-span-3 glass">
                  <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-3">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading your apps...
                  </CardContent>
                </Card>
              )}

              {!appsLoading && filteredApps.length === 0 && (
                <Card className="md:col-span-2 lg:col-span-3 glass">
                  <CardContent className="p-8 text-center">
                    <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      {statusFilter === "all" 
                        ? "No apps yet. Create your first app!" 
                        : `No ${statusFilter} apps found.`}
                    </p>
                    {statusFilter !== "all" && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2 text-cyan-400"
                        onClick={() => setStatusFilter("all")}
                      >
                        Show all apps
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {filteredApps.map((app) => (
                <Card key={app.id} className="glass glass-hover overflow-hidden group">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${app.primaryColor}20` }}
                      >
                        {app.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base text-white">{app.name}</CardTitle>
                        <CardDescription className="text-xs truncate max-w-[160px] text-muted-foreground">
                          {app.url}
                        </CardDescription>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass border-white/10">
                        {app.status === "live" && (app.platform === "android" || app.platform === "both") && (
                          <DropdownMenuItem onClick={() => handleDownload(app.id, "android")}>
                            <Download className="mr-2 h-4 w-4" /> Download APK
                          </DropdownMenuItem>
                        )}
                        {app.status === "live" && (app.platform === "ios" || app.platform === "both") && (
                          <DropdownMenuItem onClick={() => handleDownload(app.id, "ios")}>
                            <Download className="mr-2 h-4 w-4" /> Download iOS
                          </DropdownMenuItem>
                        )}
                        {isStaff && (app.status === "live" || app.status === "failed") && (
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
                          <DropdownMenuItem onClick={() => handleBuild(app.id)}>
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
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={() => setLocation(`/apps/${app.id}/edit`)}>
                          Edit App
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`/apps/${app.id}/push`)}>
                          Push Notifications
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
                    <div className="flex items-center gap-2">
                      <StatusBadge status={app.status} />
                      <span className="text-xs text-muted-foreground">
                        • {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
                      </span>
                    </div>

                    {app.status === "processing" && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-3 w-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        Build in progress...
                      </div>
                    )}

                    {app.status === "failed" && (app.buildError || app.lastBuildAt) && (
                      <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                        <div className="text-xs font-medium text-red-400">Build failed</div>
                        {app.buildError && (
                          <div className="mt-1 text-xs text-muted-foreground break-words line-clamp-2">
                            {app.buildError}
                          </div>
                        )}
                        {!isStaff && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleContactSupport(app)}
                          >
                            Contact support
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="bg-white/[0.02] border-t border-white/5 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Smartphone className="h-3.5 w-3.5" />
                      {app.platform === "both" ? "Android & iOS" : app.platform === "ios" ? "iOS" : "Android"}
                    </div>

                    {app.status === "live" && (
                      <div className="flex gap-2">
                        {(app.platform === "android" || app.platform === "both") && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20"
                            onClick={() => handleDownload(app.id, "android")}
                          >
                            <Download className="mr-1 h-3 w-3" /> APK
                          </Button>
                        )}
                        {(app.platform === "ios" || app.platform === "both") && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
                            onClick={() => handleDownload(app.id, "ios")}
                          >
                            <Download className="mr-1 h-3 w-3" /> iOS
                          </Button>
                        )}
                      </div>
                    )}

                    {app.status === "processing" && (
                      <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                        <Clock className="mr-1 h-3 w-3" /> Building...
                      </Badge>
                    )}
                  </CardFooter>
                </Card>
              ))}

              {!appsLoading && (apps || []).length === 0 && (
                <Card className="md:col-span-2 lg:col-span-3 glass border-dashed border-white/10">
                  <CardContent className="p-12 text-center">
                    <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-cyan-400" />
                    </div>
                    <h3 className="font-semibold text-white text-lg">No apps yet</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                      Transform your website into a native mobile app in minutes. No coding required.
                    </p>
                    <div className="mt-6">
                      <Link href="/create">
                        <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold">
                          <Plus className="h-4 w-4" /> Create Your First App
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>

          {/* Recent Tickets */}
          {(tickets || []).length > 0 && (
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
  if (status === "live") {
    return (
      <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 gap-1">
        <CheckCircle className="h-3 w-3" /> Live
      </Badge>
    );
  }
  if (status === "processing") {
    return (
      <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 gap-1">
        <Clock className="h-3 w-3 animate-pulse" /> Processing
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 gap-1">
        <AlertCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  }
  return (
    <Badge className="bg-white/5 text-muted-foreground border border-white/10 gap-1">
      Draft
    </Badge>
  );
}
