import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Key,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";

type Me = {
  id: string;
  username: string;
  name: string | null;
  role: string;
  mustChangePassword?: boolean;
};

export default function ChangePassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Check if this is a forced password change (team member first login)
  const isForcedChange = me?.mustChangePassword === true;

  // Redirect if not logged in
  useEffect(() => {
    if (meLoading) return;
    if (!me) {
      setLocation("/login");
    }
  }, [meLoading, me, setLocation]);

  // Password validation
  const passwordChecks = useMemo(() => {
    return {
      minLength: newPassword.length >= 8,
      hasUppercase: /[A-Z]/.test(newPassword),
      hasLowercase: /[a-z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
      matches: newPassword === confirmPassword && newPassword.length > 0,
    };
  }, [newPassword, confirmPassword]);

  const isValid = useMemo(() => {
    return (
      currentPassword.length >= 8 &&
      passwordChecks.minLength &&
      passwordChecks.hasUppercase &&
      passwordChecks.hasLowercase &&
      passwordChecks.hasNumber &&
      passwordChecks.matches
    );
  }, [currentPassword, passwordChecks]);

  const changeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/change-password", {
        currentPassword,
        newPassword,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({
        title: "✅ Password changed!",
        description: "Your password has been updated successfully.",
      });
      setLocation("/dashboard");
    },
    onError: (err: any) => {
      toast({
        title: "Could not change password",
        description: err?.message || "Please check your current password and try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      changeMutation.mutate();
    }
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
      {!isForcedChange && <Navbar />}
      <main className="container mx-auto px-4 md:px-6 py-8 flex items-center justify-center min-h-[calc(100vh-80px)]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="glass border-white/10">
            <CardHeader className="text-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                {isForcedChange ? (
                  <Shield className="h-8 w-8 text-amber-400" />
                ) : (
                  <Key className="h-8 w-8 text-cyan-400" />
                )}
              </div>
              <CardTitle className="text-2xl text-white">
                {isForcedChange ? "Set Your Password" : "Change Password"}
              </CardTitle>
              <CardDescription>
                {isForcedChange ? (
                  <>
                    Welcome to Applyn! For security, please set a new password.
                    <br />
                    <span className="text-amber-400 text-xs mt-1 block">
                      This is required before you can access the dashboard.
                    </span>
                  </>
                ) : (
                  "Update your account password"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    {isForcedChange ? "Temporary Password" : "Current Password"}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={isForcedChange ? "Enter temporary password" : "Enter current password"}
                      className="pl-10 pr-10 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {isForcedChange && (
                    <p className="text-xs text-muted-foreground">
                      This is the password shared by your admin when your account was created.
                    </p>
                  )}
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">New Password</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="pl-10 pr-10 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Confirm New Password</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="pl-10 pr-10 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Password requirements:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <RequirementCheck met={passwordChecks.minLength} text="At least 8 characters" />
                    <RequirementCheck met={passwordChecks.hasUppercase} text="Uppercase letter" />
                    <RequirementCheck met={passwordChecks.hasLowercase} text="Lowercase letter" />
                    <RequirementCheck met={passwordChecks.hasNumber} text="Number" />
                    <RequirementCheck met={passwordChecks.matches} text="Passwords match" />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!isValid || changeMutation.isPending}
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold"
                >
                  {changeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      {isForcedChange ? "Set Password & Continue" : "Update Password"}
                    </>
                  )}
                </Button>

                {!isForcedChange && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setLocation("/dashboard")}
                    className="w-full text-muted-foreground hover:text-white"
                  >
                    Cancel
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

function RequirementCheck({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${met ? "text-green-400" : "text-muted-foreground"}`}>
      {met ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      <span>{text}</span>
    </div>
  );
}
