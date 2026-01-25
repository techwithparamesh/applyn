import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Zap, Globe, ShieldCheck, Smartphone, Star, Sparkles, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";
import heroImg from "@assets/generated_images/website_to_mobile_app_conversion_isometric_illustration.png";
import { motion } from "framer-motion";

export default function Home() {
  const [, setLocation] = useLocation();
  const [websiteUrl, setWebsiteUrl] = useState("");

  const handleGetStarted = () => {
    // Pass plan=preview for free preview flow from homepage
    const baseParams = "plan=preview";
    const createPath = websiteUrl.trim()
      ? `/create?${baseParams}&url=${encodeURIComponent(websiteUrl.trim())}`
      : `/create?${baseParams}`;
    
    // Direct access - no login required to try the app builder
    setLocation(createPath);
  };

  const handlePromptCreate = () => {
    setLocation("/prompt-create");
  };

  return (
    <div className="min-h-screen bg-background bg-mesh selection:bg-primary/30">
      <Navbar />

      <main id="main-content" role="main" aria-label="Main content">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden" aria-labelledby="hero-heading">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-12 gap-16 items-center">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="lg:col-span-7 space-y-8"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 text-sm font-medium text-cyan-400 backdrop-blur-sm">
                  <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  Trusted by 10,000+ Indian Businesses
                </div>
                
                <h1 id="hero-heading" className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
                  <span className="text-white">Your Website is</span> <br />
                  <span className="text-gradient">Your New App.</span>
                </h1>
                
                <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
                  Transform your existing website into a premium, Play Store-ready mobile app in under 5 minutes. No coding, no hassle, just results.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 max-w-lg">
                  <div className="relative flex-1 group">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-cyan-400 transition-colors" aria-hidden="true" />
                    <Input 
                      placeholder="https://yourbusiness.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGetStarted()}
                      aria-label="Enter your website URL"
                      className="h-14 pl-12 text-lg rounded-xl border-white/10 bg-white/5 focus:border-cyan-500/50 text-white placeholder:text-muted-foreground"
                    />
                  </div>
                  <Button 
                    onClick={handleGetStarted}
                    size="lg" 
                    className="h-14 px-8 text-lg font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 shadow-xl glow-primary transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Try Free Preview <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-8 pt-2">
                  {[
                    { label: "No signup required", icon: Zap },
                    { label: "Play Store Ready", icon: ShieldCheck }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <item.icon className="h-5 w-5 text-cyan-400" />
                      {item.label}
                    </div>
                  ))}
                </div>

                {/* Or use AI prompt */}
                <div className="flex items-center gap-4 pt-4 border-t border-white/10 mt-4">
                  <span className="text-sm text-muted-foreground">Or</span>
                  <Button 
                    onClick={handlePromptCreate}
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Describe your app with AI
                  </Button>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-5 relative"
              >
                <div className="relative z-10 glass rounded-3xl p-6">
                  <img 
                    src={heroImg} 
                    alt="Mockup" 
                    className="w-full h-auto drop-shadow-2xl rounded-2xl"
                  />
                </div>
                {/* Visual Depth Elements */}
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-cyan-500/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>
                <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-purple-500/20 rounded-full blur-[100px] -z-10"></div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Preview */}
        <section className="py-24 mx-4 mb-4">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Why Indian businesses <br /> <span className="text-gradient">love Applyn.</span></h2>
              <p className="text-lg text-muted-foreground">We built this specifically for the Indian market dynamics.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <FeatureCard 
                icon={<Smartphone className="h-8 w-8" />}
                title="Native Experience"
                description="Your app feels like it was built from scratch, not just a website wrapper."
                gradient="from-cyan-500/20 to-cyan-500/5"
                iconColor="text-cyan-400"
              />
              <FeatureCard 
                icon={<Star className="h-8 w-8" />}
                title="Store Approval"
                description="We handle all technical compliance. 100% approval rate guaranteed."
                gradient="from-yellow-500/20 to-yellow-500/5"
                iconColor="text-yellow-400"
              />
              <FeatureCard 
                icon={<Zap className="h-8 w-8" />}
                title="WhatsApp Support"
                description="Get onboarding help and app updates directly on your WhatsApp."
                gradient="from-purple-500/20 to-purple-500/5"
                iconColor="text-purple-400"
              />
            </div>
          </div>
        </section>
      </main>

      {/* FAQ Section */}
      <section id="faq" className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-4xl relative z-10">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-white">Got <span className="text-gradient">Questions?</span></h2>
            <p className="text-lg text-muted-foreground">Everything you need to know about the transition.</p>
          </div>
          
          <div className="grid gap-4">
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
    <div className="group p-6 rounded-2xl glass glass-hover transition-all duration-300">
      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">{question}</h3>
      <p className="text-muted-foreground leading-relaxed">{answer}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description, gradient, iconColor }: { icon: React.ReactNode, title: string, description: string, gradient: string, iconColor: string }) {
  return (
    <div className="group p-8 rounded-2xl glass glass-hover transition-all duration-300">
      <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
