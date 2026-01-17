import { Navbar } from "@/components/layout/navbar";
import { motion } from "framer-motion";

export default function FAQ() {
  return (
    <div className="min-h-screen bg-mesh selection:bg-primary/30">
      <Navbar />
      
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-20 space-y-4"
          >
            <h1 className="text-5xl md:text-7xl font-extrabold text-gradient">Help Center</h1>
            <p className="text-xl text-slate-400">Everything you need to know about WebToApp.</p>
          </motion.div>
          
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
            <FAQItem 
              question="Do I get the source code?"
              answer="Yes, in our Pro plan, we provide the complete build files ready for submission. We also offer a managed service if you want us to handle the publishing for you."
            />
          </div>
        </div>
      </section>

      <footer className="py-20 bg-slate-900 text-white border-t border-white/5">
        <div className="container mx-auto px-6 text-center text-slate-500 text-sm">
          © 2026 WebToApp. Built for the Next Billion Users.
        </div>
      </footer>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-primary/30 hover:bg-white/[0.07] transition-all duration-300"
    >
      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary transition-colors">{question}</h3>
      <p className="text-slate-400 leading-relaxed">{answer}</p>
    </motion.div>
  );
}