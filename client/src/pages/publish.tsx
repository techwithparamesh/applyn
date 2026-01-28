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
import { AppBuilderStepper } from "@/components/app-builder-stepper";
import { PageLoading, PageState } from "@/components/page-state";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

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

  if (!id) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-10 max-w-3xl">
          <PageState
            icon={<AlertTriangle className="h-5 w-5 text-amber-300" />}
            title="Missing app id"
            description="Open Publish Checklist from an app." 
          >
            <Link href="/dashboard">
              <Button variant="outline" className="border-white/10">Back to dashboard</Button>
            </Link>
          </PageState>
        </main>
      </div>
    );
  }

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
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Publish Checklist</h1>
            <p className="text-muted-foreground">Make the app store-ready (assets, privacy, descriptions).</p>
          </div>
          <div className="hidden md:block">
            <AppBuilderStepper appId={id} current="publish" tone="app" />
          </div>
        </div>

        <div className="md:hidden mb-6">
          <AppBuilderStepper appId={id} current="publish" tone="app" />
        </div>

        {appQuery.isLoading && (
          <div className="mt-2">
            <PageLoading label="Loading publish checklist…" />
          </div>
        )}

        {appQuery.isError && !appQuery.isLoading && (
          <PageState
            icon={<AlertTriangle className="h-5 w-5 text-red-300" />}
            title="Couldn’t load this app"
            description={(appQuery.error as any)?.message || "Please try again."}
          >
            <Button variant="outline" className="border-white/10" onClick={() => void appQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="border-white/10">
                <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
              </Button>
            </Link>
          </PageState>
        )}

        {!appQuery.isLoading && !appQuery.isError && !app && (
          <PageState
            icon={<AlertTriangle className="h-5 w-5 text-amber-300" />}
            title="App not found"
            description="This app doesn’t exist or you don’t have access."
          >
            <Link href="/dashboard">
              <Button variant="outline" className="border-white/10">
                Back to dashboard
              </Button>
            </Link>
          </PageState>
        )}

        {appQuery.isLoading || appQuery.isError || !app ? null : !publishingModule ? (
          <PageState
            icon={<AlertTriangle className="h-5 w-5 text-amber-300" />}
            title="Publish checklist not enabled"
            description='Create the app with “Publish Checklist” enabled, or add a module of type "publishing".'
          >
            <Link href={`/apps/${id}/visual-editor`}>
              <Button variant="outline" className="border-white/10">
                Open builder
              </Button>
            </Link>
            <Link href={`/apps/${id}/preview`}>
              <Button variant="outline" className="border-white/10">
                Preview
              </Button>
            </Link>
          </PageState>
        ) : (
          <>
            <Card className="glass border-white/10 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Readiness</CardTitle>
                <CardDescription>
                  Required items completed: {progress.requiredDone}/{progress.requiredTotal}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <span className="text-sm font-medium text-white">{progress.percent}%</span>
                </div>
                <Progress value={progress.percent} className="h-2" />
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 mb-6">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" className="border-white/10" onClick={() => void downloadPublishPack()}>
                Export
              </Button>
              <Link href={`/apps/${id}/preview`}>
                <Button variant="outline" className="border-white/10">
                  Preview
                </Button>
              </Link>
            </div>

            <Card className="glass border-white/10 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Required Store Assets</CardTitle>
                <CardDescription>Most app stores require these details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-white font-medium">Support email</label>
                  <Input
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="support@yourcompany.com"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white font-medium">Privacy policy URL</label>
                  <Input
                    value={privacyPolicyUrl}
                    onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                    placeholder="https://example.com/privacy"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white font-medium">Terms URL</label>
                  <Input
                    value={termsUrl}
                    onChange={(e) => setTermsUrl(e.target.value)}
                    placeholder="https://example.com/terms"
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-white/10 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Descriptions</CardTitle>
                <CardDescription>Use clear, benefit-driven copy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-white font-medium">Short description</label>
                  <Textarea
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="A short summary for the store listing"
                    className="bg-white/5 border-white/10"
                    rows={3}
                  />
                  <div className="text-xs text-muted-foreground">Minimum 10 characters (Play Store).</div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white font-medium">Full description</label>
                  <Textarea
                    value={fullDescription}
                    onChange={(e) => setFullDescription(e.target.value)}
                    placeholder="Describe features, benefits, and target users"
                    className="bg-white/5 border-white/10"
                    rows={7}
                  />
                  <div className="text-xs text-muted-foreground">Minimum 50 characters (Play Store).</div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Checklist</CardTitle>
                <CardDescription>Track what’s required before submission.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {safeArray<any>(initialConfig.checklist).map((item) => (
                    <div
                      key={item.key}
                      className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${item.done ? "bg-green-500" : "bg-white/20"}`}
                          />
                          <div className="text-sm text-white font-medium truncate">{item.label}</div>
                          {item.required ? (
                            <Badge variant="outline" className="text-[10px]">
                              Required
                            </Badge>
                          ) : null}
                        </div>
                        {item.description ? (
                          <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">{item.done ? "Done" : "Pending"}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
