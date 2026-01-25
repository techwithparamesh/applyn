import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { 
  Loader2, 
  Users, 
  Smartphone, 
  CreditCard, 
  IndianRupee, 
  TrendingUp, 
  Calendar,
  CheckCircle2,
  XCircle,
  BarChart3
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Analytics = {
  totalUsers: number;
  totalApps: number;
  totalPayments: number;
  totalRevenue: number;
  usersToday: number;
  usersThisWeek: number;
  usersThisMonth: number;
  appsToday: number;
  appsThisWeek: number;
  appsThisMonth: number;
  paymentsToday: number;
  paymentsThisWeek: number;
  paymentsThisMonth: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  usersByDay: Array<{ date: string; count: number }>;
  revenueByDay: Array<{ date: string; amount: number }>;
  appsByPlan: Array<{ plan: string; count: number }>;
  buildSuccessRate: number;
};

const COLORS = ['#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#6366f1'];

export default function AdminAnalytics() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ["/api/admin/analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!me && (me as any).role === "admin",
    refetchInterval: 60000, // Refresh every minute
  });

  useEffect(() => {
    if (!meLoading && (!me || (me as any).role !== "admin")) {
      setLocation("/dashboard");
    }
  }, [meLoading, me, setLocation]);

  if (meLoading || analyticsLoading) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        </main>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Failed to load analytics</p>
        </main>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100).toLocaleString("en-IN")}`;
  };

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-cyan-400" />
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Business metrics and insights</p>
        </div>

        {/* Overview Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="glass border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold text-white">{analytics.totalUsers.toLocaleString()}</p>
                  <p className="text-xs text-green-400">+{analytics.usersToday} today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Apps</p>
                  <p className="text-2xl font-bold text-white">{analytics.totalApps.toLocaleString()}</p>
                  <p className="text-xs text-green-400">+{analytics.appsToday} today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Payments</p>
                  <p className="text-2xl font-bold text-white">{analytics.totalPayments.toLocaleString()}</p>
                  <p className="text-xs text-green-400">+{analytics.paymentsToday} today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <IndianRupee className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(analytics.totalRevenue)}</p>
                  <p className="text-xs text-green-400">+{formatCurrency(analytics.revenueToday)} today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Period Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">New Users</span>
                  <span className="font-semibold text-white">{analytics.usersThisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">New Apps</span>
                  <span className="font-semibold text-white">{analytics.appsThisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Payments</span>
                  <span className="font-semibold text-white">{analytics.paymentsThisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Revenue</span>
                  <span className="font-semibold text-green-400">{formatCurrency(analytics.revenueThisWeek)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">New Users</span>
                  <span className="font-semibold text-white">{analytics.usersThisMonth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">New Apps</span>
                  <span className="font-semibold text-white">{analytics.appsThisMonth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Payments</span>
                  <span className="font-semibold text-white">{analytics.paymentsThisMonth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Revenue</span>
                  <span className="font-semibold text-green-400">{formatCurrency(analytics.revenueThisMonth)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Build Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <span className="font-semibold text-white">{analytics.buildSuccessRate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full transition-all"
                      style={{ width: `${analytics.buildSuccessRate}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Success</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-400">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm">Failed</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* User Growth Chart */}
          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle className="text-white">User Growth (Last 30 Days)</CardTitle>
              <CardDescription>Daily new user registrations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.usersByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#666"
                      tick={{ fill: '#999', fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="#666" tick={{ fill: '#999', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1a1a2e', 
                        border: '1px solid #333',
                        borderRadius: '8px'
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      dot={false}
                      name="Users"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Chart */}
          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Revenue (Last 30 Days)</CardTitle>
              <CardDescription>Daily revenue in INR</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#666"
                      tick={{ fill: '#999', fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis 
                      stroke="#666" 
                      tick={{ fill: '#999', fontSize: 12 }}
                      tickFormatter={(value) => `₹${(value / 100).toLocaleString()}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1a1a2e', 
                        border: '1px solid #333',
                        borderRadius: '8px'
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number) => [`₹${(value / 100).toLocaleString()}`, 'Revenue']}
                    />
                    <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Apps by Plan */}
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Apps by Plan</CardTitle>
            <CardDescription>Distribution of apps across different plans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.appsByPlan}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ plan, count, percent }) => `${plan}: ${count} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {analytics.appsByPlan.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1a1a2e', 
                      border: '1px solid #333',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
