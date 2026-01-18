import { Navbar } from "@/components/layout/navbar";
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
import { Clock, Download, MoreVertical, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

type Role = "admin" | "support" | "user" | string;

type Me = {
  id: string;
  username: string;
  name: string | null;
  role: Role;
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

  if (meLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">Loading...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Ops</h1>
            <p className="text-muted-foreground">Staff view across all apps</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Support tickets</CardTitle>
            <CardDescription>New requests from end users (staff only)</CardDescription>
          </CardHeader>
          <CardContent>
            {ticketsLoading && (
              <div className="text-sm text-muted-foreground">Loading tickets...</div>
            )}

            {!ticketsLoading && (tickets || []).length === 0 && (
              <div className="text-sm text-muted-foreground">No tickets yet.</div>
            )}

            <div className="space-y-3">
              {(tickets || []).slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-md border bg-white p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t.status}</Badge>
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {t.subject}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                      {t.appId ? ` • App ${t.appId}` : ""}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleViewTicket(t)}>
                      View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleCopyTicket(t)}>
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleTicketStatus(t)}
                    >
                      {t.status === "closed" ? "Reopen" : "Close"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {appsLoading && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Loading apps...</CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(apps || []).map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                    {app.icon}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg truncate">{app.name}</CardTitle>
                    <CardDescription className="text-xs truncate">{app.url}</CardDescription>
                    <div className="mt-1 text-[11px] text-muted-foreground truncate">
                      Owner: {app.ownerId}
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {app.status === "live" && (
                      <DropdownMenuItem onClick={() => handleDownload(app.id)}>
                        <Download /> Download APK
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleBuild(app.id)}>
                      <RefreshCw /> {app.status === "failed" ? "Rebuild" : "Build"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setLogsTitle(`${app.name} • Build logs`);
                        setLogsText(app.buildLogs || "");
                        setLogsOpen(true);
                      }}
                      disabled={!app.buildLogs}
                    >
                      View build logs
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>

              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{app.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    • {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
                  </span>
                </div>

                {app.status === "processing" && (
                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" /> Build running
                  </div>
                )}

                {app.status === "failed" && app.buildError && (
                  <div className="mt-3 space-y-3">
                    <div className="text-xs text-slate-600 break-words">{app.buildError}</div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBuild(app.id)}
                      >
                        Retry build
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyBuildError(app)}
                      >
                        Copy build error
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {!appsLoading && (apps || []).length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <h3 className="font-semibold text-slate-900">No apps</h3>
              <p className="text-sm text-muted-foreground mt-1">Nothing to show yet.</p>
            </CardContent>
          </Card>
        )}
      </main>

      <BuildLogsDialog
        open={logsOpen}
        onOpenChange={setLogsOpen}
        title={logsTitle}
        description="Visible to Admin/Support only"
        logs={logsText}
      />

      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{ticketActive?.subject || "Ticket"}</DialogTitle>
            <DialogDescription>
              {ticketActive ? `Status: ${ticketActive.status} • Ticket: ${ticketActive.id}` : ""}
            </DialogDescription>
          </DialogHeader>

          {ticketActive && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Requester: {ticketActive.requesterId}
                {ticketActive.appId ? ` • App: ${ticketActive.appId}` : ""}
              </div>

              <ScrollArea className="h-[320px] rounded-md border bg-slate-50 p-3">
                <pre className="whitespace-pre-wrap text-sm text-slate-800">
                  {ticketActive.message}
                </pre>
              </ScrollArea>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => handleCopyTicket(ticketActive)}>
                  Copy
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleToggleTicketStatus(ticketActive)}
                >
                  {ticketActive.status === "closed" ? "Reopen" : "Close"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
