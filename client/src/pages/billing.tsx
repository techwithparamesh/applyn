import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, Receipt, CreditCard, IndianRupee, Calendar, CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";
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
      return res.json();
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
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
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
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Billing & Payments</h1>
          <p className="text-muted-foreground">View your payment history and invoices</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <IndianRupee className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">₹{totalSpent.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Successful Payments</p>
                  <p className="text-2xl font-bold">{completedPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="text-lg font-semibold">Razorpay</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
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
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <Receipt className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-medium">{getPlanLabel(payment.plan)}</p>
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
                      <p className="font-bold">₹{payment.amountInr.toLocaleString("en-IN")}</p>
                      {getStatusBadge(payment.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No payments yet</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't made any payments. Create your first app to get started!
                </p>
                <Button onClick={() => setLocation("/create")}>
                  Create Your First App <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
