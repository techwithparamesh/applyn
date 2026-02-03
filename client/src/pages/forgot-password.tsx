import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setSent(true);
      toast({
        title: "Check your email",
        description: "If that email exists, we've sent a password reset link.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Please try again",
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
                    className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20"
                  >
                    <Mail className="h-7 w-7" />
                  </motion.div>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-extrabold tracking-tight text-white">
                    {sent ? "Check your email" : "Forgot password?"}
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-base">
                    {sent
                      ? "We've sent a password reset link to your email address."
                      : "No worries, we'll send you reset instructions."}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="px-8 pb-10">
                {sent ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                      <p className="text-green-400 text-sm">
                        If an account exists for <strong>{email}</strong>, you will receive an email with instructions.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full h-12 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl"
                      onClick={() => setSent(false)}
                    >
                      Try another email
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-300 ml-1">
                        Email address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@company.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 bg-white/5 border-white/10 focus:border-primary/50 transition-all rounded-xl"
                      />
                    </div>

                    <Button
                      type="submit"
                      loading={loading}
                      className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-black rounded-xl shadow-lg shadow-primary/20 transition-colors duration-150 ease-out"
                    >
                      Send reset link
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
