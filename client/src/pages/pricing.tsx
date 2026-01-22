/**
 * Applyn Pricing Page
 * 
 * Displays four pricing tiers: Starter, Standard, Pro, and Agency
 * with clear feature differentiation. Yearly subscription model.
 */

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Shield, 
  Apple, 
  Crown,
  RefreshCw,
  Lock,
  Calendar,
  Users,
  Building2,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import pricingImg from "@assets/generated_images/saas_pricing_plans_illustration.png";
import { PLANS_LIST, ADDONS, type PlanDefinition } from "@shared/pricing";

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
        <section className="py-16 text-center relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] -z-10" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10" />
          
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Trust Badges */}
                <div className="flex flex-wrap justify-center gap-3 mb-6">
                  <Badge variant="outline" className="px-3 py-1.5 gap-2 border-green-500/30 text-green-400">
                    <Calendar className="w-4 h-4" />
                    Yearly Plans
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1.5 gap-2 border-cyan-500/30 text-cyan-400">
                    <RefreshCw className="w-4 h-4" />
                    Free Rebuilds Included
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1.5 gap-2 border-purple-500/30 text-purple-400">
                    <Shield className="w-4 h-4" />
                    Store Compliance Updates
                  </Badge>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-4">
                  <Sparkles className="h-4 w-4" />
                  Simple & Transparent Pricing
                </div>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
                  <span className="text-white">Choose Your </span>
                  <span className="text-gradient">Perfect Plan</span>
                </h1>
                <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
                  Affordable yearly subscriptions with free rebuilds, store compliance updates, 
                  and priority support. Perfect for Indian startups, businesses, and agencies.
                </p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="pt-2"
              >
                <img src={pricingImg} alt="Pricing" className="w-48 mx-auto drop-shadow-2xl opacity-90" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Pricing Cards Section */}
        <section className="pb-16">
          <div className="container mx-auto px-6 max-w-7xl">
            {/* 4-Column Grid for Plans */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
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
              className="mt-10 text-center"
            >
              <p className="text-sm text-muted-foreground">
                All plans include: WebView app wrapper • Branded experience • Secure HTTPS • Fast builds
              </p>
            </motion.div>

            {/* Add-ons Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-12 p-6 rounded-2xl glass border-white/[0.08] max-w-3xl mx-auto"
            >
              <h3 className="text-xl font-bold text-white text-center mb-6">Add-ons</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-white">{ADDONS.extraAppSlot.name}</h4>
                    <p className="text-sm text-muted-foreground">{ADDONS.extraAppSlot.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gradient">₹{ADDONS.extraAppSlot.price.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground block">/year</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-white">{ADDONS.extraRebuildPack.name}</h4>
                    <p className="text-sm text-muted-foreground">{ADDONS.extraRebuildPack.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gradient">₹{ADDONS.extraRebuildPack.price.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground block">one-time</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* FAQ / Clarifications */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-12 max-w-3xl mx-auto"
            >
              <h3 className="text-xl font-bold text-white text-center mb-6">Common Questions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                  <h4 className="font-semibold text-white mb-2">What's included in yearly subscription?</h4>
                  <p className="text-sm text-muted-foreground">
                    Each plan includes free rebuilds, store compliance updates, and support for one year.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                  <h4 className="font-semibold text-white mb-2">What happens after subscription expires?</h4>
                  <p className="text-sm text-muted-foreground">
                    Your existing apps continue working. You just can't rebuild or modify them until you renew.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                  <h4 className="font-semibold text-white mb-2">Can I purchase extra rebuilds?</h4>
                  <p className="text-sm text-muted-foreground">
                    Yes! Extra rebuilds are available for ₹499 each or ₹2,999 for a pack of 10.
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
  const isAgency = plan.id === "agency";
  const isPro = plan.id === "pro";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={`p-5 rounded-2xl border relative flex flex-col ${
        isPopular 
          ? 'border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-purple-500/5 shadow-xl shadow-cyan-500/10' 
          : isAgency
          ? 'border-purple-500/30 bg-gradient-to-b from-purple-500/10 to-cyan-500/5 shadow-xl shadow-purple-500/10'
          : 'border-white/[0.08] glass'
      }`}
    >
      {/* Popular/Agency Badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
          MOST POPULAR
        </div>
      )}
      {plan.badge && !isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg whitespace-nowrap">
          {plan.badge.toUpperCase()}
        </div>
      )}

      {/* Plan Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold text-white">{plan.name}</h3>
          {isPro && <Crown className="w-4 h-4 text-yellow-400" />}
          {isAgency && <Building2 className="w-4 h-4 text-purple-400" />}
        </div>
        <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      </div>

      {/* Price */}
      <div className="mb-3">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-gradient">₹{plan.price.toLocaleString()}</span>
          {plan.originalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              ₹{plan.originalPrice.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">per year</span>
          {plan.monthlyEquivalent && (
            <span className="text-[10px] text-cyan-400">~₹{plan.monthlyEquivalent}/month</span>
          )}
        </div>
      </div>

      {/* Apps & Rebuilds Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge variant="outline" className="gap-1 text-[10px] px-2 py-0.5 border-green-500/30 text-green-400">
          <Zap className="w-2.5 h-2.5" />
          {plan.maxApps === 1 ? "1 App" : `${plan.maxApps} Apps`}
        </Badge>
        <Badge variant="outline" className="gap-1 text-[10px] px-2 py-0.5 border-purple-500/30 text-purple-400">
          <RefreshCw className="w-2.5 h-2.5" />
          {plan.rebuildsPerYear} Rebuild{plan.rebuildsPerYear > 1 ? 's' : ''}
        </Badge>
        {plan.maxTeamMembers > 1 && (
          <Badge variant="outline" className="gap-1 text-[10px] px-2 py-0.5 border-cyan-500/30 text-cyan-400">
            <Users className="w-2.5 h-2.5" />
            {plan.maxTeamMembers} Users
          </Badge>
        )}
      </div>

      {/* Platform Badges */}
      <div className="flex gap-1.5 mb-3">
        <Badge variant="outline" className={`gap-1 text-[10px] px-2 py-0.5 ${plan.outputs.androidApk || plan.outputs.androidAab ? 'border-green-500/30 text-green-400' : 'border-gray-500/30 text-gray-500'}`}>
          <AndroidIcon className="w-2.5 h-2.5" />
          Android
        </Badge>
        <Badge variant="outline" className={`gap-1 text-[10px] px-2 py-0.5 ${plan.outputs.iosIpa ? 'border-blue-500/30 text-blue-400' : 'border-gray-500/30 text-gray-500'}`}>
          <Apple className="w-2.5 h-2.5" />
          iOS
          {!plan.outputs.iosIpa && <Lock className="w-2 h-2 ml-0.5" />}
        </Badge>
      </div>

      {/* Label */}
      <div className={`p-2 rounded-lg mb-3 ${
        isPopular 
          ? 'bg-cyan-500/10 border border-cyan-500/20' 
          : isAgency
          ? 'bg-purple-500/10 border border-purple-500/20'
          : 'bg-green-500/10 border border-green-500/20'
      }`}>
        <p className={`text-[10px] font-medium ${
          isPopular ? 'text-cyan-400' : isAgency ? 'text-purple-400' : 'text-green-400'
        }`}>
          {plan.label}
        </p>
      </div>

      {/* Features List */}
      <ul className="space-y-1.5 mb-4 flex-1">
        {plan.featureList.map((feature) => (
          <li key={feature} className="flex items-start gap-1.5 text-xs">
            <CheckCircle2 className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${
              isPopular ? 'text-cyan-400' : isAgency ? 'text-purple-400' : 'text-green-400'
            }`} />
            <span className="text-slate-300">{feature}</span>
          </li>
        ))}
        {plan.restrictions.map((restriction) => (
          <li key={restriction} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-red-400/50" />
            <span>{restriction.replace('❌ ', '')}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Button 
        onClick={onSelect}
        className={`w-full h-10 text-xs font-semibold rounded-lg transition-all ${
          isPopular 
            ? 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white shadow-lg glow-primary hover:scale-[1.02]' 
            : isAgency
            ? 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white shadow-lg hover:scale-[1.02]'
            : 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20'
        }`}
      >
        {plan.cta}
      </Button>

      {/* Subscription Info */}
      <p className="text-[10px] text-center text-muted-foreground mt-2">
        Renews yearly • Cancel anytime
      </p>
    </motion.div>
  );
}
