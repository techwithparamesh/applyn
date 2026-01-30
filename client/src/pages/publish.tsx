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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AppBuilderStepper } from "@/components/app-builder-stepper";
import { PageLoading, PageState } from "@/components/page-state";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { PlaySetupWizard } from "@/components/play-setup-wizard";

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

async function fetchMe(): Promise<{ id: string; role: string } | null> {
  const res = await fetch("/api/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

async function fetchPreflight(id: string): Promise<any> {
  const res = await fetch(`/api/apps/${id}/publish/preflight`, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || `Failed to run preflight (${res.status})`);
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

  const meQuery = useQuery<{ id: string; role: string } | null>({
    queryKey: ["me"],
    queryFn: fetchMe,
  });
  const isStaff = meQuery.data?.role === "admin" || meQuery.data?.role === "support";

  const preflightQuery = useQuery({
    queryKey: ["publish-preflight", id],
    queryFn: () => fetchPreflight(id),
    enabled: !!id,
  });

  const publishingModule = useMemo(() => findPublishingModule(app?.modules), [app?.modules]);
  const initialConfig = useMemo(() => computeChecklist(publishingModule), [publishingModule]);

  const [publishingMode, setPublishingMode] = useState<"central" | "user">("central");
  useEffect(() => {
    const mode = (app as any)?.playPublishingMode === "user" ? "user" : "central";
    setPublishingMode(mode);
  }, [app]);

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

  const modeMutation = useMutation({
    mutationFn: async (mode: "central" | "user") => {
      if (!app) throw new Error("App not loaded");
      return patchApp(app.id, { playPublishingMode: mode } as any);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["app", id] });
      await qc.invalidateQueries({ queryKey: ["publish-preflight", id] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err?.message || "Please try again", variant: "destructive" });
    },
  });

  const publishInternalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/apps/${id}/publish/play/internal`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || data?.details || `Publish failed (${res.status})`);
      return data;
    },
    onSuccess: async (data: any) => {
      await qc.invalidateQueries({ queryKey: ["app", id] });
      toast({ title: "Published (Internal testing)", description: data?.testingUrl ? "Tester link created." : "Done." });
    },
    onError: (err: any) =>
      toast({ title: "Publish failed", description: err?.message || "Please try again", variant: "destructive" }),
  });

  const requestProdMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/apps/${id}/request-production`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["app", id] });
      toast({ title: "Requested", description: "Production approval request sent." });
    },
    onError: (err: any) =>
      toast({ title: "Request failed", description: err?.message || "Please try again", variant: "destructive" }),
  });

  const publishProdMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/apps/${id}/publish/play/production`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || data?.details || `Publish failed (${res.status})`);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["app", id] });
      await qc.invalidateQueries({ queryKey: ["publish-preflight", id] });
      toast({ title: "Published", description: "Production release submitted to Play." });
    },
    onError: (err: any) =>
      toast({ title: "Publish blocked", description: err?.message || "Please try again", variant: "destructive" }),
  });

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

        {appQuery.isLoading || appQuery.isError || !app ? null : (
          <div className="space-y-6 mb-6">
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Publishing Mode</CardTitle>
                <CardDescription>
                  Choose how publishing is authorized. Platform-managed requires admin approval for production.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={publishingMode}
                  onValueChange={(v) => {
                    const next = v === "user" ? "user" : "central";
                    setPublishingMode(next);
                    modeMutation.mutate(next);
                  }}
                  className="grid gap-3"
                >
                  <div className="flex items-start gap-3 rounded-lg border border-white/10 p-3">
                    <RadioGroupItem value="central" id="mode-central" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="mode-central" className="text-white">
                        Managed by Platform (approval required)
                      </Label>
                      <div className="text-sm text-muted-foreground">Central service account publishes after staff approval.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-white/10 p-3">
                    <RadioGroupItem value="user" id="mode-user" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="mode-user" className="text-white">Connect Your Play Account (recommended)</Label>
                      <div className="text-sm text-muted-foreground">OAuth-based publishing on behalf of your account.</div>
                    </div>
                  </div>
                </RadioGroup>

                <div className="mt-3 text-sm text-muted-foreground">
                  Current approval status: <span className="text-white">{(app as any).playProductionStatus || "none"}</span>
                </div>
              </CardContent>
            </Card>

            {publishingMode === "user" ? <PlaySetupWizard appId={id} /> : null}

            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Pre-Publish Checks</CardTitle>
                <CardDescription>Validation + policy scan runs on the server.</CardDescription>
              </CardHeader>
              <CardContent>
                {preflightQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Running checks…</div>
                ) : preflightQuery.isError ? (
                  <div className="text-sm text-red-300">{(preflightQuery.error as any)?.message || "Failed to run checks"}</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">Validation</div>
                      {preflightQuery.data?.validation?.isValid ? (
                        <Badge className="bg-emerald-500/20 text-emerald-200">Pass</Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-200">Fail</Badge>
                      )}
                    </div>

                    {Array.isArray(preflightQuery.data?.validation?.errors) && preflightQuery.data.validation.errors.length ? (
                      <div className="text-sm text-red-300">
                        <div className="font-medium text-white mb-1">Errors</div>
                        <ul className="list-disc pl-5 space-y-1">
                          {preflightQuery.data.validation.errors.map((e: string, idx: number) => (
                            <li key={idx}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {Array.isArray(preflightQuery.data?.validation?.warnings) && preflightQuery.data.validation.warnings.length ? (
                      <div className="text-sm text-amber-200">
                        <div className="font-medium text-white mb-1">Warnings</div>
                        <ul className="list-disc pl-5 space-y-1">
                          {preflightQuery.data.validation.warnings.map((w: string, idx: number) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">Policy Risk</div>
                      <Badge variant="secondary">{Math.round((preflightQuery.data?.policy?.riskScore || 0) * 100)}%</Badge>
                    </div>
                    {preflightQuery.data?.policyBlocked ? (
                      <div className="text-sm text-red-300">
                        {isStaff
                          ? "Policy risk is high, but staff can still publish."
                          : "Policy risk too high; production publish is blocked."}
                      </div>
                    ) : null}

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="border-white/10"
                        onClick={() => void publishInternalMutation.mutateAsync()}
                        disabled={publishInternalMutation.isPending}
                      >
                        {publishInternalMutation.isPending ? "Publishing…" : "Publish Internal"}
                      </Button>

                      {publishingMode === "central" ? (
                        <Button
                          variant="outline"
                          className="border-white/10"
                          onClick={() => void requestProdMutation.mutateAsync()}
                          disabled={requestProdMutation.isPending}
                        >
                          {requestProdMutation.isPending ? "Requesting…" : "Request Production Approval"}
                        </Button>
                      ) : null}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            disabled={
                              publishProdMutation.isPending ||
                              (!isStaff && !!preflightQuery.data?.policyBlocked) ||
                              !preflightQuery.data?.validation?.isValid
                            }
                          >
                            Publish Production
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Publish to Google Play Production?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will upload the latest AAB and create a production release. Make sure all store assets and compliance items are correct.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void publishProdMutation.mutateAsync()}>
                              Confirm Publish
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
