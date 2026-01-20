import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
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
    <div className="min-h-screen bg-mesh selection:bg-primary/30 flex flex-col">
      <Navbar />
      
      <div className="flex-1">
        <section className="py-24 text-center">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight text-gradient leading-tight">
                  Simple <span className="text-primary">Transparent</span> Pricing
                </h1>
                <p className="text-xl text-slate-400 mt-6 max-w-2xl mx-auto">
                  No monthly subscriptions. Pay once and own your app files forever. Optimized for the Indian startup ecosystem.
                </p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="pt-12"
              >
                <img src={pricingImg} alt="Pricing" className="w-80 mx-auto drop-shadow-2xl" />
              </motion.div>
            </div>
          </div>
        </section>

        <section className="pb-32">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid md:grid-cols-3 gap-8 items-stretch">
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
            
            <div className="mt-16 p-8 rounded-[2.5rem] bg-white/5 border border-white/10 text-center max-w-3xl mx-auto">
              <h3 className="text-2xl font-bold mb-4">Agency or Reseller?</h3>
              <p className="text-slate-400 mb-6">We offer white-label dashboard and bulk pricing for digital agencies. Contact our sales team for custom plans.</p>
              <Button variant="secondary" className="font-bold">Contact Sales</Button>
            </div>
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
      whileHover={{ y: -5 }}
      className={`p-8 rounded-[2.5rem] border ${popular ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10' : 'border-white/10 bg-white/5'} relative flex flex-col`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
          MOST POPULAR
        </div>
      )}
      <h3 className="text-2xl font-bold mb-2 text-white">{title}</h3>
      <p className="text-slate-400 text-sm mb-6 leading-relaxed">{description}</p>
      <div className="text-4xl font-extrabold mb-8 text-white">{price} <span className="text-base font-normal text-slate-500">/app</span></div>
      
      <ul className="space-y-4 mb-8 flex-1">
        {features.map((feature: string) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            {feature}
          </li>
        ))}
      </ul>
      
      <Button 
        variant={variant} 
        onClick={onSelect}
        className={`w-full h-12 text-base font-bold rounded-xl transition-all ${popular ? 'shadow-lg shadow-primary/20 hover:scale-[1.02] bg-primary text-black hover:bg-primary/90' : 'hover:bg-white/10 text-white border-white/20'}`}
      >
        {buttonText}
      </Button>
    </motion.div>
  );
}