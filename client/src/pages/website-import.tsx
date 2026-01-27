import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type ImportLink = {
  title: string;
  url: string;
};

type ImportResponse = {
  baseUrl: string;
  links: ImportLink[];
};

async function importWebsiteLinks(url: string): Promise<ImportResponse> {
  const res = await fetch(`/api/import/website-links?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Import failed (${res.status})`);
  return res.json();
}

async function applyImport(appId: string, payload: { baseUrl: string; links: ImportLink[]; createNav: boolean }) {
  const res = await fetch(`/api/apps/${appId}/apply-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Apply failed (${res.status})`);
  return res.json();
}

export default function WebsiteImport() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [url, setUrl] = useState<string>("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [createNav, setCreateNav] = useState(true);

  const fetchMutation = useMutation({
    mutationFn: () => importWebsiteLinks(url),
    onSuccess: (data) => {
      setResult(data);
      const nextSelected: Record<string, boolean> = {};
      for (const link of data.links) nextSelected[link.url] = true;
      setSelected(nextSelected);
      toast({ title: "Imported", description: `Found ${data.links.length} links.` });
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  const chosenLinks = useMemo(() => {
    return (result?.links ?? []).filter((l) => selected[l.url]);
  }, [result, selected]);

  const applyMutation = useMutation({
    mutationFn: () => applyImport(id, { baseUrl: result!.baseUrl, links: chosenLinks, createNav }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["app", id] });
      toast({ title: "Applied", description: "Created webviews + navigation." });
    },
    onError: (err: any) => {
      toast({ title: "Apply failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Website Import</CardTitle>
            <CardDescription>
              Pull top links from a website and convert them into webview screens + optional navigation items.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor="url">Website URL</Label>
                <Input
                  id="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={() => fetchMutation.mutate()} disabled={fetchMutation.isPending || !url}>
                  {fetchMutation.isPending ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>

            {result && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Base: {result.baseUrl}</div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="createNav" className="text-sm">
                      Create navigation
                    </Label>
                    <Switch id="createNav" checked={createNav} onCheckedChange={setCreateNav} />
                  </div>
                </div>

                <div className="rounded-md border">
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 p-3 text-sm">
                    {(result.links ?? []).map((l) => (
                      <div key={l.url} className="contents">
                        <input
                          type="checkbox"
                          checked={!!selected[l.url]}
                          onChange={(e) => setSelected((s) => ({ ...s, [l.url]: e.target.checked }))}
                        />
                        <div className="truncate">
                          <div className="font-medium truncate">{l.title || l.url}</div>
                          <div className="text-muted-foreground truncate">{l.url}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">Selected: {chosenLinks.length}</div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline">
                      <a href={`/apps/${id}/structure`}>Open structure</a>
                    </Button>
                    <Button
                      onClick={() => applyMutation.mutate()}
                      disabled={applyMutation.isPending || !id || !result || chosenLinks.length === 0}
                    >
                      {applyMutation.isPending ? "Applying..." : "Apply to app"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
