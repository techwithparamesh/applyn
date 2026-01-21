import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Globe, Palette, Smartphone, Upload, X } from "lucide-react";
import { MobilePreview } from "@/components/mobile-preview";

type AppItem = {
  id: string;
  name: string;
  url: string;
  icon: string;
  iconUrl?: string | null;
  iconColor?: string | null;
  primaryColor: string;
  platform: string;
  status: string;
};

export default function EditApp() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: app, isLoading: appLoading } = useQuery<AppItem>({
    queryKey: ["/api/apps", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/apps/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("App not found");
      return res.json();
    },
    enabled: !!me && !!params.id,
  });

  const [formData, setFormData] = useState({
    name: "",
    url: "",
    icon: "🚀",
    customLogo: null as string | null,
    iconColor: "#2563EB",
    primaryColor: "#2563EB",
  });

  useEffect(() => {
    if (!meLoading && !me) {
      setLocation(`/login?returnTo=${encodeURIComponent(`/apps/${params.id}/edit`)}`);
    }
  }, [meLoading, me, setLocation, params.id]);

  useEffect(() => {
    if (app) {
      setFormData({
        name: app.name,
        url: app.url,
        icon: app.icon,
        customLogo: app.iconUrl || null,
        iconColor: app.iconColor || app.primaryColor || "#2563EB",
        primaryColor: app.primaryColor,
      });
    }
  }, [app]);

  const updateApp = useMutation({
    mutationFn: async (data: Partial<typeof formData>) => {
      const res = await apiRequest("PATCH", `/api/apps/${params.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/apps", params.id] });
      toast({ title: "App updated", description: "Your changes have been saved." });
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) {
      toast({ title: "Name and URL are required", variant: "destructive" });
      return;
    }
    // Map customLogo to iconUrl for the API
    const apiData = {
      name: formData.name,
      url: formData.url,
      icon: formData.icon || "🚀",
      iconUrl: formData.customLogo,
      iconColor: formData.iconColor,
      primaryColor: formData.primaryColor,
    };
    updateApp.mutate(apiData);
  };

  if (meLoading || appLoading) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading...
          </div>
        </main>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-2">App not found</h2>
            <p className="text-muted-foreground mb-4">This app doesn't exist or you don't have access to it.</p>
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
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Edit App</h1>
            <p className="text-muted-foreground">Update your app settings</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  App Details
                </CardTitle>
                <CardDescription>Basic information about your app</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">App Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="My Awesome App"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="url">Website URL</Label>
                    <Input
                      id="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>App Icon</Label>
                    
                    {/* Custom Logo Upload */}
                    <div className="mb-4">
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setFormData({ ...formData, customLogo: reader.result as string, icon: "" });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="logo-upload"
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
                          formData.customLogo 
                            ? "border-primary bg-primary/5" 
                            : "border-slate-300 hover:border-primary"
                        }`}
                      >
                        {formData.customLogo ? (
                          <>
                            <img src={formData.customLogo} alt="Logo" className="h-12 w-12 object-contain rounded-lg" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Custom logo uploaded</p>
                              <p className="text-xs text-muted-foreground">Click to change</p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setFormData({ ...formData, customLogo: null, icon: "🚀" });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
                              <Upload className="h-5 w-5 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Upload custom logo</p>
                              <p className="text-xs text-muted-foreground">PNG or JPG, 512x512 recommended</p>
                            </div>
                          </>
                        )}
                      </label>
                    </div>

                    {/* Emoji Selection */}
                    <div className="flex gap-4">
                      <Input
                        value={formData.icon}
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value, customLogo: null })}
                        className="w-20 text-center text-2xl h-12"
                        maxLength={2}
                        placeholder="🚀"
                      />
                      <div className="flex gap-2 flex-wrap">
                        {["🚀", "📱", "🛍️", "🍔", "📚", "💼", "🎮", "🏠"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              // Toggle: if already selected, unselect it
                              if (formData.icon === emoji && !formData.customLogo) {
                                setFormData({ ...formData, icon: "" });
                              } else {
                                setFormData({ ...formData, icon: emoji, customLogo: null });
                              }
                            }}
                            className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                              formData.icon === emoji && !formData.customLogo
                                ? "border-primary bg-primary/10"
                                : "border-slate-200 hover:border-slate-400"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Icon Background Color</Label>
                    <p className="text-xs text-muted-foreground mb-2">This color appears behind your logo/emoji on the app icon</p>
                    <div className="flex gap-2 flex-wrap">
                      {["#2563EB", "#16A34A", "#DC2626", "#9333EA", "#EA580C", "#0891B2", "#CA8A04", "#000000", "#FFFFFF", "#1F2937"].map(
                        (color) => (
                          <div
                            key={color}
                            onClick={() => setFormData({ ...formData, iconColor: color })}
                            className={`h-10 w-10 rounded-lg cursor-pointer border-2 transition-all ${
                              formData.iconColor === color ? "border-primary scale-110 ring-2 ring-primary/50" : "border-slate-300"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        )
                      )}
                      <Input
                        type="color"
                        value={formData.iconColor}
                        onChange={(e) => setFormData({ ...formData, iconColor: e.target.value })}
                        className="h-10 w-10 p-1 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <p className="text-xs text-muted-foreground mb-2">Used for buttons, links, and accent elements in your app</p>
                    <div className="flex gap-2 flex-wrap">
                      {["#2563EB", "#16A34A", "#DC2626", "#9333EA", "#EA580C", "#0891B2", "#CA8A04", "#000000"].map(
                        (color) => (
                          <div
                            key={color}
                            onClick={() => setFormData({ ...formData, primaryColor: color })}
                            className={`h-10 w-10 rounded-full cursor-pointer border-2 transition-all ${
                              formData.primaryColor === color ? "border-slate-900 scale-110" : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        )
                      )}
                      <Input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="h-10 w-10 p-1 rounded-full cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <Button type="submit" disabled={updateApp.isPending}>
                      {updateApp.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" /> Save Changes
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setLocation("/dashboard")}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Build Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Current Status</p>
                    <p className="text-sm text-muted-foreground capitalize">{app.status}</p>
                  </div>
                  {app.status === "draft" || app.status === "failed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await apiRequest("POST", `/api/apps/${params.id}/build`);
                          queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
                          toast({ title: "Build started", description: "Your app is being built." });
                        } catch (err: any) {
                          toast({
                            title: "Build failed",
                            description: err?.message || "Please try again",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      {app.status === "failed" ? "Rebuild" : "Build Now"}
                    </Button>
                  ) : null}
                </div>
                {app.status === "live" && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ Your app is ready for download from the dashboard.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview Section */}
          <div className="flex justify-center lg:justify-start">
            <div className="sticky top-24">
              <MobilePreview
                url={formData.url}
                appName={formData.name}
                primaryColor={formData.primaryColor}
                icon={formData.customLogo || formData.icon}
              />
              <p className="text-center text-sm text-muted-foreground mt-4">Live Preview</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
