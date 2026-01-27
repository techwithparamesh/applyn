import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

import type { App, AppModule } from "@shared/schema";

async function fetchApp(id: string): Promise<App> {
  const res = await fetch(`/api/apps/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch app (${res.status})`);
  return res.json();
}

async function patchApp(id: string, patch: Partial<App>): Promise<App> {
  const res = await fetch(`/api/apps/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || `Failed to update app (${res.status})`);
  }
  return res.json();
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function findPublishingModule(modules: AppModule[] | null | undefined) {
  return safeArray<AppModule>(modules).find((m) => m?.type === "publishing");
}

function normalizeString(v: unknown) {
  return typeof v === "string" ? v : "";
}

function computeChecklist(mod: AppModule | undefined, overrides?: any) {
  const config = { ...(mod?.config || {}), ...(overrides || {}) };
  const assets = config.storeAssets || {};

  const appName = normalizeString(config.appName);
  const supportEmail = normalizeString(assets.supportEmail);
  const privacyPolicyUrl = normalizeString(assets.privacyPolicyUrl);
  const termsUrl = normalizeString(assets.termsUrl);
  const shortDescription = normalizeString(assets.shortDescription);
  const fullDescription = normalizeString(assets.fullDescription);
  const screenshots = safeArray<any>(assets.screenshots);

  const checklist = safeArray<any>(config.checklist).map((item) => {
    const key = normalizeString(item?.key);
    let done = !!item?.done;

    if (key === "identity.appName") done = !!appName;
    if (key === "legal.privacyPolicy") done = !!privacyPolicyUrl;
    if (key === "legal.terms") done = !!termsUrl;
    if (key === "store.play.shortDesc") done = shortDescription.trim().length >= 10;
    if (key === "store.play.fullDesc") done = fullDescription.trim().length >= 50;
    if (key === "store.screenshots") done = screenshots.length > 0;
    if (key === "qa.testAccount") done = true; // optional; user can track elsewhere

    return { ...item, done };
  });

  return {
    ...config,
    appName,
    storeAssets: {
      ...assets,
      supportEmail,
      privacyPolicyUrl,
      termsUrl,
      shortDescription,
      fullDescription,
      screenshots,
    },
    checklist,
  };
}

export default function Publish() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

  const appQuery = useQuery({
    queryKey: ["app", id],
    queryFn: () => fetchApp(id),
    enabled: !!id,
  });

  const app = appQuery.data;

  const publishingModule = useMemo(() => findPublishingModule(app?.modules), [app?.modules]);
  const initialConfig = useMemo(() => computeChecklist(publishingModule), [publishingModule]);

  const [supportEmail, setSupportEmail] = useState<string>("");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState<string>("");
  const [termsUrl, setTermsUrl] = useState<string>("");
  const [shortDescription, setShortDescription] = useState<string>("");
  const [fullDescription, setFullDescription] = useState<string>("");

  useEffect(() => {
    const assets = initialConfig.storeAssets || {};
    setSupportEmail(normalizeString(assets.supportEmail));
    setPrivacyPolicyUrl(normalizeString(assets.privacyPolicyUrl));
    setTermsUrl(normalizeString(assets.termsUrl));
    setShortDescription(normalizeString(assets.shortDescription));
    setFullDescription(normalizeString(assets.fullDescription));
  }, [initialConfig]);

  const progress = useMemo(() => {
    const list = safeArray<any>(initialConfig.checklist);
    const required = list.filter((x) => x?.required);
    const requiredDone = required.filter((x) => x?.done);
    const percent = required.length ? Math.round((requiredDone.length / required.length) * 100) : 0;
    return { requiredTotal: required.length, requiredDone: requiredDone.length, percent };
  }, [initialConfig]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!app) throw new Error("App not loaded");
      const modules = safeArray<AppModule>(app.modules);

      const idx = modules.findIndex((m) => m?.type === "publishing");
      if (idx < 0) throw new Error("Publish checklist module is missing for this app");

      const current = modules[idx];
      const nextConfig = computeChecklist(current, {
        storeAssets: {
          ...(current.config?.storeAssets || {}),
          supportEmail,
          privacyPolicyUrl,
          termsUrl,
          shortDescription,
          fullDescription,
        },
      });

      const nextModules = [...modules];
      nextModules[idx] = { ...current, config: nextConfig };

      return patchApp(app.id, { modules: nextModules } as Partial<App>);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["app", id] });
      toast({ title: "Saved", description: "Publish checklist updated." });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message || "Please try again", variant: "destructive" });
    },
  });

  const downloadPublishPack = async () => {
    try {
      if (!id) throw new Error("Missing app id");
      const res = await fetch(`/api/apps/${id}/publish-pack`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Failed to export (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `publish-pack-${id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message || "Please try again", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Publish Checklist</h1>
            <p className="text-muted-foreground">
              Make the app store-ready (assets, privacy, descriptions).
            </p>
          </div>
          {id && (
            <Link href={`/apps/${id}/visual-editor`}>
              <Button variant="outline" className="border-white/10">Back to editor</Button>
            </Link>
          )}
        </div>

        {!publishingModule ? (
          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Publish checklist not enabled</CardTitle>
              <CardDescription>
                Create the app from prompt with “Publish Checklist” enabled, or add a module of type "publishing".
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card className="glass border-white/10 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Readiness</CardTitle>
                <CardDescription>
                  Required items completed: {progress.requiredDone}/{progress.requiredTotal}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progress.percent} />
                <div className="flex flex-wrap gap-2">
                  <Badge variant={progress.percent === 100 ? "default" : "secondary"}>
                    {progress.percent}% ready
                  </Badge>
                  <Badge variant="outline">App: {normalizeString(app?.name)}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-white/10 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Legal & Support</CardTitle>
                <CardDescription>These are common reasons for store rejection.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm text-white">Support email</div>
                  <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@yourdomain.com" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-white">Privacy policy URL *</div>
                  <Input value={privacyPolicyUrl} onChange={(e) => setPrivacyPolicyUrl(e.target.value)} placeholder="https://yourdomain.com/privacy" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-white">Terms URL</div>
                  <Input value={termsUrl} onChange={(e) => setTermsUrl(e.target.value)} placeholder="https://yourdomain.com/terms" />
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-white/10 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Store Listing</CardTitle>
                <CardDescription>Descriptions and screenshots drive installs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm text-white">Short description *</div>
                  <Textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="A one-line pitch for your app" />
                  <div className="text-xs text-muted-foreground">Recommended: 10+ characters</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-white">Full description *</div>
                  <Textarea value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} placeholder="Explain features, benefits, and how it works" className="min-h-[140px]" />
                  <div className="text-xs text-muted-foreground">Recommended: 50+ characters</div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Save</CardTitle>
                <CardDescription>Updates are stored inside the app’s publishing module.</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save checklist"}
                </Button>
                <Button variant="outline" className="border-white/10" onClick={downloadPublishPack}>
                  Download publish pack
                </Button>
                <Link href={`/apps/${id}/preview`}>
                  <Button variant="outline" className="border-white/10">Preview app</Button>
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
