import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { Smartphone, Mail, Lock, Chrome } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (!err) return;
    if (err === "google_not_configured") {
      toast({
        title: "Google sign-in unavailable",
        description: "Google OAuth is not configured on the server yet.",
        variant: "destructive",
      });
    } else if (err === "google_failed") {
      toast({
        title: "Google sign-in failed",
        description: "Please try again or use email/password.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await apiRequest("POST", "/api/auth/login", {
          email,
          password,
        });
      } else {
        await apiRequest("POST", "/api/auth/register", {
          name: fullName,
          username: email,
          password,
        });
      }

      // Invalidate the /api/me query so dashboard knows user is logged in
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });

      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo");
      if (returnTo && returnTo.startsWith("/")) {
        setLocation(returnTo);
      } else {
        setLocation("/dashboard");
      }
    } catch (err: any) {
      toast({
        title: "Authentication failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-mesh selection:bg-primary/30 flex flex-col">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center p-6 py-16">
        <div className="w-full max-w-[420px] relative">
          {/* Decorative Glow */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] -z-10" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] -z-10" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="glass border-white/[0.08] shadow-2xl rounded-2xl overflow-hidden">
              <CardHeader className="space-y-4 pt-8 pb-4 text-center">
                <div className="flex justify-center">
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="h-14 w-14 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-white/10"
                  >
                    <Smartphone className="h-7 w-7 text-cyan-400" />
                  </motion.div>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl font-bold tracking-tight text-white">
                    {isLogin ? "Welcome back" : "Create account"}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {isLogin 
                      ? "Enter your credentials to access your dashboard" 
                      : "Start transforming your website into a mobile app today"}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="px-6 pb-8">
                <AnimatePresence mode="wait">
                  <motion.form
                    key={isLogin ? "login" : "signup"}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    onSubmit={handleSubmit} 
                    className="space-y-4"
                  >
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm text-muted-foreground">Full Name</Label>
                        <Input 
                          id="name" 
                          placeholder="Arjun Reddy" 
                          required 
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="h-11 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white placeholder:text-muted-foreground rounded-lg"
                        />
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm text-muted-foreground">Email address</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="name@company.com" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white placeholder:text-muted-foreground rounded-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                        {isLogin && (
                          <Link href="/forgot-password" className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors">
                            Forgot password?
                          </Link>
                        )}
                      </div>
                      <Input 
                        id="password" 
                        type="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white rounded-lg"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-11 text-base font-semibold bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white rounded-lg shadow-lg glow-primary transition-all hover:scale-[1.02] active:scale-[0.98]" 
                      disabled={loading}
                    >
                      {loading ? (isLogin ? "Signing in..." : "Creating account...") : (isLogin ? "Sign in" : "Get Started Free")}
                    </Button>

                    <div className="relative py-3">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/[0.08]" />
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-medium">
                        <span className="bg-card px-3 text-muted-foreground">Or continue with</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full h-11 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-lg flex items-center gap-3 transition-all font-medium" 
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams(window.location.search);
                        const returnTo = params.get("returnTo") || "/dashboard";
                        const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/dashboard";
                        window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(safeReturnTo)}`;
                      }}
                    >
                      <Chrome className="h-5 w-5" />
                      Google
                    </Button>
                  </motion.form>
                </AnimatePresence>

                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                    <button 
                      onClick={() => setIsLogin(!isLogin)}
                      className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {isLogin ? "Sign up" : "Log in"}
                    </button>
                  </p>
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