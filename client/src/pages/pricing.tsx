/**
 * Applyn Pricing Page
 * 
 * Displays the three pricing tiers with clear feature differentiation.
 * Emphasizes one-time payment model and Play Store / App Store readiness.
 */

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Zap, 
  Shield, 
  Smartphone, 
  Apple, 
  Play,
  Crown,
  Star,
  Gift,
  Lock,
} from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import pricingImg from "@assets/generated_images/saas_pricing_plans_illustration.png";
import { PLANS_LIST, type PlanDefinition } from "@shared/pricing";

// Android icon component
function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
    </svg>
  );
}

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { data: me } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const handleSelectPlan = (planId: string) => {
    if (me) {
      setLocation(`/create?plan=${planId}`);
    } else {
      setLocation(`/login?returnTo=${encodeURIComponent(`/create?plan=${planId}`)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background selection:bg-cyan-500/30 flex flex-col">
      <Navbar />
      
      <div className="flex-1">
        {/* Hero Section */}
        <section className="py-20 text-center relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] -z-10" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10" />
          
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Trust Badges */}
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                  <Badge variant="outline" className="px-3 py-1.5 gap-2 border-green-500/30 text-green-400">
                    <Gift className="w-4 h-4" />
                    One-Time Payment
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1.5 gap-2 border-cyan-500/30 text-cyan-400">
                    <Shield className="w-4 h-4" />
                    No Monthly Fees
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1.5 gap-2 border-purple-500/30 text-purple-400">
                    <Star className="w-4 h-4" />
                    Own Your App Forever
                  </Badge>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6">
                  <Sparkles className="h-4 w-4" />
                  Simple & Transparent Pricing
                </div>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
                  <span className="text-white">Choose Your </span>
                  <span className="text-gradient">Perfect Plan</span>
                </h1>
                <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto">
                  Pay once, own your app files forever. No recurring fees. 
                  Perfect for Indian startups, businesses, and agencies.
                </p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="pt-4"
              >
                <img src={pricingImg} alt="Pricing" className="w-64 mx-auto drop-shadow-2xl opacity-90" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Pricing Cards Section */}
        <section className="pb-20">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="grid md:grid-cols-3 gap-6 items-stretch">
              {PLANS_LIST.map((plan, index) => (
                <PricingCard 
                  key={plan.id}
                  plan={plan}
                  delay={index * 0.1}
                  onSelect={() => handleSelectPlan(plan.id)}
                />
              ))}
            </div>
            
            {/* Feature Comparison Note */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-12 text-center"
            >
              <p className="text-sm text-muted-foreground">
                All plans include: WebView app wrapper • Branded experience • Secure HTTPS • Fast builds
              </p>
            </motion.div>

            {/* Agency CTA */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-16 p-8 rounded-2xl glass border-white/[0.08] text-center max-w-3xl mx-auto"
            >
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                  <Crown className="h-6 w-6 text-cyan-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">Agency or Reseller?</h3>
              <p className="text-muted-foreground mb-6">
                We offer white-label dashboard, bulk pricing, and custom branding for digital agencies. 
                Contact our sales team for tailored enterprise solutions.
              </p>
              <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold px-8">
                Contact Sales
              </Button>
            </motion.div>

            {/* FAQ / Clarifications */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-16 max-w-3xl mx-auto"
            >
              <h3 className="text-xl font-bold text-white text-center mb-8">Common Questions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                  <h4 className="font-semibold text-white mb-2">What's the difference between APK and AAB?</h4>
                  <p className="text-sm text-muted-foreground">
                    APK is for direct installation. AAB (Android App Bundle) is required by Google Play Store for publishing.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                  <h4 className="font-semibold text-white mb-2">Can I upgrade later?</h4>
                  <p className="text-sm text-muted-foreground">
                    Yes! You can upgrade anytime. Only pay the difference between plans.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                  <h4 className="font-semibold text-white mb-2">What does "App Store ready" mean?</h4>
                  <p className="text-sm text-muted-foreground">
                    Your app will be properly signed and formatted for Apple App Store submission (Pro plan).
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                  <h4 className="font-semibold text-white mb-2">Do you publish the app for me?</h4>
                  <p className="text-sm text-muted-foreground">
                    We provide store-ready files. You upload to your own Play Store/App Store developer account.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}

// ============================================
// PRICING CARD COMPONENT
// ============================================

interface PricingCardProps {
  plan: PlanDefinition;
  delay: number;
  onSelect: () => void;
}

function PricingCard({ plan, delay, onSelect }: PricingCardProps) {
  const isPopular = plan.popular;
  const isStarter = plan.id === "starter";
  const isPro = plan.id === "pro";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={`p-6 rounded-2xl border relative flex flex-col ${
        isPopular 
          ? 'border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-purple-500/5 shadow-xl shadow-cyan-500/10' 
          : 'border-white/[0.08] glass'
      }`}
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
          MOST POPULAR
        </div>
      )}

      {/* Plan Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
          {isPro && <Crown className="w-4 h-4 text-yellow-400" />}
        </div>
        <p className="text-sm text-muted-foreground">{plan.tagline}</p>
      </div>

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-gradient">₹{plan.price.toLocaleString()}</span>
          {plan.originalPrice && (
            <span className="text-lg text-muted-foreground line-through">
              ₹{plan.originalPrice.toLocaleString()}
            </span>
          )}
        </div>
        <span className="text-sm text-muted-foreground">one-time payment</span>
      </div>

      {/* Platform Badges */}
      <div className="flex gap-2 mb-4">
        <Badge variant="outline" className={`gap-1 ${plan.outputs.androidApk ? 'border-green-500/30 text-green-400' : 'border-gray-500/30 text-gray-500'}`}>
          <AndroidIcon className="w-3 h-3" />
          Android
        </Badge>
        <Badge variant="outline" className={`gap-1 ${plan.outputs.iosIpa ? 'border-blue-500/30 text-blue-400' : 'border-gray-500/30 text-gray-500'}`}>
          <Apple className="w-3 h-3" />
          iOS
          {!plan.outputs.iosIpa && <Lock className="w-2.5 h-2.5 ml-0.5" />}
        </Badge>
      </div>

      {/* Store Ready Label */}
      <div className={`p-3 rounded-lg mb-4 ${
        plan.features.playStoreReady 
          ? 'bg-green-500/10 border border-green-500/20' 
          : 'bg-yellow-500/10 border border-yellow-500/20'
      }`}>
        <p className={`text-xs font-medium ${
          plan.features.playStoreReady ? 'text-green-400' : 'text-yellow-400'
        }`}>
          {plan.label}
        </p>
      </div>

      {/* Features List */}
      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.featureList.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
              isPopular ? 'text-cyan-400' : 'text-purple-400'
            }`} />
            <span className="text-slate-300">{feature}</span>
          </li>
        ))}
        {plan.restrictions.map((restriction) => (
          <li key={restriction} className="flex items-start gap-2 text-sm text-muted-foreground">
            <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-400/50" />
            <span>{restriction.replace('❌ ', '')}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Button 
        onClick={onSelect}
        className={`w-full h-12 text-sm font-semibold rounded-lg transition-all ${
          isPopular 
            ? 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white shadow-lg glow-primary hover:scale-[1.02]' 
            : 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20'
        }`}
      >
        {plan.cta}
      </Button>

      {/* Rebuilds Info */}
      {plan.rebuilds.count > 0 && (
        <p className="text-xs text-center text-muted-foreground mt-3">
          Includes {plan.rebuilds.count} free rebuild{plan.rebuilds.count > 1 ? 's' : ''} within {plan.rebuilds.windowDays} days
        </p>
      )}
    </motion.div>
  );
}
