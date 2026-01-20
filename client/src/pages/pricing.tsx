import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import pricingImg from "@assets/generated_images/saas_pricing_plans_illustration.png";

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { data: me } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const handleSelectPlan = (plan: string) => {
    if (me) {
      setLocation(`/create?plan=${plan}`);
    } else {
      setLocation(`/login?returnTo=${encodeURIComponent(`/create?plan=${plan}`)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background selection:bg-cyan-500/30 flex flex-col">
      <Navbar />
      
      <div className="flex-1">
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
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6">
                  <Sparkles className="h-4 w-4" />
                  Simple & Transparent
                </div>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
                  <span className="text-white">Choose Your </span>
                  <span className="text-gradient">Perfect Plan</span>
                </h1>
                <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto">
                  No monthly subscriptions. Pay once and own your app files forever. Optimized for the Indian startup ecosystem.
                </p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="pt-8"
              >
                <img src={pricingImg} alt="Pricing" className="w-72 mx-auto drop-shadow-2xl opacity-90" />
              </motion.div>
            </div>
          </div>
        </section>

        <section className="pb-32">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid md:grid-cols-3 gap-6 items-stretch">
              <PricingCard 
                title="Starter Build"
                price="₹499"
                description="Ideal for students and hobbyists wanting to see their project on a phone."
                features={[
                  "Android .apk (release signed)",
                  "WebView app wrapper",
                  "Branded Splash Screen",
                  "Community Support",
                  "Single Build – no rebuilds"
                ]}
                buttonText="Get Started"
                variant="outline"
                onSelect={() => handleSelectPlan("starter")}
              />
              <PricingCard 
                title="Standard Build"
                price="₹999"
                description="Perfect for bloggers and small shop owners launching their first Android app."
                features={[
                  "Android .apk & .aab (release)",
                  "Custom Branded Splash",
                  "Push Notifications Ready",
                  "Email Support (48h response)",
                  "1 Free Rebuild within 30 days",
                  "Play Store upload guide"
                ]}
                buttonText="Get Android Build"
                variant="outline"
                onSelect={() => handleSelectPlan("standard")}
              />
              <PricingCard 
                title="Pro Build"
                price="₹2,499"
                description="For brands & agencies needing a polished, store-ready Android app with priority support."
                features={[
                  "Android .apk & .aab (signed)",
                  "Push Notifications Integrated",
                  "White-Label Branding",
                  "Priority WhatsApp Support",
                  "3 Free Rebuilds within 90 days",
                  "Play Store ready package"
                ]}
                buttonText="Get Pro Build"
                variant="default"
                popular
                onSelect={() => handleSelectPlan("pro")}
              />
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-16 p-8 rounded-2xl glass border-white/[0.08] text-center max-w-3xl mx-auto"
            >
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                  <Zap className="h-6 w-6 text-cyan-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">Agency or Reseller?</h3>
              <p className="text-muted-foreground mb-6">We offer white-label dashboard and bulk pricing for digital agencies. Contact our sales team for custom plans.</p>
              <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold px-8">
                Contact Sales
              </Button>
            </motion.div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}

function PricingCard({ title, price, description, features, buttonText, variant, popular = false, onSelect }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={`p-6 rounded-2xl border ${popular ? 'border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-purple-500/5 shadow-xl shadow-cyan-500/10' : 'border-white/[0.08] glass'} relative flex flex-col`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
          MOST POPULAR
        </div>
      )}
      <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{description}</p>
      <div className="text-4xl font-bold mb-6">
        <span className="text-gradient">{price}</span>
        <span className="text-base font-normal text-muted-foreground"> /app</span>
      </div>
      
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature: string) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
            <CheckCircle2 className={`h-5 w-5 flex-shrink-0 mt-0.5 ${popular ? 'text-cyan-400' : 'text-purple-400'}`} />
            {feature}
          </li>
        ))}
      </ul>
      
      <Button 
        variant={variant} 
        onClick={onSelect}
        className={`w-full h-11 text-sm font-semibold rounded-lg transition-all ${
          popular 
            ? 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white shadow-lg glow-primary hover:scale-[1.02]' 
            : 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20'
        }`}
      >
        {buttonText}
      </Button>
    </motion.div>
  );
}