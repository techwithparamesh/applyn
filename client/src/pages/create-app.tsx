import React, { useEffect, useState, useRef, useCallback } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MobilePreview } from "@/components/mobile-preview";
import { DevicePreview } from "@/components/device-preview";
import { ArrowRight, ArrowLeft, Loader2, Smartphone, Check, Palette, Globe, CreditCard, Upload, Image, Trash2, Sun, Moon, Sparkles, Lock, Crown, Zap, Download, X, Wand2, CheckCircle2, AlertCircle, PartyPopper } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AppNameGenerator, useAIStatus } from "@/components/ai-features";
import { Confetti, SuccessCelebration } from "@/components/ui/confetti";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const STEPS = [
  { id: 1, name: "Details", icon: Globe },
  { id: 2, name: "Customize", icon: Palette },
  { id: 3, name: "Review", icon: Smartphone },
];

// Feature access by plan - YEARLY PRICING MODEL
// Preview: FREE - Build & preview only, no download
// Starter: ₹1,999/year - Basic Android native shell
// Standard: ₹3,999/year - Smart Hybrid Native Layer with push
// Pro: ₹6,999/year - Full Android + iOS with white-label
const PLAN_FEATURES = {
  preview: {
    platforms: ["android"],
    customLogo: true,
    customColors: true,
    customSplashImage: false,
    statusBarCustomization: true,
    // Native features - basic preview
    nativeHeader: true,
    pullToRefresh: true,
    offlineScreen: false,
    smartBackButton: true,
    nativeLoadingProgress: false,
    bottomNavigation: false,
    deepLinking: false,
    customNativeMenu: false,
    // Push notifications
    pushNotifications: false,
    pushNotificationsIos: false,
    // Builds - PREVIEW ONLY, NO DOWNLOAD
    iosBuilds: false,
    aabFormat: false,
    apkFormat: false,
    playStoreReady: false,
    appStoreReady: false,
    // Branding
    whiteLabel: false,
    // Support
    rebuilds: 0,
    // Preview restrictions
    canDownload: false,
    canPublish: false,
    previewOnly: true,
  },
  starter: {
    platforms: ["android"],
    customLogo: true,
    customColors: true,
    customSplashImage: true,
    statusBarCustomization: true,
    // Native features - basic shell
    nativeHeader: true,
    pullToRefresh: true,
    offlineScreen: true,
    smartBackButton: true,
    nativeLoadingProgress: false,
    bottomNavigation: false,     // Not in Starter
    deepLinking: false,
    customNativeMenu: false,
    // Push notifications
    pushNotifications: false,    // Not in Starter
    pushNotificationsIos: false,
    // Builds
    iosBuilds: false,
    aabFormat: true,
    apkFormat: false,            // Only AAB in Starter
    playStoreReady: true,
    appStoreReady: false,
    // Branding
    whiteLabel: false,
    // Support
    rebuilds: 1,
  },
  standard: {
    platforms: ["android"],
    customLogo: true,
    customColors: true,
    customSplashImage: true,
    statusBarCustomization: true,
    // Native features - Smart Hybrid Layer
    nativeHeader: true,
    pullToRefresh: true,
    offlineScreen: true,
    smartBackButton: true,
    nativeLoadingProgress: true,
    bottomNavigation: true,      // ✓ Included
    deepLinking: true,           // ✓ Included
    customNativeMenu: false,     // Pro only
    // Push notifications
    pushNotifications: true,     // ✓ FCM
    pushNotificationsIos: false,
    // Builds
    iosBuilds: false,
    aabFormat: true,
    apkFormat: true,             // APK + AAB
    playStoreReady: true,
    appStoreReady: false,
    // Branding
    whiteLabel: false,
    // Support
    rebuilds: 2,
  },
  pro: {
    platforms: ["android", "ios", "both"],
    customLogo: true,
    customColors: true,
    customSplashImage: true,
    statusBarCustomization: true,
    // Native features - Full hybrid enhancements
    nativeHeader: true,
    pullToRefresh: true,
    offlineScreen: true,
    smartBackButton: true,
    nativeLoadingProgress: true,
    bottomNavigation: true,
    deepLinking: true,
    customNativeMenu: true,      // ✓ Custom menu
    // Push notifications
    pushNotifications: true,     // ✓ FCM
    pushNotificationsIos: true,  // ✓ APNs
    // Builds
    iosBuilds: true,
    aabFormat: true,
    apkFormat: true,
    playStoreReady: true,
    appStoreReady: true,
    // Branding
    whiteLabel: true,
    // Support
    rebuilds: 3,
  },
  agency: {
    platforms: ["android", "ios", "both"],
    customLogo: true,
    customColors: true,
    customSplashImage: true,
    statusBarCustomization: true,
    // Native features - Full hybrid enhancements
    nativeHeader: true,
    pullToRefresh: true,
    offlineScreen: true,
    smartBackButton: true,
    nativeLoadingProgress: true,
    bottomNavigation: true,
    deepLinking: true,
    customNativeMenu: true,
    // Push notifications
    pushNotifications: true,
    pushNotificationsIos: true,
    // Builds
    iosBuilds: true,
    aabFormat: true,
    apkFormat: true,
    playStoreReady: true,
    appStoreReady: true,
    // Branding
    whiteLabel: true,
    // Support
    rebuilds: 20,
    // Agency extras
    multiApp: true,
    teamAccess: true,
    priorityBuildQueue: true,
  },
};

const PLANS = [
  {
    id: "preview",
    name: "Preview",
    tagline: "Try Before You Buy",
    price: 0,
    originalPrice: null,
    features: [
      "Build & preview your app FREE",
      "Live preview on phone via QR",
      "Test WebView experience",
      "Basic customization",
      "Unlimited previews",
    ],
    limitations: ["No APK/AAB download", "No store publishing", "Preview only - upgrade to publish"],
    label: "Perfect for testing your website as an app",
    recommended: false,
    isPreview: true,
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "Android Play Store Ready",
    price: 1999,
    originalPrice: 2499,
    features: [
      "Android Play Store ready",
      "Signed AAB build",
      "WebView + Basic Native Shell",
      "Native header with theme color",
      "Pull-to-refresh",
      "Offline screen",
      "Smart back button handling",
      "1 rebuild per year",
      "Store compliance updates",
      "Email support (72h)",
    ],
    limitations: ["No push notifications", "No bottom navigation", "No iOS build", "No white-label"],
    label: "Entry-level Android businesses",
    recommended: false,
  },
  {
    id: "standard",
    name: "Standard",
    tagline: "Most Popular",
    price: 3999,
    originalPrice: 4999,
    features: [
      "Android APK + AAB (signed)",
      "✅ Play Store ready",
      "WebView + Smart Hybrid Native Layer",
      "Native bottom navigation",
      "Push notifications (FCM)",
      "Deep linking support",
      "Native loading progress bar",
      "2 rebuilds per year",
      "Store compliance updates",
      "Email support (48h)",
    ],
    limitations: ["No iOS build", "No white-label branding"],
    label: "Serious Android businesses",
    recommended: true,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Android + iOS",
    price: 6999,
    originalPrice: 8999,
    features: [
      "Android APK + AAB",
      "iOS IPA (App Store ready)",
      "✅ Play Store & App Store ready",
      "Full Native Hybrid Enhancements",
      "Push notifications (FCM + APNs)",
      "Custom native menu",
      "White-label branding",
      "3 rebuilds per year",
      "Store compliance updates (Android + iOS)",
      "Priority WhatsApp support",
    ],
    limitations: [],
    label: "Brands & Agencies",
    recommended: false,
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "Multi-App & Team",
    price: 19999,
    originalPrice: 24999,
    features: [
      "Everything in Pro",
      "Up to 10 apps included",
      "20 rebuilds per year",
      "Multi-app dashboard",
      "3 team member seats",
      "Priority build queue",
      "Dedicated account manager",
      "Custom integrations",
      "White-label for all apps",
      "24/7 Priority support",
    ],
    limitations: [],
    label: "Agencies & Enterprises",
    recommended: false,
    isAgency: true,
  },
];

export default function CreateApp() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  const { data: me, isLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Check if user is admin (admins get free access)
  const isAdmin = (me as any)?.role === "admin";

  // Get URL and plan from query params if provided (from home/pricing page)
  const params = new URLSearchParams(search);
  const urlFromQuery = params.get("url") || "";
  const planFromQuery = params.get("plan") || "pro";

  const [selectedPlan, setSelectedPlan] = useState<"preview" | "starter" | "standard" | "pro" | "agency">(
    ["preview", "starter", "standard", "pro", "agency"].includes(planFromQuery) ? planFromQuery as any : "pro"
  );

  // Get current plan features
  const planFeatures = PLAN_FEATURES[selectedPlan];

  const [formData, setFormData] = useState({
    url: urlFromQuery || "https://",
    appName: "My Awesome App",
    icon: "🚀",
    customLogo: null as string | null,
    iconColor: "#2563EB",
    primaryColor: "", // Empty = no custom color, show neutral
    secondaryColor: "", // Empty = no custom color
    splashBgColor: "#0a0a0a",
    statusBarStyle: "light" as "light" | "dark",
    enablePullToRefresh: true,
    enableLoadingIndicator: true,
    enableBottomNav: false, // Native bottom navigation
    enableOfflineScreen: true, // Offline fallback screen
    enableWhatsAppButton: false, // WhatsApp floating button
    whatsappNumber: "", // WhatsApp number (with country code)
    platform: "android",
  });

  // Helper to check if a feature is available in current plan
  const isFeatureAvailable = (feature: keyof typeof PLAN_FEATURES.starter) => {
    return planFeatures[feature];
  };

  // Helper to get minimum plan required for a feature
  const getMinPlanForFeature = (feature: keyof typeof PLAN_FEATURES.starter): string => {
    if (PLAN_FEATURES.starter[feature]) return "starter";
    if (PLAN_FEATURES.standard[feature]) return "standard";
    return "pro";
  };

  // Upgrade prompt handler
  const handleUpgradePrompt = (feature: string, requiredPlan: string) => {
    toast({
      title: `${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} Plan Required`,
      description: `Upgrade to ${requiredPlan} plan to unlock ${feature}.`,
      action: (
        <Button 
          size="sm" 
          onClick={() => setSelectedPlan(requiredPlan as any)}
          className="bg-gradient-to-r from-cyan-500 to-purple-500"
        >
          Upgrade
        </Button>
      ),
    });
  };

  // File input refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const splashInputRef = useRef<HTMLInputElement>(null);
  const [splashImage, setSplashImage] = useState<string | null>(null);
  
  // State for plan selection modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  
  // Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState({ title: "", message: "" });

  // AI Status check
  const { data: aiStatus } = useAIStatus();

  // Auto-analysis state - includes scraped data (logo, colors)
  const [websiteAnalysis, setWebsiteAnalysis] = useState<{
    appName: string;
    primaryColor: string;
    logoUrl?: string;
    logoSource?: string;
    colorSource?: string;
    isAppReady: boolean;
    issues: string[];
    secondaryColor?: string;
    backgroundColor?: string;
  } | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState<string>("");
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);

  // Website scraper mutation (NO LLM - fast & free)
  const scrapeWebsiteMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/scrape-website", { url });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Could not fetch website");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Build analysis object from scraped data
      const analysis = {
        appName: data.appName || "",
        primaryColor: data.colors?.primary || "",
        secondaryColor: data.colors?.secondary || "",
        backgroundColor: data.colors?.background || "",
        logoUrl: data.logo?.url || null,
        logoSource: data.logo?.source || "",
        colorSource: data.colors?.primarySource || "",
        isAppReady: !!(data.appName && (data.colors?.primary || data.logo?.url)),
        issues: [],
      };
      setWebsiteAnalysis(analysis);
      
      // Auto-apply all detected values including secondary and splash background
      setFormData(prev => ({
        ...prev,
        appName: data.appName || prev.appName,
        primaryColor: data.colors?.primary || prev.primaryColor,
        secondaryColor: data.colors?.secondary || prev.secondaryColor,
        splashBgColor: data.colors?.background || prev.splashBgColor,
        // Auto-apply logo if detected (not og-image which is usually a banner)
        customLogo: (data.logo?.url && data.logo?.source !== "og-image") ? data.logo.url : prev.customLogo,
      }));
      
      // Show success toast with what was detected
      const detected = [];
      if (data.appName) detected.push("name");
      if (data.colors?.primary || data.colors?.secondary) detected.push("colors");
      if (data.logo?.url && data.logo?.source !== "og-image") detected.push("logo");
      
      if (detected.length > 0) {
        toast({
          title: "✨ Website analyzed!",
          description: `Auto-detected: ${detected.join(", ")}`,
        });
      }
    },
    onError: () => {
      // Silent fail - website might block scraping
      setWebsiteAnalysis(null);
    },
  });

  // Debounced auto-scrape when URL changes (no AI required!)
  useEffect(() => {
    const url = formData.url;
    // Check if it's a valid URL and different from what we've analyzed
    const isValidUrl = url.length > 10 && url.includes(".") && url.startsWith("http") && !url.endsWith("https://");
    
    if (!isValidUrl || url === analyzedUrl) return;

    // Debounce: wait 1 second after user stops typing
    const timeoutId = setTimeout(() => {
      setAnalyzedUrl(url);
      scrapeWebsiteMutation.mutate(url);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [formData.url, analyzedUrl]);

  // Check if resuming after login
  const isResuming = params.get("resume") === "true";

  // Save form data to localStorage for anonymous users (only if they've made progress)
  useEffect(() => {
    if (!me && formData.url !== "https://" && formData.url.includes(".")) {
      localStorage.setItem("applyn_draft", JSON.stringify({ formData, selectedPlan, step }));
    }
  }, [formData, selectedPlan, step, me]);

  // Load draft from localStorage ONLY when resuming after login
  useEffect(() => {
    const draft = localStorage.getItem("applyn_draft");
    if (draft && isResuming) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.formData) setFormData(parsed.formData);
        if (parsed.selectedPlan) setSelectedPlan(parsed.selectedPlan);
        
        // User just logged in and is resuming - go to Review step
        if (me && parsed.step) {
          setStep(parsed.step);
          // If they were trying to download, show plan modal
          if (parsed.showPlan) {
            setTimeout(() => setShowPlanModal(true), 500);
          }
        }
      } catch (e) {
        // Invalid draft, ignore
      }
    }
    // Clear draft if not resuming (fresh start)
    if (!isResuming) {
      localStorage.removeItem("applyn_draft");
    }
  }, [me, isResuming]);

  // Clear draft after successful app creation
  const clearDraft = () => {
    localStorage.removeItem("applyn_draft");
  };

  // Load Razorpay script
  useEffect(() => {
    if (!document.getElementById("razorpay-script")) {
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  const handleNext = () => {
    if (step < 3) {
      if (step === 1 && !formData.url.includes(".")) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid website URL",
          variant: "destructive",
        });
        return;
      }
      
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep(step + 1);
      }, 500);
    } else {
      // Step 3 (Review) - Download button clicked
      handleDownload();
    }
  };

  // Handle Download button click - requires login then shows plan selection
  const handleDownload = () => {
    if (!me) {
      // Save current state before redirecting to login
      localStorage.setItem("applyn_draft", JSON.stringify({ formData, selectedPlan, step: 3, showPlan: true }));
      toast({
        title: "Almost there! 🎉",
        description: "Sign in to download your app.",
      });
      setLocation(`/login?returnTo=${encodeURIComponent("/create?resume=true")}`);
      return;
    }
    
    // User is logged in - show plan selection modal
    setShowPlanModal(true);
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Use detected color or defaults if not set
      const primaryColorToUse = formData.primaryColor || websiteAnalysis?.primaryColor || "#00E5FF";
      const secondaryColorToUse = formData.secondaryColor || "#A855F7";
      
      // First create the app
      const appRes = await apiRequest("POST", "/api/apps", {
        name: formData.appName,
        url: formData.url,
        icon: formData.icon,
        iconUrl: formData.customLogo,
        iconColor: formData.iconColor,
        primaryColor: primaryColorToUse,
        platform: formData.platform,
        plan: selectedPlan, // Include plan info
        buildNow: false, // Don't build yet, wait for payment
        features: {
          bottomNav: formData.enableBottomNav,
          pullToRefresh: formData.enablePullToRefresh,
          offlineScreen: formData.enableOfflineScreen,
          whatsappButton: formData.enableWhatsAppButton,
          whatsappNumber: formData.whatsappNumber,
        },
      });
      const app = await appRes.json();

      // FREE PREVIEW TIER - no payment required, just preview access
      if (selectedPlan === "preview") {
        clearDraft();
        await queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
        // Show celebration then redirect
        setCelebrationMessage({ 
          title: "🎉 Preview Ready!", 
          message: "Your app preview is being prepared..." 
        });
        setShowCelebration(true);
        setTimeout(() => {
          setLocation(`/preview-app?appId=${app.id}`);
        }, 2000);
        return;
      }

      // Admin bypass - skip payment and directly build
      if (isAdmin) {
        // Create a free payment record for admin
        await apiRequest("POST", "/api/payments/admin-bypass", {
          plan: selectedPlan,
          appId: app.id,
        });

        // Trigger build
        await apiRequest("POST", `/api/apps/${app.id}/build`);

        clearDraft(); // Clear saved draft after successful creation
        await queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
        // Show celebration then redirect
        setCelebrationMessage({ 
          title: "🎉 Building Started!", 
          message: "Your app is being compiled..." 
        });
        setShowCelebration(true);
        setTimeout(() => {
          setLocation("/dashboard");
        }, 2000);
        return;
      }

      // Create payment order
      const orderRes = await apiRequest("POST", "/api/payments/create-order", {
        plan: selectedPlan,
        appId: app.id,
      });
      const orderData = await orderRes.json();

      if (!orderData.orderId) {
        throw new Error("Failed to create payment order");
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Applyn",
        description: `${PLANS.find((p) => p.id === selectedPlan)?.name} - ${formData.appName}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Verify payment
            await apiRequest("POST", "/api/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              paymentId: orderData.paymentId,
            });

            // Trigger build
            await apiRequest("POST", `/api/apps/${app.id}/build`);

            clearDraft(); // Clear saved draft after successful creation
            await queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
            // Show celebration then redirect
            setCelebrationMessage({ 
              title: "🎉 Payment Successful!", 
              message: "Your app is now being built..." 
            });
            setShowCelebration(true);
            setTimeout(() => {
              setLocation("/dashboard");
            }, 2500);
          } catch (err: any) {
            toast({
              title: "Payment verification failed",
              description: err?.message || "Please contact support",
              variant: "destructive",
            });
          }
        },
        prefill: {
          email: (me as any)?.username || "",
          name: (me as any)?.name || "",
        },
        theme: {
          color: "#2563EB",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            toast({
              title: "Payment cancelled",
              description: "You can complete payment later from your dashboard.",
            });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast({
        title: "Could not initiate payment",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Progress Bar - Enhanced with percentage */}
      <div className="w-full bg-[#0d1117] border-b border-white/[0.06] sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4 sm:py-5">
          {/* Progress percentage bar - Mobile friendly */}
          <div className="max-w-md mx-auto mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-white/60">Progress</span>
              <span className="text-xs font-bold text-cyan-400">
                {Math.round((step / STEPS.length) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(step / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
          
          {/* Step indicators */}
          <div className="flex items-center justify-center max-w-2xl mx-auto">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isCompleted = s.id < step;

              return (
                <div key={s.id} className="flex items-center">
                  <div className="flex flex-col items-center relative z-10 group">
                    {/* Step circle with pulse animation when active */}
                    <div className="relative">
                      {isActive && (
                        <div className="absolute inset-0 w-11 h-11 rounded-full bg-cyan-400/20 animate-ping" />
                      )}
                      <div
                        className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                          isActive
                            ? "border-cyan-400 bg-cyan-400/10 text-cyan-400 scale-110 shadow-lg shadow-cyan-500/25"
                            : isCompleted
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-white/20 bg-transparent text-white/40"
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs font-medium mt-2 transition-colors duration-300 ${
                        isActive ? "text-cyan-400" : isCompleted ? "text-green-400" : "text-white/40"
                      }`}
                    >
                      {s.name}
                    </span>
                  </div>
                  
                  {/* Connector Line with gradient */}
                  {i !== STEPS.length - 1 && (
                    <div className="w-16 sm:w-24 md:w-32 h-[2px] mx-2 sm:mx-4 mt-[-20px]">
                      <div className={`h-full rounded-full transition-all duration-500 ${
                        s.id < step 
                          ? "bg-gradient-to-r from-green-500 to-cyan-500" 
                          : "bg-white/10"
                      }`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 sm:py-8 flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-6xl">
        {/* Left Panel: Form */}
        <div className="flex-1 order-2 lg:order-1">
          <Card className="border-white/[0.06] bg-[#0d1117] shadow-2xl h-full rounded-2xl overflow-hidden">
            <CardContent className="p-4 sm:p-6 md:p-8">
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Let's start with your website</h2>
                    <p className="text-muted-foreground mt-1">Enter the URL you want to convert.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="url" className="text-slate-300/80">Website URL</Label>
                      <Input
                        id="url"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder="https://yourwebsite.com"
                        className="h-12 text-lg bg-white/5 border-white/10 focus:border-cyan-500/50 text-white rounded-lg"
                      />
                      {/* Auto-detection status - now uses lightweight scraper (no AI required) */}
                      {formData.url.length > 10 && formData.url.includes(".") && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            {scrapeWebsiteMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                                <span className="text-muted-foreground">Detecting logo & colors...</span>
                              </>
                            ) : websiteAnalysis ? (
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                  {websiteAnalysis.isAppReady ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-amber-500" />
                                  )}
                                  <span className="text-muted-foreground">
                                    {websiteAnalysis.isAppReady 
                                      ? "Logo & colors detected" 
                                      : "Couldn't detect all branding"}
                                  </span>
                                </div>
                                {websiteAnalysis.primaryColor && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                                    <div 
                                      className="w-3 h-3 rounded-full border border-white/20" 
                                      style={{ backgroundColor: websiteAnalysis.primaryColor }}
                                    />
                                    <span className="text-xs font-medium text-slate-300/80">Color</span>
                                  </div>
                                )}
                                {websiteAnalysis.logoUrl && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                                    <Image className="w-3 h-3 text-green-400" />
                                    <span className="text-xs font-medium text-slate-300/80">Logo</span>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="appName" className="text-slate-300/80">App Name</Label>
                      <Input
                        id="appName"
                        value={formData.appName}
                        onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                        placeholder="e.g. My Shop"
                        className="h-12 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white rounded-lg"
                      />
                      {/* AI App Name Generator */}
                      <AppNameGenerator 
                        websiteUrl={formData.url}
                        description=""
                        onSelect={(name) => {
                          setFormData(prev => ({ ...prev, appName: name }));
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Customize Your App</h2>
                    <p className="text-muted-foreground mt-1">Preview your app with custom branding. Some features require higher plans.</p>
                  </div>

                  <div className="space-y-6">
                    {/* App Logo Section - Auto-detected from website */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-white font-medium flex items-center gap-2">
                          <Image className="h-4 w-4 text-cyan-400" />
                          App Icon / Logo
                        </Label>
                        {websiteAnalysis?.logoUrl && !formData.customLogo?.startsWith("data:") && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Auto-detected from {websiteAnalysis.logoSource?.replace(/-/g, ' ')}
                          </span>
                        )}
                      </div>
                      
                      {/* Custom Logo Upload - Available for preview */}
                      <div className="flex gap-4 items-start">
                        <div className="flex-1">
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Check file size (max 5MB)
                                if (file.size > 5 * 1024 * 1024) {
                                  alert("Image too large. Maximum file size is 5MB. Please compress your image or use a smaller file.");
                                  e.target.value = "";
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setFormData({ ...formData, customLogo: reader.result as string, icon: "" });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <div 
                            onClick={() => logoInputRef.current?.click()}
                            className={`h-20 rounded-xl border-2 border-dashed cursor-pointer transition-all flex items-center justify-center gap-3 ${
                              formData.customLogo 
                                ? "border-cyan-500/50 bg-cyan-500/10" 
                                : "border-white/20 bg-white/5 hover:border-cyan-500/30"
                            }`}
                          >
                            {formData.customLogo ? (
                              <div className="flex items-center gap-3">
                                <img src={formData.customLogo} alt="Logo" className="h-12 w-12 object-contain rounded-lg" />
                                <div className="text-left">
                                  <p className="text-sm text-white font-medium flex items-center gap-1">
                                    {websiteAnalysis?.logoUrl && formData.customLogo === websiteAnalysis.logoUrl ? (
                                      <>
                                        <Wand2 className="h-3 w-3 text-cyan-400" />
                                        Auto-detected logo
                                      </>
                                    ) : formData.customLogo.startsWith("data:") ? (
                                      "Custom logo uploaded"
                                    ) : (
                                      "Logo loaded"
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Click to change or upload custom</p>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFormData({ ...formData, customLogo: null, icon: "🚀" });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="text-center py-2">
                                {scrapeWebsiteMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-5 w-5 mx-auto mb-1 text-cyan-400 animate-spin" />
                                    <p className="text-sm text-muted-foreground">Detecting logo from website...</p>
                                  </>
                                ) : websiteAnalysis && !websiteAnalysis.logoUrl ? (
                                  <>
                                    <Upload className="h-5 w-5 mx-auto mb-1 text-amber-400" />
                                    <p className="text-sm text-muted-foreground">No logo detected - upload your own</p>
                                    <p className="text-xs text-muted-foreground/70">512x512 recommended, max 5MB</p>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">
                                      {formData.url === "https://" 
                                        ? "Enter website URL to auto-detect logo" 
                                        : "Upload custom logo (512x512, max 5MB)"}
                                    </p>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Emoji Icons - Always available as fallback */}
                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground mb-2">Or choose an emoji icon:</p>
                        <div className="flex gap-2 flex-wrap">
                          {["🚀", "📱", "🛍️", "🍔", "📚", "💼", "🎮", "🏠", "💎", "⚡"].map((emoji) => (
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
                              className={`w-9 h-9 text-lg rounded-lg border-2 transition-all ${
                                formData.icon === emoji && !formData.customLogo 
                                  ? "border-cyan-500/50 bg-cyan-500/10" 
                                  : "border-white/10 bg-white/5 hover:border-white/20"
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Brand Colors - Auto-detected with minimal override */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-white font-medium flex items-center gap-2">
                          <Palette className="h-4 w-4 text-cyan-400" />
                          Brand Colors
                        </Label>
                        {scrapeWebsiteMutation.isPending && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Detecting...
                          </span>
                        )}
                      </div>
                      
                      {/* Show detected color status */}
                      <div className="p-3 rounded-xl border bg-gradient-to-br from-cyan-500/5 to-purple-500/5 border-white/10">
                        {websiteAnalysis?.primaryColor ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="h-10 w-10 rounded-lg border-2 border-white/20 shadow-lg"
                                style={{ backgroundColor: formData.primaryColor || websiteAnalysis.primaryColor }}
                              />
                              <div>
                                <p className="text-sm text-white font-medium flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                                  Auto-detected from website
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formData.primaryColor || websiteAnalysis.primaryColor} 
                                  {websiteAnalysis.colorSource && (
                                    <span className="ml-1 text-cyan-400/70">
                                      (from {websiteAnalysis.colorSource.replace(/-/g, ' ')})
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {/* Custom color picker for override */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-300/80">Override:</span>
                              <Input
                                type="color"
                                value={formData.primaryColor || websiteAnalysis.primaryColor || "#00E5FF"}
                                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                className="h-8 w-8 p-1 rounded-lg cursor-pointer bg-transparent border-white/20"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div 
                                  className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center ${
                                    formData.primaryColor 
                                      ? 'border-white/20' 
                                      : 'border-dashed border-white/30 bg-gray-700'
                                  }`}
                                  style={formData.primaryColor ? { backgroundColor: formData.primaryColor } : undefined}
                                >
                                  {!formData.primaryColor && <Palette className="h-4 w-4 text-white/40" />}
                                </div>
                                <div>
                                  <p className="text-sm text-white font-medium">
                                    {formData.primaryColor ? "Custom color selected" : "No color selected"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {scrapeWebsiteMutation.isPending 
                                      ? "Detecting from website..." 
                                      : websiteAnalysis && !websiteAnalysis.primaryColor 
                                        ? "Could not detect - select manually below" 
                                        : "Select a brand color for your app header"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {formData.primaryColor && (
                                  <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, primaryColor: "" })}
                                    className="h-8 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Clear color selection"
                                  >
                                    Clear
                                  </button>
                                )}
                                <Input
                                  type="color"
                                  value={formData.primaryColor || "#3B82F6"}
                                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                  className="h-8 w-8 p-1 rounded-lg cursor-pointer bg-transparent border-white/20"
                                />
                              </div>
                            </div>
                            
                            {/* Quick color presets - show when no color or allow changing */}
                            <div className="pt-2 border-t border-white/10">
                              <p className="text-xs text-muted-foreground mb-2">
                                {formData.primaryColor ? "Change color:" : "Quick picks:"}
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                {[
                                  { color: "#B8860B", name: "Gold" },
                                  { color: "#2563EB", name: "Blue" },
                                  { color: "#10B981", name: "Green" },
                                  { color: "#8B5CF6", name: "Purple" },
                                  { color: "#F59E0B", name: "Amber" },
                                  { color: "#EF4444", name: "Red" },
                                  { color: "#06B6D4", name: "Cyan" },
                                  { color: "#EC4899", name: "Pink" },
                                ].map((preset) => (
                                  <button
                                    key={preset.color}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, primaryColor: preset.color })}
                                    className={`h-8 w-8 rounded-lg border-2 transition-all hover:scale-110 ${
                                      formData.primaryColor?.toUpperCase() === preset.color.toUpperCase() 
                                        ? "border-white scale-110 ring-2 ring-cyan-500/50" 
                                        : "border-white/20 hover:border-white/40"
                                    }`}
                                    style={{ backgroundColor: preset.color }}
                                    title={preset.name}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Splash Screen */}
                    <div className="space-y-3 p-4 rounded-xl border bg-white/5 border-white/10">
                      <Label className="text-white font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-400" />
                        Splash Screen
                      </Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Background Color</p>
                          <div className="flex gap-2 flex-wrap">
                            {["#0a0a0a", "#1a1a2e", "#16213e", "#0f3460", "#ffffff"].map((color) => (
                              <div
                                key={color}
                                onClick={() => setFormData({ ...formData, splashBgColor: color })}
                                className={`h-7 w-7 rounded-lg cursor-pointer border-2 transition-all ${
                                  formData.splashBgColor === color ? "border-cyan-500 scale-110" : "border-white/20 hover:scale-105"
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Custom Image</p>
                          <input
                            ref={splashInputRef}
                            type="file"
                            accept="image/png,image/jpeg"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Check file size (max 5MB)
                                if (file.size > 5 * 1024 * 1024) {
                                  alert("Image too large. Maximum file size is 5MB. Please compress your image or use a smaller file.");
                                  e.target.value = "";
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => setSplashImage(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => splashInputRef.current?.click()}
                            className="w-full border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            {splashImage ? "Change" : "Upload"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* App Behavior Settings */}
                    <div className="space-y-3 p-4 rounded-xl border bg-white/5 border-white/10">
                      <Label className="text-white font-medium">App Behavior</Label>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-white">Status Bar Style</p>
                            <p className="text-xs text-muted-foreground">Light or dark icons</p>
                          </div>
                          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                            <button
                              onClick={() => setFormData({ ...formData, statusBarStyle: "light" })}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                                formData.statusBarStyle === "light" ? "bg-white/10 text-white" : "text-muted-foreground"
                              }`}
                            >
                              <Sun className="h-3 w-3" /> Light
                            </button>
                            <button
                              onClick={() => setFormData({ ...formData, statusBarStyle: "dark" })}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                                formData.statusBarStyle === "dark" ? "bg-white/10 text-white" : "text-muted-foreground"
                              }`}
                            >
                              <Moon className="h-3 w-3" /> Dark
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-white">Pull to Refresh</p>
                            <p className="text-xs text-muted-foreground">Swipe down to reload</p>
                          </div>
                          <Switch 
                            checked={formData.enablePullToRefresh}
                            onCheckedChange={(checked) => setFormData({ ...formData, enablePullToRefresh: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-white">Loading Indicator</p>
                            <p className="text-xs text-muted-foreground">Show spinner</p>
                          </div>
                          <Switch 
                            checked={formData.enableLoadingIndicator}
                            onCheckedChange={(checked) => setFormData({ ...formData, enableLoadingIndicator: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-white">Offline Screen</p>
                            <p className="text-xs text-muted-foreground">Show retry when offline</p>
                          </div>
                          <Switch 
                            checked={formData.enableOfflineScreen}
                            onCheckedChange={(checked) => setFormData({ ...formData, enableOfflineScreen: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-white">Bottom Navigation</p>
                            <p className="text-xs text-muted-foreground">Home, back, forward, refresh</p>
                          </div>
                          <Switch 
                            checked={formData.enableBottomNav}
                            onCheckedChange={(checked) => setFormData({ ...formData, enableBottomNav: checked })}
                          />
                        </div>

                        {/* WhatsApp Floating Button */}
                        <div className="pt-3 border-t border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-green-500/20">
                                <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm text-white">WhatsApp Button</p>
                                <p className="text-xs text-muted-foreground">Floating chat button</p>
                              </div>
                            </div>
                            <Switch 
                              checked={formData.enableWhatsAppButton}
                              onCheckedChange={(checked) => setFormData({ ...formData, enableWhatsAppButton: checked })}
                            />
                          </div>
                          {formData.enableWhatsAppButton && (
                            <div className="mt-2">
                              <input
                                type="tel"
                                placeholder="+91 98765 43210"
                                value={formData.whatsappNumber}
                                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-green-500/50"
                              />
                              <p className="text-xs text-muted-foreground mt-1">Include country code (e.g., +91)</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Target Platform */}
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Target Platform</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: "android", label: "Android", desc: "APK & AAB", icon: "🤖" },
                          { id: "ios", label: "iOS", desc: "IPA File", icon: "🍎" },
                          { id: "both", label: "Both", desc: "Save 20%", icon: "✨" },
                        ].map((platform) => (
                          <div
                            key={platform.id}
                            onClick={() => setFormData({ ...formData, platform: platform.id })}
                            className={`border-2 rounded-xl p-3 text-center cursor-pointer transition-all ${
                              formData.platform === platform.id
                                ? "border-cyan-500/50 bg-cyan-500/10"
                                : "border-white/10 bg-white/5 hover:border-white/20"
                            }`}
                          >
                            <div className="text-xl mb-1">{platform.icon}</div>
                            <div className="font-medium text-white text-sm">{platform.label}</div>
                            <div className="text-xs text-muted-foreground">{platform.desc}</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-cyan-400/80 flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Platform availability depends on selected plan
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Download */}
              {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Review Your App</h2>
                    <p className="text-muted-foreground mt-1">Your app is ready! Review the configuration and download.</p>
                  </div>

                  <div className="space-y-4">
                    {/* Basic Information - Clean Card Design */}
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
                      <div className="px-5 py-3 border-b border-white/[0.08] flex items-center gap-2">
                        <Globe className="h-4 w-4 text-cyan-400" />
                        <h3 className="text-sm font-semibold text-cyan-400">Basic Information</h3>
                      </div>
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-300/80">Website URL:</span>
                          <span className="text-sm font-medium text-white truncate max-w-[220px]">{formData.url}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-300/80">App Name:</span>
                          <span className="text-sm font-medium text-white">{formData.appName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-300/80">App Icon:</span>
                          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                            {formData.customLogo ? (
                              <img src={formData.customLogo} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
                            ) : (
                              <span className="text-xl">{formData.icon}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-300/80">Platform:</span>
                          <span className="text-sm font-medium text-white capitalize px-3 py-1 rounded-full bg-white/5 border border-white/10">
                            {formData.platform === "both" ? "Android & iOS" : formData.platform === "android" ? "🤖 Android" : "🍎 iOS"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Branding & Colors - Clean Card Design */}
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
                      <div className="px-5 py-3 border-b border-white/[0.08] flex items-center gap-2">
                        <Palette className="h-4 w-4 text-purple-400" />
                        <h3 className="text-sm font-semibold text-purple-400">Branding & Colors</h3>
                      </div>
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-300/80">Primary Color:</span>
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg" 
                              style={{ backgroundColor: formData.primaryColor || websiteAnalysis?.primaryColor || "#00E5FF" }} 
                            />
                            <span className="font-mono text-xs text-white bg-white/5 px-2 py-1 rounded">
                              {(formData.primaryColor || websiteAnalysis?.primaryColor || "#00E5FF").toUpperCase()}
                            </span>
                            {websiteAnalysis?.primaryColor && (
                              <span className="text-xs text-cyan-400" title="Detected from your website">(from site)</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-300/80">Secondary Color:</span>
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg" 
                              style={{ backgroundColor: formData.secondaryColor || websiteAnalysis?.secondaryColor || "#A855F7" }} 
                            />
                            <span className="font-mono text-xs text-white bg-white/5 px-2 py-1 rounded">
                              {(formData.secondaryColor || websiteAnalysis?.secondaryColor || "#A855F7").toUpperCase()}
                            </span>
                            {websiteAnalysis?.secondaryColor && (
                              <span className="text-xs text-purple-400" title="Detected from your website">(from site)</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-300/80">Splash Background:</span>
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-lg border-2 border-white/20 shadow-lg" 
                              style={{ backgroundColor: formData.splashBgColor }} 
                            />
                            <span className="font-mono text-xs text-white bg-white/5 px-2 py-1 rounded">
                              {formData.splashBgColor.toUpperCase()}
                            </span>
                            {websiteAnalysis?.backgroundColor && (
                              <span className="text-xs text-green-400" title="Detected from your website">(from site)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* App Ready CTA - Premium Design */}
                    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 overflow-hidden">
                      <div className="p-6 flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                          <Smartphone className="h-7 w-7 text-cyan-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white">Your App is Ready!</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">Click download to choose your plan and get your app.</p>
                        </div>
                      </div>
                    </div>

                    {/* Starter Plan Warning Banner */}
                    {selectedPlan === "starter" && (
                      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 overflow-hidden">
                        <div className="p-5 flex items-start gap-4">
                          <div className="h-10 w-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                            <AlertCircle className="h-5 w-5 text-yellow-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-yellow-400">Preview Build Only</h4>
                            <p className="text-sm text-yellow-400/80 mt-1">
                              Starter plan builds are for preview and testing only. 
                              <strong> NOT eligible for Play Store submission.</strong>
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Upgrade to Standard (₹1,999) for a Play Store-ready build with AAB format.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                              onClick={() => setSelectedPlan("standard")}
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              Upgrade to Standard
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Build Time Notice */}
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/20">
                      <Sparkles className="h-4 w-4 text-green-400 shrink-0" />
                      <p className="text-sm text-green-400">
                        Your app will be ready to download within 10-15 minutes after selecting a plan.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-8 flex justify-between">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={step === 1}
                  className={`text-muted-foreground hover:text-white hover:bg-white/5 ${step === 1 ? "invisible" : ""}`}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button 
                  onClick={handleNext} 
                  className="min-w-[160px] bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white shadow-lg" 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {step === 3 ? (
                    <>
                      <Smartphone className="mr-2 h-4 w-4" />
                      Download App
                    </>
                  ) : (
                    <>
                      Next Step
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Live Preview */}
        <div className="flex-1 order-1 lg:order-2 flex justify-center items-center lg:items-start pt-8">
          <div className="sticky top-24">
            <DevicePreview
              url={formData.url}
              appName={formData.appName}
              primaryColor={formData.primaryColor || websiteAnalysis?.primaryColor || ""}
              icon={formData.customLogo || formData.icon}
              availablePlatforms={
                // Determine available platforms based on plan
                selectedPlan === "starter" 
                  ? ["android"] 
                  : ["android", "ios"]
              }
              defaultPlatform={formData.platform === "ios" ? "ios" : "android"}
              onPlatformChange={(platform) => {
                // Update form data when platform changes
                setFormData(prev => ({ ...prev, platform }));
              }}
              showToggle={true}
            />
          </div>
        </div>
      </main>

      {/* Plan Selection Modal */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="max-w-5xl bg-background border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-cyan-400" />
              Choose Your Plan
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select a plan to build and download your app: <span className="text-white font-medium">{formData.appName}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Admin Free Access Banner */}
          {isAdmin && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-green-400">Admin Access</p>
                  <p className="text-sm text-green-400/80">All plans are free for you!</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-5 gap-3 mt-4">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id as any)}
                className={`border-2 rounded-xl p-4 relative overflow-hidden cursor-pointer transition-all flex flex-col ${
                  selectedPlan === plan.id
                    ? "border-cyan-500/50 bg-gradient-to-br from-cyan-500/10 to-purple-500/5 shadow-lg shadow-cyan-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                } ${(plan as any).isAgency ? "border-amber-500/30" : ""} ${(plan as any).isPreview ? "border-green-500/30" : ""}`}
              >
                {plan.recommended && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-[10px] px-2 py-1 rounded-bl-xl font-semibold flex items-center gap-1">
                    <Crown className="h-3 w-3" /> BEST VALUE
                  </div>
                )}
                {(plan as any).isAgency && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] px-2 py-1 rounded-bl-xl font-semibold flex items-center gap-1">
                    <Zap className="h-3 w-3" /> AGENCY
                  </div>
                )}
                {(plan as any).isPreview && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] px-2 py-1 rounded-bl-xl font-semibold flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> FREE
                  </div>
                )}
                
                {/* Header */}
                <div className="text-center mb-3">
                  <h3 className="font-bold text-base text-white flex items-center justify-center gap-2">
                    {plan.name}
                    {selectedPlan === plan.id && <Check className="h-4 w-4 text-cyan-400" />}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.id === "preview" && "Preview only"}
                    {plan.id === "starter" && "Android only"}
                    {plan.id === "standard" && "Android + Push"}
                    {plan.id === "pro" && "Android + iOS"}
                    {plan.id === "agency" && "Multi-App & Team"}
                  </p>
                  <div className="mt-3">
                    {isAdmin ? (
                      <>
                        <span className="text-3xl font-bold text-green-400">FREE</span>
                        <p className="text-xs text-muted-foreground line-through">₹{plan.price.toLocaleString()}</p>
                      </>
                    ) : plan.price === 0 ? (
                      <>
                        <span className="text-3xl font-bold text-green-400">FREE</span>
                        <p className="text-xs text-muted-foreground">no card required</p>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-gradient">₹{plan.price.toLocaleString()}</span>
                        <p className="text-xs text-muted-foreground">per year</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Features List */}
                <div className="flex-1 space-y-2 mb-4">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-white/90">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Limitations */}
                {plan.limitations.length > 0 && (
                  <div className="space-y-1 pt-3 border-t border-white/10">
                    {plan.limitations.map((limitation) => (
                      <div key={limitation} className="flex items-start gap-2">
                        <X className="h-3 w-3 text-red-400/60 shrink-0 mt-1" />
                        <span className="text-xs text-muted-foreground">{limitation}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selection Indicator */}
                <div className={`mt-4 py-2 rounded-lg text-center text-sm font-medium transition-all ${
                  selectedPlan === plan.id 
                    ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white" 
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}>
                  {selectedPlan === plan.id ? "Selected" : "Select Plan"}
                </div>
              </div>
            ))}
          </div>

          {/* Feature Comparison Summary */}
          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              What's Included in All Plans
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-3 w-3 text-green-400" />
                <span>WebView App</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-3 w-3 text-green-400" />
                <span>Splash Screen</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-3 w-3 text-green-400" />
                <span>Loading Indicator</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-3 w-3 text-green-400" />
                <span>Lifetime Access</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowPlanModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowPlanModal(false);
                handlePayment();
              }}
              className={`flex-1 font-semibold ${
                selectedPlan === "preview" 
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400" 
                  : "bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400"
              } text-white`}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : selectedPlan === "preview" ? (
                <Sparkles className="mr-2 h-4 w-4" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isAdmin 
                ? "Build App (Free)" 
                : selectedPlan === "preview"
                ? "Start Free Preview"
                : `Pay ₹${PLANS.find((p) => p.id === selectedPlan)?.price.toLocaleString()}/year`
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Celebration Overlay */}
      <SuccessCelebration 
        show={showCelebration}
        title={celebrationMessage.title}
        message={celebrationMessage.message}
      />
    </div>
  );
}
