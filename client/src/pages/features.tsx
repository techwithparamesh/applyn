import { Navbar } from "@/components/layout/navbar";
import { CheckCircle2, Zap, Globe, ShieldCheck, Smartphone, Bell, RefreshCw, Layers } from "lucide-react";
import { motion } from "framer-motion";
import featureImg from "@assets/generated_images/saas_platform_dashboard_features_illustration.png";

export default function Features() {
  return (
    <div className="min-h-screen bg-mesh selection:bg-primary/30">
      <Navbar />
      
      <section className="py-24 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex-1 space-y-8"
            >
              <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-gradient leading-[1.1]">
                Powerful Features to <span className="text-primary">Scale</span> Your Business
              </h1>
              <p className="text-xl text-slate-400 leading-relaxed max-w-xl">
                Everything you need to convert your website into a high-performance mobile application without writing a single line of code.
              </p>
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-primary font-bold text-2xl mb-1">99.9%</div>
                  <div className="text-slate-500 text-sm uppercase tracking-wider">Uptime</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-primary font-bold text-2xl mb-1">&lt; 2s</div>
                  <div className="text-slate-500 text-sm uppercase tracking-wider">Load Time</div>
                </div>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="flex-1 relative"
            >
              <div className="relative z-10 glass rounded-[2.5rem] p-6">
                <img src={featureImg} alt="Features" className="w-full h-auto drop-shadow-2xl rounded-xl" />
              </div>
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -z-10"></div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-32 bg-slate-900/50 border-y border-white/5">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
            <FeatureItem 
              icon={<Bell className="h-10 w-10 text-primary" />}
              title="Push Notifications"
              description="Keep users engaged with personalized alerts and updates sent directly to their devices."
            />
            <FeatureItem 
              icon={<RefreshCw className="h-10 w-10 text-primary" />}
              title="Smart Sync"
              description="Your app automatically stays in sync with your website content. Zero maintenance required."
            />
            <FeatureItem 
              icon={<Globe className="h-10 w-10 text-primary" />}
              title="Regional Ready"
              description="Built-in support for multiple languages including Telugu and Hindi for local markets."
            />
             <FeatureItem 
              icon={<ShieldCheck className="h-10 w-10 text-primary" />}
              title="Store Optimization"
              description="We handle the technical heavy lifting to ensure 100% store compliance and high ratings."
            />
            <FeatureItem 
              icon={<Layers className="h-10 w-10 text-primary" />}
              title="White-Label Mastery"
              description="Full control over branding. Your logo, your colors, your splash screen. No compromise."
            />
            <FeatureItem 
              icon={<Smartphone className="h-10 w-10 text-primary" />}
              title="Performance First"
              description="Native-like scrolling and animations ensure a premium experience for every user."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="p-8 rounded-[2rem] bg-white/5 border border-white/10 hover:border-primary/20 transition-all"
    >
      <div className="mb-6 p-4 bg-primary/10 rounded-2xl w-fit">{icon}</div>
      <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </motion.div>
  );
}