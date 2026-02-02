import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { NATIVE_ICON_IDS, NativeIcon } from "@/native/icons";

import type { App, AppModule, AppNavigation } from "@shared/schema";

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
  if (!res.ok) throw new Error(`Failed to update app (${res.status})`);
  return res.json();
}

const DEFAULT_MODULES: AppModule[] = [
  { id: "mod_webview", type: "webviewPages", name: "Webview Pages", enabled: true, config: { pages: [] } },
  { id: "mod_notifications", type: "notifications", name: "Notifications", enabled: true, config: {} },
  { id: "mod_contact", type: "contactForm", name: "Contact Form", enabled: false, config: {} },
];

const DEFAULT_NAVIGATION: AppNavigation = {
  style: "bottom-tabs",
  items: [],
};

type NavItem = NonNullable<AppNavigation["items"]>[number];

function newId(prefix: string) {
  const c: any = (globalThis as any).crypto;
  const uuid = typeof c?.randomUUID === "function" ? c.randomUUID() : null;
  return uuid ? `${prefix}_${uuid}` : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function titleCaseFromSlug(slug: string) {
  return (slug || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ensureWebviewPagesModule(modules: AppModule[]) {
  const idx = modules.findIndex((m) => m?.type === "webviewPages");
  if (idx >= 0) return modules;
  return [
    {
      id: newId("mod"),
      type: "webviewPages",
      name: "Webview Pages",
      enabled: true,
      config: { pages: [] },
    } as AppModule,
    ...modules,
  ];
}

function moduleTypeLabel(t: AppModule["type"]) {
  const map: Record<string, string> = {
    webviewPages: "Webview Pages",
    catalog: "Catalog",
    booking: "Booking",
    contactForm: "Contact Form",
    notifications: "Notifications",
  };
  return map[t] ?? titleCaseFromSlug(String(t));
}

function navKindLabel(k: NavItem["kind"]) {
  const map: Record<string, string> = { screen: "Native Screen", webview: "Webview", module: "Module" };
  return map[k] ?? String(k);
}

type SortableNavItemRowProps = {
  item: NavItem;
  screens: Array<{ id: string; name: string; icon?: string }>;
  modules: AppModule[];
  onUpdate: (id: string, patch: Partial<NavItem>) => void;
  onDelete: (id: string) => void;
};

function SortableNavItemRow({ item, screens, modules, onUpdate, onDelete }: SortableNavItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="flex-1 grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input value={item.label ?? ""} onChange={(e) => onUpdate(item.id, { label: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Icon</Label>
            <Select value={String(item.icon || "home")} onValueChange={(v) => onUpdate(item.id, { icon: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATIVE_ICON_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    <span className="inline-flex items-center gap-2">
                      <NativeIcon name={id} className="h-4 w-4 opacity-90" />
                      <span>{id}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} className="text-red-500">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={item.kind}
            onValueChange={(v) => {
              const kind = (v as NavItem["kind"]) ?? "screen";
              if (kind === "screen") {
                onUpdate(item.id, { kind, url: undefined, moduleId: undefined, screenId: screens[0]?.id });
              } else if (kind === "webview") {
                onUpdate(item.id, { kind, screenId: undefined, moduleId: undefined, url: item.url ?? "" });
              } else {
                onUpdate(item.id, { kind, screenId: undefined, url: undefined, moduleId: modules[0]?.id });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="screen">{navKindLabel("screen")}</SelectItem>
              <SelectItem value="webview">{navKindLabel("webview")}</SelectItem>
              <SelectItem value="module">{navKindLabel("module")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {item.kind === "screen" && (
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Screen</Label>
            <Select
              value={item.screenId ?? ""}
              onValueChange={(v) => onUpdate(item.id, { screenId: v })}
              disabled={screens.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={screens.length ? "Choose a screen" : "No screens found"} />
              </SelectTrigger>
              <SelectContent>
                {screens.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="inline-flex items-center gap-2">
                      <NativeIcon name={String(s.icon || "file-text")} className="h-4 w-4 opacity-90" />
                      <span>{s.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {item.kind === "webview" && (
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">URL</Label>
            <Input
              value={item.url ?? ""}
              placeholder="https://example.com/page"
              onChange={(e) => onUpdate(item.id, { url: e.target.value })}
            />
          </div>
        )}

        {item.kind === "module" && (
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Module</Label>
            <Select
              value={item.moduleId ?? ""}
              onValueChange={(v) => onUpdate(item.id, { moduleId: v })}
              disabled={modules.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={modules.length ? "Choose a module" : "No modules"} />
              </SelectTrigger>
              <SelectContent>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {moduleTypeLabel(m.type)} — {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppStructure() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

  const appQuery = useQuery({
    queryKey: ["app", id],
    queryFn: () => fetchApp(id),
    enabled: !!id,
  });

  const app = appQuery.data;

  const screensForNav = useMemo(() => {
    const raw = safeArray<any>((app as any)?.editorScreens);
    return raw
      .map((s) => ({ id: String(s?.id ?? ""), name: String(s?.name ?? ""), icon: s?.icon ? String(s.icon) : undefined }))
      .filter((s) => s.id && s.name);
  }, [app]);

  const initialModules = useMemo(() => {
    const base = (app?.modules?.length ? app.modules : DEFAULT_MODULES) as AppModule[];
    return ensureWebviewPagesModule(base);
  }, [app?.modules]);

  const [modules, setModules] = useState<AppModule[]>(initialModules);
  const [navigation, setNavigation] = useState<AppNavigation>((app?.navigation ?? DEFAULT_NAVIGATION) as AppNavigation);

  // Advanced JSON buffers
  const [modulesJson, setModulesJson] = useState<string>(JSON.stringify(initialModules, null, 2));
  const [navigationJson, setNavigationJson] = useState<string>(
    JSON.stringify((app?.navigation ?? DEFAULT_NAVIGATION) as AppNavigation, null, 2),
  );

  useEffect(() => {
    if (!app) return;
    const nextModules = ensureWebviewPagesModule((app.modules?.length ? app.modules : DEFAULT_MODULES) as AppModule[]);
    const nextNavigation = ((app.navigation ?? DEFAULT_NAVIGATION) as AppNavigation) ?? DEFAULT_NAVIGATION;
    setModules(nextModules);
    setNavigation(nextNavigation);
    setModulesJson(JSON.stringify(nextModules, null, 2));
    setNavigationJson(JSON.stringify(nextNavigation, null, 2));
  }, [app]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onNavDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setNavigation((prev) => {
      const items = safeArray<NavItem>((prev as any)?.items);
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return { ...prev, items: arrayMove(items, oldIndex, newIndex) };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      return patchApp(id, { modules, navigation } as Partial<App>);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["app", id] });
      toast({ title: "Saved", description: "Modules & navigation updated." });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>App Structure</CardTitle>
            <CardDescription>
              Configure AppyPie-style primitives: modules (capabilities) and navigation (how screens are reached).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="editor">
              <TabsList>
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="advanced">Advanced JSON</TabsTrigger>
              </TabsList>

              <TabsContent value="editor" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Modules</CardTitle>
                      <CardDescription>Enable capabilities your app can use.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">{modules.length} modules</div>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setModules((prev) =>
                              prev.concat({
                                id: newId("mod"),
                                type: "catalog",
                                name: "Catalog",
                                enabled: true,
                                config: {},
                              } as AppModule),
                            )
                          }
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add module
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {modules.map((m) => (
                          <div key={m.id} className="rounded-md border p-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{m.name}</div>
                                <div className="text-xs text-muted-foreground">{moduleTypeLabel(m.type)} • {m.id}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs">Enabled</Label>
                                  <Switch
                                    checked={m.enabled ?? true}
                                    onCheckedChange={(v) =>
                                      setModules((prev) => prev.map((x) => (x.id === m.id ? { ...x, enabled: v } : x)))
                                    }
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500"
                                  onClick={() => setModules((prev) => prev.filter((x) => x.id !== m.id))}
                                  disabled={m.type === "webviewPages"}
                                  title={m.type === "webviewPages" ? "Webview Pages is required" : "Delete module"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Name</Label>
                                <Input
                                  value={m.name}
                                  onChange={(e) =>
                                    setModules((prev) => prev.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Type</Label>
                                <Select
                                  value={m.type}
                                  onValueChange={(v) =>
                                    setModules((prev) =>
                                      prev.map((x) =>
                                        x.id === m.id
                                          ? ({
                                              ...x,
                                              type: v as any,
                                              name: x.name || moduleTypeLabel(v as any),
                                            } as AppModule)
                                          : x,
                                      ),
                                    )
                                  }
                                  disabled={m.type === "webviewPages"}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="webviewPages">{moduleTypeLabel("webviewPages")}</SelectItem>
                                    <SelectItem value="catalog">{moduleTypeLabel("catalog")}</SelectItem>
                                    <SelectItem value="booking">{moduleTypeLabel("booking")}</SelectItem>
                                    <SelectItem value="contactForm">{moduleTypeLabel("contactForm")}</SelectItem>
                                    <SelectItem value="notifications">{moduleTypeLabel("notifications")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Navigation</CardTitle>
                      <CardDescription>Define how users move between screens/webviews/modules.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Style</Label>
                          <Select
                            value={navigation.style}
                            onValueChange={(v) => setNavigation((prev) => ({ ...prev, style: v as any }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bottom-tabs">Bottom tabs</SelectItem>
                              <SelectItem value="drawer">Drawer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end justify-end">
                          <Button
                            variant="outline"
                            onClick={() => {
                              const items = safeArray<NavItem>((navigation as any).items);
                              const kind: NavItem["kind"] = screensForNav.length ? "screen" : "webview";
                              const newItem: NavItem = {
                                id: newId("nav"),
                                kind,
                                label: kind === "screen" ? "Home" : "Website",
                                icon: kind === "screen" ? "home" : "globe",
                                screenId: kind === "screen" ? screensForNav[0]?.id : undefined,
                                url: kind === "webview" ? (app?.url ?? "") : undefined,
                              };
                              setNavigation((prev) => ({ ...prev, items: items.concat(newItem) }));
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" /> Add item
                          </Button>
                        </div>
                      </div>

                      <DndContext sensors={sensors} onDragEnd={onNavDragEnd}>
                        <SortableContext
                          items={safeArray<NavItem>((navigation as any).items).map((i) => i.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-3">
                            {safeArray<NavItem>((navigation as any).items).map((it) => (
                              <SortableNavItemRow
                                key={it.id}
                                item={it}
                                screens={screensForNav}
                                modules={modules}
                                onUpdate={(navId, patch) =>
                                  setNavigation((prev) => ({
                                    ...prev,
                                    items: safeArray<NavItem>((prev as any).items).map((x) =>
                                      x.id === navId ? ({ ...x, ...patch } as NavItem) : x,
                                    ),
                                  }))
                                }
                                onDelete={(navId) =>
                                  setNavigation((prev) => ({
                                    ...prev,
                                    items: safeArray<NavItem>((prev as any).items).filter((x) => x.id !== navId),
                                  }))
                                }
                              />
                            ))}
                            {safeArray<NavItem>((navigation as any).items).length === 0 && (
                              <div className="rounded-md border p-6 text-sm text-muted-foreground text-center">
                                No navigation items yet. Add one to start.
                              </div>
                            )}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Tip: Import website links first, then wire them into navigation.
                  </div>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !id}>
                    {saveMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="modules">Modules (JSON)</Label>
                    <Textarea
                      id="modules"
                      className="min-h-[360px] font-mono text-xs"
                      value={modulesJson}
                      onChange={(e) => setModulesJson(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setModulesJson(JSON.stringify(modules, null, 2))}
                      >
                        Refresh from editor
                      </Button>
                      <Button
                        onClick={() => {
                          try {
                            const parsed = ensureWebviewPagesModule(JSON.parse(modulesJson) as AppModule[]);
                            setModules(parsed);
                            toast({ title: "Applied", description: "Modules JSON applied to editor." });
                          } catch (e: any) {
                            toast({ title: "Invalid JSON", description: e?.message ?? "Failed to parse", variant: "destructive" });
                          }
                        }}
                      >
                        Apply JSON
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="navigation">Navigation (JSON)</Label>
                    <Textarea
                      id="navigation"
                      className="min-h-[360px] font-mono text-xs"
                      value={navigationJson}
                      onChange={(e) => setNavigationJson(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setNavigationJson(JSON.stringify(navigation, null, 2))}
                      >
                        Refresh from editor
                      </Button>
                      <Button
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(navigationJson) as AppNavigation;
                            setNavigation({
                              style: (parsed as any)?.style ?? "bottom-tabs",
                              items: safeArray<NavItem>((parsed as any)?.items),
                            } as AppNavigation);
                            toast({ title: "Applied", description: "Navigation JSON applied to editor." });
                          } catch (e: any) {
                            toast({ title: "Invalid JSON", description: e?.message ?? "Failed to parse", variant: "destructive" });
                          }
                        }}
                      >
                        Apply JSON
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">Saving uses the editor state (not raw textareas).</div>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !id}>
                    {saveMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="rounded-md border p-4 space-y-3">
              <div className="text-sm font-medium">Quick actions</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Jump to import wizard</Label>
                  <Button asChild variant="outline" className="w-full">
                    <a href={`/apps/${id}/import`}>Import website links</a>
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Jump to editor</Label>
                  <Button asChild variant="outline" className="w-full">
                    <a href={`/apps/${id}/visual-editor`}>Open builder</a>
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Reset from saved</Label>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      if (!app) return;
                      const nextModules = ensureWebviewPagesModule((app.modules ?? DEFAULT_MODULES) as AppModule[]);
                      const nextNavigation = (app.navigation ?? DEFAULT_NAVIGATION) as AppNavigation;
                      setModules(nextModules);
                      setNavigation(nextNavigation);
                      setModulesJson(JSON.stringify(nextModules, null, 2));
                      setNavigationJson(JSON.stringify(nextNavigation, null, 2));
                    }}
                    disabled={!app}
                  >
                    Reset from saved
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">App Info</CardTitle>
                  <CardDescription>Read-only snapshot for context.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input value={app?.name ?? ""} readOnly />
                  </div>
                  <div className="space-y-1">
                    <Label>Industry</Label>
                    <Input value={app?.industry ?? ""} readOnly />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Validation</CardTitle>
                  <CardDescription>Lightweight checks before saving.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    - Navigation items should reference existing screen IDs or webview URLs.
                  </div>
                  <div>
                    - If the app is native-only, navigation should not rely on external http(s) URLs.
                  </div>
                  <div>
                    - Keep JSON valid (double quotes, no trailing commas).
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
