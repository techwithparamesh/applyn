import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Download, RefreshCw, ExternalLink } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { DevicePreview } from "@/components/device-preview";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

type AppItem = {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  status: "draft" | "processing" | "live" | "failed" | string;
  platform: "android" | "ios" | "both" | string;
  icon: string;
  iconUrl?: string | null;
  primaryColor: string;
  splashColor?: string | null;
  packageName?: string | null;
  versionCode?: number | null;
  artifactSize?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type Me = {
  id: string;
  username: string;
  plan?: string;
};

export default function PreviewApp() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: app, isLoading: appLoading } = useQuery<AppItem | null>({
    queryKey: [`/api/apps/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me && !!id,
  });

  // Redirect to login if not authenticated
  if (!meLoading && !me) {
    setLocation(`/login?returnTo=${encodeURIComponent(`/apps/${id}/preview`)}`);
    return null;
  }

  // Loading state
  if (meLoading || appLoading) {
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

  // App not found
  if (!app) {
    return (
      <div className="min-h-screen bg-background bg-mesh-subtle">
        <Navbar />
        <main className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">App not found</h1>
          <p className="text-muted-foreground mb-6">The app you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </main>
      </div>
    );
  }

  // Determine available platforms based on user plan
  const getAvailablePlatforms = (): ("android" | "ios")[] => {
    const plan = me?.plan || "starter";
    if (plan === "pro" || plan === "enterprise") return ["android", "ios"];
    return ["android"];
  };

  // Status badge helper
  const getStatusBadge = () => {
    switch (app.status) {
      case "live":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>;
      case "processing":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Building</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Draft</Badge>;
    }
  };

  const handleDownload = (platform: string) => {
    if (platform === "ios") {
      window.location.href = `/api/apps/${app.id}/download-ios`;
    } else {
      window.location.href = `/api/apps/${app.id}/download`;
    }
  };

  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/dashboard")}
              className="text-muted-foreground hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${app.primaryColor}20` }}
              >
                {app.iconUrl ? (
                  <img src={app.iconUrl} alt={app.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  app.icon
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white">{app.name}</h1>
                  {getStatusBadge()}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {app.url}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation(`/apps/${app.id}/edit`)}
              className="border-white/20 bg-white/5 hover:bg-white/10"
            >
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
            {app.status === "live" && (
              <>
                {(app.platform === "android" || app.platform === "both") && (
                  <Button 
                    size="sm"
                    onClick={() => handleDownload("android")}
                    className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
                  >
                    <Download className="mr-2 h-4 w-4" /> APK
                  </Button>
                )}
                {(app.platform === "ios" || app.platform === "both") && (
                  <Button 
                    size="sm"
                    onClick={() => handleDownload("ios")}
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                  >
                    <Download className="mr-2 h-4 w-4" /> iOS
                  </Button>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* Preview Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col lg:flex-row gap-8 items-start"
        >
          {/* Device Preview */}
          <div className="flex-1 flex justify-center">
            <DevicePreview
              url={app.url}
              appName={app.name}
              primaryColor={app.primaryColor}
              icon={app.iconUrl || app.icon}
              availablePlatforms={getAvailablePlatforms()}
              defaultPlatform={app.platform === "ios" ? "ios" : "android"}
              showToggle={true}
            />
          </div>

          {/* App Details Sidebar */}
          <div className="w-full lg:w-80 space-y-4">
            <div className="glass rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-4">App Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="text-white capitalize">{app.platform}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-white capitalize">{app.status}</span>
                </div>
                {app.packageName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Package</span>
                    <span className="text-white text-xs truncate max-w-[150px]">{app.packageName}</span>
                  </div>
                )}
                {app.versionCode && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Version</span>
                    <span className="text-white">{app.versionCode}</span>
                  </div>
                )}
                {app.artifactSize && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Size</span>
                    <span className="text-white">{(app.artifactSize / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-white">{new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Color Info */}
            <div className="glass rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-4">Theme Colors</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Primary</span>
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-6 w-6 rounded-md border border-white/20"
                      style={{ backgroundColor: app.primaryColor }}
                    />
                    <span className="text-xs text-white font-mono">{app.primaryColor}</span>
                  </div>
                </div>
                {app.splashColor && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Splash</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-6 w-6 rounded-md border border-white/20"
                        style={{ backgroundColor: app.splashColor }}
                      />
                      <span className="text-xs text-white font-mono">{app.splashColor}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white"
                  onClick={() => setLocation(`/apps/${app.id}/edit`)}
                >
                  <Edit className="mr-2 h-4 w-4" /> Edit App Settings
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white"
                  onClick={() => setLocation(`/apps/${app.id}/push`)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Push Notifications
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-white"
                  onClick={() => window.open(app.url, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" /> Visit Website
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
