/**
 * App Analytics Page
 * 
 * Basic analytics dashboard for app performance metrics.
 * Shows install counts, active users, and engagement data.
 */

import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { 
  ArrowLeft, 
  Users, 
  Smartphone, 
  TrendingUp, 
  Download, 
  Bell, 
  BarChart3,
  DollarSign,
  ShoppingCart,
  Clock,
  Globe,
  Activity,
  ChevronUp,
  ChevronDown,
  Loader2,
  Crown
} from "lucide-react";
import { motion } from "framer-motion";

import { usePlanGate } from "@/lib/plan-gate";
type AppItem = {
  id: string;
  name: string;
  url: string;
  icon: string;
  iconUrl?: string | null;
  primaryColor: string;
  status: string;
};

type AnalyticsData = {
  totalInstalls: number;
  activeDevices: number;
  pushDelivered: number;
  avgSessionDuration: number;
  platformBreakdown: {
    android: number;
    ios: number;
  };
  recentActivity: Array<{
    date: string;
    installs: number;
    sessions: number;
  }>;
};

type RuntimeAnalyticsSummary = {
  range: string;
  since: string;
  customersTotal: number;
  ordersCount: number;
  revenueCents: number;
  topEvents: Array<{ name: string; count: number }>;
  eventsByDay: Array<{ day: string; count: number }>;
};

export default function AppAnalytics() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [timeRange, setTimeRange] = useState("7d");
  const { isAllowed, requirePlan } = usePlanGate();
  const analyticsAllowed = isAllowed("advanced_analytics");

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: app, isLoading: appLoading } = useQuery<AppItem>({
    queryKey: ["/api/apps", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/apps/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("App not found");
      return res.json();
    },
    enabled: !!me && !!params.id,
  });

  // Analytics data - using tokens count as a proxy for now
  const { data: tokens } = useQuery({
    queryKey: ["/api/apps", params.id, "push/tokens"],
    queryFn: async () => {
      const res = await fetch(`/api/apps/${params.id}/push/tokens`, { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!app,
  });

  const { data: notificationHistory } = useQuery({
    queryKey: ["/api/apps", params.id, "push/history"],
    queryFn: async () => {
      const res = await fetch(`/api/apps/${params.id}/push/history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!app,
  });

  const { data: runtimeAnalytics } = useQuery<RuntimeAnalyticsSummary | null>({
    queryKey: ["runtime-analytics", params.id, timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/apps/${params.id}/admin/runtime-analytics?range=${encodeURIComponent(timeRange)}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!app && analyticsAllowed,
  });

  if (meLoading || appLoading) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading analytics...
          </div>
        </main>
      </div>
    );
  }

  if (!me) {
    setLocation(`/login?returnTo=${encodeURIComponent(`/apps/${params.id}/analytics`)}`);
    return null;
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 md:px-6 py-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">App not found</h2>
          <Button onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </main>
      </div>
    );
  }

  // Calculate analytics from available data
  const totalDevices = tokens?.count || 0;
  const totalNotifications = notificationHistory?.length || 0;
  const deliveredCount = notificationHistory?.reduce((acc: number, n: any) => acc + (n.sentCount || 0), 0) || 0;
  const runtimeOrders = runtimeAnalytics?.ordersCount ?? 0;
  const runtimeRevenue = runtimeAnalytics ? (runtimeAnalytics.revenueCents / 100).toFixed(2) : "0.00";
  const runtimeCustomers = runtimeAnalytics?.customersTotal ?? 0;

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle">
      <Navbar />
      <main className="container mx-auto px-4 md:px-6 py-8 max-w-6xl space-y-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
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
                style={{ backgroundColor: `${app.primaryColor || '#00E5FF'}20` }}
              >
                {app.iconUrl ? (
                  <img src={app.iconUrl} alt={app.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  app.icon || "📱"
                )}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Analytics</h1>
                <p className="mt-1 text-sm text-muted-foreground">{app.name}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10">
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {!analyticsAllowed && (
          <Card className="glass border-white/10 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-400" />
                Advanced analytics is a premium feature
              </CardTitle>
              <CardDescription>
                Unlock revenue, orders, customers, and event trends. Preview UI stays fully enabled; only analytics data is gated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="bg-cyan-600 hover:bg-cyan-700"
                onClick={() =>
                  requirePlan("advanced_analytics", { requiredPlan: "pro", reason: "Advanced analytics requires Pro or Agency." })
                }
              >
                Unlock Premium Features
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <StatCard 
            title="Total Devices"
            value={totalDevices}
            icon={<Smartphone className="h-5 w-5" />}
            color="cyan"
            change={totalDevices > 0 ? "+100%" : "0%"}
            trend="up"
          />
          <StatCard 
            title="Active Users"
            value={totalDevices}
            icon={<Users className="h-5 w-5" />}
            color="green"
            change={totalDevices > 0 ? "New" : "0"}
            trend="up"
          />
          <StatCard 
            title="Notifications Sent"
            value={totalNotifications}
            icon={<Bell className="h-5 w-5" />}
            color="purple"
            change={`${deliveredCount} delivered`}
            trend="neutral"
          />
          <StatCard 
            title="App Opens"
            value={"-"}
            icon={<Activity className="h-5 w-5" />}
            color="amber"
            change="Coming soon"
            trend="neutral"
          />
        </motion.div>

        {runtimeAnalytics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
          >
            <StatCard
              title="Runtime Customers"
              value={runtimeCustomers}
              icon={<Users className="h-5 w-5" />}
              color="cyan"
              change={runtimeAnalytics.range}
              trend="neutral"
            />
            <StatCard
              title="Runtime Orders"
              value={runtimeOrders}
              icon={<ShoppingCart className="h-5 w-5" />}
              color="green"
              change={runtimeAnalytics.range}
              trend="neutral"
            />
            <StatCard
              title="Runtime Revenue"
              value={runtimeRevenue}
              icon={<DollarSign className="h-5 w-5" />}
              color="purple"
              change={runtimeAnalytics.range}
              trend="neutral"
            />
          </motion.div>
        )}

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="glass border-white/10 h-full">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-cyan-400" />
                  Activity Overview
                </CardTitle>
                <CardDescription>App engagement over time</CardDescription>
              </CardHeader>
              <CardContent>
                {totalDevices > 0 ? (
                  <div className="space-y-4">
                    {/* Simple bar chart placeholder */}
                    <div className="flex items-end gap-2 h-40">
                      {[0.3, 0.5, 0.7, 0.4, 0.8, 0.6, 1.0].map((height, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div 
                            className="w-full rounded-t-md bg-gradient-to-t from-cyan-500/50 to-cyan-500/20 transition-all duration-500"
                            style={{ height: `${height * 100}%` }}
                          />
                          <span className="text-xs font-medium text-slate-300/80">
                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-6 text-xs font-medium text-slate-300/80">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-cyan-500/50" />
                        <span>App Sessions</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">No data yet</p>
                    <p className="text-xs text-muted-foreground">Analytics will appear once users start using your app</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Side Panel */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            {/* Platform Breakdown */}
            <Card className="glass border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4 text-purple-400" />
                  Platform Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-sm text-white">Android</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{totalDevices} ({totalDevices > 0 ? "100%" : "0%"})</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
                      style={{ width: totalDevices > 0 ? "100%" : "0%" }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-sm text-white">iOS</span>
                    </div>
                    <span className="text-sm text-muted-foreground">0 (0%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                      style={{ width: "0%" }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="glass border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white"
                  onClick={() => setLocation(`/apps/${params.id}/push`)}
                >
                  <Bell className="mr-2 h-4 w-4" /> Send Push Notification
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white"
                  onClick={() => setLocation(`/apps/${params.id}/preview`)}
                >
                  <Smartphone className="mr-2 h-4 w-4" /> Preview App
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white"
                  onClick={() => setLocation(`/apps/${params.id}/editor`)}
                >
                  <TrendingUp className="mr-2 h-4 w-4" /> Open Settings
                </Button>
              </CardContent>
            </Card>

            {runtimeAnalytics?.topEvents?.length ? (
              <Card className="glass border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-cyan-400" />
                    Runtime Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {runtimeAnalytics.topEvents.slice(0, 6).map((e) => (
                      <div key={e.name} className="flex items-center justify-between text-sm">
                        <span className="text-white truncate max-w-[220px]">{e.name}</span>
                        <span className="text-muted-foreground">{e.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Recent Activity */}
            <Card className="glass border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {totalDevices > 0 || totalNotifications > 0 ? (
                  <div className="space-y-3">
                    {totalNotifications > 0 && (
                      <div className="flex items-start gap-3 text-sm">
                        <div className="p-1.5 rounded-lg bg-purple-500/20">
                          <Bell className="h-3 w-3 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-white">{totalNotifications} notification(s) sent</p>
                          <p className="text-xs font-medium text-slate-300/80">{deliveredCount} delivered</p>
                        </div>
                      </div>
                    )}
                    {totalDevices > 0 && (
                      <div className="flex items-start gap-3 text-sm">
                        <div className="p-1.5 rounded-lg bg-cyan-500/20">
                          <Smartphone className="h-3 w-3 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-white">{totalDevices} device(s) registered</p>
                          <p className="text-xs font-medium text-slate-300/80">For push notifications</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent activity
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon, 
  color, 
  change, 
  trend 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ReactNode; 
  color: "cyan" | "green" | "purple" | "amber";
  change: string;
  trend: "up" | "down" | "neutral";
}) {
  const colors = {
    cyan: "bg-cyan-500/20 text-cyan-400",
    green: "bg-green-500/20 text-green-400",
    purple: "bg-purple-500/20 text-purple-400",
    amber: "bg-amber-500/20 text-amber-400",
  };

  return (
    <Card className="glass border-white/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${colors[color]}`}>
            {icon}
          </div>
          {trend !== "neutral" && (
            <div className={`flex items-center gap-0.5 text-xs ${trend === "up" ? "text-green-400" : "text-red-400"}`}>
              {trend === "up" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs font-medium text-slate-300/80">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}
