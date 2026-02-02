import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Contact() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subject = params.get("subject") || "";
    const message = params.get("message") || "";

    if (!subject && !message) return;

    setForm((prev) => ({
      ...prev,
      subject: prev.subject || subject,
      message: prev.message || message,
    }));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/contact", form);
      toast({
        title: "Message sent",
        description: "We will get back to you shortly.",
      });
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err: any) {
      toast({
        title: "Could not send",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background selection:bg-cyan-500/30">
      <Navbar />
      
      <main className="container mx-auto px-4 md:px-6 py-20 relative">
        {/* Background Glow */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10" />
        
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12 space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mx-auto">
              <Sparkles className="h-4 w-4" />
              We're Here to Help
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="text-gradient">Get in Touch</span>
            </h1>
            <p className="text-lg text-muted-foreground">We're here to help you scale your business mobile-first.</p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-10">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl space-y-6 border-white/[0.08]">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl text-cyan-400 border border-white/10">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Email Us</h3>
                    <p className="text-muted-foreground">support@applyn.co.in</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl text-purple-400 border border-white/10">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">WhatsApp Support</h3>
                    <p className="text-muted-foreground">+91 98765 43210</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl text-green-400 border border-white/10">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Office</h3>
                    <p className="text-muted-foreground">Hitech City, Hyderabad,<br />Telangana, India</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <Card className="glass border-white/[0.08] rounded-2xl">
              <CardContent className="p-6">
                <form className="space-y-5" onSubmit={onSubmit}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-muted-foreground">Full Name</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        className="h-11 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white rounded-lg"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        className="h-11 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white rounded-lg"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-muted-foreground">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="How can we help?"
                      className="h-11 bg-white/5 border-white/10 focus:border-cyan-500/50 text-white rounded-lg"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-muted-foreground">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us more about your project..."
                      className="bg-white/5 border-white/10 focus:border-cyan-500/50 text-white rounded-lg min-h-[120px]"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      required
                    />
                  </div>
                  <Button 
                    className="w-full h-11 font-semibold gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white shadow-lg" 
                    disabled={loading}
                  >
                    <Send className="h-4 w-4" /> {loading ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}