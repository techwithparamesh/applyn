import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { useState } from "react";
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
    <div className="min-h-screen bg-mesh selection:bg-primary/30">
      <Navbar />
      
      <main className="container mx-auto px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16 space-y-4"
          >
            <h1 className="text-5xl md:text-7xl font-extrabold text-gradient">Get in Touch</h1>
            <p className="text-xl text-slate-400">We're here to help you scale your business mobile-first.</p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <div className="glass p-8 rounded-3xl space-y-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Email Us</h3>
                    <p className="text-slate-400">support@webtoapp.in</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary">
                    <Phone className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">WhatsApp Support</h3>
                    <p className="text-slate-400">+91 98765 43210</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Office</h3>
                    <p className="text-slate-400">Hitech City, Hyderabad,<br />Telangana, India</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <Card className="glass border-none p-8 rounded-3xl">
              <form className="space-y-6" onSubmit={onSubmit}>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      className="bg-white/5 border-white/10"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      className="bg-white/5 border-white/10"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="How can we help?"
                    className="bg-white/5 border-white/10"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us more about your project..."
                    className="bg-white/5 border-white/10 min-h-[150px]"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                  />
                </div>
                <Button className="w-full h-12 font-bold gap-2" disabled={loading}>
                  <Send className="h-4 w-4" /> Send Message
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}