import { Navbar } from "@/components/layout/navbar";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

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
      toast({ title: "Ticket created", description: "Support will get back to you." });
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

  if (meLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">Loading...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {isStaff ? "Tickets" : "My Tickets"}
            </h1>
            <p className="text-muted-foreground">
              {isStaff
                ? "Staff can view tickets in Ops"
                : "Track your support requests"}
            </p>
          </div>

          <Button onClick={() => setNewOpen(true)} variant="outline">
            New ticket
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recent tickets</CardTitle>
            <CardDescription>
              {isStaff
                ? "You should use Ops for staff actions"
                : "Only your tickets are shown"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ticketsLoading && (
              <div className="text-sm text-muted-foreground">Loading tickets...</div>
            )}

            {!ticketsLoading && (tickets || []).length === 0 && (
              <div className="text-sm text-muted-foreground">No tickets yet.</div>
            )}

            <div className="space-y-3">
              {(tickets || []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-md border bg-white p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t.status}</Badge>
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {t.subject}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                      {t.appId ? ` • App ${t.appId}` : ""}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleView(t)}>
                      View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleCopy(t)}>
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(t)}>
                      {t.status === "closed" ? "Reopen" : "Close"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeTicket?.subject || "Ticket"}</DialogTitle>
            <DialogDescription>
              {activeTicket ? `Status: ${activeTicket.status} • Ticket: ${activeTicket.id}` : ""}
            </DialogDescription>
          </DialogHeader>

          {activeTicket && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {activeTicket.appId ? `App: ${activeTicket.appId}` : "General support"}
              </div>

              <ScrollArea className="h-[320px] rounded-md border bg-slate-50 p-3">
                <pre className="whitespace-pre-wrap text-sm text-slate-800">
                  {activeTicket.message}
                </pre>
              </ScrollArea>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => handleCopy(activeTicket)}>
                  Copy
                </Button>
                <Button variant="outline" onClick={() => handleToggleStatus(activeTicket)}>
                  {activeTicket.status === "closed" ? "Reopen" : "Close"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
            <DialogDescription>Send a message to support (authenticated)</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">Optional: App ID</div>
            <Input
              value={newAppId}
              onChange={(e) => setNewAppId(e.target.value)}
              placeholder="e.g. 4f7b7b0c-..."
            />

            <div className="text-xs text-muted-foreground">Subject</div>
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="What do you need help with?"
            />

            <div className="text-xs text-muted-foreground">Message</div>
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Describe the issue..."
              rows={6}
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newSubject.trim() || !newMessage.trim()}>
                Create ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
