import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { MobilePreview } from "@/components/mobile-preview";
import { ArrowRight, ArrowLeft, Loader2, Smartphone, Check, Palette, Globe, CreditCard } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const STEPS = [
  { id: 1, name: "Details", icon: Globe },
  { id: 2, name: "Customize", icon: Palette },
  { id: 3, name: "Preview", icon: Smartphone },
  { id: 4, name: "Payment", icon: CreditCard },
];

const PLANS = [
  {
    id: "starter",
    name: "Starter Build",
    price: 499,
    features: ["Android .apk (signed)", "WebView wrapper", "Branded Splash", "Community Support", "Single Build"],
    recommended: false,
  },
  {
    id: "standard",
    name: "Standard Build",
    price: 999,
    features: ["Android .apk & .aab", "Branded Splash", "Push Ready", "Email Support", "1 Rebuild (30 days)"],
    recommended: false,
  },
  {
    id: "pro",
    name: "Pro Build",
    price: 2499,
    features: ["Android .apk & .aab", "Push Notifications", "White-Label", "Priority Support", "3 Rebuilds (90 days)"],
    recommended: true,
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

  // Get URL and plan from query params if provided (from home/pricing page)
  const params = new URLSearchParams(search);
  const urlFromQuery = params.get("url") || "";
  const planFromQuery = params.get("plan") || "pro";

  const [selectedPlan, setSelectedPlan] = useState(
    ["starter", "standard", "pro"].includes(planFromQuery) ? planFromQuery : "pro"
  );

  const [formData, setFormData] = useState({
    url: urlFromQuery || "https://",
    appName: "My Awesome App",
    icon: "🚀",
    primaryColor: "#2563EB",
    platform: "android",
  });

  useEffect(() => {
    if (!isLoading && !me) setLocation(`/login?returnTo=${encodeURIComponent("/create")}`);
  }, [isLoading, me, setLocation]);

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
    if (step < 4) {
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
      // Handle payment
      handlePayment();
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      // First create the app
      const appRes = await apiRequest("POST", "/api/apps", {
        name: formData.appName,
        url: formData.url,
        icon: formData.icon,
        primaryColor: formData.primaryColor,
        platform: formData.platform,
        buildNow: false, // Don't build yet, wait for payment
      });
      const app = await appRes.json();

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
        name: "WebToApp",
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

            await queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
            toast({
              title: "Payment successful!",
              description: "Your app is now being built.",
            });
            setLocation("/dashboard");
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

      {/* Progress Bar */}
      <div className="w-full glass border-b border-white/[0.08] sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isCompleted = s.id < step;

              return (
                <div key={s.id} className="flex flex-col items-center relative z-10 group">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-300 ${
                      isActive
                        ? "border-cyan-500/50 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-cyan-400 scale-110 shadow-lg shadow-cyan-500/20"
                        : isCompleted
                        ? "border-green-500/50 bg-green-500/20 text-green-400"
                        : "border-white/10 bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span
                    className={`text-xs font-medium mt-2 transition-colors duration-300 ${
                      isActive ? "text-cyan-400" : "text-muted-foreground"
                    }`}
                  >
                    {s.name}
                  </span>

                  {i !== STEPS.length - 1 && (
                    <div
                      className={`absolute top-5 left-1/2 w-full h-[2px] -z-10 ${
                        s.id < step ? "bg-green-500/50" : "bg-white/10"
                      }`}
                      style={{ width: "calc(100% * 6)" }}
                    ></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 max-w-6xl">
        {/* Left Panel: Form */}
        <div className="flex-1 order-2 lg:order-1">
          <Card className="border-white/[0.08] glass shadow-2xl h-full">
            <CardContent className="p-8">
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Let's start with your website</h2>
                    <p className="text-muted-foreground mt-1">Enter the URL you want to convert.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="url" className="text-muted-foreground">Website URL</Label>
                      <Input
                        id="url"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder="https://yourwebsite.com"
                        className="h-12 text-lg bg-white/5 border-white/10 focus:border-cyan-500/50 text-white rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="appName" className="text-muted-foreground">App Name</Label>
                      <Input
                        id="appName"
                        value={formData.appName}
                        onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                        placeholder="e.g. My Shop"
                        className="h-12 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Customize Look & Feel</h2>
                    <p className="text-muted-foreground mt-1">Make it look like a native app.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">App Icon (Emoji)</Label>
                      <div className="flex gap-4">
                        <Input
                          value={formData.icon}
                          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                          className="w-20 text-center text-2xl h-12 bg-white/5 border-white/10 focus:border-cyan-500/50 rounded-lg"
                          maxLength={2}
                        />
                        <div className="flex gap-2 flex-wrap">
                          {["🚀", "📱", "🛍️", "🍔", "📚", "💼", "🎮", "🏠"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setFormData({ ...formData, icon: emoji })}
                              className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                                formData.icon === emoji ? "border-cyan-500/50 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:border-white/20"
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Primary Color</Label>
                      <div className="grid grid-cols-8 gap-2">
                        {["#00E5FF", "#A855F7", "#16A34A", "#DC2626", "#EA580C", "#0891B2", "#CA8A04", "#000000"].map(
                          (color) => (
                            <div
                              key={color}
                              onClick={() => setFormData({ ...formData, primaryColor: color })}
                              className={`h-10 w-10 rounded-full cursor-pointer border-2 transition-all ${
                                formData.primaryColor === color ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          )
                        )}
                        <Input
                          type="color"
                          value={formData.primaryColor}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          className="h-10 w-10 p-1 rounded-full cursor-pointer bg-transparent border-white/10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Target Platform</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: "android", label: "Android", desc: "APK & AAB" },
                          { id: "ios", label: "iOS", desc: "IPA File" },
                          { id: "both", label: "Both", desc: "Save 20%" },
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
                            <div className="font-medium text-white">{platform.label}</div>
                            <div className="text-xs text-muted-foreground">{platform.desc}</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">iOS builds take 5-10 minutes via cloud build.</p>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Review Your App</h2>
                    <p className="text-muted-foreground mt-1">Check how your app will look.</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-sm space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">URL:</span>
                      <span className="font-medium text-white truncate max-w-[200px]">{formData.url}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">App Name:</span>
                      <span className="font-medium text-white">{formData.appName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Icon:</span>
                      <span className="text-xl">{formData.icon}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Primary Color:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: formData.primaryColor }} />
                        <span className="font-mono text-xs text-muted-foreground">{formData.primaryColor}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform:</span>
                      <span className="font-medium text-white capitalize">{formData.platform}</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
                    <p className="text-muted-foreground mt-1">Select a plan that fits your needs.</p>
                  </div>

                  <div className="space-y-4">
                    {PLANS.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`border-2 rounded-xl p-4 relative overflow-hidden cursor-pointer transition-all ${
                          selectedPlan === plan.id
                            ? "border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                      >
                        {plan.recommended && (
                          <div className="absolute top-0 right-0 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                            RECOMMENDED
                          </div>
                        )}
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-bold text-lg text-white">{plan.name}</h3>
                          <span className="text-2xl font-bold text-gradient">₹{plan.price.toLocaleString()}</span>
                        </div>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex gap-2 items-center">
                              <Check className="h-3 w-3 text-green-400 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
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
                  className="min-w-[140px] bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white shadow-lg glow-primary" 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {step === 4 ? `Pay ₹${PLANS.find((p) => p.id === selectedPlan)?.price.toLocaleString()}` : "Next Step"}
                  {!loading && step !== 4 && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Live Preview */}
        <div className="flex-1 order-1 lg:order-2 flex justify-center items-center lg:items-start pt-8">
          <div className="sticky top-24">
            <MobilePreview
              url={formData.url}
              appName={formData.appName}
              primaryColor={formData.primaryColor}
              icon={formData.icon}
            />
            <p className="text-center text-sm text-muted-foreground mt-4">Live Preview: <span className="text-white">{formData.appName}</span></p>
          </div>
        </div>
      </main>
    </div>
  );
}
