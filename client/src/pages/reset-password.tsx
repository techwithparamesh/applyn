import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link, useLocation, useSearch } from "wouter";
import { KeyRound, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  const token = new URLSearchParams(search).get("token") || "";

  useEffect(() => {
    if (!token) {
      toast({
        title: "Invalid link",
        description: "This password reset link is invalid or has expired.",
        variant: "destructive",
      });
    }
  }, [token, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setSuccess(true);
      toast({
        title: "Password reset successful",
        description: "You can now log in with your new password.",
      });
    } catch (err: any) {
      toast({
        title: "Reset failed",
        description: err?.message || "This link may have expired. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh selection:bg-primary/30 flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-6 py-20">
        <div className="w-full max-w-[440px] relative">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -z-10" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] -z-10" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="glass border-white/10 shadow-2xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="space-y-4 pt-10 pb-6 text-center">
                <div className="flex justify-center">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`h-14 w-14 rounded-2xl flex items-center justify-center border ${
                      success
                        ? "bg-green-500/10 text-green-500 border-green-500/20"
                        : "bg-primary/10 text-primary border-primary/20"
                    }`}
                  >
                    {success ? <CheckCircle className="h-7 w-7" /> : <KeyRound className="h-7 w-7" />}
                  </motion.div>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-extrabold tracking-tight text-white">
                    {success ? "Password reset!" : "Set new password"}
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-base">
                    {success
                      ? "Your password has been successfully reset."
                      : "Your new password must be at least 8 characters."}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="px-8 pb-10">
                {success ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                      <p className="text-green-400 text-sm">
                        Your password has been changed. You can now log in with your new password.
                      </p>
                    </div>
                    <Button
                      className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-black rounded-xl shadow-lg shadow-primary/20"
                      onClick={() => setLocation("/login")}
                    >
                      Go to login
                    </Button>
                  </div>
                ) : !token ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                      <p className="text-red-400 text-sm">
                        This password reset link is invalid or has expired.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full h-12 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl"
                      onClick={() => setLocation("/forgot-password")}
                    >
                      Request a new link
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-slate-300 ml-1">
                        New password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 bg-white/5 border-white/10 focus:border-primary/50 transition-all rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-slate-300 ml-1">
                        Confirm password
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-12 bg-white/5 border-white/10 focus:border-primary/50 transition-all rounded-xl"
                      />
                    </div>

                    <Button
                      type="submit"
                      loading={loading}
                      className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-black rounded-xl shadow-lg shadow-primary/20 transition-colors duration-150 ease-out"
                    >
                      Reset password
                    </Button>
                  </form>
                )}

                <div className="mt-8 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center text-sm text-slate-400 hover:text-primary transition-colors"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to login
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
