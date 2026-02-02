import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { CheckCircle2, Zap, Globe, ShieldCheck, Smartphone, Bell, RefreshCw, Layers, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import featureImg from "@assets/generated_images/saas_platform_dashboard_features_illustration.png";

export default function Features() {
  return (
    <div className="min-h-screen bg-background selection:bg-cyan-500/30">
      <Navbar />
      
      <section className="py-20 overflow-hidden relative">
        {/* Background Glow */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10" />
        
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex-1 space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                Enterprise Grade
              </div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                <span className="text-white">Powerful Features to </span>
                <span className="text-gradient">Scale Your Business</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
                Everything you need to convert your website into a high-performance mobile application without writing a single line of code.
              </p>
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 rounded-xl glass border-white/[0.08]">
                  <div className="text-gradient font-bold text-2xl mb-1">99.9%</div>
                  <div className="text-muted-foreground text-sm uppercase tracking-wider">Uptime</div>
                </div>
                <div className="p-4 rounded-xl glass border-white/[0.08]">
                  <div className="text-gradient font-bold text-2xl mb-1">&lt; 2s</div>
                  <div className="text-muted-foreground text-sm uppercase tracking-wider">Load Time</div>
                </div>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="flex-1 relative"
            >
              <div className="relative z-10 glass rounded-2xl p-6 border-white/[0.08]">
                <img src={featureImg} alt="Features" className="w-full h-auto drop-shadow-2xl rounded-xl" />
              </div>
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-cyan-500/20 rounded-full blur-[100px] -z-10"></div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-white/[0.02] border-y border-white/[0.05]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureItem 
              icon={<Bell className="h-8 w-8" />}
              title="Push Notifications"
              description="Keep users engaged with personalized alerts and updates sent directly to their devices."
              gradient="from-cyan-500/20 to-blue-500/20"
              iconColor="text-cyan-400"
            />
            <FeatureItem 
              icon={<RefreshCw className="h-8 w-8" />}
              title="Smart Sync"
              description="Your app automatically stays in sync with your website content. Zero maintenance required."
              gradient="from-purple-500/20 to-pink-500/20"
              iconColor="text-purple-400"
            />
            <FeatureItem 
              icon={<Globe className="h-8 w-8" />}
              title="Regional Ready"
              description="Built-in support for multiple languages including Telugu and Hindi for local markets."
              gradient="from-green-500/20 to-emerald-500/20"
              iconColor="text-green-400"
            />
             <FeatureItem 
              icon={<ShieldCheck className="h-8 w-8" />}
              title="Store Optimization"
              description="We handle the technical heavy lifting to ensure 100% store compliance and high ratings."
              gradient="from-orange-500/20 to-amber-500/20"
              iconColor="text-orange-400"
            />
            <FeatureItem 
              icon={<Layers className="h-8 w-8" />}
              title="White-Label Mastery"
              description="Full control over branding. Your logo, your colors, your splash screen. No compromise."
              gradient="from-pink-500/20 to-rose-500/20"
              iconColor="text-pink-400"
            />
            <FeatureItem 
              icon={<Smartphone className="h-8 w-8" />}
              title="Performance First"
              description="Native-like scrolling and animations ensure a premium experience for every user."
              gradient="from-blue-500/20 to-indigo-500/20"
              iconColor="text-blue-400"
            />
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

function FeatureItem({ icon, title, description, gradient, iconColor }: { icon: React.ReactNode, title: string, description: string, gradient: string, iconColor: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="p-6 rounded-2xl glass border-white/[0.08] hover:border-cyan-500/20 transition-all group"
    >
      <div className={`mb-5 p-3 bg-gradient-to-br ${gradient} rounded-xl w-fit border border-white/10 ${iconColor}`}>{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}