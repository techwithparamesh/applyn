import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (!isLoading && !me) setLocation(`/login?returnTo=${encodeURIComponent("/profile")}`);
  }, [isLoading, me, setLocation]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : me ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span> {(me as any).name || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span> {(me as any).username}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Redirecting...</div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
