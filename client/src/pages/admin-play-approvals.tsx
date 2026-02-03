import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, Clock, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type Me = {
  id: string;
  username: string;
  role: string;
};

type ApprovalItem = {
  id: string;
  ownerId: string;
  ownerUsername: string | null;
  name: string;
  url: string;
  status: string;
  packageName: string | null;
  playPublishingMode: string;
  playProductionStatus: string;
  playProductionRequestedAt: string | Date | null;
  lastPlayPublishedAt: string | Date | null;
  lastPlayTrack: string | null;
  lastPlayVersionCode: number | null;
};

type ApprovalListResponse = {
  items: ApprovalItem[];
  limit: number;
  offset: number;
};

export default function AdminPlayApprovals() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<ApprovalItem | null>(null);
  const [decisionApproved, setDecisionApproved] = useState(true);
  const [decisionReason, setDecisionReason] = useState("");

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const isStaff = me?.role === "admin" || me?.role === "support";

  useEffect(() => {
    if (meLoading) return;
    if (!me) {
      setLocation(`/login?returnTo=${encodeURIComponent("/admin/play-approvals")}`);
      return;
    }
    if (!isStaff) {
      setLocation("/dashboard");
      toast({
        title: "Access denied",
        description: "Admin/support access required.",
        variant: "destructive",
      });
    }
  }, [meLoading, me, isStaff, setLocation, toast]);

  const { data, isLoading, error } = useQuery<ApprovalListResponse>({
    queryKey: ["/api/admin/play/production-requests"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me && isStaff,
    refetchInterval: 15_000,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  const decisionMutation = useMutation({
    mutationFn: async (payload: { appId: string; approved: boolean; reason?: string }) => {
      const res = await fetch(`/api/apps/${payload.appId}/admin/production-decision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: payload.approved, reason: payload.reason || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || `Decision failed (${res.status})`);
      return json;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/admin/play/production-requests"] });
      setDecisionOpen(false);
      setDecisionTarget(null);
      setDecisionReason("");
      toast({ title: "Updated", description: "Production decision saved." });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err?.message || "Please try again", variant: "destructive" });
    },
  });

  const openDecision = (item: ApprovalItem, approved: boolean) => {
    setDecisionTarget(item);
    setDecisionApproved(approved);
    setDecisionReason("");
    setDecisionOpen(true);
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
      <Navbar />
      <main className="container mx-auto px-4 md:px-6 py-8 space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">Play Production Approvals</h1>
              <p className="mt-1 text-sm text-muted-foreground">Approve/reject production publishing requests (central mode).</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-2">
            <Clock className="h-3.5 w-3.5" /> Auto-refresh 15s
          </Badge>
        </div>

        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Pending Requests</CardTitle>
            <CardDescription>{items.length} awaiting review</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : error ? (
              <div className="text-red-300 text-sm">{(error as any)?.message || "Failed to load"}</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No pending requests.</div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-white font-semibold">{item.name}</div>
                          <Badge className="bg-amber-500/20 text-amber-200">requested</Badge>
                          <Badge variant="secondary">{item.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Owner: <span className="text-white">{item.ownerUsername || item.ownerId}</span>
                          {item.packageName ? (
                            <> · Package: <span className="text-white">{item.packageName}</span></>
                          ) : null}
                          {item.playProductionRequestedAt ? (
                            <> · Requested {formatDistanceToNow(new Date(item.playProductionRequestedAt), { addSuffix: true })}</>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                          onClick={() => openDecision(item, true)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          className="border-white/10 text-white hover:bg-white/5"
                          onClick={() => openDecision(item, false)}
                        >
                          <XCircle className="h-4 w-4 mr-2" /> Reject
                        </Button>
                        <Button
                          variant="outline"
                          className="border-white/10 text-white hover:bg-white/5"
                          onClick={() => setLocation(`/apps/${item.id}/publish`)}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{decisionApproved ? "Approve" : "Reject"} production request</DialogTitle>
            <DialogDescription>
              {decisionTarget ? (
                <>
                  App: <span className="text-white">{decisionTarget.name}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder={decisionApproved ? "Optional note (e.g., checks passed)" : "Required: why rejected?"}
              className="bg-white/5 border-white/10 text-white"
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="border-white/10"
                onClick={() => setDecisionOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!decisionTarget) return;
                  if (!decisionApproved && !decisionReason.trim()) {
                    toast({ title: "Reason required", description: "Please provide a rejection reason.", variant: "destructive" });
                    return;
                  }
                  decisionMutation.mutate({
                    appId: decisionTarget.id,
                    approved: decisionApproved,
                    reason: decisionReason.trim() || undefined,
                  });
                }}
                disabled={decisionMutation.isPending}
                className={decisionApproved ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}
              >
                {decisionMutation.isPending ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
