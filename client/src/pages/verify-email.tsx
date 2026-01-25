import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading");
  const [message, setMessage] = useState("");

  const verifyMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Verification failed");
      }
      return data;
    },
    onSuccess: () => {
      setStatus("success");
      setMessage("Your email has been verified successfully!");
    },
    onError: (error: Error) => {
      setStatus("error");
      setMessage(error.message || "Verification failed. The link may be invalid or expired.");
    },
  });

  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      setMessage("No verification token provided.");
      return;
    }

    verifyMutation.mutate(token);
  }, [token]);

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-16 flex items-center justify-center">
        <Card className="glass border-white/10 max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {status === "loading" && (
                <div className="h-16 w-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
                </div>
              )}
              {status === "success" && (
                <div className="h-16 w-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
              )}
              {(status === "error" || status === "no-token") && (
                <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl text-white">
              {status === "loading" && "Verifying Email..."}
              {status === "success" && "Email Verified!"}
              {status === "error" && "Verification Failed"}
              {status === "no-token" && "Invalid Link"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "success" && (
              <Button 
                onClick={() => setLocation("/dashboard")}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
              >
                Go to Dashboard
              </Button>
            )}
            {status === "error" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  If your link has expired, you can request a new verification email from your profile settings.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setLocation("/login")}
                    className="flex-1 border-white/10"
                  >
                    Login
                  </Button>
                  <Button 
                    onClick={() => setLocation("/profile")}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                  >
                    Go to Profile
                  </Button>
                </div>
              </div>
            )}
            {status === "no-token" && (
              <Button 
                onClick={() => setLocation("/login")}
                className="w-full border-white/10"
                variant="outline"
              >
                Go to Login
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
