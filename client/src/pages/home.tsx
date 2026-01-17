import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ArrowRight, Zap, Globe, Smartphone, ShieldCheck, Play } from "lucide-react";
import { Link, useLocation } from "wouter";
import heroImage from "@assets/generated_images/website_to_mobile_app_conversion_isometric_illustration.png";
import { motion } from "framer-motion";

export default function Home() {
  const [, setLocation] = useLocation();

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    setLocation("/create");
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-background to-background opacity-50"></div>
        
        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/50 px-3 py-1 text-sm text-primary backdrop-blur-sm shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              v2.0 is live: WhatsApp Integration Added
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
              Convert any <span className="text-primary">Website</span> into an <span className="text-primary">App</span> in minutes.
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
              The easiest way to get your business on the Play Store & App Store. No coding required. Trusted by 10,000+ businesses.
            </p>

            <form onSubmit={handleStart} className="flex flex-col sm:flex-row gap-3 max-w-md">
              <Input 
                placeholder="Enter your website URL..." 
                className="h-12 text-base shadow-sm"
                required
              />
              <Button type="submit" size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20">
                Convert Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>No coding required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Play Store Ready</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="relative z-10">
               <img 
                src={heroImage} 
                alt="Website to App Conversion" 
                className="w-full h-auto drop-shadow-2xl hover:scale-105 transition-transform duration-500"
              />
            </div>
            
            {/* Decorative blobs */}
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl -z-10"></div>
            <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-green-400/20 rounded-full blur-3xl -z-10"></div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50 border-y border-slate-200">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4 text-slate-900">Why choose WebToApp?</h2>
            <p className="text-muted-foreground">
              We don't just wrap your website. We add native features that make it feel like a real app.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Zap className="h-8 w-8 text-yellow-500" />}
              title="Lightning Fast"
              description="Your app loads instantly and caches content for offline access."
            />
            <FeatureCard 
              icon={<Globe className="h-8 w-8 text-blue-500" />}
              title="Push Notifications"
              description="Send unlimited push notifications to engage your users directly."
            />
            <FeatureCard 
              icon={<ShieldCheck className="h-8 w-8 text-green-500" />}
              title="Store Compliant"
              description="100% compliant with Google Play Store & Apple App Store policies."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4 text-slate-900">Simple Indian Pricing</h2>
            <p className="text-muted-foreground">
              Transparent plans designed for Indian startups and small businesses.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="border rounded-2xl p-8 hover:border-primary/50 transition-colors">
              <h3 className="text-xl font-bold mb-2">Basic</h3>
              <div className="text-3xl font-bold mb-4">₹999 <span className="text-sm font-normal text-muted-foreground">/app</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Android .apk & .aab</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Standard WebView</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Email Support</li>
              </ul>
              <Button variant="outline" className="w-full">Get Started</Button>
            </div>

            <div className="border-2 border-primary rounded-2xl p-8 relative overflow-hidden bg-primary/5">
              <div className="absolute top-4 right-4 bg-primary text-white text-xs px-2 py-1 rounded">BEST VALUE</div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-4">₹2,499 <span className="text-sm font-normal text-muted-foreground">/app</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Android + iOS</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Push Notifications</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Custom Splash Screen</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Priority WhatsApp Support</li>
              </ul>
              <Button className="w-full">Get Started</Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-slate-50 border-t">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold mb-12 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border">
              <h3 className="font-bold mb-2">Will my app be approved by Play Store?</h3>
              <p className="text-muted-foreground text-sm">Yes! We follow all standard guidelines to ensure your app is store-ready. We've helped 10,000+ apps get approved.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border">
              <h3 className="font-bold mb-2">Do I need to pay monthly?</h3>
              <p className="text-muted-foreground text-sm">No, our pricing is per app. Pay once and get your build files. Updates are included for 1 year.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats/Social Proof */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
             <div>
               <div className="text-4xl font-bold text-primary mb-2">10k+</div>
               <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Apps Created</div>
             </div>
             <div>
               <div className="text-4xl font-bold text-primary mb-2">5M+</div>
               <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Active Users</div>
             </div>
             <div>
               <div className="text-4xl font-bold text-primary mb-2">99%</div>
               <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Approval Rate</div>
             </div>
             <div>
               <div className="text-4xl font-bold text-primary mb-2">24/7</div>
               <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Support</div>
             </div>
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 font-bold text-xl text-white mb-4">
                <Smartphone className="h-6 w-6" />
                <span>WebToApp</span>
              </div>
              <p className="max-w-xs text-sm text-slate-400">
                Helping businesses go mobile instantly. The #1 Website to App converter for India.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Showcase</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-sm text-slate-500">
            © 2026 WebToApp Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl bg-white border border-slate-100 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow">
      <div className="mb-4 p-3 bg-slate-50 rounded-xl w-fit">{icon}</div>
      <h3 className="text-xl font-bold mb-2 text-slate-900">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}