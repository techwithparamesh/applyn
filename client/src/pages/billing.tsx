import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Loader2, Receipt, CreditCard, IndianRupee, Calendar, CheckCircle2, Clock, XCircle, ArrowRight, Sparkles, Download } from "lucide-react";
import { format } from "date-fns";

type Payment = {
  id: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amountInr: number;
  plan: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  appId: string | null;
};

export default function Billing() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const res = await fetch("/api/payments", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      const data: Payment[] = await res.json();
      // Filter out test/dummy payments with zero amount
      return data.filter(p => p.amountInr > 0);
    },
    enabled: !!me,
  });

  useEffect(() => {
    if (!meLoading && !me) setLocation(`/login?returnTo=${encodeURIComponent("/billing")}`);
  }, [meLoading, me, setLocation]);

  const getStatusBadge = (status: Payment["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">
            <XCircle className="h-3 w-3 mr-1" /> Failed
          </Badge>
        );
    }
  };

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case "starter":
        return "Starter Build";
      case "standard":
        return "Standard Build";
      case "pro":
        return "Enterprise Pro";
      default:
        return plan;
    }
  };

  const totalSpent = payments
    ?.filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amountInr, 0) || 0;

  const completedPayments = payments?.filter((p) => p.status === "completed").length || 0;

  if (meLoading) {
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

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-8 max-w-4xl space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Billing & Payments</h1>
            <p className="mt-1 text-sm text-muted-foreground">View your payment history and invoices</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <IndianRupee className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300/80">Total Spent</p>
                  <p className="text-2xl font-bold text-white">₹{totalSpent.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300/80">Successful Payments</p>
                  <p className="text-2xl font-bold text-white">{completedPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300/80">Payment Method</p>
                  <p className="text-lg font-semibold text-white">Razorpay</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Receipt className="h-5 w-5 text-cyan-400" />
              Payment History
            </CardTitle>
            <CardDescription>All your transactions in one place</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{getPlanLabel(payment.plan)}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(payment.createdAt), "PPP")}
                          {payment.providerPaymentId && (
                            <span className="text-xs">• ID: {payment.providerPaymentId}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-white">₹{payment.amountInr.toLocaleString("en-IN")}</p>
                      {getStatusBadge(payment.status)}
                      {payment.status === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/10 hover:bg-white/5"
                          onClick={() => {
                            window.open(`/api/payments/${payment.id}/invoice`, '_blank');
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <Receipt className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No payments yet</h3>
                <p className="text-muted-foreground mb-6">
                  You haven't made any payments. Create your first app to get started!
                </p>
                <Link href="/prompt-create">
                  <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Create Your First App
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
