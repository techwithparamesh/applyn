import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  BadgeIndianRupee,
  Bell,
  Building2,
  Clock,
  CreditCard,
  TrendingUp,
  Users,
  Wrench,
  Loader2,
} from "lucide-react";

type Me = {
  id: string;
  role: "admin" | "support" | "staff" | "user" | string;
  permissions?: string[] | null;
};

type FounderMetrics = {
  business: {
    totalUsers: number;
    activeSubscriptions: number;
    activeTrials: number;
    trialToPaidConversionRate: number;
    totalRevenuePaise: number;
    revenueLast30DaysPaise: number;
    failedPaymentsLast7Days: number;
  };
  operations: {
    buildsToday: number;
    failedBuildsLast24h: number;
    pendingBuilds: number;
    webhookFailuresLast24h: number;
    disabledWebhooks: number;
  };
  growth: {
    appsCreatedLast7Days: number;
    appsPublishedLast7Days: number;
    pushNotificationsLast7Days: number;
  };
  alerts: string[];
};

function formatCurrencyPaise(paise: number) {
  const value = Number.isFinite(paise) ? paise : 0;
  return `₹${(value / 100).toLocaleString("en-IN")}`;
}

function formatPercent01(rate01: number) {
  const value = Number.isFinite(rate01) ? rate01 : 0;
  return `${(value * 100).toFixed(1)}%`;
}

function canViewMetrics(me: Me | null | undefined) {
  if (!me) return false;
  if (me.role === "admin") return true;
  if (me.role !== "support" && me.role !== "staff") return false;
  const permissions = Array.isArray(me.permissions) ? me.permissions : [];
  return permissions.includes("view_metrics");
}

function StatCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: ReactNode;
}) {
  return (
    <Card className="glass border-white/10">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-300/80 truncate">{label}</p>
            <p className="text-2xl font-bold text-white truncate">{value}</p>
            {helper ? <p className="text-xs text-muted-foreground truncate">{helper}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminFounder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const allowed = useMemo(() => canViewMetrics(me), [me]);

  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useQuery<FounderMetrics>({
    queryKey: ["/api/admin/founder-metrics"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me && allowed,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (meLoading) return;
    if (!me) {
      setLocation(`/login?returnTo=${encodeURIComponent("/admin/founder")}`);
      return;
    }
    if (!allowed) {
      setLocation("/dashboard");
      toast({
        title: "Access denied",
        description: "You do not have permission to view founder metrics.",
        variant: "destructive",
      });
    }
  }, [meLoading, me, allowed, setLocation, toast]);

  if (meLoading || (allowed && metricsLoading)) {
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

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 md:px-6 py-8">
          <p className="text-muted-foreground">Forbidden</p>
        </main>
      </div>
    );
  }

  if (!metrics || metricsError) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 md:px-6 py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white flex items-center gap-3">
              <Building2 className="h-8 w-8 text-cyan-400" />
              Founder Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Key business, operations, and growth signals</p>
          </div>

          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Unable to load metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {(metricsError as any)?.message || "Request failed"}
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const hasAlerts = (metrics.alerts || []).length > 0;

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-8 space-y-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white flex items-center gap-3">
            <Building2 className="h-8 w-8 text-cyan-400" />
            Founder Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Key business, operations, and growth signals</p>
        </div>

        {/* Business */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BadgeIndianRupee className="h-5 w-5 text-slate-200" />
            <h2 className="text-lg font-semibold text-white">Business</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <StatCard
              label="Total Users"
              value={metrics.business.totalUsers.toLocaleString()}
              icon={<Users className="h-6 w-6 text-cyan-300" />}
            />
            <StatCard
              label="Active Subscriptions"
              value={metrics.business.activeSubscriptions.toLocaleString()}
              helper="Includes grace"
              icon={<CreditCard className="h-6 w-6 text-emerald-300" />}
            />
            <StatCard
              label="Active Trials"
              value={metrics.business.activeTrials.toLocaleString()}
              icon={<Clock className="h-6 w-6 text-amber-300" />}
            />
            <StatCard
              label="Trial → Paid"
              value={formatPercent01(metrics.business.trialToPaidConversionRate)}
              icon={<TrendingUp className="h-6 w-6 text-purple-300" />}
            />
            <StatCard
              label="Total Revenue"
              value={formatCurrencyPaise(metrics.business.totalRevenuePaise)}
              icon={<BadgeIndianRupee className="h-6 w-6 text-emerald-300" />}
            />
            <StatCard
              label="Revenue (30d)"
              value={formatCurrencyPaise(metrics.business.revenueLast30DaysPaise)}
              icon={<TrendingUp className="h-6 w-6 text-cyan-300" />}
            />
            <StatCard
              label="Failed Payments (7d)"
              value={metrics.business.failedPaymentsLast7Days.toLocaleString()}
              icon={<AlertTriangle className="h-6 w-6 text-red-300" />}
            />
          </div>
        </section>

        {/* Operations */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-slate-200" />
            <h2 className="text-lg font-semibold text-white">Operations</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <StatCard
              label="Builds Today"
              value={metrics.operations.buildsToday.toLocaleString()}
              icon={<Activity className="h-6 w-6 text-cyan-300" />}
            />
            <StatCard
              label="Failed Builds (24h)"
              value={metrics.operations.failedBuildsLast24h.toLocaleString()}
              icon={<AlertTriangle className="h-6 w-6 text-red-300" />}
            />
            <StatCard
              label="Pending Builds"
              value={metrics.operations.pendingBuilds.toLocaleString()}
              icon={<Clock className="h-6 w-6 text-amber-300" />}
            />
            <StatCard
              label="Webhook Failures (24h)"
              value={metrics.operations.webhookFailuresLast24h.toLocaleString()}
              icon={<Bell className="h-6 w-6 text-purple-300" />}
            />
            <StatCard
              label="Disabled Webhooks"
              value={metrics.operations.disabledWebhooks.toLocaleString()}
              icon={<AlertTriangle className="h-6 w-6 text-amber-300" />}
            />
          </div>
        </section>

        {/* Growth */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-slate-200" />
            <h2 className="text-lg font-semibold text-white">Growth</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <StatCard
              label="Apps Created (7d)"
              value={metrics.growth.appsCreatedLast7Days.toLocaleString()}
              icon={<TrendingUp className="h-6 w-6 text-cyan-300" />}
            />
            <StatCard
              label="Apps Published (7d)"
              value={metrics.growth.appsPublishedLast7Days.toLocaleString()}
              icon={<TrendingUp className="h-6 w-6 text-emerald-300" />}
            />
            <StatCard
              label="Push Notifications (7d)"
              value={metrics.growth.pushNotificationsLast7Days.toLocaleString()}
              icon={<Bell className="h-6 w-6 text-purple-300" />}
            />
          </div>
        </section>

        {/* Alerts */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-slate-200" />
            <h2 className="text-lg font-semibold text-white">Alerts</h2>
          </div>

          <Card className={hasAlerts ? "glass border-red-500/30" : "glass border-emerald-500/30"}>
            <CardHeader>
              <CardTitle className="text-white">
                {hasAlerts ? "Needs attention" : "All systems operational"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasAlerts ? (
                <ul className="space-y-2">
                  {metrics.alerts.map((a, idx) => (
                    <li key={`${a}-${idx}`} className="text-sm text-red-200/90 flex items-start gap-2">
                      <span className="mt-0.5">•</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-200/90">No alerts triggered.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
      <Footer />
    </div>
  );
}
