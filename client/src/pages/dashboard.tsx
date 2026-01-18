import { Navbar } from "@/components/layout/navbar";
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

  const { data: apps, isLoading: appsLoading } = useQuery<AppItem[]>({
    queryKey: ["/api/apps"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me,
    // Poll while any build is running so status flips automatically.
    refetchInterval: (query) => {
      const data = query.state.data as AppItem[] | undefined;
      return data?.some((a) => a.status === "processing") ? 2000 : false;
    },
  });

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

  const handleDownload = (id: string) => {
    // Use browser navigation so the APK streams/downloads with session cookies.
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
      // Fallback: still allow users to contact via the public form.
      const qs = new URLSearchParams({ subject, message }).toString();
      setLocation(`/contact?${qs}`);
    }
  };

  if (isLoading) {
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
            <h1 className="text-3xl font-bold text-slate-900">My Apps</h1>
            <p className="text-muted-foreground">Manage your mobile applications</p>
          </div>
          <Link href="/create">
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Create New App
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appsLoading && (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading your apps...
              </CardContent>
            </Card>
          )}

          {(apps || []).map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                    {app.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{app.name}</CardTitle>
                    <CardDescription className="text-xs truncate max-w-[150px]">
                      {app.url}
                    </CardDescription>
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

                    {isStaff && (
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
                    )}

                    {app.status === "draft" && (
                      <DropdownMenuItem onClick={() => handleBuild(app.id)}>
                        <RefreshCw /> Build APK
                      </DropdownMenuItem>
                    )}

                    {app.status === "failed" && (
                      <DropdownMenuItem onClick={() => handleBuild(app.id)}>
                        <RefreshCw /> Rebuild APK
                      </DropdownMenuItem>
                    )}

                    {app.status === "processing" && (
                      <DropdownMenuItem disabled>
                        <Clock /> Building...
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Edit App</DropdownMenuItem>
                    <DropdownMenuItem>Push Notifications</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(app.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>

              <CardContent>
                <div className="mt-4 flex items-center gap-2">
                  <StatusBadge status={app.status} />
                  <span className="text-xs text-muted-foreground">
                    •{" "}
                    {formatDistanceToNow(new Date(app.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                {app.status === "processing" && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Build in progress. This list auto-refreshes.
                  </div>
                )}

                {app.status === "failed" && (app.buildError || app.lastBuildAt) && (
                  <div className="mt-3 rounded-md border bg-white p-3">
                    <div className="text-xs font-medium text-slate-900">Build failed</div>
                    {app.buildError && (
                      <div className="mt-1 text-xs text-slate-600 break-words">
                        {app.buildError}
                      </div>
                    )}
                    {app.lastBuildAt && (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Last attempt{" "}
                        {formatDistanceToNow(new Date(app.lastBuildAt), { addSuffix: true })}
                      </div>
                    )}

                    {!isStaff && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleContactSupport(app)}
                        >
                          Contact support
                        </Button>
                      </div>
                    )}

                    {isStaff && (
                      <div className="mt-3 flex gap-2">
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
                          disabled={!app.buildError}
                        >
                          Copy build error
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {app.status === "live" && app.lastBuildAt && (
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    Built {formatDistanceToNow(new Date(app.lastBuildAt), { addSuffix: true })}
                  </div>
                )}
              </CardContent>

              <CardFooter className="bg-slate-50/50 border-t p-4 flex justify-between items-center">
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Smartphone className="h-3 w-3" />
                  {app.platform === "both"
                    ? "Android & iOS"
                    : app.platform === "ios"
                      ? "iOS Only"
                      : "Android Only"}
                </div>

                {app.status === "live" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => handleDownload(app.id)}
                  >
                    <Download className="mr-2 h-3 w-3" /> Download
                  </Button>
                )}

                {app.status === "processing" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground"
                    disabled
                  >
                    <Clock className="mr-2 h-3 w-3" /> Building...
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}

          {!appsLoading && (apps || []).length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3 border-dashed">
              <CardContent className="p-8 text-center">
                <h3 className="font-semibold text-slate-900">No apps yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first mobile app from a website.
                </p>
                <div className="mt-4">
                  <Link href="/create">
                    <Button className="shadow-lg shadow-primary/20">
                      <Plus className="mr-2 h-4 w-4" /> Create New App
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

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
      <Badge className="bg-green-500 hover:bg-green-600 gap-1">
        <CheckCircle className="h-3 w-3" /> Live
      </Badge>
    );
  }
  if (status === "processing") {
    return (
      <Badge variant="secondary" className="gap-1 animate-pulse">
        <Clock className="h-3 w-3" /> Processing
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      Draft
    </Badge>
  );
}