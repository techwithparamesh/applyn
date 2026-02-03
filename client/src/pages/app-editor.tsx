import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { MobilePreview } from "@/components/mobile-preview";
import { 
  ArrowLeft, Loader2, Save, Globe, Palette, Smartphone, Upload, X, 
  Layout, Bell, Menu, Navigation, Wifi, MessageCircle, Share2,
  Settings, Eye, Code, Paintbrush, Layers, Plus, Trash2, GripVertical,
  ExternalLink, Check, Crown, Lock, Sparkles, FileText, Users, Image, Phone, HelpCircle,
  BarChart3, TrendingUp, Activity
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// DnD Kit for drag-drop reordering
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Screen types for navigation
type ScreenType = "webview" | "native" | "custom";
type Screen = {
  id: string;
  name: string;
  type: ScreenType;
  url?: string;
  icon?: string;
  showInNav?: boolean;
  order: number;
  nativeTemplate?: string; // For native screens: "about", "contact", "gallery", "faq", "team", "services"
  content?: any; // Content for native screens
};

// Feature configuration
type FeatureConfig = {
  bottomNav: boolean;
  pullToRefresh: boolean;
  offlineScreen: boolean;
  whatsappButton: boolean;
  whatsappNumber: string;
  pushNotifications: boolean;
  deepLinking: boolean;
  customMenu: boolean;
  nativeLoadingProgress: boolean;
  statusBarStyle: "light" | "dark";
};

// Branding configuration
type BrandingConfig = {
  name: string;
  icon: string;
  customLogo: string | null;
  iconColor: string;
  primaryColor: string;
  secondaryColor: string;
  splashBgColor: string;
  splashImage: string | null;
};

// Plan features mapping
const PLAN_FEATURES: Record<string, string[]> = {
  preview: ["pullToRefresh", "offlineScreen"],
  starter: ["pullToRefresh", "offlineScreen"],
  standard: ["pullToRefresh", "offlineScreen", "bottomNav", "deepLinking", "pushNotifications", "nativeLoadingProgress"],
  pro: ["pullToRefresh", "offlineScreen", "bottomNav", "deepLinking", "pushNotifications", "nativeLoadingProgress", "customMenu", "whatsappButton"],
  agency: ["pullToRefresh", "offlineScreen", "bottomNav", "deepLinking", "pushNotifications", "nativeLoadingProgress", "customMenu", "whatsappButton"],
};

type AppData = {
  id: string;
  name: string;
  url: string;
  icon: string;
  iconUrl?: string | null;
  iconColor?: string | null;
  isNativeOnly?: boolean | null;
  industry?: string | null;
  editorScreens?: any[] | null;
  primaryColor: string;
  platform: string;
  status: string;
  plan?: string | null;
  features?: FeatureConfig | null;
  screens?: Screen[] | null;
};

export default function AppEditor() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("branding");
  const [hasChanges, setHasChanges] = useState(false);

  // Auth check
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Fetch app data
  const { data: app, isLoading: appLoading } = useQuery<AppData>({
    queryKey: ["/api/apps", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/apps/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("App not found");
      return res.json();
    },
    enabled: !!me && !!params.id,
  });

  // State for all configurations
  const [branding, setBranding] = useState<BrandingConfig>({
    name: "",
    icon: "rocket",
    customLogo: null,
    iconColor: "#2563EB",
    primaryColor: "#2563EB",
    secondaryColor: "#A855F7",
    splashBgColor: "#0a0a0a",
    splashImage: null,
  });

  const [features, setFeatures] = useState<FeatureConfig>({
    bottomNav: false,
    pullToRefresh: true,
    offlineScreen: true,
    whatsappButton: false,
    whatsappNumber: "",
    pushNotifications: false,
    deepLinking: false,
    customMenu: false,
    nativeLoadingProgress: false,
    statusBarStyle: "light",
  });

  const [screens, setScreens] = useState<Screen[]>([
    { id: "home", name: "Home", type: "webview", url: "", icon: "🏠", showInNav: true, order: 0 },
  ]);

  // Current plan (for feature gating)
  const currentPlan = app?.plan || "preview";
  const allowedFeatures = PLAN_FEATURES[currentPlan] || PLAN_FEATURES.preview;

  // Check if feature is available in current plan
  const isFeatureAvailable = (feature: string) => allowedFeatures.includes(feature);

  // Initialize state from app data
  useEffect(() => {
    if (app) {
      setBranding({
        name: app.name,
        icon: app.icon || "rocket",
        customLogo: app.iconUrl || null,
        iconColor: app.iconColor || app.primaryColor || "#2563EB",
        primaryColor: app.primaryColor || "#2563EB",
        secondaryColor: "#A855F7",
        splashBgColor: "#0a0a0a",
        splashImage: null,
      });

      if (app.features) {
        setFeatures(prev => ({ ...prev, ...app.features }));
      }

      if (app.screens && app.screens.length > 0) {
        setScreens(app.screens);
      } else {
        // Default screen from URL
        setScreens([
          { id: "home", name: "Home", type: "webview", url: app.url, icon: "🏠", showInNav: true, order: 0 },
        ]);
      }
    }
  }, [app]);

  // Redirect if not logged in
  useEffect(() => {
    if (!meLoading && !me) {
      setLocation(`/login?returnTo=${encodeURIComponent(`/apps/${params.id}/editor`)}`);
    }
  }, [meLoading, me, setLocation, params.id]);

  // Track changes
  useEffect(() => {
    setHasChanges(true);
  }, [branding, features, screens]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: branding.name,
        icon: branding.icon,
        iconUrl: branding.customLogo,
        iconColor: branding.iconColor,
        primaryColor: branding.primaryColor,
        features: features,
        screens: screens,
      };
      const res = await apiRequest("PATCH", `/api/apps/${params.id}`, payload);
      if (!res.ok) throw new Error("Failed to save changes");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/apps", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
      setHasChanges(false);
      toast({ title: "Changes saved!", description: "Your app configuration has been updated." });
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Handle logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setBranding(prev => ({ ...prev, customLogo: event.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Native screen templates
  const NATIVE_TEMPLATES = [
    { id: "about", name: "About Us", icon: "ℹ️", description: "Company information and story", lucideIcon: FileText },
    { id: "contact", name: "Contact", icon: "📞", description: "Contact form and details", lucideIcon: Phone },
    { id: "gallery", name: "Gallery", icon: "🖼️", description: "Image gallery showcase", lucideIcon: Image },
    { id: "faq", name: "FAQ", icon: "❓", description: "Frequently asked questions", lucideIcon: HelpCircle },
    { id: "team", name: "Our Team", icon: "👥", description: "Team member profiles", lucideIcon: Users },
    { id: "services", name: "Services", icon: "⚡", description: "Services or products list", lucideIcon: Layers },
  ];

  // Sortable screen item component
  type SortableScreenItemProps = {
    screen: Screen;
    onUpdate: (id: string, updates: Partial<Screen>) => void;
    onDelete: (id: string) => void;
    canDelete: boolean;
    nativeTemplates: typeof NATIVE_TEMPLATES;
  };

  function SortableScreenItem({ screen, onUpdate, onDelete, canDelete, nativeTemplates }: SortableScreenItemProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: screen.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 1000 : 1,
    };

    const templateInfo = screen.nativeTemplate 
      ? nativeTemplates.find(t => t.id === screen.nativeTemplate) 
      : null;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`p-4 rounded-lg bg-white/5 border border-white/10 space-y-3 ${
          isDragging ? "shadow-xl ring-2 ring-cyan-400/50" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-white transition-colors"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          <span className="text-2xl">{screen.icon}</span>
          <div className="flex-1">
            <Input
              value={screen.name}
              onChange={(e) => onUpdate(screen.id, { name: e.target.value })}
              placeholder="Screen name"
              className="bg-transparent border-none text-white font-medium h-auto p-0 focus-visible:ring-0"
            />
          </div>
          <Badge 
            variant="outline" 
            className={`text-xs capitalize ${
              screen.type === "native" 
                ? "border-purple-500/50 text-purple-400" 
                : "border-cyan-500/50 text-cyan-400"
            }`}
          >
            {screen.type === "native" && templateInfo ? templateInfo.name : screen.type}
          </Badge>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(screen.id)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {screen.type === "webview" && (
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Input
              value={screen.url || ""}
              onChange={(e) => onUpdate(screen.id, { url: e.target.value })}
              placeholder="https://example.com/page"
              className="bg-white/5 border-white/10 text-sm"
            />
          </div>
        )}

        {screen.type === "native" && templateInfo && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span>{templateInfo.description}</span>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={screen.showInNav}
              onCheckedChange={(v) => onUpdate(screen.id, { showInNav: v })}
            />
            <span className="text-muted-foreground">Show in navigation</span>
          </label>
        </div>
      </div>
    );
  }

  // Template dialog state
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // Screen management with drag-drop support
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setScreens((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        // Update order values
        return reordered.map((item, index) => ({ ...item, order: index }));
      });
    }
  };

  const addScreen = (type: "webview" | "native" = "webview", template?: string) => {
    const templateData = template ? NATIVE_TEMPLATES.find(t => t.id === template) : null;
    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: templateData?.name || `Screen ${screens.length + 1}`,
      type: type,
      url: type === "webview" ? "" : undefined,
      icon: templateData?.icon || (type === "webview" ? "📄" : "⚡"),
      showInNav: true,
      order: screens.length,
      nativeTemplate: template,
    };
    setScreens([...screens, newScreen]);
    setShowTemplateDialog(false);
  };

  const updateScreen = (id: string, updates: Partial<Screen>) => {
    setScreens(screens.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteScreen = (id: string) => {
    if (screens.length <= 1) {
      toast({ title: "Cannot delete", description: "App needs at least one screen", variant: "destructive" });
      return;
    }
    setScreens(screens.filter(s => s.id !== id));
  };

  // Feature toggle with plan check
  const toggleFeature = (feature: keyof FeatureConfig, value: boolean) => {
    if (!isFeatureAvailable(feature)) {
      toast({
        title: "Upgrade Required",
        description: `This feature requires a higher plan. Upgrade to unlock.`,
        action: (
          <Button size="sm" onClick={() => setLocation("/pricing")}>
            Upgrade
          </Button>
        ),
      });
      return;
    }
    setFeatures(prev => ({ ...prev, [feature]: value }));
  };

  if (meLoading || appLoading) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center gap-2 text-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading app editor...
          </div>
        </main>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 md:px-6 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-2">App not found</h2>
            <p className="text-muted-foreground mb-4">This app doesn't exist or you don't have access.</p>
            <Button onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle">
      <Navbar />
      
      {/* Sticky Header with Save Button */}
      <div className="sticky top-16 z-40 bg-[#0d1117]/95 backdrop-blur border-b border-white/[0.06]">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  {branding.name}
                  <Badge variant="outline" className="text-xs capitalize">
                    {currentPlan}
                  </Badge>
                </h1>
                <p className="text-sm text-muted-foreground">App Settings & Branding</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setLocation(`/apps/${params.id}/visual-editor`)}
                className="border-white/[0.10] bg-white/[0.03] text-slate-100 hover:bg-white/[0.06]"
              >
                <Sparkles className="mr-2 h-4 w-4 text-cyan-300" /> Open Builder
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setLocation(`/apps/${params.id}/preview`)}
                className="border-white/10"
              >
                <Eye className="mr-2 h-4 w-4" /> Preview
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !hasChanges}
                className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Editor Panel */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-[#161b22]">
                <TabsTrigger value="branding" className="data-[state=active]:bg-cyan-500/20">
                  <Paintbrush className="mr-2 h-4 w-4" /> Branding
                </TabsTrigger>
                <TabsTrigger value="screens" className="data-[state=active]:bg-cyan-500/20">
                  <Layers className="mr-2 h-4 w-4" /> Screens
                </TabsTrigger>
                <TabsTrigger value="features" className="data-[state=active]:bg-cyan-500/20">
                  <Settings className="mr-2 h-4 w-4" /> Features
                </TabsTrigger>
              </TabsList>

              {/* BRANDING TAB */}
              <TabsContent value="branding" className="space-y-4 mt-4">
                <Card className="glass border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Globe className="h-5 w-5 text-cyan-400" />
                      App Identity
                    </CardTitle>
                    <CardDescription>Define how your app appears to users</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* App Name */}
                    <div className="space-y-2">
                      <Label className="text-slate-300/80">App Name</Label>
                      <Input
                        value={branding.name}
                        onChange={(e) => setBranding(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="My Awesome App"
                        className="bg-white/5 border-white/10"
                      />
                    </div>

                    {/* Logo Upload */}
                    <div className="space-y-2">
                      <Label className="text-slate-300/80">App Logo</Label>
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                          {branding.customLogo ? (
                            <img src={branding.customLogo} alt="Logo" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-4xl">{branding.icon}</span>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                            id="logo-upload"
                          />
                          <Label htmlFor="logo-upload" className="cursor-pointer">
                            <Button variant="outline" size="sm" className="border-white/10" asChild>
                              <span><Upload className="mr-2 h-4 w-4" /> Upload Logo</span>
                            </Button>
                          </Label>
                          {branding.customLogo && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setBranding(prev => ({ ...prev, customLogo: null }))}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-white/10" />

                    {/* Colors */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-300/80">Primary Color</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={branding.primaryColor}
                            onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                            className="h-10 w-14 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={branding.primaryColor}
                            onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                            className="bg-white/5 border-white/10 font-mono text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300/80">Secondary Color</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={branding.secondaryColor}
                            onChange={(e) => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))}
                            className="h-10 w-14 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={branding.secondaryColor}
                            onChange={(e) => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))}
                            className="bg-white/5 border-white/10 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Status Bar Style */}
                    <div className="space-y-2">
                      <Label className="text-slate-300/80">Status Bar Style</Label>
                      <Select 
                        value={features.statusBarStyle} 
                        onValueChange={(v) => setFeatures(prev => ({ ...prev, statusBarStyle: v as "light" | "dark" }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light (Dark Icons)</SelectItem>
                          <SelectItem value="dark">Dark (Light Icons)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SCREENS TAB */}
              <TabsContent value="screens" className="space-y-4 mt-4">
                <Card className="glass border-white/10">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-white">
                          <Layers className="h-5 w-5 text-cyan-400" />
                          App Screens
                        </CardTitle>
                        <CardDescription>Drag to reorder • Manage your app's pages and navigation</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => setShowTemplateDialog(true)} size="sm" variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                          <Sparkles className="mr-2 h-4 w-4" /> Add Native
                        </Button>
                        <Button onClick={() => addScreen("webview")} size="sm" variant="outline" className="border-white/10">
                          <Plus className="mr-2 h-4 w-4" /> Add WebView
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={screens.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {screens.map((screen) => (
                          <SortableScreenItem
                            key={screen.id}
                            screen={screen}
                            onUpdate={updateScreen}
                            onDelete={deleteScreen}
                            canDelete={screens.length > 1}
                            nativeTemplates={NATIVE_TEMPLATES}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>

                    {screens.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No screens yet. Add your first screen to get started.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Native Screen Template Dialog */}
                <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                  <DialogContent className="bg-[#0d1117] border-white/10">
                    <DialogHeader>
                      <DialogTitle className="text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-400" />
                        Add Native Screen
                      </DialogTitle>
                      <DialogDescription>
                        Pre-built screens that work offline and feel truly native
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 py-4">
                      {NATIVE_TEMPLATES.map((template) => {
                        const Icon = template.lucideIcon;
                        return (
                          <button
                            key={template.id}
                            onClick={() => addScreen("native", template.id)}
                            className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-left group"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-2xl">{template.icon}</span>
                              <span className="font-medium text-white group-hover:text-purple-300">{template.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{template.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Screen Analytics Card */}
                <Card className="glass border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <BarChart3 className="h-5 w-5 text-green-400" />
                      Screen Analytics
                    </CardTitle>
                    <CardDescription>See which screens users engage with most</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {screens.map((screen, index) => {
                        // Mock analytics data - will be populated by SDK reporting
                        const mockViews = Math.floor(Math.random() * 1000) + 100;
                        const mockAvgTime = Math.floor(Math.random() * 120) + 10;
                        const percentOfTotal = index === 0 ? 45 : Math.floor(Math.random() * 30) + 5;
                        
                        return (
                          <div key={screen.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span>{screen.icon}</span>
                                <span className="font-medium text-white">{screen.name}</span>
                              </div>
                              <div className="flex items-center gap-1 text-green-400 text-sm">
                                <TrendingUp className="h-3 w-3" />
                                <span>{percentOfTotal}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                              <div 
                                className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full transition-all"
                                style={{ width: `${percentOfTotal}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {mockViews.toLocaleString()} views
                              </span>
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                {mockAvgTime}s avg. time
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      
                      <div className="text-center pt-4 text-sm text-muted-foreground">
                        <p className="flex items-center justify-center gap-2">
                          <Activity className="h-4 w-4" />
                          Analytics will be populated once your app is published
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* FEATURES TAB */}
              <TabsContent value="features" className="space-y-4 mt-4">
                <Card className="glass border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Settings className="h-5 w-5 text-cyan-400" />
                      Native Features
                    </CardTitle>
                    <CardDescription>Enable native app capabilities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" className="w-full space-y-2">
                      {/* Navigation Features */}
                      <AccordionItem value="navigation" className="border-white/10">
                        <AccordionTrigger className="text-white hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Navigation className="h-4 w-4 text-cyan-400" />
                            Navigation & UI
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                          <FeatureToggle
                            label="Bottom Navigation Bar"
                            description="Native tab bar at the bottom of the screen"
                            enabled={features.bottomNav}
                            onChange={(v) => toggleFeature("bottomNav", v)}
                            available={isFeatureAvailable("bottomNav")}
                            requiredPlan="standard"
                          />
                          <FeatureToggle
                            label="Pull to Refresh"
                            description="Swipe down to reload content"
                            enabled={features.pullToRefresh}
                            onChange={(v) => toggleFeature("pullToRefresh", v)}
                            available={isFeatureAvailable("pullToRefresh")}
                          />
                          <FeatureToggle
                            label="Native Loading Progress"
                            description="Show native progress bar while loading"
                            enabled={features.nativeLoadingProgress}
                            onChange={(v) => toggleFeature("nativeLoadingProgress", v)}
                            available={isFeatureAvailable("nativeLoadingProgress")}
                            requiredPlan="standard"
                          />
                          <FeatureToggle
                            label="Custom Native Menu"
                            description="Add custom items to the native menu"
                            enabled={features.customMenu}
                            onChange={(v) => toggleFeature("customMenu", v)}
                            available={isFeatureAvailable("customMenu")}
                            requiredPlan="pro"
                          />
                        </AccordionContent>
                      </AccordionItem>

                      {/* Engagement Features */}
                      <AccordionItem value="engagement" className="border-white/10">
                        <AccordionTrigger className="text-white hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-cyan-400" />
                            User Engagement
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                          <FeatureToggle
                            label="Push Notifications"
                            description="Send notifications to users' devices"
                            enabled={features.pushNotifications}
                            onChange={(v) => toggleFeature("pushNotifications", v)}
                            available={isFeatureAvailable("pushNotifications")}
                            requiredPlan="standard"
                          />
                          <FeatureToggle
                            label="WhatsApp Button"
                            description="Floating WhatsApp chat button"
                            enabled={features.whatsappButton}
                            onChange={(v) => toggleFeature("whatsappButton", v)}
                            available={isFeatureAvailable("whatsappButton")}
                            requiredPlan="pro"
                          />
                          {features.whatsappButton && (
                            <div className="ml-6 space-y-2">
                              <Label className="text-sm font-medium text-slate-300/80">WhatsApp Number (with country code)</Label>
                              <Input
                                value={features.whatsappNumber}
                                onChange={(e) => setFeatures(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                                placeholder="+91XXXXXXXXXX"
                                className="bg-white/5 border-white/10"
                              />
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      {/* Technical Features */}
                      <AccordionItem value="technical" className="border-white/10">
                        <AccordionTrigger className="text-white hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Code className="h-4 w-4 text-cyan-400" />
                            Technical Features
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                          <FeatureToggle
                            label="Offline Screen"
                            description="Show fallback screen when offline"
                            enabled={features.offlineScreen}
                            onChange={(v) => toggleFeature("offlineScreen", v)}
                            available={isFeatureAvailable("offlineScreen")}
                          />
                          <FeatureToggle
                            label="Deep Linking"
                            description="Open specific screens via URLs"
                            enabled={features.deepLinking}
                            onChange={(v) => toggleFeature("deepLinking", v)}
                            available={isFeatureAvailable("deepLinking")}
                            requiredPlan="standard"
                          />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Live Preview Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-36">
              <Card className="glass border-white/10 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-cyan-400" />
                    Live Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex justify-center">
                  <MobilePreview
                    url={screens[0]?.url || app.url}
                    primaryColor={branding.primaryColor}
                    appName={branding.name}
                    icon={branding.customLogo || branding.icon}
                    screens={
                      app.isNativeOnly || String(app.url || "").startsWith("native://")
                        ? (app.editorScreens as any) || undefined
                        : undefined
                    }
                    industry={
                      app.isNativeOnly || String(app.url || "").startsWith("native://")
                        ? (app.industry as any) || undefined
                        : undefined
                    }
                    isNativeOnly={app.isNativeOnly || String(app.url || "").startsWith("native://")}
                  />
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="glass border-white/10 mt-4">
                <CardContent className="p-4 space-y-2">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-muted-foreground hover:text-white"
                    onClick={() => setLocation(`/apps/${params.id}/preview`)}
                  >
                    <Eye className="mr-2 h-4 w-4" /> Full Preview
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-muted-foreground hover:text-white"
                    onClick={() => setLocation(`/apps/${params.id}/push`)}
                  >
                    <Bell className="mr-2 h-4 w-4" /> Push Notifications
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-muted-foreground hover:text-white"
                    onClick={() => setLocation(`/apps/${params.id}/analytics`)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" /> Analytics
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Feature Toggle Component
function FeatureToggle({
  label,
  description,
  enabled,
  onChange,
  available,
  requiredPlan,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  available: boolean;
  requiredPlan?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-white/5">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{label}</span>
          {!available && requiredPlan && (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs capitalize border-yellow-500/50 text-yellow-400">
                  <Crown className="mr-1 h-3 w-3" />
                  {requiredPlan}+
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Requires {requiredPlan} plan or higher</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={!available}
        className={!available ? "opacity-50" : ""}
      />
    </div>
  );
}
