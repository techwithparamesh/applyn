import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { Smartphone, Mail, Lock, Chrome } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setLocation("/dashboard");
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-mesh selection:bg-primary/30 flex flex-col">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center p-6 py-20">
        <div className="w-full max-w-[440px] relative">
          {/* Decorative Glow */}
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
                    className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20"
                  >
                    <Smartphone className="h-7 w-7" />
                  </motion.div>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-extrabold tracking-tight text-white">
                    {isLogin ? "Welcome back" : "Create account"}
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-base">
                    {isLogin 
                      ? "Enter your credentials to access your dashboard" 
                      : "Start transforming your website into a mobile app today"}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="px-8 pb-10">
                <AnimatePresence mode="wait">
                  <motion.form
                    key={isLogin ? "login" : "signup"}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    onSubmit={handleSubmit} 
                    className="space-y-5"
                  >
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-slate-300 ml-1">Full Name</Label>
                        <div className="relative group">
                          <Input 
                            id="name" 
                            placeholder="Arjun Reddy" 
                            required 
                            className="h-12 bg-white/5 border-white/10 focus:border-primary/50 transition-all rounded-xl"
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-300 ml-1">Email address</Label>
                      <div className="relative group">
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="name@company.com" 
                          required 
                          className="h-12 bg-white/5 border-white/10 focus:border-primary/50 transition-all rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <Label htmlFor="password" text-slate-300>Password</Label>
                        {isLogin && (
                          <Link href="#" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                            Forgot password?
                          </Link>
                        )}
                      </div>
                      <Input 
                        id="password" 
                        type="password" 
                        required 
                        className="h-12 bg-white/5 border-white/10 focus:border-primary/50 transition-all rounded-xl"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-black rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                      disabled={loading}
                    >
                      {loading ? (isLogin ? "Signing in..." : "Creating account...") : (isLogin ? "Sign in" : "Get Started Free")}
                    </Button>

                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/5" />
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                        <span className="bg-[#0f172a] px-3 text-slate-500">Or continue with</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full h-12 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center gap-3 transition-all font-semibold" 
                      type="button"
                    >
                      <Chrome className="h-5 w-5" />
                      Google
                    </Button>
                  </motion.form>
                </AnimatePresence>

                <div className="mt-8 text-center">
                  <p className="text-sm text-slate-500">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                    <button 
                      onClick={() => setIsLogin(!isLogin)}
                      className="font-bold text-primary hover:underline underline-offset-4 transition-all"
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