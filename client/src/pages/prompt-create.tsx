import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MobilePreview } from "@/components/mobile-preview";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { buildEditorScreensFromTemplate } from "@/lib/app-templates";
import { motion, AnimatePresence } from "framer-motion";
import type { AppModule } from "@shared/schema";
import {
  ArrowRight,
  Sparkles,
  Loader2,
  ShoppingCart,
  UtensilsCrossed,
  Building2,
  Heart,
  Check,
  ChevronRight,
  Rocket,
  Layout,
  Smartphone,
  Wand2,
} from "lucide-react";

// Industry templates with pre-defined features
const INDUSTRY_TEMPLATES = [
  {
    id: "ecommerce",
    name: "E-Commerce",
    icon: ShoppingCart,
    color: "from-orange-500 to-amber-500",
    description: "Online store with product catalog, cart, checkout",
    prompt: "Build an ecommerce app to sell products online with product catalog, shopping cart, secure checkout, order tracking, user accounts, admin panel, and analytics dashboard.",
    suggestedFeatures: ["bottomNav", "pushNotifications", "offlineScreen", "deepLinking"],
    screens: ["Home", "Products", "Cart", "Orders", "Account"],
  },
  {
    id: "restaurant",
    name: "Restaurant",
    icon: UtensilsCrossed,
    color: "from-red-500 to-orange-500",
    description: "Menu, ordering, reservations for food business",
    prompt: "Build a restaurant app with digital menu, online ordering, table reservation, delivery tracking, special offers, push notifications for deals, and customer loyalty program.",
    suggestedFeatures: ["bottomNav", "pushNotifications", "whatsappButton", "deepLinking"],
    screens: ["Menu", "Order", "Reservations", "Offers", "Account"],
  },
  {
    id: "realestate",
    name: "Real Estate",
    icon: Building2,
    color: "from-slate-500 to-zinc-500",
    description: "Property listings, agents for real estate",
    prompt: "Create a real estate app with property listings, search filters, virtual tours, agent profiles, mortgage calculator, saved properties, push notifications for new listings, and inquiry form.",
    suggestedFeatures: ["bottomNav", "pushNotifications", "whatsappButton", "deepLinking"],
    screens: ["Search", "Listings", "Saved", "Agents", "More"],
  },
  {
    id: "healthcare",
    name: "Healthcare",
    icon: Heart,
    color: "from-red-400 to-pink-500",
    description: "Appointments, records for clinics",
    prompt: "Build a healthcare app with doctor profiles, appointment booking, medical records, prescription history, health tips, emergency contacts, push notification reminders, and telemedicine.",
    suggestedFeatures: ["bottomNav", "pushNotifications", "deepLinking"],
    screens: ["Home", "Doctors", "Appointments", "Records", "Profile"],
  },
];

// Creation mode: website-to-app or build from scratch
type CreationMode = "website" | "scratch" | null;
type Step = "mode" | "template" | "prompt" | "generating" | "preview";

type BusinessCapabilities = {
  auth: boolean;
  payments: boolean;
  admin: boolean;
  analytics: boolean;
  notifications: boolean;
  publishingChecklist: boolean;
};

function newId(prefix: string) {
  const c: any = (globalThis as any).crypto;
  const uuid = typeof c?.randomUUID === "function" ? c.randomUUID() : null;
  return uuid ? `${prefix}_${uuid}` : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function defaultCapabilitiesForIndustry(industryId: string | undefined | null): BusinessCapabilities {
  const id = String(industryId || "").toLowerCase();
  // Baseline: every real app needs publishing readiness + basic analytics.
  const base: BusinessCapabilities = {
    auth: true,
    payments: false,
    admin: true,
    analytics: true,
    notifications: false,
    publishingChecklist: true,
  };

  // E-commerce, Store, Shop - full commerce stack
  if (id.includes("ecommerce") || id.includes("store") || id.includes("shop") || id.includes("grocery") || id.includes("retail")) {
    return { ...base, payments: true, notifications: true };
  }
  // Restaurant, Food, Cafe - orders + notifications
  if (id.includes("restaurant") || id.includes("food") || id.includes("cafe") || id.includes("delivery")) {
    return { ...base, payments: true, notifications: true };
  }
  // Salon, Spa, Beauty, Booking - appointments + payments
  if (id.includes("salon") || id.includes("spa") || id.includes("beauty") || id.includes("booking")) {
    return { ...base, payments: true, notifications: true };
  }
  // Fitness, Gym - memberships + class notifications
  if (id.includes("fitness") || id.includes("gym") || id.includes("workout") || id.includes("health")) {
    return { ...base, payments: true, notifications: true };
  }
  // Healthcare, Clinic, Medical - appointments + patient portal
  if (id.includes("healthcare") || id.includes("clinic") || id.includes("medical") || id.includes("doctor")) {
    return { ...base, payments: true, notifications: true };
  }
  // Education, School, Course - course payments + notifications
  if (id.includes("education") || id.includes("school") || id.includes("course") || id.includes("learning")) {
    return { ...base, payments: true, notifications: true };
  }
  // Church, Ministry, Nonprofit - donations
  if (id.includes("church") || id.includes("ministry") || id.includes("nonprofit") || id.includes("charity")) {
    return { ...base, payments: true, notifications: true, admin: true };
  }
  // Real Estate, Property - listings + inquiries
  if (id.includes("realestate") || id.includes("real estate") || id.includes("property")) {
    return { ...base, payments: false, notifications: true, admin: true };
  }
  // News, Blog, Magazine, Radio, Music - content + notifications
  if (id.includes("news") || id.includes("blog") || id.includes("radio") || id.includes("music") || id.includes("podcast")) {
    return { ...base, payments: false, notifications: true, admin: true };
  }
  // Photography, Portfolio - bookings
  if (id.includes("photo") || id.includes("portfolio") || id.includes("studio")) {
    return { ...base, payments: true, notifications: true };
  }
  // Business, Corporate - basic
  if (id.includes("business") || id.includes("corporate") || id.includes("company")) {
    return { ...base, payments: false, notifications: true };
  }

  return base;
}

// Get industry-specific capability descriptions
function getCapabilityDescriptions(industryId: string | undefined | null): Record<string, { title: string; description: string }> {
  const id = String(industryId || "").toLowerCase();
  
  const defaults = {
    auth: { title: "Authentication & Profiles", description: "Login, roles, member-only screens" },
    payments: { title: "Payments", description: "Checkout, subscriptions, order payments" },
    admin: { title: "Admin Panel", description: "Manage catalog, orders, users" },
    analytics: { title: "Analytics", description: "Track activation, retention, conversions" },
    notifications: { title: "Push Notifications", description: "Announcements, order updates, reminders" },
    publishingChecklist: { title: "Publish Checklist", description: "Store assets, privacy policy, screenshots" },
  };

  // E-commerce
  if (id.includes("ecommerce") || id.includes("store") || id.includes("shop") || id.includes("grocery")) {
    return {
      ...defaults,
      payments: { title: "Checkout & Payments", description: "Shopping cart, Razorpay/Stripe, order tracking" },
      admin: { title: "Product Management", description: "Inventory, orders, customer management" },
      notifications: { title: "Order Notifications", description: "Order confirmations, shipping updates, promotions" },
    };
  }
  // Fitness / Gym
  if (id.includes("fitness") || id.includes("gym") || id.includes("workout")) {
    return {
      ...defaults,
      auth: { title: "Member Profiles", description: "Membership tiers, workout history, goals" },
      payments: { title: "Membership Payments", description: "Subscriptions, class bookings, trainer fees" },
      admin: { title: "Gym Management", description: "Classes, trainers, member schedules" },
      notifications: { title: "Workout Reminders", description: "Class reminders, achievement alerts, tips" },
    };
  }
  // Restaurant / Food
  if (id.includes("restaurant") || id.includes("food") || id.includes("cafe")) {
    return {
      ...defaults,
      payments: { title: "Order Payments", description: "Table orders, delivery checkout, tips" },
      admin: { title: "Menu Management", description: "Menu items, orders, table reservations" },
      notifications: { title: "Order Updates", description: "Order ready, delivery tracking, specials" },
    };
  }
  // Salon / Spa
  if (id.includes("salon") || id.includes("spa") || id.includes("beauty")) {
    return {
      ...defaults,
      payments: { title: "Booking Payments", description: "Service deposits, full payments, packages" },
      admin: { title: "Appointment Management", description: "Staff schedules, services, clients" },
      notifications: { title: "Appointment Reminders", description: "Booking confirmations, reminders, offers" },
    };
  }
  // Education
  if (id.includes("education") || id.includes("school") || id.includes("course")) {
    return {
      ...defaults,
      auth: { title: "Student Profiles", description: "Enrollment, progress tracking, certificates" },
      payments: { title: "Course Payments", description: "Enrollment fees, subscriptions, materials" },
      admin: { title: "Course Management", description: "Lessons, students, assignments" },
      notifications: { title: "Learning Notifications", description: "New lessons, deadlines, achievements" },
    };
  }
  // Church / Nonprofit
  if (id.includes("church") || id.includes("ministry") || id.includes("nonprofit")) {
    return {
      ...defaults,
      payments: { title: "Donations & Tithes", description: "One-time & recurring giving, campaigns" },
      admin: { title: "Ministry Management", description: "Events, members, groups, volunteers" },
      notifications: { title: "Community Updates", description: "Events, sermons, prayer requests" },
    };
  }
  // Healthcare
  if (id.includes("healthcare") || id.includes("clinic") || id.includes("medical")) {
    return {
      ...defaults,
      auth: { title: "Patient Profiles", description: "Health records, appointment history" },
      payments: { title: "Billing & Payments", description: "Consultation fees, lab payments" },
      admin: { title: "Clinic Management", description: "Doctors, appointments, prescriptions" },
      notifications: { title: "Health Reminders", description: "Appointments, medication, checkups" },
    };
  }
  // Real Estate
  if (id.includes("realestate") || id.includes("property")) {
    return {
      ...defaults,
      auth: { title: "Buyer/Seller Profiles", description: "Saved properties, inquiries, alerts" },
      admin: { title: "Property Management", description: "Listings, leads, agents" },
      notifications: { title: "Property Alerts", description: "New listings, price changes, inquiries" },
    };
  }
  // News / Blog / Radio
  if (id.includes("news") || id.includes("blog") || id.includes("radio") || id.includes("podcast")) {
    return {
      ...defaults,
      auth: { title: "Subscriber Profiles", description: "Saved articles, preferences, history" },
      admin: { title: "Content Management", description: "Articles, categories, authors" },
      notifications: { title: "Breaking News", description: "New articles, live streams, updates" },
    };
  }

  return defaults;
}

function buildBusinessModules(args: {
  capabilities: BusinessCapabilities;
  appName: string;
  prompt: string;
}) {
  const { capabilities, appName, prompt } = args;

  const modules: AppModule[] = [];
  const push = (m: AppModule) => modules.push(m);

  if (capabilities.auth) {
    push({
      id: newId("mod_auth"),
      type: "auth",
      name: "Authentication",
      enabled: true,
      config: {
        providers: ["email"],
        roles: ["owner", "admin", "staff", "customer"],
      },
    });
  }

  if (capabilities.payments) {
    push({
      id: newId("mod_pay"),
      type: "payments",
      name: "Payments",
      enabled: true,
      config: {
        currency: "INR",
        providers: ["razorpay", "stripe"],
        mode: "one_time_and_subscription",
      },
    });
  }

  if (capabilities.notifications) {
    push({
      id: newId("mod_notif"),
      type: "notifications",
      name: "Notifications",
      enabled: true,
      config: {
        provider: "fcm",
        templatesEnabled: true,
      },
    });
  }

  if (capabilities.analytics) {
    push({
      id: newId("mod_analytics"),
      type: "analytics",
      name: "Analytics",
      enabled: true,
      config: {
        events: ["signup", "login", "view_screen", "add_to_cart", "checkout", "purchase"],
      },
    });
  }

  if (capabilities.admin) {
    push({
      id: newId("mod_admin"),
      type: "admin",
      name: "Admin Panel",
      enabled: true,
      config: {
        sections: ["content", "catalog", "orders", "users", "settings"],
      },
    });
  }

  if (capabilities.publishingChecklist) {
    push({
      id: newId("mod_publish"),
      type: "publishing",
      name: "Publish Checklist",
      enabled: true,
      config: {
        version: 1,
        appName,
        prompt,
        checklist: [
          { key: "identity.appName", label: "App name finalized", required: true, done: !!appName },
          { key: "identity.icon", label: "App icon uploaded", required: true, done: false },
          { key: "identity.colors", label: "Brand colors set", required: true, done: false },
          { key: "legal.privacyPolicy", label: "Privacy Policy URL", required: true, done: false },
          { key: "legal.terms", label: "Terms URL", required: false, done: false },
          { key: "store.play.shortDesc", label: "Play Store short description", required: true, done: false },
          { key: "store.play.fullDesc", label: "Play Store full description", required: true, done: false },
          { key: "store.screenshots", label: "Screenshots (all required sizes)", required: true, done: false },
          { key: "qa.testAccount", label: "Test account credentials (if login)", required: false, done: false },
        ],
        storeAssets: {
          supportEmail: "",
          privacyPolicyUrl: "",
          termsUrl: "",
          shortDescription: "",
          fullDescription: "",
          screenshots: [],
        },
      },
    });
  }

  return modules;
}

function hasBiryaniKeywords(text: string): boolean {
  const t = (text || "").toLowerCase();
  return t.includes("biryani") || t.includes("biriyani") || t.includes("biryani") || t.includes("dum biryani") || t.includes("biriyani") || t.includes("biriyani") || t.includes("biriyan") || t.includes("briyani") || t.includes("hyderabadi biryani") || t.includes("hyderabadi biriyani");
}

function hasBambooToothbrushKeywords(text: string): boolean {
  const t = (text || "").toLowerCase();
  const mentionsToothbrush = t.includes("toothbrush") || t.includes("tooth brush") || t.includes("oral care") || t.includes("dental");
  const mentionsBambooOrEco =
    t.includes("bamboo") ||
    t.includes("eco") ||
    t.includes("eco-friendly") ||
    t.includes("sustainable") ||
    t.includes("plastic-free") ||
    t.includes("zero waste") ||
    t.includes("biodegradable");
  return mentionsToothbrush && mentionsBambooOrEco;
}

export default function PromptCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [creationMode, setCreationMode] = useState<CreationMode>(null);
  const [step, setStep] = useState<Step>("mode");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof INDUSTRY_TEMPLATES[0] | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [generatedConfig, setGeneratedConfig] = useState<any>(null);
  const [businessCaps, setBusinessCaps] = useState<BusinessCapabilities>(() =>
    defaultCapabilitiesForIndustry(undefined),
  );
  const [capsSeedIndustry, setCapsSeedIndustry] = useState<string | null>(null);

  // Auth check
  const { data: me, isLoading: authLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // AI generation mutation - uses real AI when available, falls back to templates
  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const template = selectedTemplate || INDUSTRY_TEMPLATES[0];
      const lockedIndustry = selectedTemplate?.id || null;
      
      // Try to use real AI parsing
      try {
        const res = await apiRequest("POST", "/api/ai/parse-prompt", {
          prompt,
          industryHint: template.id !== "custom" ? template.id : undefined,
        });
        
        if (res.ok) {
          const aiResult = await res.json();
          return {
            appName: aiResult.appName || `My ${template.name} App`,
            description: aiResult.appDescription || prompt,
            suggestedScreens: aiResult.suggestedScreens?.map((s: any) => s.name) || template.screens || ["Home", "About", "Contact"],
            suggestedFeatures: aiResult.suggestedFeatures || template.suggestedFeatures || ["pullToRefresh", "offlineScreen"],
            primaryColor: aiResult.primaryColor || getTemplateColor(template.id),
            secondaryColor: aiResult.secondaryColor || getTemplateSecondaryColor(template.id),
            icon: aiResult.icon || getTemplateEmoji(template.id),
            // If the user explicitly chose an industry template, do NOT let AI override it.
            industry: lockedIndustry || aiResult.industry || template.id,
            fullScreens: aiResult.suggestedScreens,
            targetAudience: aiResult.targetAudience,
            monetization: aiResult.monetization,
            aiGenerated: true,
          };
        }
        // Non-OK response (like 503), fall through to template fallback
        console.log("AI service returned non-OK status, using template fallback");
      } catch (e) {
        console.log("AI parsing unavailable, using template fallback:", e);
      }
      
      // Template-based generation (no AI needed)
      const appName = generateSmartAppName(prompt, template);
      
      return {
        appName,
        description: prompt,
        suggestedScreens: template.screens.length > 0 
          ? template.screens 
          : ["Home", "About", "Contact"],
        suggestedFeatures: template.suggestedFeatures.length > 0
          ? template.suggestedFeatures
          : ["pullToRefresh", "offlineScreen"],
        primaryColor: getTemplateColor(template.id),
        secondaryColor: getTemplateSecondaryColor(template.id),
        icon: getTemplateEmoji(template.id),
        industry: lockedIndustry || template.id,
        aiGenerated: false,
      };
    },
    onSuccess: (data) => {
      const lockedIndustry = selectedTemplate?.id || null;
      const industry = String(lockedIndustry || data?.industry || "");

      setGeneratedConfig({
        ...data,
        industry,
      });
      setBusinessCaps(defaultCapabilitiesForIndustry(industry));
      setCapsSeedIndustry(industry);
      setStep("preview");
    },
    onError: (err: any) => {
      toast({
        title: "Generation failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
      setStep("prompt");
    },
  });

  // Create app mutation
  const createAppMutation = useMutation({
    mutationFn: async () => {
      if (!me) {
        throw new Error("Please sign in to create an app");
      }

      // For scratch mode, we use a placeholder URL that signals "native app"
      // For website mode, we use the actual website URL
      const appUrl = creationMode === "website" 
        ? websiteUrl 
        : "native://app"; // Special URL to indicate native-only app

      const normalizeIndustryId = (raw: string | undefined | null) => {
        if (!raw) return undefined;
        const v = String(raw).trim().toLowerCase();
        const normalized = v
          .replace(/&/g, "and")
          .replace(/\s+/g, " ")
          .replace(/[^a-z0-9 ]/g, "")
          .trim();

        // Direct template ids (only the focused set + custom)
        const known = new Set(INDUSTRY_TEMPLATES.map(t => t.id));
        if (known.has(normalized)) return normalized;

        // Common synonyms/variants from AI (restricted to supported domains)
        // Ecommerce / marketplace
        if (
          normalized.includes("ecommerce") ||
          normalized.includes("e commerce") ||
          normalized.includes("store") ||
          normalized.includes("shop") ||
          normalized.includes("market") ||
          normalized.includes("marketplace") ||
          normalized.includes("delivery")
        ) return "ecommerce";

        // Restaurant / food service
        if (normalized.includes("restaurant") || normalized.includes("cafe") || normalized.includes("menu") || normalized.includes("reservation")) return "restaurant";
        if (normalized.includes("health") || normalized.includes("clinic") || normalized.includes("medical") || normalized.includes("hospital")) return "healthcare";
        if (normalized.includes("real estate") || normalized.includes("realestate") || normalized.includes("property")) return "realestate";

        return undefined;
      };

      const industryId =
        // If a template is selected, it always wins.
        selectedTemplate?.id ||
        normalizeIndustryId(generatedConfig.industry) ||
        "ecommerce";

      const promptContext = (customPrompt || selectedTemplate?.prompt || "").trim();
      const resolvedIndustryId =
        industryId === "restaurant" && hasBiryaniKeywords(promptContext)
          ? "restaurant_biryani"
          : industryId === "ecommerce" && hasBambooToothbrushKeywords(promptContext)
            ? "ecommerce_bamboo"
          : industryId;

      const resolvedAppName = creationMode === "scratch" ? appName : generatedConfig.appName;
      const initialEditorScreens = buildEditorScreensFromTemplate(
        resolvedIndustryId,
        resolvedAppName || "My App",
        { prompt: promptContext },
      );

      const rawSuggestedFeatures: string[] = Array.isArray(generatedConfig?.suggestedFeatures)
        ? generatedConfig.suggestedFeatures
        : [];
      const featureSet = new Set(rawSuggestedFeatures);
      if (resolvedIndustryId === "ecommerce_bamboo") {
        featureSet.add("bottomNav");
        featureSet.add("offlineScreen");
        featureSet.add("deepLinking");
        featureSet.add("pushNotifications");
        featureSet.add("whatsappButton");
      }
      const finalSuggestedFeatures = Array.from(featureSet);

      const useTemplateBranding = resolvedIndustryId !== industryId;
      const finalIcon = useTemplateBranding ? getTemplateEmoji(resolvedIndustryId) : generatedConfig.icon;
      const finalPrimaryColor = useTemplateBranding ? getTemplateColor(resolvedIndustryId) : generatedConfig.primaryColor;
      const finalSecondaryColor = useTemplateBranding ? getTemplateSecondaryColor(resolvedIndustryId) : generatedConfig.secondaryColor;

      const modules = buildBusinessModules({
        capabilities: businessCaps,
        appName: resolvedAppName || generatedConfig.appName || "My App",
        prompt: promptContext,
      });

      const appData = {
        name: resolvedAppName,
        url: appUrl,
        icon: finalIcon,
        primaryColor: finalPrimaryColor,
        secondaryColor: finalSecondaryColor,
        platform: "android",
        plan: "preview",
        features: {
          bottomNav: finalSuggestedFeatures.includes("bottomNav"),
          pullToRefresh: finalSuggestedFeatures.includes("pullToRefresh"),
          offlineScreen: finalSuggestedFeatures.includes("offlineScreen"),
          whatsappButton: finalSuggestedFeatures.includes("whatsappButton"),
          whatsappNumber: "",
        },
        modules,
        // Store generated config for later use
        generatedPrompt: promptContext,
        generatedScreens: generatedConfig.suggestedScreens,
        // Flag to indicate creation mode
        isNativeOnly: creationMode === "scratch",
        // Industry template ID - used to load pre-built screens in visual editor
        industry: resolvedIndustryId,
        // Seed the visual editor with real template screens when possible
        editorScreens: initialEditorScreens,
      };

      const res = await apiRequest("POST", "/api/apps", appData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create app");
      }
      return res.json();
    },
    onSuccess: (app) => {
      queryClient.invalidateQueries({ queryKey: ["/api/apps"] });

      toast({
        title: "🎉 App created!",
        description: "Build started in background. You can track progress on the dashboard.",
      });

      // Builds are async; take the user to the dashboard where they can see status (draft/processing/live/failed)
      setLocation("/dashboard");
    },
    onError: (err: any) => {
      toast({
        title: "Creation failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleTemplateSelect = (template: typeof INDUSTRY_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    // Don't pre-fill prompt - it's optional. Let users describe their specific needs
    setCustomPrompt("");
    setStep("prompt");
  };

  const handleModeSelect = (mode: CreationMode) => {
    setCreationMode(mode);
    setStep("template");
  };

  const handleGenerate = () => {
    if (creationMode === "website") {
      // Website mode - URL is required
      if (!websiteUrl.trim() || !websiteUrl.startsWith("http")) {
        toast({
          title: "Website URL required",
          description: "Please enter your website URL to create an app",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Scratch mode - App name is required
      if (!appName.trim()) {
        toast({
          title: "App name required",
          description: "Please enter a name for your app",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Use template prompt if no custom description provided
    const promptToUse = customPrompt.trim() || selectedTemplate?.prompt || "Create a mobile app";
    
    setStep("generating");
    generateMutation.mutate(promptToUse);
  };

  const handleCreate = () => {
    if (!me) {
      // Save state and redirect to login
      localStorage.setItem("applyn_prompt_draft", JSON.stringify({
        template: selectedTemplate,
        prompt: customPrompt,
        config: generatedConfig,
        websiteUrl,
      }));
      setLocation("/login?returnTo=/prompt-create");
      return;
    }
    createAppMutation.mutate();
  };

  // Restore draft after login
  useEffect(() => {
    const draft = localStorage.getItem("applyn_prompt_draft");
    if (draft && me) {
      try {
        const parsed = JSON.parse(draft);
        setSelectedTemplate(parsed.template);
        setCustomPrompt(parsed.prompt);
        setGeneratedConfig(parsed.config);
        setWebsiteUrl(parsed.websiteUrl || "");
        if (parsed.config) {
          setStep("preview");
        }
        localStorage.removeItem("applyn_prompt_draft");
      } catch (e) {
        // Invalid draft
      }
    }
  }, [me]);

  // If a new generation produced a different industry, re-seed capability defaults.
  useEffect(() => {
    if (!generatedConfig) return;
    const next = String(generatedConfig?.industry || "");
    if (capsSeedIndustry === next) return;
    setBusinessCaps(defaultCapabilitiesForIndustry(next));
    setCapsSeedIndustry(next);
  }, [generatedConfig, capsSeedIndustry]);

  return (
    <div className="min-h-screen bg-background bg-mesh selection:bg-primary/30">
      <Navbar />

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            AI-Powered App Builder
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Create Your App<br />
            <span className="text-gradient">In Minutes</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {step === "mode" 
              ? "Choose how you want to create your app"
              : creationMode === "website"
              ? "Convert your website into a mobile app"
              : "Build a native app from scratch with our visual editor"
            }
          </p>
        </motion.div>

        {/* Progress Steps - Only show after mode selection */}
        {step !== "mode" && (
          <div className="flex items-center justify-center gap-2 mb-12">
            {["template", "prompt", "preview"].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s || (s === "generating" && step === "generating")
                    ? "bg-cyan-500 text-white"
                    : ["template", "prompt", "generating", "preview"].indexOf(step) > i
                    ? "bg-green-500 text-white"
                    : "bg-white/10 text-white/40"
                }`}>
                  {["template", "prompt", "generating", "preview"].indexOf(step) > i ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 2 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    ["template", "prompt", "generating", "preview"].indexOf(step) > i
                      ? "bg-green-500"
                      : "bg-white/10"
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 0: Mode Selection - Website or Build from Scratch */}
          {step === "mode" && (
            <motion.div
              key="mode"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              <div className="grid md:grid-cols-2 gap-6">
                {/* Option 1: I have a website */}
                <Card 
                  className="glass border-white/10 cursor-pointer transition-all hover:scale-[1.02] hover:border-cyan-500/50 group"
                  onClick={() => handleModeSelect("website")}
                >
                  <CardContent className="p-8 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Globe className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">I have a website</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Convert your existing website into a mobile app instantly
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-400 text-xs">
                        Instant Preview
                      </Badge>
                      <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-400 text-xs">
                        Auto-detect Branding
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Option 2: Build from scratch */}
                <Card 
                  className="glass border-white/10 cursor-pointer transition-all hover:scale-[1.02] hover:border-purple-500/50 group"
                  onClick={() => handleModeSelect("scratch")}
                >
                  <CardContent className="p-8 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Layout className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Build from scratch</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Create a native app using our visual drag-and-drop builder
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 text-xs">
                        Visual Builder
                      </Badge>
                      <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 text-xs">
                        Native Screens
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-8">
                Not sure? You can always add a website later or build native screens for your web app.
              </p>
            </motion.div>
          )}

          {/* Step 1: Template Selection */}
          {step === "template" && (
            <motion.div
              key="template"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Button
                variant="ghost"
                onClick={() => setStep("mode")}
                className="mb-4 text-muted-foreground"
              >
                ← Change mode
              </Button>
              <h2 className="text-2xl font-semibold text-white mb-6 text-center">
                What type of app do you want to build?
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {INDUSTRY_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <Card
                      key={template.id}
                      className={`glass border-white/10 cursor-pointer transition-all hover:scale-105 hover:border-cyan-500/50 ${
                        selectedTemplate?.id === template.id ? "border-cyan-500 bg-cyan-500/10" : ""
                      }`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center mb-3`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="font-semibold text-white text-sm mb-1">{template.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Step 2: Website URL + Prompt Input */}
          {/* Step 2: Input based on mode */}
          {step === "prompt" && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto"
            >
              <Button
                variant="ghost"
                onClick={() => setStep("template")}
                className="mb-4 text-muted-foreground"
              >
                ← Back to templates
              </Button>

              {selectedTemplate && (
                <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${selectedTemplate.color} flex items-center justify-center`}>
                    <selectedTemplate.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{selectedTemplate.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                  </div>
                </div>
              )}

              <Card className="glass border-white/10">
                <CardContent className="p-6 space-y-6">
                  {/* MODE: WEBSITE - URL is primary */}
                  {creationMode === "website" && (
                    <>
                      <div className="space-y-3">
                        <label className="text-base font-semibold text-white flex items-center gap-2">
                          <Globe className="h-5 w-5 text-cyan-400" />
                          Your Website URL
                          <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400 text-xs ml-2">Required</Badge>
                        </label>
                        <div className="relative">
                          <Input
                            value={websiteUrl}
                            onChange={(e) => setWebsiteUrl(e.target.value)}
                            placeholder="https://yourbusiness.com"
                            className="h-14 text-lg bg-white/10 border-cyan-500/30 text-white placeholder:text-muted-foreground pl-4 pr-12 focus:border-cyan-500 focus:ring-cyan-500/20"
                          />
                          {websiteUrl && websiteUrl.startsWith("http") && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Check className="h-5 w-5 text-green-400" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-cyan-400/80">
                          Enter your website URL to convert it into a mobile app
                        </p>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-gray-900 px-3 text-muted-foreground">Optional Enhancements</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-medium text-white flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-400" />
                          Additional Features
                        </label>
                        <Textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder={selectedTemplate?.prompt || "Add any specific features: push notifications, user accounts, booking system..."}
                          className="min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-muted-foreground resize-none"
                        />
                        
                        {/* AI Pre-fill Suggestions for website mode */}
                        {selectedTemplate && selectedTemplate.id !== 'custom' && !customPrompt && (
                          <div className="p-3 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg border border-purple-500/20">
                            <div className="flex items-start gap-2">
                              <Wand2 className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                              <div className="space-y-2 flex-1">
                                <p className="text-xs text-purple-300 font-medium">✨ Suggested features for {selectedTemplate.name}</p>
                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                  {selectedTemplate.prompt}
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCustomPrompt(selectedTemplate.prompt)}
                                  className="h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Add These Features
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* MODE: SCRATCH - App name is primary */}
                  {creationMode === "scratch" && (
                    <>
                      <div className="space-y-3">
                        <label className="text-base font-semibold text-white flex items-center gap-2">
                          <Smartphone className="h-5 w-5 text-purple-400" />
                          App Name
                          <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 text-xs ml-2">Required</Badge>
                        </label>
                        <div className="relative">
                          <Input
                            value={appName}
                            onChange={(e) => setAppName(e.target.value)}
                            placeholder="My Awesome App"
                            className="h-14 text-lg bg-white/10 border-purple-500/30 text-white placeholder:text-muted-foreground pl-4 pr-12 focus:border-purple-500 focus:ring-purple-500/20"
                          />
                          {appName.trim().length >= 2 && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Check className="h-5 w-5 text-green-400" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-purple-400/80">
                          Choose a name for your app
                        </p>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-gray-900 px-3 text-muted-foreground">Describe Your App</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-medium text-white flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-cyan-400" />
                          What does your app do?
                        </label>
                        <Textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder={selectedTemplate?.prompt || "Describe your app: A fitness app with workout tracking, meal plans, progress photos..."}
                          className="min-h-[100px] bg-white/5 border-white/10 text-white placeholder:text-muted-foreground resize-none"
                        />
                        
                        {/* AI Pre-fill Suggestions based on selected template */}
                        {selectedTemplate && selectedTemplate.id !== 'custom' && !customPrompt && (
                          <div className="p-3 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg border border-cyan-500/20">
                            <div className="flex items-start gap-2">
                              <Wand2 className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
                              <div className="space-y-2 flex-1">
                                <p className="text-xs text-cyan-300 font-medium">✨ AI Suggestion for {selectedTemplate.name}</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {selectedTemplate.prompt}
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCustomPrompt(selectedTemplate.prompt)}
                                  className="h-7 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Use This Prompt
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                          Help us understand what screens and features your app needs. {selectedTemplate?.id !== 'custom' && 'Or use the AI suggestion above!'}
                        </p>
                      </div>

                      {/* Optional website for scratch mode */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-white flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          Website URL (optional)
                        </label>
                        <Input
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://yourbusiness.com"
                          className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
                        />
                        <p className="text-xs text-muted-foreground">
                          Have a website? Add it to include web content in your app
                        </p>
                      </div>
                    </>
                  )}

                  <Button
                    onClick={handleGenerate}
                    disabled={
                      (creationMode === "website" && (!websiteUrl.trim() || !websiteUrl.startsWith("http"))) ||
                      (creationMode === "scratch" && !appName.trim()) ||
                      generateMutation.isPending
                    }
                    className={`w-full h-14 text-lg font-semibold disabled:opacity-50 ${
                      creationMode === "website" 
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
                        : "bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500"
                    }`}
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {creationMode === "website" ? "Analyzing Website..." : "Generating App..."}
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        {creationMode === "website" ? "Generate My App" : "Create My App"}
                      </>
                    )}
                  </Button>

                  {creationMode === "website" && !websiteUrl.trim() && (
                    <p className="text-center text-sm text-amber-400/80">
                      Please enter your website URL to continue
                    </p>
                  )}
                  {creationMode === "scratch" && !appName.trim() && (
                    <p className="text-center text-sm text-amber-400/80">
                      Please enter an app name to continue
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Generating Animation */}
          {step === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-20"
            >
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className={`absolute inset-0 rounded-full animate-ping ${
                  creationMode === "website" ? "bg-cyan-500/20" : "bg-purple-500/20"
                }`} />
                <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${
                  creationMode === "website" 
                    ? "bg-gradient-to-br from-cyan-500 to-blue-600" 
                    : "bg-gradient-to-br from-purple-500 to-pink-600"
                }`}>
                  <Sparkles className="h-10 w-10 text-white animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {creationMode === "website" ? "Analyzing your website..." : "Generating your app..."}
              </h2>
              <p className="text-muted-foreground">
                {creationMode === "website" 
                  ? "Detecting branding and preparing your mobile app"
                  : "Creating the perfect app structure for you"
                }
              </p>
              <div className="flex justify-center gap-1 mt-8">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full animate-bounce ${
                      creationMode === "website" ? "bg-cyan-400" : "bg-purple-400"
                    }`}
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 4: Preview Generated Config */}
          {step === "preview" && generatedConfig && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="text-center mb-8">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                  creationMode === "website" 
                    ? "bg-gradient-to-br from-green-500 to-emerald-500" 
                    : "bg-gradient-to-br from-purple-500 to-pink-500"
                }`}>
                  <Check className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {creationMode === "website" ? "Your App Preview" : "App Configuration Ready"}
                </h2>
                <p className="text-muted-foreground">
                  {creationMode === "website" 
                    ? "This is how your app will look on mobile devices"
                    : "Review your app settings and start building"
                  }
                </p>
              </div>

              {/* Live Preview and Config Grid */}
              <div className={`grid gap-8 mb-6 ${creationMode === "website" ? "lg:grid-cols-2" : ""}`}>
                {/* Mobile Preview - Only for website mode */}
                {creationMode === "website" && websiteUrl && (
                  <div className="flex justify-center">
                    <MobilePreview
                      url={websiteUrl}
                      appName={generatedConfig.appName}
                      primaryColor={generatedConfig.primaryColor}
                      icon={generatedConfig.icon}
                    />
                  </div>
                )}

                {/* App Configuration Card */}
                <Card className="glass border-white/10">
                  <CardContent className="p-6 space-y-5">
                    {/* App Identity */}
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: generatedConfig.primaryColor + "20" }}
                      >
                        {generatedConfig.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {creationMode === "scratch" ? appName : generatedConfig.appName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <div 
                            className="w-3 h-3 rounded-full border border-white/20"
                            style={{ backgroundColor: generatedConfig.primaryColor }}
                          />
                          <span className="text-xs text-muted-foreground">{generatedConfig.primaryColor}</span>
                        </div>
                      </div>
                    </div>

                    {/* Website URL - Only if provided */}
                    {websiteUrl && (
                      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Globe className="h-4 w-4 text-cyan-400" />
                          <span className="text-sm font-medium text-white">Website</span>
                        </div>
                        <a 
                          href={websiteUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-cyan-400 hover:text-cyan-300 truncate block"
                        >
                          {websiteUrl.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}

                    {/* For scratch mode - show what they'll build */}
                    {creationMode === "scratch" && !websiteUrl && (
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Layout className="h-4 w-4 text-purple-400" />
                          <span className="text-sm font-medium text-white">Native App</span>
                        </div>
                        <p className="text-sm text-purple-400">
                          Build custom screens with our visual editor
                        </p>
                      </div>
                    )}

                    {/* Suggested Screens */}
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">App Screens</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {generatedConfig.suggestedScreens.map((screen: string) => (
                          <Badge key={screen} variant="secondary" className="bg-white/10 text-white text-xs">
                            {screen}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Enabled Features */}
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Features Included</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {generatedConfig.suggestedFeatures.map((feature: string) => (
                          <Badge key={feature} variant="outline" className={`text-xs ${
                            creationMode === "website" 
                              ? "border-cyan-500/50 text-cyan-400"
                              : "border-purple-500/50 text-purple-400"
                          }`}>
                            <Check className="mr-1 h-3 w-3" />
                            {formatFeatureName(feature)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Business-Ready Capabilities */}
                    <div className="pt-2">
                      <h4 className="text-sm font-medium text-white mb-2">Business-Ready Capabilities</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Tailored for your {generatedConfig.industry} business needs.
                      </p>

                      {(() => {
                        const capDescs = getCapabilityDescriptions(generatedConfig.industry);
                        return (
                          <div className="grid gap-2">
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.auth.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.auth.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.auth} onChange={(e) => setBusinessCaps((p) => ({ ...p, auth: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.payments.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.payments.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.payments} onChange={(e) => setBusinessCaps((p) => ({ ...p, payments: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.admin.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.admin.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.admin} onChange={(e) => setBusinessCaps((p) => ({ ...p, admin: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.analytics.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.analytics.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.analytics} onChange={(e) => setBusinessCaps((p) => ({ ...p, analytics: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.notifications.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.notifications.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.notifications} onChange={(e) => setBusinessCaps((p) => ({ ...p, notifications: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                              <div>
                                <div className="text-sm text-white">{capDescs.publishingChecklist.title}</div>
                                <div className="text-xs text-muted-foreground">{capDescs.publishingChecklist.description}</div>
                              </div>
                              <input type="checkbox" className="h-4 w-4" checked={businessCaps.publishingChecklist} onChange={(e) => setBusinessCaps((p) => ({ ...p, publishingChecklist: e.target.checked }))} />
                            </label>
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep("prompt")}
                  className="flex-1 border-white/10"
                >
                  ← Modify
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createAppMutation.isPending}
                  className={`flex-[2] h-12 text-lg font-semibold ${
                    creationMode === "website"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
                      : "bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500"
                  }`}
                >
                  {createAppMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating App...
                    </>
                  ) : (
                    <>
                      {creationMode === "scratch" ? "Start Building" : "Create My App"}
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>

              {!me && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  You'll need to sign in to create your app
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}

// Helper functions
function extractAppName(prompt: string): string {
  // Simple extraction - look for app name patterns
  const patterns = [
    /build (?:a|an) (.+?) app/i,
    /create (?:a|an) (.+?) app/i,
    /(.+?) app with/i,
  ];
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1) + " App";
    }
  }
  return "My Custom App";
}

function getTemplateColor(id: string): string {
  const colors: Record<string, string> = {
    ecommerce: "#F97316",
    ecommerce_bamboo: "#2F6B4F",
    salon: "#EC4899",
    restaurant: "#EF4444",
    restaurant_biryani: "#7A1020",
    church: "#8B5CF6",
    radio: "#06B6D4",
    fitness: "#10B981",
    education: "#3B82F6",
    realestate: "#64748B",
    healthcare: "#F43F5E",
    photography: "#7C3AED",
    music: "#D946EF",
    business: "#475569",
    news: "#F59E0B",
    custom: "#00E5FF",
  };
  return colors[id] || "#00E5FF";
}

function getTemplateEmoji(id: string): string {
  const emojis: Record<string, string> = {
    ecommerce: "🛒",
    ecommerce_bamboo: "🎋",
    salon: "💇",
    restaurant: "🍽️",
    restaurant_biryani: "👑",
    church: "⛪",
    radio: "📻",
    fitness: "💪",
    education: "📚",
    realestate: "🏠",
    healthcare: "🏥",
    photography: "📷",
    music: "🎵",
    business: "💼",
    news: "📰",
    custom: "🚀",
  };
  return emojis[id] || "🚀";
}

function formatFeatureName(feature: string): string {
  const names: Record<string, string> = {
    bottomNav: "Bottom Nav",
    pullToRefresh: "Pull to Refresh",
    offlineScreen: "Offline Mode",
    whatsappButton: "WhatsApp",
    pushNotifications: "Push Notifications",
    deepLinking: "Deep Linking",
    customMenu: "Custom Menu",
    nativeLoadingProgress: "Loading Bar",
  };
  return names[feature] || feature;
}

function getTemplateSecondaryColor(id: string): string {
  const colors: Record<string, string> = {
    ecommerce: "#FCD34D",
    ecommerce_bamboo: "#E7DCC8",
    salon: "#F472B6",
    restaurant: "#FBBF24",
    restaurant_biryani: "#D4AF37",
    church: "#A78BFA",
    radio: "#22D3EE",
    fitness: "#34D399",
    education: "#60A5FA",
    realestate: "#94A3B8",
    healthcare: "#FB7185",
    photography: "#A78BFA",
    music: "#E879F9",
    business: "#64748B",
    news: "#FBBF24",
    custom: "#A855F7",
  };
  return colors[id] || "#A855F7";
}

function generateSmartAppName(prompt: string, template: typeof INDUSTRY_TEMPLATES[0]): string {
  // Try to extract a business name from the prompt
  const businessPatterns = [
    /(?:for|called|named|my|our)\s+["']?([A-Z][a-zA-Z\s&]+?)["']?(?:\s+(?:app|store|shop|business|salon|restaurant|gym|church|clinic|studio))?/i,
    /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:app|mobile|website)/i,
  ];
  
  for (const pattern of businessPatterns) {
    const match = prompt.match(pattern);
    if (match && match[1] && match[1].length > 2 && match[1].length < 25) {
      return match[1].trim();
    }
  }
  
  // Generate a creative name based on template
  const prefixes: Record<string, string[]> = {
    ecommerce: ["Shop", "Store", "Market"],
    salon: ["Glam", "Style", "Beauty"],
    restaurant: ["Taste", "Dine", "Food"],
    fitness: ["Fit", "Active", "Strong"],
    education: ["Learn", "Study", "Edu"],
    healthcare: ["Care", "Health", "Well"],
    custom: ["My", "The", "Go"],
  };
  
  const prefix = prefixes[template.id]?.[Math.floor(Math.random() * 3)] || "My";
  return `${prefix} ${template.name}`;
}
