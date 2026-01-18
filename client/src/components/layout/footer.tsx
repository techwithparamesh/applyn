import { Link } from "wouter";
import { Smartphone, Mail, Phone, MapPin } from "lucide-react";


export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/60 text-slate-300">
      <div className="container mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-4 mb-14">
          <div className="col-span-1 md:col-span-1 space-y-6">
            <Link href="/">
              <div className="flex items-center cursor-pointer group -ml-2">
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-400 to-sky-300 bg-clip-text text-transparent drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]">
                    Applyn
                  </span>
                  <span className="text-sm font-medium text-slate-300/70">
                    Turn any website into an app.
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div>
            <h4 className="font-bold text-slate-100 mb-6 uppercase tracking-wider text-xs">Product</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/login?returnTo=%2Fcreate" className="hover:text-white transition-colors">Convert URL</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">Showcase</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-100 mb-6 uppercase tracking-wider text-xs">Company</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="font-bold text-slate-100 mb-6 uppercase tracking-wider text-xs">Contact</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <a className="hover:text-white transition-colors" href="mailto:support@webtoapp.in">support@webtoapp.in</a>
              </li>
              <li className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <a className="hover:text-white transition-colors" href="tel:+919876543210">+91 98765 43210</a>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <a
                  className="hover:text-white transition-colors"
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
        
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500">
          <p>© 2026 Applyn. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-slate-200 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-200 transition-colors">Cookies</a>
            <a href="#" className="hover:text-slate-200 transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}