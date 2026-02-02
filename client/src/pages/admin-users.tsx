import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  User,
  Mail,
  MoreVertical,
  Smartphone,
  LifeBuoy,
  Calendar,
  Eye,
  Crown,
  Loader2,
  Package,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getAppUrlDisplay, isHttpUrl } from "@/lib/utils";

type UserWithStats = {
  id: string;
  username: string;
  name: string | null;
  role: string;
  plan: string | null;
  planStatus: string | null;
  createdAt: string | Date;
  appCount: number;
  ticketCount: number;
  openTickets: number;
};

type AppItem = {
  id: string;
  name: string;
  url: string;
  status: string;
  platform: string;
  icon: string;
  iconUrl?: string | null;
  primaryColor: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type TicketItem = {
  id: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string | Date;
};

type UserDetails = {
  user: UserWithStats;
  apps: AppItem[];
  tickets: TicketItem[];
};

type Me = {
  id: string;
  username: string;
  name: string | null;
  role: string;
};

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (meLoading) return;
    if (!me) {
      setLocation(`/login?returnTo=${encodeURIComponent("/admin/users")}`);
      return;
    }
    if (me.role !== "admin") {
      setLocation("/dashboard");
      toast({
        title: "Access denied",
        description: "Admin access required.",
        variant: "destructive",
      });
    }
  }, [meLoading, me, setLocation, toast]);

  const { data: users, isLoading: usersLoading, error: usersError } = useQuery<UserWithStats[]>({
    queryKey: ["/api/admin/users"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me && me.role === "admin",
  });

  const { data: userDetails, isLoading: detailsLoading } = useQuery<UserDetails>({
    queryKey: ["/api/admin/users", selectedUserId],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedUserId && detailsOpen,
  });

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(u => 
      u.username.toLowerCase().includes(query) ||
      (u.name && u.name.toLowerCase().includes(query))
    );
  }, [users, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const list = users || [];
    return {
      total: list.length,
      withApps: list.filter(u => u.appCount > 0).length,
      withOpenTickets: list.filter(u => u.openTickets > 0).length,
      withPlan: list.filter(u => u.plan && u.planStatus === "active").length,
    };
  }, [users]);

  const handleViewUser = (userId: string) => {
    setSelectedUserId(userId);
    setDetailsOpen(true);
  };

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
      <main className="container mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">User Management</h1>
                <p className="text-muted-foreground">View and support your platform users</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by email or name..."
                className="pl-10 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white"
              />
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300/80">Total Users</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300/80">With Apps</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.withApps}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300/80">Open Tickets</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.withOpenTickets}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <LifeBuoy className="h-5 w-5 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300/80">Paid Users</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.withPlan}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Users List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5 text-purple-400" />
                Platform Users
              </CardTitle>
              <CardDescription>
                {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} 
                {searchQuery && ` matching "${searchQuery}"`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersError && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {String(usersError)}
                </div>
              )}
              
              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    {searchQuery ? "No users found matching your search" : "No users yet"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user, index) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center justify-between p-4 rounded-xl border bg-white/5 hover:bg-white/[0.07] transition-colors border-white/10"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-purple-400" />
                        </div>
                        
                        {/* Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white truncate">
                              {user.name || user.username.split("@")[0]}
                            </span>
                            {user.plan && user.planStatus === "active" && (
                              <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">
                                {user.plan}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.username}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Package className="h-4 w-4" />
                            <span>{user.appCount} apps</span>
                          </div>
                          <div className={`flex items-center gap-1 ${user.openTickets > 0 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                            <LifeBuoy className="h-4 w-4" />
                            <span>{user.openTickets} open</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-white/10">
                            <DropdownMenuItem
                              onClick={() => handleViewUser(user.id)}
                              className="text-white focus:bg-white/10 cursor-pointer"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setLocation(`/tickets?user=${user.id}`)}
                              className="text-white focus:bg-white/10 cursor-pointer"
                            >
                              <LifeBuoy className="mr-2 h-4 w-4" />
                              View Tickets
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
      <Footer />

      {/* User Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="glass border-white/10 max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-purple-400" />
              User Details
            </DialogTitle>
            <DialogDescription>
              View user information, apps, and support tickets
            </DialogDescription>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          ) : userDetails ? (
            <div className="space-y-6">
              {/* User Info */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center">
                    <User className="h-7 w-7 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">
                      {userDetails.user.name || userDetails.user.username.split("@")[0]}
                    </h3>
                    <p className="text-sm text-muted-foreground">{userDetails.user.username}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {userDetails.user.plan && userDetails.user.planStatus === "active" ? (
                        <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                          <Crown className="h-3 w-3 mr-1" />
                          {userDetails.user.plan} Plan
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">
                          No Plan
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Joined {formatDistanceToNow(new Date(userDetails.user.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* User's Apps */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-cyan-400" />
                  Apps ({userDetails.apps.length})
                </h4>
                {userDetails.apps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No apps created</p>
                ) : (
                  <div className="space-y-2">
                    {userDetails.apps.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-lg flex items-center justify-center text-lg overflow-hidden"
                            style={{ backgroundColor: `${app.primaryColor}20` }}
                          >
                            {app.iconUrl ? (
                              <img src={app.iconUrl} alt={app.name} className="h-full w-full object-cover" />
                            ) : (
                              app.icon
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{app.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{getAppUrlDisplay(app.url, (app as any).isNativeOnly)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={
                            app.status === "live" 
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : app.status === "processing"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              : app.status === "failed"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                          }>
                            {app.status === "live" && <CheckCircle className="h-3 w-3 mr-1" />}
                            {app.status === "processing" && <Clock className="h-3 w-3 mr-1 animate-pulse" />}
                            {app.status === "failed" && <AlertCircle className="h-3 w-3 mr-1" />}
                            {app.status}
                          </Badge>
                          {isHttpUrl(app.url) && (
                            <a 
                              href={app.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-cyan-400 transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User's Tickets */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <LifeBuoy className="h-4 w-4 text-yellow-400" />
                  Support Tickets ({userDetails.tickets.length})
                </h4>
                {userDetails.tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No support tickets</p>
                ) : (
                  <div className="space-y-2">
                    {userDetails.tickets.slice(0, 5).map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${ticket.status === "open" ? "bg-yellow-400" : "bg-green-400"}`} />
                          <div>
                            <p className="text-sm font-medium text-white">{ticket.subject}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <Badge className={
                          ticket.status === "open"
                            ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                            : "bg-green-500/10 text-green-400 border-green-500/20"
                        }>
                          {ticket.status}
                        </Badge>
                      </div>
                    ))}
                    {userDetails.tickets.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{userDetails.tickets.length - 5} more tickets
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
