import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ArrowRight, Zap, Globe, Smartphone, ShieldCheck, Star } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import heroImg from "@assets/generated_images/website_to_mobile_app_conversion_isometric_illustration.png";
import { motion } from "framer-motion";

export default function Home() {
  const [, setLocation] = useLocation();
  const [websiteUrl, setWebsiteUrl] = useState("");
  
  const { data: me } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const handleGetStarted = () => {
    const createPath = websiteUrl.trim()
      ? `/create?url=${encodeURIComponent(websiteUrl.trim())}`
      : "/create";
    
    if (me) {
      setLocation(createPath);
    } else {
      setLocation(`/login?returnTo=${encodeURIComponent(createPath)}`);
    }
  };

  return (
    <div className="min-h-screen bg-mesh selection:bg-primary/30">
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-12 gap-16 items-center">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="lg:col-span-7 space-y-10"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary backdrop-blur-sm">
                  <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                  Trusted by 10,000+ Indian Businesses
                </div>
                
                <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight text-slate-900 leading-[0.95] text-gradient">
                  Your Website is <br />
                  <span className="text-primary">Your New App.</span>
                </h1>
                
                <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
                  Transform your existing website into a premium, Play Store-ready mobile app in under 5 minutes. No coding, no hassle, just results.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 max-w-lg">
                  <div className="relative flex-1 group">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input 
                      placeholder="https://yourbusiness.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGetStarted()}
                      className="h-14 pl-12 text-lg rounded-2xl border-white/10 bg-white/5 shadow-sm focus:ring-primary/20 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <Button 
                    onClick={handleGetStarted}
                    size="lg" 
                    className="h-14 px-8 text-lg font-bold rounded-2xl shadow-xl shadow-primary/25 hover:scale-105 transition-all active:scale-95"
                  >
                    Get Started <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-8 pt-4">
                  {[
                    { label: "Play Store Ready", icon: ShieldCheck },
                    { label: "WhatsApp Updates", icon: Zap }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <item.icon className="h-5 w-5 text-primary" />
                      {item.label}
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-5 relative"
              >
                <div className="relative z-10 glass rounded-[3rem] p-4 p-8">
                  <img 
                    src={heroImg} 
                    alt="Mockup" 
                    className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-2xl"
                  />
                </div>
                {/* Visual Depth Elements */}
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>
                <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-emerald-400/20 rounded-full blur-[100px] -z-10"></div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Preview */}
        <section className="py-32 bg-slate-900 text-white rounded-[4rem] mx-4 mb-4">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mb-20">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">Why Indian businesses <br /> love WebToApp.</h2>
              <p className="text-xl text-slate-400">We built this specifically for the Indian market dynamics.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<Smartphone className="h-10 w-10" />}
                title="Native Experience"
                description="Your app feels like it was built from scratch, not just a website wrapper."
              />
              <FeatureCard 
                icon={<Star className="h-10 w-10 text-yellow-400" />}
                title="Store Approval"
                description="We handle all technical compliance. 100% approval rate guaranteed."
              />
              <FeatureCard 
                icon={<Zap className="h-10 w-10 text-primary" />}
                title="WhatsApp Support"
                description="Get onboarding help and app updates directly on your WhatsApp."
              />
            </div>
          </div>
        </section>
      </main>

      {/* FAQ Section */}
      <section id="faq" className="py-32 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-4xl relative z-10">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-6xl font-extrabold text-gradient">Got Questions?</h2>
            <p className="text-xl text-slate-500">Everything you need to know about the transition.</p>
          </div>
          
          <div className="grid gap-6">
            <FAQItem 
              question="Will my app be approved by Play Store?"
              answer="Absolutely. We follow all Play Store and App Store guidelines. Our templates are built to be compliant, and we've helped 10,000+ apps get approved successfully."
            />
            <FAQItem 
              question="Do I need to pay monthly or yearly?"
              answer="Neither. We believe in simple Indian pricing psychology. Pay once per app and get your build files. Updates are included for the first year (Basic) or lifetime (Pro)."
            />
            <FAQItem 
              question="Can I send push notifications?"
              answer="Yes! Our Pro plan includes full integration with Firebase Cloud Messaging, allowing you to send unlimited notifications to your users' devices instantly."
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  return (
    <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-primary/20 hover:bg-white/10 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary transition-colors">{question}</h3>
      <p className="text-slate-400 leading-relaxed">{answer}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="group p-10 rounded-[2.5rem] bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300">
      <div className="mb-6 text-primary group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-2xl font-bold mb-4">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-lg">{description}</p>
    </div>
  );
}
