import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Mail, Loader2, CheckCircle, Chrome, Shield, Eye, EyeOff } from "lucide-react";

type Me = {
  id: string;
  username: string;
  name: string | null;
  role: string;
  googleId?: string | null;
};

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && !me) setLocation(`/login?returnTo=${encodeURIComponent("/profile")}`);
  }, [isLoading, me, setLocation]);

  useEffect(() => {
    if (me?.name) setName(me.name);
  }, [me]);

  const updateProfile = useMutation({
    mutationFn: async (data: { name?: string; currentPassword?: string; newPassword?: string }) => {
      const res = await apiRequest("PATCH", "/api/me", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleUpdateName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    updateProfile.mutate({ name: name.trim() });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast({ title: "All fields required", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    updateProfile.mutate({ currentPassword, newPassword });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading...
          </div>
        </main>
      </div>
    );
  }

  const hasGoogleLinked = !!(me as any)?.googleId;

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
        </div>

        {/* Account Info Card */}
        <Card className="glass border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <User className="h-5 w-5 text-cyan-400" />
              Account Information
            </CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateName} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-white">Email</Label>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{me?.username}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Role</Label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm capitalize">
                    {me?.role || "user"}
                  </span>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={updateProfile.isPending}
                className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white"
              >
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Connected Accounts Card */}
        <Card className="glass border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5 text-purple-400" />
              Connected Accounts
            </CardTitle>
            <CardDescription>Manage your sign-in methods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Chrome className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-white">Google Account</p>
                  <p className="text-sm text-muted-foreground">
                    {hasGoogleLinked ? "Connected" : "Not connected"}
                  </p>
                </div>
              </div>
              {hasGoogleLinked ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm">Connected</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent("/profile")}`;
                  }}
                  className="border-white/20 bg-white/5 hover:bg-white/10 text-white"
                >
                  Connect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Lock className="h-5 w-5 text-yellow-400" />
              Change Password
            </CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-white">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-cyan-500/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Separator className="bg-white/10" />

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-white">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-cyan-500/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-cyan-500/50"
                />
              </div>

              <Button 
                type="submit" 
                variant="outline" 
                disabled={updateProfile.isPending}
                className="border-white/20 bg-white/5 hover:bg-white/10 text-white"
              >
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
