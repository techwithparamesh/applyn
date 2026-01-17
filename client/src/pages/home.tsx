import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ArrowRight, Zap, Globe, Smartphone, ShieldCheck, Star } from "lucide-react";
import { useLocation } from "wouter";
import heroImg from "@assets/generated_images/website_to_mobile_app_conversion_isometric_illustration.png";
import { motion } from "framer-motion";

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white selection:bg-blue-100">
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-40 overflow-hidden">
          {/* Background Decorative Elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 opacity-50">
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-50 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-50 rounded-full blur-[120px]" />
          </div>

          <div className="container mx-auto px-6">
            <div className="flex flex-col items-center text-center space-y-12">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-6 max-w-4xl"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-sm font-bold text-blue-600 mb-4">
                  <Star className="h-4 w-4 fill-blue-600" />
                  Made for Indian businesses
                </div>
                
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.95]">
                  Your website.<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Now an app.</span>
                </h1>
                
                <p className="text-xl md:text-2xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
                  Turn any website into a mobile app in minutes — no code required.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="w-full max-w-xl space-y-6"
              >
                <div className="flex flex-col sm:flex-row gap-4 p-2 bg-slate-50 border border-slate-100 rounded-[2rem] shadow-sm">
                  <div className="relative flex-1 group">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <Input 
                      placeholder="Enter your website URL" 
                      className="h-14 pl-12 border-none bg-transparent shadow-none focus-visible:ring-0 text-slate-900 text-lg"
                    />
                  </div>
                  <Button 
                    onClick={() => setLocation("/create")}
                    size="lg" 
                    className="h-14 px-10 text-lg font-bold rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95 border-none"
                  >
                    Create My App
                  </Button>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <button 
                    onClick={() => setLocation("/features")}
                    className="text-slate-500 font-bold hover:text-blue-600 transition-colors flex items-center gap-2 group"
                  >
                    See how it works <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  
                  <p className="text-sm font-medium text-slate-400">
                    Free preview · No credit card required
                  </p>
                </div>

                <div className="flex justify-center items-center gap-8 pt-8 opacity-60 grayscale hover:grayscale-0 transition-all">
                  <div className="flex items-center gap-2 font-bold text-slate-600">
                    <Smartphone className="h-6 w-6" />
                    Android
                  </div>
                  <div className="flex items-center gap-2 font-bold text-slate-600">
                    <Smartphone className="h-6 w-6 rotate-180" />
                    iOS
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.4 }}
                className="relative mt-20 w-full max-w-5xl mx-auto px-4"
              >
                <div className="relative z-10 p-4 bg-white rounded-[3rem] shadow-2xl border border-slate-100">
                   <div className="overflow-hidden rounded-[2rem] bg-slate-50 aspect-video flex items-center justify-center border border-slate-100">
                      <img 
                        src={heroImg} 
                        alt="Applyn Dashboard Preview" 
                        className="w-full h-auto object-cover"
                      />
                   </div>
                </div>
                {/* Visual accents */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl -z-10" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-400/20 rounded-full blur-3xl -z-10" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Value Prop Preview */}
        <section className="py-24 bg-slate-50/50">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12">
               <div className="space-y-4">
                  <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                    <Zap className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Instant Conversion</h3>
                  <p className="text-slate-600 leading-relaxed">Turn your URL into a production-ready mobile app package in under 5 minutes.</p>
               </div>
               <div className="space-y-4">
                  <div className="h-12 w-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Store Compliant</h3>
                  <p className="text-slate-600 leading-relaxed">We handle all technical requirements for Play Store and App Store approval.</p>
               </div>
               <div className="space-y-4">
                  <div className="h-12 w-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                    <Globe className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Global Reach</h3>
                  <p className="text-slate-600 leading-relaxed">Optimized performance for 2G/3G networks and multi-language support built-in.</p>
               </div>
            </div>
          </div>
        </section>
      </main>

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
