import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Plus,
  MessageSquare,
  Clock,
  CheckCircle2,
  Copy,
  Eye,
  LifeBuoy,
  ArrowRight,
  Sparkles,
  Send,
  Loader2,
  Wand2,
  AlertTriangle,
} from "lucide-react";

type Role = "admin" | "support" | "user" | string;

type Me = {
  id: string;
  username: string;
  name: string | null;
  role: Role;
};

type SupportTicket = {
  id: string;
  requesterId: string;
  appId: string | null;
  subject: string;
  message: string;
  status: "open" | "closed" | string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function isStaffRole(role: Role) {
  return role === "admin" || role === "support";
}

export default function Tickets() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const isStaff = useMemo(() => isStaffRole(me?.role || "user"), [me]);

  useEffect(() => {
    if (meLoading) return;
    if (!me) {
      setLocation(`/login?returnTo=${encodeURIComponent("/tickets")}`);
    }
  }, [meLoading, me, setLocation]);

  const { data: tickets, isLoading: ticketsLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me,
  });

  const [viewOpen, setViewOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [ticketAnalysis, setTicketAnalysis] = useState<{
    category: string;
    priority: string;
    summary: string;
    suggestedResponse?: string;
  } | null>(null);

  // AI Ticket Categorization for staff
  const categorizeMutation = useMutation({
    mutationFn: async (ticket: SupportTicket) => {
      const res = await apiRequest("POST", "/api/ai/categorize-ticket", {
        subject: ticket.subject,
        message: ticket.message,
      });
      if (!res.ok) throw new Error("AI analysis failed");
      return res.json();
    },
    onSuccess: (data) => {
      setTicketAnalysis(data);
    },
    onError: () => {
      toast({
        title: "AI analysis unavailable",
        description: "Could not analyze the ticket",
        variant: "destructive",
      });
    },
  });

  const [newOpen, setNewOpen] = useState(false);
  const [newAppId, setNewAppId] = useState<string>("");
  const [newSubject, setNewSubject] = useState<string>("");
  const [newMessage, setNewMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const appId = params.get("appId");
    const subject = params.get("subject");
    const message = params.get("message");

    if (appId && !newAppId) setNewAppId(appId);
    if (subject && !newSubject) setNewSubject(subject);
    if (message && !newMessage) setNewMessage(message);

    if ((subject || message || appId) && !newOpen) {
      setNewOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallthrough
    }
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  };

  const handleView = (t: SupportTicket) => {
    setActiveTicket(t);
    setTicketAnalysis(null); // Reset analysis when viewing new ticket
    setViewOpen(true);
  };

  const handleCopy = async (t: SupportTicket) => {
    const text = [
      `Ticket: ${t.id}`,
      `Status: ${t.status}`,
      t.appId ? `App: ${t.appId}` : null,
      `Subject: ${t.subject}`,
      "",
      t.message,
    ]
      .filter(Boolean)
      .join("\n");

    const ok = await copyText(text);
    toast({
      title: ok ? "Copied" : "Copy failed",
      description: ok ? "Ticket details copied." : "Could not copy to clipboard.",
      variant: ok ? undefined : "destructive",
    });
  };

  const handleToggleStatus = async (t: SupportTicket) => {
    const next = t.status === "closed" ? "open" : "closed";
    try {
      await apiRequest("PATCH", `/api/support/tickets/${t.id}`, { status: next });
      await queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Updated", description: `Ticket marked ${next}.` });
      if (viewOpen && activeTicket?.id === t.id) {
        setActiveTicket({ ...t, status: next });
      }
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    try {
      const payload: any = {
        subject: newSubject,
        message: newMessage,
      };
      if (newAppId.trim()) payload.appId = newAppId.trim();

      await apiRequest("POST", "/api/support/tickets", payload);
      await queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket created", description: "Support will get back to you soon." });
      setNewOpen(false);
      setNewAppId("");
      setNewSubject("");
      setNewMessage("");
    } catch (err: any) {
      toast({
        title: "Could not create ticket",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  // Stats
  const stats = useMemo(() => {
    const list = tickets || [];
    return {
      total: list.length,
      open: list.filter((t) => t.status === "open").length,
      closed: list.filter((t) => t.status === "closed").length,
    };
  }, [tickets]);

  if (meLoading) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        </main>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">
                {isStaff ? "Support Tickets" : "My Tickets"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isStaff
                  ? "Manage and respond to customer support requests"
                  : "Track your support requests and get help from our team"}
              </p>
            </div>
            <Button 
              onClick={() => setNewOpen(true)}
              className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold shadow-lg glow-primary"
            >
              <Plus className="h-4 w-4" /> Create New Ticket
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
            <Card className="glass glass-hover border stat-gradient-1">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tickets</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-cyan-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass glass-hover border stat-gradient-4">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Open</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.open}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass glass-hover border stat-gradient-3">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Resolved</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.closed}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Create Card */}
          {(tickets || []).length === 0 && !ticketsLoading && (
            <motion.div variants={itemVariants}>
              <Card className="glass border-dashed border-white/10">
                <CardContent className="p-12 text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                    <LifeBuoy className="h-8 w-8 text-cyan-400" />
                  </div>
                  <h3 className="font-semibold text-white text-lg">No tickets yet</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                    Need help with your app? Create a support ticket and our team will get back to you within 24 hours.
                  </p>
                  <div className="mt-6">
                    <Button 
                      onClick={() => setNewOpen(true)}
                      className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold"
                    >
                      <Plus className="h-4 w-4" /> Create Your First Ticket
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Tickets List */}
          {((tickets || []).length > 0 || ticketsLoading) && (
            <motion.div variants={itemVariants}>
              <Card className="glass overflow-hidden">
                <CardHeader className="border-b border-white/5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-white">Recent Tickets</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {isStaff ? "All customer tickets" : "Your support history"}
                      </CardDescription>
                    </div>
                    {isStaff && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1 text-muted-foreground hover:text-white"
                        onClick={() => setLocation("/ops")}
                      >
                        Go to Ops <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {ticketsLoading && (
                    <div className="p-6 text-sm text-muted-foreground flex items-center gap-3">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Loading tickets...
                    </div>
                  )}

                  <div className="divide-y divide-white/5">
                    {(tickets || []).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-4 p-4 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={`h-3 w-3 rounded-full shrink-0 ${
                            t.status === "open" 
                              ? "bg-yellow-400 shadow-lg shadow-yellow-400/30" 
                              : "bg-green-400 shadow-lg shadow-green-400/30"
                          }`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-white truncate">{t.subject}</span>
                              <Badge 
                                className={`shrink-0 ${
                                  t.status === "open"
                                    ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                    : "bg-green-500/10 text-green-400 border-green-500/20"
                                }`}
                              >
                                {t.status === "open" ? "Open" : "Closed"}
                              </Badge>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground truncate">
                              Updated {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                              {t.appId && ` • App: ${t.appId.slice(0, 8)}...`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-white"
                            onClick={() => handleView(t)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-white"
                            onClick={() => handleCopy(t)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className={`text-xs ${
                              t.status === "closed" 
                                ? "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10" 
                                : "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            }`}
                            onClick={() => handleToggleStatus(t)}
                          >
                            {t.status === "closed" ? "Reopen" : "Close"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </main>

      <Footer />

      {/* View Ticket Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl glass border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">{activeTicket?.subject || "Ticket"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {activeTicket && (
                <span className="flex items-center gap-2">
                  <Badge 
                    className={`${
                      activeTicket.status === "open"
                        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        : "bg-green-500/10 text-green-400 border-green-500/20"
                    }`}
                  >
                    {activeTicket.status}
                  </Badge>
                  <span>• Ticket ID: {activeTicket.id.slice(0, 8)}...</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {activeTicket && (
            <div className="space-y-4">
              {activeTicket.appId && (
                <div className="text-xs text-muted-foreground">
                  Related App: <span className="text-white">{activeTicket.appId}</span>
                </div>
              )}

              {/* AI Analysis for Staff */}
              {isStaff && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-white">AI Analysis</span>
                    </div>
                    {!ticketAnalysis && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => categorizeMutation.mutate(activeTicket)}
                        disabled={categorizeMutation.isPending}
                        className="h-7 text-xs gap-1 text-purple-400 hover:text-purple-300"
                      >
                        {categorizeMutation.isPending ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing...</>
                        ) : (
                          <><Sparkles className="h-3 w-3" /> Analyze</>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {ticketAnalysis && (
                    <div className="space-y-2 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          Category: {ticketAnalysis.category.replace('_', ' ')}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            ticketAnalysis.priority === 'urgent' ? 'border-red-500/50 text-red-400' :
                            ticketAnalysis.priority === 'high' ? 'border-orange-500/50 text-orange-400' :
                            ticketAnalysis.priority === 'medium' ? 'border-yellow-500/50 text-yellow-400' :
                            'border-green-500/50 text-green-400'
                          }`}
                        >
                          {ticketAnalysis.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          Priority: {ticketAnalysis.priority}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{ticketAnalysis.summary}</p>
                      {ticketAnalysis.suggestedResponse && (
                        <div className="mt-2 p-2 rounded bg-white/5 border border-white/10">
                          <p className="text-xs text-muted-foreground mb-1">Suggested Response:</p>
                          <p className="text-white/80 text-xs">{ticketAnalysis.suggestedResponse}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <ScrollArea className="h-[250px] rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <pre className="whitespace-pre-wrap text-sm text-white/90 font-sans">
                  {activeTicket.message}
                </pre>
              </ScrollArea>

              <div className="flex gap-2 justify-end">
                <Button 
                  variant="ghost" 
                  onClick={() => handleCopy(activeTicket)}
                  className="gap-2 text-muted-foreground hover:text-white"
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Button 
                  onClick={() => handleToggleStatus(activeTicket)}
                  className={`${
                    activeTicket.status === "closed"
                      ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20"
                      : "bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20"
                  }`}
                >
                  {activeTicket.status === "closed" ? "Reopen Ticket" : "Mark as Resolved"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Ticket Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-xl glass border-white/10">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <DialogTitle className="text-white">Create Support Ticket</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Tell us what you need help with
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">App ID (optional)</Label>
              <Input
                value={newAppId}
                onChange={(e) => setNewAppId(e.target.value)}
                placeholder="e.g. 4f7b7b0c-..."
                className="bg-white/5 border-white/10 focus:border-cyan-500/50 text-white placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Subject <span className="text-red-400">*</span></Label>
              <Input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="What do you need help with?"
                className="bg-white/5 border-white/10 focus:border-cyan-500/50 text-white placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Message <span className="text-red-400">*</span></Label>
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Describe the issue in detail..."
                rows={6}
                className="bg-white/5 border-white/10 focus:border-cyan-500/50 text-white placeholder:text-muted-foreground resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="ghost" 
                onClick={() => setNewOpen(false)}
                className="text-muted-foreground hover:text-white"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={!newSubject.trim() || !newMessage.trim()}
                className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Submit Ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
