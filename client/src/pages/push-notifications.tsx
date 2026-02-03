import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bell, Send, Loader2, Users, CheckCircle, XCircle, Clock, Image, Link as LinkIcon, Sparkles, Calendar, Target, BarChart3, Smartphone, Globe } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { NotificationGenerator } from "@/components/ai-features";
import { motion } from "framer-motion";
import { usePlanGate } from "@/lib/plan-gate";

type PushNotification = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  actionUrl: string | null;
  status: "pending" | "sent" | "failed";
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sentAt: string | null;
};

type TokensResponse = {
  count: number;
  tokens: Array<{
    id: string;
    token: string;
    platform: string;
    createdAt: string;
  }>;
};

export default function PushNotifications() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { requirePlan } = usePlanGate();

  const [formData, setFormData] = useState({
    title: "",
    body: "",
    imageUrl: "",
    actionUrl: "",
    // New scheduling options
    scheduleEnabled: false,
    scheduledTime: "",
    // Targeting options
    targetPlatform: "all" as "all" | "android" | "ios",
  });

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: app, isLoading: appLoading } = useQuery({
    queryKey: ["/api/apps", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/apps/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("App not found");
      return res.json();
    },
    enabled: !!me && !!params.id,
  });

  const { data: tokens, isLoading: tokensLoading } = useQuery<TokensResponse>({
    queryKey: ["/api/apps", params.id, "push/tokens"],
    queryFn: async () => {
      const res = await fetch(`/api/apps/${params.id}/push/tokens`, { credentials: "include" });
      if (res.status === 403 || res.status === 402) {
        return { count: 0, tokens: [] };
      }
      if (!res.ok) throw new Error("Failed to fetch tokens");
      return res.json();
    },
    enabled: !!app,
  });

  const { data: history, isLoading: historyLoading } = useQuery<PushNotification[]>({
    queryKey: ["/api/apps", params.id, "push/history"],
    queryFn: async () => {
      const res = await fetch(`/api/apps/${params.id}/push/history`, { credentials: "include" });
      if (res.status === 403 || res.status === 402) {
        return [];
      }
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!app,
  });

  const sendNotification = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", `/api/apps/${params.id}/push/send`, {
        title: data.title,
        body: data.body,
        imageUrl: data.imageUrl || null,
        actionUrl: data.actionUrl || null,
      });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/apps", params.id, "push/history"] });
      toast({
        title: "Notification sent!",
        description: `Sent to ${result.sentCount} device(s)`,
      });
      setFormData({ 
        title: "", 
        body: "", 
        imageUrl: "", 
        actionUrl: "",
        scheduleEnabled: false,
        scheduledTime: "",
        targetPlatform: "all",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to send",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.body.trim()) {
      toast({ title: "Title and body are required", variant: "destructive" });
      return;
    }

    if (!requirePlan("push_notifications", { requiredPlan: "standard", reason: "Push notifications require Standard or higher." })) {
      return;
    }

    sendNotification.mutate(formData);
  };

  if (meLoading || appLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading...
          </div>
        </main>
      </div>
    );
  }

  if (!me) {
    setLocation(`/login?returnTo=${encodeURIComponent(`/apps/${params.id}/push`)}`);
    return null;
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 md:px-6 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">App not found</h2>
            <Button onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle">
      <Navbar />
      <main className="container mx-auto px-4 md:px-6 py-8 max-w-5xl space-y-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")} className="text-muted-foreground hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${app.primaryColor || '#00E5FF'}20` }}
              >
                {app.iconUrl ? (
                  <img src={app.iconUrl} alt={app.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  app.icon || "📱"
                )}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Push Notifications</h1>
                <p className="mt-1 text-sm text-muted-foreground">Send notifications to {app.name} users</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <Smartphone className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-300/80">Devices</p>
                  <p className="text-xl font-bold text-white">{tokensLoading ? "..." : tokens?.count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Send className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-300/80">Sent</p>
                  <p className="text-xl font-bold text-white">
                    {historyLoading ? "..." : history?.filter((n) => n.status === "sent").length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-300/80">Delivered</p>
                  <p className="text-xl font-bold text-white">
                    {historyLoading ? "..." : history?.reduce((acc, n) => acc + (n.sentCount || 0), 0) || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Bell className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-300/80">Total</p>
                  <p className="text-xl font-bold text-white">{historyLoading ? "..." : history?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="compose" className="space-y-6">
          <TabsList className="glass border-white/10 bg-white/5">
            <TabsTrigger value="compose" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Send className="h-4 w-4 mr-2" /> Compose
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Clock className="h-4 w-4 mr-2" /> History
            </TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Send className="h-5 w-5 text-cyan-400" />
                    Compose Notification
                  </CardTitle>
                  <CardDescription>Create and send push notifications to your app users</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* AI Generator */}
                  <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-white">AI Content Generator</span>
                    </div>
                    <NotificationGenerator
                      appName={app?.name || ""}
                      appDescription=""
                      onSelect={(title, body) => {
                        setFormData(prev => ({ ...prev, title, body }));
                      }}
                    />
                  </div>

                  <Separator className="my-6 bg-white/10" />

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Title & Body */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="title" className="text-slate-300/80">Title *</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="New update available!"
                          maxLength={200}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                        />
                        <p className="text-xs text-muted-foreground">{formData.title.length}/200</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="body" className="text-slate-300/80">Message *</Label>
                        <Textarea
                          id="body"
                          value={formData.body}
                          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                          placeholder="Check out our latest features..."
                          rows={3}
                          maxLength={2000}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
                        />
                        <p className="text-xs text-muted-foreground">{formData.body.length}/2000</p>
                      </div>
                    </div>

                    {/* Advanced Options */}
                    <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2">
                        <Target className="h-4 w-4 text-cyan-400" /> Advanced Options
                      </h4>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-300/80 flex items-center gap-2">
                            <Image className="h-4 w-4" /> Image URL
                          </Label>
                          <Input
                            type="url"
                            value={formData.imageUrl}
                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                            placeholder="https://example.com/image.png"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300/80 flex items-center gap-2">
                            <LinkIcon className="h-4 w-4" /> Action URL
                          </Label>
                          <Input
                            type="url"
                            value={formData.actionUrl}
                            onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                            placeholder="https://yoursite.com/promo"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                          />
                        </div>
                      </div>

                      {/* Platform Targeting */}
                      <div className="space-y-2">
                        <Label className="text-slate-300/80 flex items-center gap-2">
                          <Globe className="h-4 w-4" /> Target Platform
                        </Label>
                        <Select 
                          value={formData.targetPlatform} 
                          onValueChange={(v: any) => setFormData({ ...formData, targetPlatform: v })}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-white/10">
                            <SelectItem value="all">All Platforms</SelectItem>
                            <SelectItem value="android">Android Only</SelectItem>
                            <SelectItem value="ios">iOS Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Scheduling */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-cyan-400" />
                          <div>
                            <p className="text-sm font-medium text-white">Schedule for later</p>
                            <p className="text-xs text-muted-foreground">Send at a specific time</p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.scheduleEnabled}
                          onCheckedChange={(checked) => setFormData({ ...formData, scheduleEnabled: checked })}
                        />
                      </div>

                      {formData.scheduleEnabled && (
                        <div className="space-y-2">
                          <Label className="text-slate-300/80">Scheduled Time</Label>
                          <Input
                            type="datetime-local"
                            value={formData.scheduledTime}
                            onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                            min={new Date().toISOString().slice(0, 16)}
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    <div className="p-4 rounded-xl bg-slate-800 border border-white/10">
                      <p className="text-xs font-medium text-slate-300/80 mb-2">Preview</p>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/50">
                        <div 
                          className="h-10 w-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                          style={{ backgroundColor: `${app.primaryColor || '#00E5FF'}30` }}
                        >
                          {app.icon || "📱"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm truncate">
                            {formData.title || "Notification title"}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {formData.body || "Notification message will appear here"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Send Button */}
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400"
                      disabled={sendNotification.isPending || (tokens?.count || 0) === 0}
                    >
                      {sendNotification.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                        </>
                      ) : formData.scheduleEnabled ? (
                        <>
                          <Calendar className="mr-2 h-4 w-4" /> Schedule Notification
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" /> Send to {tokens?.count || 0} Device(s)
                        </>
                      )}
                    </Button>

                    {(tokens?.count || 0) === 0 && (
                      <p className="text-sm text-amber-400 text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        ⚠️ No devices registered yet. Users need to install the app first.
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-cyan-400" />
                    Notification History
                  </CardTitle>
                  <CardDescription>View all sent and scheduled notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                    </div>
                  ) : history && history.length > 0 ? (
                    <div className="space-y-3">
                      {history.map((notification, index) => (
                        <motion.div 
                          key={notification.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-white truncate">{notification.title}</p>
                                <StatusBadge status={notification.status} />
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{notification.body}</p>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                </span>
                                {notification.status === "sent" && (
                                  <span className="flex items-center gap-1 text-green-400">
                                    <CheckCircle className="h-3 w-3" />
                                    {notification.sentCount} delivered
                                  </span>
                                )}
                                {notification.failedCount > 0 && (
                                  <span className="flex items-center gap-1 text-red-400">
                                    <XCircle className="h-3 w-3" />
                                    {notification.failedCount} failed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-2">No notifications sent yet</p>
                      <p className="text-xs text-muted-foreground">Send your first notification from the Compose tab</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: PushNotification["status"] }) {
  switch (status) {
    case "sent":
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30">
          <CheckCircle className="h-3 w-3 mr-1" /> Sent
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">
          <XCircle className="h-3 w-3 mr-1" /> Failed
        </Badge>
      );
  }
}
