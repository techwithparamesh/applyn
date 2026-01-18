import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Billing() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (!isLoading && !me) setLocation(`/login?returnTo=${encodeURIComponent("/billing")}`);
  }, [isLoading, me, setLocation]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Billing is a placeholder right now. Next step is wiring plans/payments (Stripe/Razorpay) and showing invoices.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
