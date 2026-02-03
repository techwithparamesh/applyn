import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "wouter";

type Webhook = {
  id: string;
  appId: string;
  name: string;
  url: string;
  secret: string | null;
  events: string | null; // JSON string
  enabled: number;
  createdAt: string;
  updatedAt: string;
};

function safeJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function Integrations() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const hooksQ = useQuery<Webhook[]>({
    queryKey: ["/api/apps", id, "admin/webhooks"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [events, setEvents] = useState("order.created, customer.register");

  const createHook = useMutation({
    mutationFn: async () => {
      const parsedEvents = events
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await apiRequest("POST", `/api/apps/${id}/admin/webhooks`, {
        name,
        url,
        secret: secret || undefined,
        enabled,
        events: parsedEvents,
      });
      return res.json();
    },
    onSuccess: () => {
      setName("");
      setUrl("");
      setSecret("");
      toast({ title: "Webhook created" });
      queryClient.invalidateQueries({ queryKey: ["/api/apps", id, "admin/webhooks"] });
    },
    onError: (err: any) => toast({ title: "Create failed", description: err?.message, variant: "destructive" }),
  });

  const toggleHook = useMutation({
    mutationFn: async ({ hookId, nextEnabled }: { hookId: string; nextEnabled: boolean }) => {
      await apiRequest("PATCH", `/api/apps/${id}/admin/webhooks/${hookId}`, { enabled: nextEnabled });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/apps", id, "admin/webhooks"] }),
    onError: (err: any) => toast({ title: "Update failed", description: err?.message, variant: "destructive" }),
  });

  const testHook = useMutation({
    mutationFn: async ({ hookId }: { hookId: string }) => {
      await apiRequest("POST", `/api/apps/${id}/admin/webhooks/${hookId}/test`);
    },
    onSuccess: () => toast({ title: "Test sent", description: "Check your endpoint logs." }),
    onError: (err: any) => toast({ title: "Test failed", description: err?.message, variant: "destructive" }),
  });

  const deleteHook = useMutation({
    mutationFn: async ({ hookId }: { hookId: string }) => {
      await apiRequest("DELETE", `/api/apps/${id}/admin/webhooks/${hookId}`);
    },
    onSuccess: () => {
      toast({ title: "Webhook deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/apps", id, "admin/webhooks"] });
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
  });

  const rows = useMemo(() => hooksQ.data ?? [], [hooksQ.data]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-8 space-y-10">
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle>Integrations (Webhooks)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="font-medium">Create webhook</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300/80">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Order webhook" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300/80">URL</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300/80">Secret (optional)</Label>
                  <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="shared secret for HMAC" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300/80">Events (comma separated; empty = all)</Label>
                  <Input value={events} onChange={(e) => setEvents(e.target.value)} placeholder="order.created, customer.login" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <div className="text-sm font-medium text-slate-300/80">Enabled</div>
              </div>
              <Button onClick={() => createHook.mutate()} disabled={!name || !url || createHook.isPending}>
                Create
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="font-medium">Webhooks</div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs text-slate-300/80">Name</TableHead>
                      <TableHead className="text-xs text-slate-300/80">URL</TableHead>
                      <TableHead className="text-xs text-slate-300/80">Events</TableHead>
                      <TableHead className="text-xs text-slate-300/80">Enabled</TableHead>
                      <TableHead className="text-xs text-slate-300/80">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.name}</TableCell>
                        <TableCell className="max-w-[360px] truncate">{h.url}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-300/80">
                          {safeJsonArray(h.events).join(", ") || "(all)"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={!!h.enabled}
                            onCheckedChange={(v) => toggleHook.mutate({ hookId: h.id, nextEnabled: v })}
                          />
                        </TableCell>
                        <TableCell className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/10"
                            onClick={() => testHook.mutate({ hookId: h.id })}
                            disabled={testHook.isPending}
                          >
                            Test
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteHook.mutate({ hookId: h.id })}
                            disabled={deleteHook.isPending}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!rows.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          {hooksQ.isLoading ? "Loading…" : "No webhooks yet"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="text-xs text-muted-foreground">
                Requests are sent as JSON with headers: x-app-event, x-app-delivery-id, and optional x-app-signature (HMAC SHA-256 hex).
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
