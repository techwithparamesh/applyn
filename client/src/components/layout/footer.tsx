import { Link } from "wouter";
import { Mail, Phone, MapPin, Sparkles } from "lucide-react";


export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-background/80">
      <div className="container mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-4 mb-14">
          <div className="col-span-1 md:col-span-1 space-y-4">
            <Link href="/">
              <div className="flex items-center cursor-pointer group gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight text-gradient">
                  Applyn
                </span>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Transform any website into a native mobile app in minutes. No coding required.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-5 text-sm">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/features" className="text-muted-foreground hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="text-muted-foreground hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/create" className="text-muted-foreground hover:text-white transition-colors">Convert URL</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-5 text-sm">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/contact" className="text-muted-foreground hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link href="/faq" className="text-muted-foreground hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/privacy" className="text-muted-foreground hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-5 text-sm">Contact</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-cyan-400" />
                </div>
                <a className="text-muted-foreground hover:text-white transition-colors" href="mailto:support@applyn.co.in">support@applyn.co.in</a>
              </li>
              <li className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-purple-400" />
                </div>
                <a className="text-muted-foreground hover:text-white transition-colors" href="tel:+919876543210">+91 98765 43210</a>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center mt-0.5">
                  <MapPin className="h-4 w-4 text-green-400" />
                </div>
                <a
                  className="text-muted-foreground hover:text-white transition-colors"
                  href="https://www.google.com/maps/search/?api=1&query=Hitech%20City%2C%20Hyderabad"
                  target="_blank"
                  rel="noreferrer"
                >
                  Hitech City, Hyderabad,<br />Telangana, India
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-white/[0.08] flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>© 2026 Applyn. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <a href="#" className="hover:text-white transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}