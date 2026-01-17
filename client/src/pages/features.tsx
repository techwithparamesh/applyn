import { Navbar } from "@/components/layout/navbar";
import { CheckCircle2, Zap, Globe, ShieldCheck, Smartphone, Bell, RefreshCw, Layers } from "lucide-react";
import { motion } from "framer-motion";
import featureImg from "@assets/generated_images/saas_platform_dashboard_features_illustration.png";

export default function Features() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 space-y-6"
            >
              <h1 className="text-5xl font-bold tracking-tight text-slate-900 leading-tight">
                Powerful Features to <span className="text-primary">Scale</span> Your Business
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Everything you need to convert your website into a high-performance mobile application without writing a single line of code.
              </p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1"
            >
              <img src={featureImg} alt="Features" className="w-full h-auto drop-shadow-2xl" />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-50 border-y">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
            <FeatureItem 
              icon={<Bell className="h-10 w-10 text-primary" />}
              title="Unlimited Push Notifications"
              description="Send real-time alerts to your users to keep them engaged and coming back for more."
            />
            <FeatureItem 
              icon={<RefreshCw className="h-10 w-10 text-primary" />}
              title="Auto-Sync Content"
              description="Any change you make to your website is instantly reflected in your mobile app."
            />
            <FeatureItem 
              icon={<Globe className="h-10 w-10 text-primary" />}
              title="Multi-Language Support"
              description="Full support for English, Telugu, and other regional languages to reach a wider audience."
            />
             <FeatureItem 
              icon={<ShieldCheck className="h-10 w-10 text-primary" />}
              title="Security First"
              description="We ensure your app follows all security protocols for Play Store & App Store compliance."
            />
            <FeatureItem 
              icon={<Layers className="h-10 w-10 text-primary" />}
              title="White-Label Ready"
              description="Remove our branding and use your own logo, splash screens, and colors."
            />
            <FeatureItem 
              icon={<Smartphone className="h-10 w-10 text-primary" />}
              title="Offline Access"
              description="Let users access critical parts of your content even when they are not connected to the internet."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-white rounded-2xl w-fit shadow-sm border border-slate-100">{icon}</div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}