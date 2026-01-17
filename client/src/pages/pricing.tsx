import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import pricingImg from "@assets/generated_images/saas_pricing_plans_illustration.png";

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-20 text-center">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-5xl font-bold tracking-tight text-slate-900">
              Simple, Transparent <span className="text-primary">Pricing</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Choose the plan that fits your business needs. No hidden fees.
            </p>
            <div className="pt-8">
                <img src={pricingImg} alt="Pricing" className="w-64 mx-auto drop-shadow-xl" />
            </div>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8">
            <PricingCard 
              title="Basic"
              price="₹999"
              description="Perfect for small businesses and personal blogs."
              features={[
                "Android .apk & .aab Build",
                "Standard WebView Integration",
                "Splash Screen with Branding",
                "Email Support",
                "1 Year of Updates"
              ]}
              buttonText="Start with Basic"
              variant="outline"
            />
            <PricingCard 
              title="Pro"
              price="₹2,499"
              description="Best for growing startups and e-commerce stores."
              features={[
                "Android + iOS Builds",
                "Unlimited Push Notifications",
                "Custom Splash Screen (No Branding)",
                "Offline Mode Support",
                "Priority WhatsApp Support",
                "Lifetime Free Updates"
              ]}
              buttonText="Upgrade to Pro"
              variant="default"
              popular
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function PricingCard({ title, price, description, features, buttonText, variant, popular = false }: any) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`p-8 rounded-3xl border ${popular ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10' : 'border-slate-200 bg-white'} relative`}
    >
      {popular && (
        <div className="absolute top-4 right-4 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
          MOST POPULAR
        </div>
      )}
      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6">{description}</p>
      <div className="text-4xl font-bold mb-8">{price} <span className="text-base font-normal text-muted-foreground">/app</span></div>
      
      <ul className="space-y-4 mb-8">
        {features.map((feature: string) => (
          <li key={feature} className="flex items-center gap-3 text-sm text-slate-600">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      
      <Button variant={variant} className="w-full h-12 text-base font-bold rounded-xl">
        {buttonText}
      </Button>
    </motion.div>
  );
}