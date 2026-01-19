import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bell, Send, Loader2, Users, CheckCircle, XCircle, Clock, Image, Link as LinkIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

  const [formData, setFormData] = useState({
    title: "",
    body: "",
    imageUrl: "",
    actionUrl: "",
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
      if (!res.ok) throw new Error("Failed to fetch tokens");
      return res.json();
    },
    enabled: !!app,
  });

  const { data: history, isLoading: historyLoading } = useQuery<PushNotification[]>({
    queryKey: ["/api/apps", params.id, "push/history"],
    queryFn: async () => {
      const res = await fetch(`/api/apps/${params.id}/push/history`, { credentials: "include" });
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
      setFormData({ title: "", body: "", imageUrl: "", actionUrl: "" });
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
    sendNotification.mutate(formData);
  };

  if (meLoading || appLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
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
        <main className="container mx-auto px-4 py-8">
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
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Push Notifications</h1>
            <p className="text-muted-foreground">Send notifications to {app.name} users</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Registered Devices</p>
                  <p className="text-2xl font-bold">{tokensLoading ? "..." : tokens?.count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <Send className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sent Notifications</p>
                  <p className="text-2xl font-bold">
                    {historyLoading ? "..." : history?.filter((n) => n.status === "sent").length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Messages</p>
                  <p className="text-2xl font-bold">{historyLoading ? "..." : history?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Send Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Notification
              </CardTitle>
              <CardDescription>Compose and send a push notification to all registered devices</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="New update available!"
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Message *</Label>
                  <Textarea
                    id="body"
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    placeholder="Check out our latest features..."
                    rows={3}
                    maxLength={2000}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="flex items-center gap-2">
                    <Image className="h-4 w-4" /> Image URL (optional)
                  </Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.png"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actionUrl" className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" /> Action URL (optional)
                  </Label>
                  <Input
                    id="actionUrl"
                    type="url"
                    value={formData.actionUrl}
                    onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                    placeholder="https://yoursite.com/promo"
                  />
                  <p className="text-xs text-muted-foreground">Opens when user taps the notification</p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={sendNotification.isPending || (tokens?.count || 0) === 0}
                >
                  {sendNotification.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Send to {tokens?.count || 0} Device(s)
                    </>
                  )}
                </Button>

                {(tokens?.count || 0) === 0 && (
                  <p className="text-sm text-amber-600 text-center">
                    No devices registered yet. Users need to install the app first.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification History
              </CardTitle>
              <CardDescription>Recent notifications sent to your users</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : history && history.length > 0 ? (
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {history.map((notification) => (
                    <div key={notification.id} className="p-3 rounded-lg border">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{notification.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">{notification.body}</p>
                        </div>
                        <StatusBadge status={notification.status} />
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                        {notification.status === "sent" && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {notification.sentCount} delivered
                          </span>
                        )}
                        {notification.failedCount > 0 && (
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-red-500" />
                            {notification.failedCount} failed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No notifications sent yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: PushNotification["status"] }) {
  switch (status) {
    case "sent":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" /> Sent
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" /> Failed
        </Badge>
      );
  }
}
