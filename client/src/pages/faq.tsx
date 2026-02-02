import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion } from "framer-motion";
import { HelpCircle, Sparkles } from "lucide-react";

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background selection:bg-cyan-500/30 flex flex-col">
      <Navbar />
      
      <main className="flex-1 relative">
        {/* Background Glow */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10" />
        
        <section className="py-20 relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-16 space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mx-auto">
                <Sparkles className="h-4 w-4" />
                Help Center
              </div>
              <h1 className="text-4xl md:text-6xl font-bold">
                <span className="text-gradient">Frequently Asked Questions</span>
              </h1>
              <p className="text-lg text-muted-foreground">Everything you need to know about Applyn.</p>
            </motion.div>
            
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
              <FAQItem 
                question="Do I get the source code?"
                answer="Yes, in our Pro plan, we provide the complete build files ready for submission. We also offer a managed service if you want us to handle the publishing for you."
              />
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
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group p-6 rounded-2xl glass border-white/[0.08] hover:border-cyan-500/20 transition-all duration-300"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-lg text-cyan-400 border border-white/10 mt-0.5">
          <HelpCircle className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">{question}</h3>
          <p className="text-muted-foreground leading-relaxed">{answer}</p>
        </div>
      </div>
    </motion.div>
  );
}