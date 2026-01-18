import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { MobilePreview } from "@/components/mobile-preview";
import { ArrowRight, ArrowLeft, Loader2, Smartphone, Check, Palette, Globe, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

const STEPS = [
  { id: 1, name: "Details", icon: Globe },
  { id: 2, name: "Customize", icon: Palette },
  { id: 3, name: "Preview", icon: Smartphone },
  { id: 4, name: "Payment", icon: CreditCard },
];

export default function CreateApp() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (!isLoading && !me) setLocation(`/login?returnTo=${encodeURIComponent("/create")}`);
  }, [isLoading, me, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="container mx-auto px-4 py-8">Loading...</main>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    url: "https://",
    appName: "My Awesome App",
    icon: "🚀",
    primaryColor: "#2563EB",
    email: "",
    platform: "android"
  });

  const handleNext = () => {
    if (step < 4) {
      if (step === 1 && !formData.url.includes(".")) {
          toast({
              title: "Invalid URL",
              description: "Please enter a valid website URL",
              variant: "destructive"
          });
          return;
      }
      setLoading(true);
      // Simulate processing
      setTimeout(() => {
        setLoading(false);
        setStep(step + 1);
      }, 500);
    } else {
      // Handle payment/submit
      (async () => {
        setLoading(true);
        try {
          await apiRequest("POST", "/api/apps", {
            name: formData.appName,
            url: formData.url,
            icon: formData.icon,
            primaryColor: formData.primaryColor,
            platform: formData.platform,
            status: "processing",
          });

          await queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
          toast({
            title: "App creation started",
            description: "We are building your app now.",
          });
          setLocation("/dashboard");
        } catch (err: any) {
          toast({
            title: "Could not create app",
            description: err?.message || "Please try again",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      })();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      {/* Progress Bar */}
      <div className="w-full bg-white border-b sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isCompleted = s.id < step;
              
              return (
                <div key={s.id} className="flex flex-col items-center relative z-10 group">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      isActive ? "border-primary bg-primary text-white scale-110 shadow-lg shadow-primary/30" : 
                      isCompleted ? "border-green-500 bg-green-500 text-white" : 
                      "border-slate-200 bg-white text-slate-300"
                    }`}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs font-medium mt-2 transition-colors duration-300 ${isActive ? "text-primary" : "text-slate-400"}`}>
                    {s.name}
                  </span>
                  
                  {/* Connector Line */}
                  {i !== STEPS.length - 1 && (
                    <div className={`absolute top-5 left-1/2 w-full h-[2px] -z-10 ${s.id < step ? "bg-green-500" : "bg-slate-100"}`} style={{ width: "calc(100% * 6)" }}></div>
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
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm h-full">
            <CardContent className="p-8">
                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Let's start with your website</h2>
                            <p className="text-muted-foreground mt-1">Enter the URL you want to convert.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="url">Website URL</Label>
                                <Input 
                                    id="url" 
                                    value={formData.url}
                                    onChange={(e) => setFormData({...formData, url: e.target.value})}
                                    placeholder="https://yourwebsite.com"
                                    className="h-12 text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="appName">App Name</Label>
                                <Input 
                                    id="appName" 
                                    value={formData.appName}
                                    onChange={(e) => setFormData({...formData, appName: e.target.value})}
                                    placeholder="e.g. My Shop"
                                    className="h-12"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                         <div>
                            <h2 className="text-2xl font-bold text-slate-900">Customize Look & Feel</h2>
                            <p className="text-muted-foreground mt-1">Make it look like a native app.</p>
                        </div>
                        
                        <div className="space-y-4">
                             <div className="space-y-2">
                                <Label>App Icon (Emoji or Upload)</Label>
                                <div className="flex gap-4">
                                    <Input 
                                        value={formData.icon}
                                        onChange={(e) => setFormData({...formData, icon: e.target.value})}
                                        className="w-20 text-center text-2xl h-12" 
                                        maxLength={2}
                                    />
                                    <Button variant="outline" className="flex-1 h-12">Upload Custom Icon</Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Primary Color</Label>
                                <div className="grid grid-cols-6 gap-2">
                                    {['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#000000'].map(color => (
                                        <div 
                                            key={color}
                                            onClick={() => setFormData({...formData, primaryColor: color})}
                                            className={`h-10 w-10 rounded-full cursor-pointer border-2 transition-all ${formData.primaryColor === color ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <Input 
                                        type="color" 
                                        value={formData.primaryColor}
                                        onChange={(e) => setFormData({...formData, primaryColor: e.target.value})}
                                        className="h-10 w-10 p-1 rounded-full cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                 {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                         <div>
                            <h2 className="text-2xl font-bold text-slate-900">Review & Test</h2>
                            <p className="text-muted-foreground mt-1">Check how your app looks on the preview.</p>
                        </div>
                        
                        <div className="p-4 bg-slate-50 rounded-lg border text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">URL:</span>
                                <span className="font-medium">{formData.url}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">App Name:</span>
                                <span className="font-medium">{formData.appName}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Platform:</span>
                                <span className="font-medium capitalize">{formData.platform}</span>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Send Preview APK to WhatsApp</Label>
                             <div className="flex gap-2">
                                <Input placeholder="+91 98765 43210" />
                                <Button variant="secondary">Send</Button>
                             </div>
                        </div>
                    </div>
                )}

                 {step === 4 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                         <div>
                            <h2 className="text-2xl font-bold text-slate-900">Final Step</h2>
                            <p className="text-muted-foreground mt-1">Select a plan to build your app.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="border-2 border-primary bg-primary/5 rounded-xl p-4 relative overflow-hidden cursor-pointer hover:shadow-md transition-all">
                                <div className="absolute top-0 right-0 bg-primary text-white text-xs px-2 py-1 rounded-bl">RECOMMENDED</div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-lg">Lifetime Deal</h3>
                                    <span className="text-2xl font-bold">₹2,499</span>
                                </div>
                                <ul className="text-sm space-y-1 text-slate-600">
                                    <li className="flex gap-2 items-center"><Check className="h-3 w-3 text-green-500"/> Android + iOS Code</li>
                                    <li className="flex gap-2 items-center"><Check className="h-3 w-3 text-green-500"/> Lifetime Updates</li>
                                    <li className="flex gap-2 items-center"><Check className="h-3 w-3 text-green-500"/> Push Notifications</li>
                                </ul>
                            </div>

                             <div className="border rounded-xl p-4 cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all opacity-60">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-lg">Basic</h3>
                                    <span className="text-2xl font-bold">₹999</span>
                                </div>
                                <ul className="text-sm space-y-1 text-slate-600">
                                    <li className="flex gap-2 items-center"><Check className="h-3 w-3 text-green-500"/> Android Only</li>
                                    <li className="flex gap-2 items-center"><Check className="h-3 w-3 text-green-500"/> No Updates</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-8 flex justify-between">
                    <Button 
                        variant="ghost" 
                        onClick={handleBack} 
                        disabled={step === 1}
                        className={step === 1 ? "invisible" : ""}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button onClick={handleNext} className="min-w-[140px] shadow-lg shadow-primary/20">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {step === 4 ? "Pay & Build" : "Next Step"} 
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
                <p className="text-center text-sm text-muted-foreground mt-4">
                    Live Preview: {formData.appName}
                </p>
            </div>
        </div>

      </main>
    </div>
  );
}