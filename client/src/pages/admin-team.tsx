import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  User,
  Mail,
  MoreVertical,
  Trash2,
  Key,
  Crown,
  Headphones,
  AlertTriangle,
  Copy,
  Loader2,
  Info,
} from "lucide-react";

type UserRole = "admin" | "support" | "user";

type TeamMember = {
  id: string;
  username: string;
  name: string | null;
  role: UserRole;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type Me = {
  id: string;
  username: string;
  name: string | null;
  role: UserRole;
  mustChangePassword?: boolean;
};

// Role badge colors and icons
const roleConfig: Record<UserRole, { icon: any; color: string; bgColor: string; label: string; description: string }> = {
  admin: {
    icon: Crown,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    label: "Admin",
    description: "Full access to all features, user management, and settings",
  },
  support: {
    icon: Headphones,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
    label: "Support",
    description: "Can view tickets, build logs, and help users (read-only for apps)",
  },
  user: {
    icon: User,
    color: "text-gray-400",
    bgColor: "bg-gray-500/10 border-gray-500/20",
    label: "User",
    description: "Regular user account",
  },
};

export default function AdminTeam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (meLoading) return;
    if (!me) {
      setLocation(`/login?returnTo=${encodeURIComponent("/admin/team")}`);
      return;
    }
    // Redirect to password change if required
    if (me.mustChangePassword) {
      setLocation("/change-password");
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

  const { data: team, isLoading: teamLoading, error: teamError } = useQuery<TeamMember[]>({
    queryKey: ["/api/admin/team-members"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me && me.role === "admin",
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("support");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<TeamMember | null>(null);
  const [copiedPassword, setCopiedPassword] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && email.includes("@") && (role === "admin" || role === "support");
  }, [email, role]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/team-members", {
        email,
        role,
      });
      return (await res.json()) as { user: TeamMember; tempPassword: string; emailSent?: boolean };
    },
    onSuccess: async (payload) => {
      setEmail("");
      setRole("support");
      setCopiedPassword(payload.tempPassword);
      setEmailSent(payload.emailSent ?? false);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/team-members"] });
      toast({
        title: "✅ Team member created!",
        description: payload.emailSent 
          ? "A welcome email with login details has been sent to the team member."
          : "Copy the temporary password and share it securely.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not create team member",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/team-members/${userId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Delete failed");
      }
      return res.json();
    },
    onSuccess: async () => {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/team-members"] });
      toast({
        title: "User deleted",
        description: "The user has been removed from the system.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not delete user",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const res = await apiRequest("PATCH", `/api/admin/team-members/${userId}`, { role });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Update failed");
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/team-members"] });
      toast({
        title: "Role updated",
        description: "User role has been changed.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not update role",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleCopyPassword = async () => {
    if (!copiedPassword) return;
    try {
      await navigator.clipboard.writeText(copiedPassword);
      toast({ title: "Copied!", description: "Password copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleDeleteClick = (user: TeamMember) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const list = team || [];
    return {
      total: list.length,
      admins: list.filter((u) => u.role === "admin").length,
      support: list.filter((u) => u.role === "support").length,
      users: list.filter((u) => u.role === "user").length,
    };
  }, [team]);

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
      <main className="container mx-auto px-4 md:px-6 py-8 space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Team Management</h1>
                <p className="mt-1 text-sm text-muted-foreground">Manage admin and support team members</p>
              </div>
            </div>
            <Link href="/admin/users">
              <Button variant="outline" className="gap-2 border-white/10 text-white hover:bg-white/5">
                <User className="h-4 w-4" />
                View All Users
              </Button>
            </Link>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Add Member & Stats */}
          <div className="space-y-6">
            {/* Add Team Member Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="glass border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-cyan-400" />
                    Add Team Member
                  </CardTitle>
                  <CardDescription>
                    Create a new admin or support account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300/80">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="support@yourcompany.com"
                        className="pl-10 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-slate-300/80">Role</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                      <SelectTrigger className="bg-white/5 border-white/10 focus:border-cyan-500/50 text-white">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/10">
                        <SelectItem value="support" className="text-white focus:bg-white/10">
                          <div className="flex items-center gap-2">
                            <Headphones className="h-4 w-4 text-cyan-400" />
                            <span>Support</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin" className="text-white focus:bg-white/10">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-400" />
                            <span>Admin</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Role Description */}
                  <div className={`p-3 rounded-lg border ${roleConfig[role].bgColor}`}>
                    <p className="text-sm text-muted-foreground">
                      {roleConfig[role].description}
                    </p>
                  </div>

                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!canSubmit || createMutation.isPending}
                    className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Team Member
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Temporary Password Display */}
            {copiedPassword && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className={emailSent ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/10"}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Key className={`h-5 w-5 mt-0.5 ${emailSent ? "text-green-400" : "text-amber-400"}`} />
                      <div className="flex-1 min-w-0">
                        {emailSent ? (
                          <>
                            <p className="text-sm font-medium text-green-400 mb-1">✉️ Welcome Email Sent!</p>
                            <p className="text-xs text-muted-foreground mb-2">
                              The team member has received an email with login instructions. They will be prompted to change their password on first login.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-amber-400 mb-1">⚠️ Share Password Manually</p>
                            <p className="text-xs text-muted-foreground mb-2">
                              Email is not configured. Please share this password securely with the team member. They will be prompted to change it on first login.
                            </p>
                          </>
                        )}
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 rounded bg-black/30 text-white text-sm font-mono truncate flex-1">
                            {copiedPassword}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCopyPassword}
                            className={emailSent ? "text-green-400 hover:text-green-300" : "text-amber-400 hover:text-amber-300"}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setCopiedPassword(null); setEmailSent(false); }}
                        className="text-muted-foreground hover:text-white"
                      >
                        ×
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Stats Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="glass border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Team Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-white">{stats.total}</div>
                      <div className="text-xs font-medium text-slate-300/80">Total</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-400">{stats.admins}</div>
                      <div className="text-xs font-medium text-slate-300/80">Admins</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-cyan-400">{stats.support}</div>
                      <div className="text-xs font-medium text-slate-300/80">Support</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Role Permissions Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="glass border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Info className="h-4 w-4 text-cyan-400" />
                    Role Permissions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-400" />
                      <span className="font-medium text-amber-400">Admin</span>
                    </div>
                    <ul className="text-muted-foreground text-xs space-y-1 ml-6">
                      <li>• Full access to all features</li>
                      <li>• Manage team members</li>
                      <li>• View and respond to all tickets</li>
                      <li>• Access build logs</li>
                      <li>• Delete users and apps</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Headphones className="h-4 w-4 text-cyan-400" />
                      <span className="font-medium text-cyan-400">Support</span>
                    </div>
                    <ul className="text-muted-foreground text-xs space-y-1 ml-6">
                      <li>• View and respond to all tickets</li>
                      <li>• Access build logs (for debugging)</li>
                      <li>• View user apps (read-only)</li>
                      <li>• Cannot manage team or billing</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Team Members List */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="glass border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="h-5 w-5 text-cyan-400" />
                    Team Members
                  </CardTitle>
                  <CardDescription>
                    {stats.total} member{stats.total !== 1 ? "s" : ""} in your team
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {teamError && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {String(teamError)}
                    </div>
                  )}
                  
                  {teamLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                    </div>
                  ) : (team || []).length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">No team members yet</p>
                      <p className="text-sm text-muted-foreground/60">Add your first team member above</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(team || []).map((member, index) => {
                        const config = roleConfig[member.role];
                        const RoleIcon = config.icon;
                        const isCurrentUser = me?.id === member.id;
                        
                        return (
                          <motion.div
                            key={member.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex items-center justify-between p-4 rounded-xl border bg-white/5 hover:bg-white/[0.07] transition-colors ${
                              isCurrentUser ? "border-cyan-500/30" : "border-white/10"
                            }`}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              {/* Avatar */}
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${config.bgColor} border`}>
                                <RoleIcon className={`h-5 w-5 ${config.color}`} />
                              </div>
                              
                              {/* Info */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white truncate">
                                    {member.name || member.username.split("@")[0]}
                                  </span>
                                  {isCurrentUser && (
                                    <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {member.username}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Role Badge */}
                              <Badge className={`${config.bgColor} ${config.color} border`}>
                                <RoleIcon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>

                              {/* Actions Dropdown */}
                              {!isCurrentUser && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-gray-900 border-white/10">
                                    <DropdownMenuItem
                                      onClick={() => updateRoleMutation.mutate({ 
                                        userId: member.id, 
                                        role: member.role === "admin" ? "support" : "admin" 
                                      })}
                                      className="text-white focus:bg-white/10 cursor-pointer"
                                    >
                                      <ShieldCheck className="mr-2 h-4 w-4" />
                                      Change to {member.role === "admin" ? "Support" : "Admin"}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteClick(member)}
                                      className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete User
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong className="text-white">{userToDelete?.username}</strong>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              className="text-muted-foreground hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
