import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  Loader2, 
  Shield, 
  ChevronLeft, 
  ChevronRight,
  User,
  Smartphone,
  CreditCard,
  Key,
  AlertTriangle,
  Settings,
  Search,
  RefreshCw
} from "lucide-react";

type AuditLog = {
  id: number;
  userId: number | null;
  action: string;
  targetType: string | null;
  targetId: number | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  userEmail?: string;
};

type AuditLogsResponse = {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const actionCategories = {
  'user': ['user.register', 'user.login', 'user.logout', 'user.password.change', 'user.password.reset', 'user.email.verify', 'user.role.change'],
  'app': ['app.create', 'app.update', 'app.delete', 'app.build.start', 'app.build.complete', 'app.build.failed'],
  'payment': ['payment.initiated', 'payment.completed', 'payment.failed', 'payment.refund'],
  'subscription': ['subscription.created', 'subscription.cancelled', 'subscription.renewed', 'subscription.upgraded'],
  'admin': ['admin.user.suspend', 'admin.user.delete', 'admin.settings.change'],
};

const getActionIcon = (action: string) => {
  if (action.startsWith('user.')) return <User className="h-4 w-4" />;
  if (action.startsWith('app.')) return <Smartphone className="h-4 w-4" />;
  if (action.startsWith('payment.') || action.startsWith('subscription.')) return <CreditCard className="h-4 w-4" />;
  if (action.startsWith('admin.')) return <Shield className="h-4 w-4" />;
  if (action.includes('password') || action.includes('login')) return <Key className="h-4 w-4" />;
  return <Settings className="h-4 w-4" />;
};

const getActionColor = (action: string) => {
  if (action.includes('failed') || action.includes('delete') || action.includes('suspend')) {
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  }
  if (action.includes('complete') || action.includes('verify') || action.includes('create')) {
    return 'bg-green-500/10 text-green-400 border-green-500/20';
  }
  if (action.includes('change') || action.includes('update')) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
  return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
};

export default function AdminAuditLogs() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const limit = 20;

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(actionFilter && { action: actionFilter }),
    ...(userIdFilter && { userId: userIdFilter }),
  });

  const { data, isLoading, refetch, isFetching } = useQuery<AuditLogsResponse>({
    queryKey: ["/api/admin/audit-logs", page, actionFilter, userIdFilter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-logs?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
    enabled: !!me && (me as any).role === "admin",
  });

  useEffect(() => {
    if (!meLoading && (!me || (me as any).role !== "admin")) {
      setLocation("/dashboard");
    }
  }, [meLoading, me, setLocation]);

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  const clearFilters = () => {
    setActionFilter("");
    setUserIdFilter("");
    setPage(1);
  };

  if (meLoading) {
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

  const allActions = Object.values(actionCategories).flat();

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="h-8 w-8 text-cyan-400" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">Track all system activities and user actions</p>
        </div>

        {/* Filters */}
        <Card className="glass border-white/10 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-300/80 mb-1 block">User ID</label>
                <Input
                  placeholder="Filter by user ID..."
                  value={userIdFilter}
                  onChange={(e) => setUserIdFilter(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-300/80 mb-1 block">Action</label>
                <Select value={actionFilter || "all"} onValueChange={(val) => setActionFilter(val === "all" ? "" : val)}>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {Object.entries(actionCategories).map(([category, actions]) => (
                      <div key={category}>
                        <div className="px-2 py-1 text-xs font-semibold text-slate-300/80 uppercase">
                          {category}
                        </div>
                        {actions.map((action) => (
                          <SelectItem key={action} value={action}>
                            {action}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleSearch} className="bg-cyan-600 hover:bg-cyan-700">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
                <Button variant="outline" onClick={clearFilters} className="border-white/10">
                  Clear
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Activity Log</span>
              {data && (
                <span className="text-sm font-normal text-muted-foreground">
                  Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, data.total)} of {data.total}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              </div>
            ) : data?.logs.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No audit logs found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data?.logs.map((log) => (
                  <div 
                    key={log.id}
                    className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${getActionColor(log.action).split(' ')[0]}`}>
                          {getActionIcon(log.action)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getActionColor(log.action)}>
                              {log.action}
                            </Badge>
                            {log.targetType && (
                              <span className="text-xs text-muted-foreground">
                                {log.targetType} #{log.targetId}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {log.userId ? (
                              <span>User #{log.userId} {log.userEmail && `(${log.userEmail})`}</span>
                            ) : (
                              <span>System</span>
                            )}
                          </div>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground bg-black/20 rounded p-2 font-mono">
                              {JSON.stringify(log.metadata, null, 2)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                        {log.ipAddress && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {log.ipAddress}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/10"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="border-white/10"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
