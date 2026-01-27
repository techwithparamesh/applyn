import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BuildLogsDialog } from "@/components/build-logs-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getAppUrlDisplay } from "@/lib/utils";
import { 
  Clock, 
  Download, 
  MoreVertical, 
  RefreshCw, 
  Smartphone, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Ticket,
  Eye,
  Copy,
  XCircle,
  RefreshCcw,
  FileText,
  Settings,
  TrendingUp,
  Activity,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

type Role = "admin" | "support" | "user" | string;

type Me = {
  id: string;
  username: string;
  name: string | null;
  role: Role;
  mustChangePassword?: boolean;
};

type AppItem = {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  status: "draft" | "processing" | "live" | "failed" | string;
  platform: "android" | "ios" | "both" | string;
  icon: string;
  primaryColor: string;
  buildLogs?: string | null;
  buildError?: string | null;
  lastBuildAt?: string | Date | null;
  updatedAt: string | Date;
};

type SupportTicket = {
  id: string;
  requesterId: string;
  appId: string | null;
  subject: string;
  message: string;
  status: "open" | "closed" | string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function isStaffRole(role: Role) {
  return role === "admin" || role === "support";
}

export default function Ops() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const isStaff = useMemo(() => isStaffRole(me?.role || "user"), [me]);

  useEffect(() => {
    if (meLoading) return;
    if (!me) {
      setLocation(`/login?returnTo=${encodeURIComponent("/ops")}`);
      return;
    }
    // Redirect to password change if required
    if (me.mustChangePassword) {
      setLocation("/change-password");
      return;
    }
    if (!isStaff) {
      setLocation("/dashboard");
      toast({
        title: "Access denied",
        description: "Staff access required.",
        variant: "destructive",
      });
    }
  }, [meLoading, me, isStaff, setLocation, toast]);

  const { data: apps, isLoading: appsLoading } = useQuery<AppItem[]>({
    queryKey: ["/api/apps"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me && isStaff,
    refetchInterval: (query) => {
      const data = query.state.data as AppItem[] | undefined;
      return data?.some((a) => a.status === "processing") ? 2000 : false;
    },
  });

  const { data: tickets, isLoading: ticketsLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me && isStaff,
  });

  const [logsOpen, setLogsOpen] = useState(false);
  const [logsTitle, setLogsTitle] = useState("Build logs");
  const [logsText, setLogsText] = useState<string | null>(null);

  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketActive, setTicketActive] = useState<SupportTicket | null>(null);

  const handleBuild = async (id: string) => {
    try {
      await apiRequest("POST", `/api/apps/${id}/build`);
      await queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
      toast({ title: "Build started", description: "We are building the APK now." });
    } catch (err: any) {
      toast({
        title: "Build failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleDownload = (id: string) => {
    window.location.href = `/api/apps/${id}/download`;
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

  const handleViewTicket = (t: SupportTicket) => {
    setTicketActive(t);
    setTicketOpen(true);
  };

  const handleCopyTicket = async (t: SupportTicket) => {
    const text = [
      `Ticket: ${t.id}`,
      `Status: ${t.status}`,
      `Requester: ${t.requesterId}`,
      t.appId ? `App: ${t.appId}` : null,
      `Subject: ${t.subject}`,
      "",
      t.message,
    ]
      .filter(Boolean)
      .join("\n");

    const ok = await copyText(text);
    toast({
      title: ok ? "Copied" : "Copy failed",
      description: ok ? "Ticket details copied to clipboard." : "Could not copy to clipboard.",
      variant: ok ? undefined : "destructive",
    });
  };

  const handleToggleTicketStatus = async (t: SupportTicket) => {
    const next = t.status === "closed" ? "open" : "closed";
    try {
      await apiRequest("PATCH", `/api/support/tickets/${t.id}`, { status: next });
      await queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Updated", description: `Ticket marked ${next}.` });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm("Are you sure you want to permanently delete this ticket? This action cannot be undone.")) {
      return;
    }
    try {
      await apiRequest("DELETE", `/api/support/tickets/${ticketId}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Deleted", description: "Ticket has been permanently removed." });
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  // Calculate stats - MUST be before any early returns
  const stats = useMemo(() => {
    const appList = apps || [];
    const ticketList = tickets || [];
    return {
      totalApps: appList.length,
      liveApps: appList.filter(a => a.status === "live").length,
      processingApps: appList.filter(a => a.status === "processing").length,
      failedApps: appList.filter(a => a.status === "failed").length,
      openTickets: ticketList.filter(t => t.status === "open").length,
      closedTickets: ticketList.filter(t => t.status === "closed").length,
    };
  }, [apps, tickets]);

  if (meLoading) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                <Settings className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Operations Center</h1>
                <p className="text-muted-foreground">Staff view across all apps and tickets</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                <Activity className="h-3 w-3 mr-1" />
                Staff Access
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
        >
          <Card className="glass border-white/10">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.totalApps}</div>
                  <div className="text-xs text-muted-foreground">Total Apps</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{stats.liveApps}</div>
                  <div className="text-xs text-muted-foreground">Live</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-400">{stats.processingApps}</div>
                  <div className="text-xs text-muted-foreground">Building</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{stats.failedApps}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Ticket className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-400">{stats.openTickets}</div>
                  <div className="text-xs text-muted-foreground">Open Tickets</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-400">{stats.closedTickets}</div>
                  <div className="text-xs text-muted-foreground">Resolved</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Support Tickets Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <Card className="glass border-white/10 h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-purple-400" />
                    Support Tickets
                  </CardTitle>
                  {stats.openTickets > 0 && (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      {stats.openTickets} open
                    </Badge>
                  )}
                </div>
                <CardDescription>Recent requests from users</CardDescription>
              </CardHeader>
              <CardContent>
                {ticketsLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                  </div>
                )}

                {!ticketsLoading && (tickets || []).length === 0 && (
                  <div className="text-center py-8">
                    <Ticket className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground text-sm">No tickets yet</p>
                  </div>
                )}

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {(tickets || []).slice(0, 15).map((t, index) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`p-3 rounded-lg border bg-white/5 hover:bg-white/[0.07] transition-colors ${
                        t.status === "open" ? "border-purple-500/30" : "border-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge 
                          variant="outline" 
                          className={t.status === "open" 
                            ? "border-purple-500/30 text-purple-400 text-xs" 
                            : "border-gray-500/30 text-gray-400 text-xs"
                          }
                        >
                          {t.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-white truncate mb-1">
                        {t.subject}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mb-2">
                        {t.appId ? `App: ${t.appId.slice(0, 8)}...` : "General inquiry"}
                      </div>

                      <div className="flex gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleViewTicket(t)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-white hover:bg-white/10"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleCopyTicket(t)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-white hover:bg-white/10"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleTicketStatus(t)}
                          className={`h-7 px-2 text-xs hover:bg-white/10 ${
                            t.status === "closed" 
                              ? "text-purple-400 hover:text-purple-300" 
                              : "text-green-400 hover:text-green-300"
                          }`}
                        >
                          {t.status === "closed" ? (
                            <>
                              <RefreshCcw className="h-3 w-3 mr-1" />
                              Reopen
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Close
                            </>
                          )}
                        </Button>
                        {t.status === "closed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTicket(t.id)}
                            className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Apps Grid Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card className="glass border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-cyan-400" />
                    All Apps
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {stats.processingApps > 0 && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        {stats.processingApps} building
                      </Badge>
                    )}
                    {stats.failedApps > 0 && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {stats.failedApps} failed
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>Manage and monitor all user apps</CardDescription>
              </CardHeader>
              <CardContent>
                {appsLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                  </div>
                )}

                {!appsLoading && (apps || []).length === 0 && (
                  <div className="text-center py-12">
                    <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No apps created yet</p>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                  {(apps || []).map((app, index) => {
                    const statusConfig = {
                      live: { color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
                      processing: { color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30" },
                      failed: { color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
                      draft: { color: "text-gray-400", bg: "bg-gray-500/20", border: "border-gray-500/30" },
                    }[app.status] || { color: "text-gray-400", bg: "bg-gray-500/20", border: "border-gray-500/30" };

                    return (
                      <motion.div
                        key={app.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className={`p-4 rounded-xl border bg-white/5 hover:bg-white/[0.07] transition-all ${statusConfig.border}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div 
                              className="h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                              style={{ backgroundColor: `${app.primaryColor}20` }}
                            >
                              {app.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-white truncate">{app.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{getAppUrlDisplay(app.url, (app as any).isNativeOnly)}</div>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-900 border-white/10">
                              {app.status === "live" && (
                                <DropdownMenuItem 
                                  onClick={() => handleDownload(app.id)}
                                  className="text-white focus:bg-white/10 cursor-pointer"
                                >
                                  <Download className="mr-2 h-4 w-4" /> Download APK
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleBuild(app.id)}
                                className="text-white focus:bg-white/10 cursor-pointer"
                              >
                                <RefreshCw className="mr-2 h-4 w-4" /> 
                                {app.status === "failed" ? "Rebuild" : "Build"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setLogsTitle(`${app.name} • Build logs`);
                                  setLogsText(app.buildLogs || "");
                                  setLogsOpen(true);
                                }}
                                disabled={!app.buildLogs}
                                className="text-white focus:bg-white/10 cursor-pointer disabled:opacity-50"
                              >
                                <FileText className="mr-2 h-4 w-4" /> View build logs
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} text-xs`}>
                              {app.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              {app.status}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
                          </span>
                        </div>

                        <div className="mt-2 text-[10px] text-muted-foreground truncate">
                          Owner: {app.ownerId.slice(0, 8)}...
                        </div>

                        {app.status === "failed" && app.buildError && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs text-red-400/80 line-clamp-2">{app.buildError}</div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBuild(app.id)}
                                className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Retry
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyBuildError(app)}
                                className="h-7 text-xs text-muted-foreground hover:text-white hover:bg-white/10"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy error
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
      <Footer />

      <BuildLogsDialog
        open={logsOpen}
        onOpenChange={setLogsOpen}
        title={logsTitle}
        description="Visible to Admin/Support only"
        logs={logsText}
      />

      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent className="max-w-2xl glass border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">{ticketActive?.subject || "Ticket"}</DialogTitle>
            <DialogDescription>
              {ticketActive ? `Status: ${ticketActive.status} • Ticket: ${ticketActive.id.slice(0, 8)}...` : ""}
            </DialogDescription>
          </DialogHeader>

          {ticketActive && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-xs">
                <Badge 
                  variant="outline" 
                  className={ticketActive.status === "open" 
                    ? "border-purple-500/30 text-purple-400" 
                    : "border-gray-500/30 text-gray-400"
                  }
                >
                  {ticketActive.status}
                </Badge>
                <span className="text-muted-foreground">
                  Requester: {ticketActive.requesterId.slice(0, 8)}...
                </span>
                {ticketActive.appId && (
                  <span className="text-muted-foreground">
                    App: {ticketActive.appId.slice(0, 8)}...
                  </span>
                )}
              </div>

              <ScrollArea className="h-[320px] rounded-lg border border-white/10 bg-white/5 p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-300">
                  {ticketActive.message}
                </pre>
              </ScrollArea>

              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => handleCopyTicket(ticketActive)}
                  className="border-white/10 text-white hover:bg-white/10"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  onClick={() => handleToggleTicketStatus(ticketActive)}
                  className={ticketActive.status === "closed" 
                    ? "bg-purple-500 hover:bg-purple-600 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                  }
                >
                  {ticketActive.status === "closed" ? (
                    <>
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Reopen Ticket
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Close Ticket
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
