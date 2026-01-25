import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Loader2,
  ShoppingCart,
  Scissors,
  UtensilsCrossed,
  Church,
  Radio,
  Dumbbell,
  GraduationCap,
  Building2,
  Heart,
  Camera,
  Music,
  Briefcase,
  Newspaper,
  Globe,
  Check,
  ChevronRight,
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
    id: "salon",
    name: "Salon & Spa",
    icon: Scissors,
    color: "from-pink-500 to-rose-500",
    description: "Booking, services, gallery for beauty business",
    prompt: "Create a salon booking app with service catalog, online appointment booking, stylist profiles, price list, gallery, customer reviews, push notification reminders, and loyalty rewards.",
    suggestedFeatures: ["bottomNav", "pushNotifications", "whatsappButton"],
    screens: ["Home", "Services", "Book Now", "Gallery", "Profile"],
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
    id: "church",
    name: "Church & Ministry",
    icon: Church,
    color: "from-purple-500 to-indigo-500",
    description: "Sermons, events, donations for religious orgs",
    prompt: "Create a church app with sermon library, event calendar, online giving/donations, prayer requests, volunteer sign-up, push notifications for services, and community directory.",
    suggestedFeatures: ["pushNotifications", "offlineScreen"],
    screens: ["Home", "Sermons", "Events", "Give", "Connect"],
  },
  {
    id: "radio",
    name: "Online Radio",
    icon: Radio,
    color: "from-cyan-500 to-blue-500",
    description: "Live streaming, podcasts, music station",
    prompt: "Build a radio streaming app with live audio player, podcast episodes, show schedule, DJ profiles, song request feature, push notifications for shows, and social sharing.",
    suggestedFeatures: ["pushNotifications", "offlineScreen"],
    screens: ["Live", "Shows", "Podcasts", "Schedule", "About"],
  },
  {
    id: "fitness",
    name: "Fitness & Gym",
    icon: Dumbbell,
    color: "from-green-500 to-emerald-500",
    description: "Workouts, classes, membership for gyms",
    prompt: "Create a fitness app with workout plans, class booking, trainer profiles, progress tracking, membership management, push notifications for classes, and nutrition tips.",
    suggestedFeatures: ["bottomNav", "pushNotifications", "deepLinking"],
    screens: ["Home", "Workouts", "Classes", "Progress", "Profile"],
  },
  {
    id: "education",
    name: "Education",
    icon: GraduationCap,
    color: "from-blue-500 to-cyan-500",
    description: "Courses, learning materials for schools",
    prompt: "Build an education app with course catalog, video lessons, quiz assessments, progress tracking, certificates, discussion forum, push notifications for assignments, and resource library.",
    suggestedFeatures: ["bottomNav", "pushNotifications", "offlineScreen", "deepLinking"],
    screens: ["Courses", "My Learning", "Quizzes", "Resources", "Profile"],
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
  {
    id: "photography",
    name: "Photography",
    icon: Camera,
    color: "from-violet-500 to-purple-500",
    description: "Portfolio, booking for photographers",
    prompt: "Create a photography portfolio app with image gallery, service packages, booking system, client testimonials, pricing information, contact form, and social media integration.",
    suggestedFeatures: ["bottomNav", "whatsappButton"],
    screens: ["Portfolio", "Services", "Book", "About", "Contact"],
  },
  {
    id: "music",
    name: "Music & Band",
    icon: Music,
    color: "from-fuchsia-500 to-pink-500",
    description: "Albums, events, merchandise for artists",
    prompt: "Build a music app with album releases, tour dates, music player, merchandise store, fan club membership, push notifications for releases, and social media feed.",
    suggestedFeatures: ["bottomNav", "pushNotifications", "deepLinking"],
    screens: ["Home", "Music", "Tour", "Merch", "Fan Club"],
  },
  {
    id: "business",
    name: "Business Services",
    icon: Briefcase,
    color: "from-gray-600 to-slate-600",
    description: "Company info, services, contact",
    prompt: "Create a professional business app with company overview, service catalog, team profiles, case studies, contact form, appointment booking, and WhatsApp integration.",
    suggestedFeatures: ["whatsappButton", "deepLinking"],
    screens: ["Home", "Services", "About", "Portfolio", "Contact"],
  },
  {
    id: "news",
    name: "News & Blog",
    icon: Newspaper,
    color: "from-amber-500 to-yellow-500",
    description: "Articles, categories, notifications",
    prompt: "Build a news app with article feed, category filters, bookmarks, reading history, push notifications for breaking news, offline reading, and social sharing.",
    suggestedFeatures: ["bottomNav", "pushNotifications", "offlineScreen", "deepLinking"],
    screens: ["Feed", "Categories", "Saved", "Notifications", "Settings"],
  },
  {
    id: "custom",
    name: "Custom App",
    icon: Globe,
    color: "from-cyan-400 to-purple-500",
    description: "Describe your unique app idea",
    prompt: "",
    suggestedFeatures: [],
    screens: [],
  },
];

type Step = "template" | "prompt" | "generating" | "preview";

export default function PromptCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("template");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof INDUSTRY_TEMPLATES[0] | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [generatedConfig, setGeneratedConfig] = useState<any>(null);

  // Auth check
  const { data: me, isLoading: authLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // AI generation mutation - uses real AI when available, falls back to templates
  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const template = selectedTemplate || INDUSTRY_TEMPLATES[INDUSTRY_TEMPLATES.length - 1];
      
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
            industry: aiResult.industry || template.id,
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
      const appName = template.id === "custom" 
        ? extractAppName(prompt) 
        : generateSmartAppName(prompt, template);
      
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
        industry: template.id,
        aiGenerated: false,
      };
    },
    onSuccess: (data) => {
      setGeneratedConfig(data);
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

      const appData = {
        name: generatedConfig.appName,
        url: websiteUrl || "https://example.com",
        icon: generatedConfig.icon,
        primaryColor: generatedConfig.primaryColor,
        platform: "android",
        plan: "preview",
        features: {
          bottomNav: generatedConfig.suggestedFeatures.includes("bottomNav"),
          pullToRefresh: generatedConfig.suggestedFeatures.includes("pullToRefresh"),
          offlineScreen: generatedConfig.suggestedFeatures.includes("offlineScreen"),
          whatsappButton: generatedConfig.suggestedFeatures.includes("whatsappButton"),
          whatsappNumber: "",
        },
        // Store generated config for later use
        generatedPrompt: customPrompt || selectedTemplate?.prompt,
        generatedScreens: generatedConfig.suggestedScreens,
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
        description: "Taking you to the app editor...",
      });
      // Go to the new visual editor
      setLocation(`/apps/${app.id}/editor`);
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
    if (template.id === "custom") {
      setCustomPrompt("");
    } else {
      setCustomPrompt(template.prompt);
    }
    setStep("prompt");
  };

  const handleGenerate = () => {
    if (!customPrompt.trim()) {
      toast({
        title: "Please describe your app",
        description: "Enter a description of what you want to build",
        variant: "destructive",
      });
      return;
    }
    setStep("generating");
    generateMutation.mutate(customPrompt);
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
            Describe Your App,<br />
            <span className="text-gradient">We'll Build It</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Choose an industry template or describe your custom app idea. 
            Our AI will generate the perfect app structure for you.
          </p>
        </motion.div>

        {/* Progress Steps */}
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

        <AnimatePresence mode="wait">
          {/* Step 1: Template Selection */}
          {step === "template" && (
            <motion.div
              key="template"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
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

          {/* Step 2: Prompt Input */}
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
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-cyan-400" />
                      Describe your app
                    </label>
                    <Textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Example: Build an ecommerce app to sell handmade crafts with product catalog, shopping cart, secure checkout, order tracking..."
                      className="min-h-[150px] bg-white/5 border-white/10 text-white placeholder:text-muted-foreground resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Be specific about features, screens, and functionality you want.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white flex items-center gap-2">
                      <Globe className="h-4 w-4 text-cyan-400" />
                      Website URL (optional)
                    </label>
                    <Input
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourbusiness.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      If you have a website, we'll auto-detect logo and colors.
                    </p>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={!customPrompt.trim() || generateMutation.isPending}
                    className="w-full h-12 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-lg font-semibold"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate App Structure
                      </>
                    )}
                  </Button>
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
                <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-white animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">AI is building your app...</h2>
              <p className="text-muted-foreground">Analyzing your requirements and generating the perfect structure</p>
              <div className="flex justify-center gap-1 mt-8">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
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
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Your App is Ready!</h2>
                <p className="text-muted-foreground">Review the generated configuration and create your app</p>
              </div>

              <Card className="glass border-white/10 mb-6">
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* App Info */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                          style={{ backgroundColor: generatedConfig.primaryColor + "20" }}
                        >
                          {generatedConfig.icon}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{generatedConfig.appName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div 
                              className="w-4 h-4 rounded-full border border-white/20"
                              style={{ backgroundColor: generatedConfig.primaryColor }}
                            />
                            <span className="text-sm text-muted-foreground">{generatedConfig.primaryColor}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-white mb-2">Description</h4>
                        <p className="text-sm text-muted-foreground">{generatedConfig.description}</p>
                      </div>
                    </div>

                    {/* Screens & Features */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-white mb-2">Suggested Screens</h4>
                        <div className="flex flex-wrap gap-2">
                          {generatedConfig.suggestedScreens.map((screen: string) => (
                            <Badge key={screen} variant="secondary" className="bg-white/10 text-white">
                              {screen}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-white mb-2">Enabled Features</h4>
                        <div className="flex flex-wrap gap-2">
                          {generatedConfig.suggestedFeatures.map((feature: string) => (
                            <Badge key={feature} variant="outline" className="border-cyan-500/50 text-cyan-400">
                              <Check className="mr-1 h-3 w-3" />
                              {formatFeatureName(feature)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep("prompt")}
                  className="flex-1 border-white/10"
                >
                  ← Modify Prompt
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createAppMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400"
                >
                  {createAppMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create App <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {!me && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  You'll be asked to sign in before creating the app
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
    salon: "#EC4899",
    restaurant: "#EF4444",
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
    salon: "💇",
    restaurant: "🍽️",
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
    salon: "#F472B6",
    restaurant: "#FBBF24",
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
