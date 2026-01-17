import { Link } from "wouter";
import { Smartphone, Mail, Phone, MapPin, Github, Twitter, Linkedin } from "lucide-react";

import logoImg from "@assets/ChatGPT_Image_Jan_17,_2026,_01_09_57_PM_1768635605492.png";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-20 border-t border-white/5">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1 space-y-6">
            <Link href="/">
              <div className="flex items-center cursor-pointer group -ml-2">
                <img 
                  src={logoImg} 
                  alt="Applyn Logo" 
                  className="h-14 w-auto object-contain transition-transform group-hover:scale-105" 
                  style={{ filter: 'drop-shadow(0px 0px 1px rgba(255,255,255,0.8)) brightness(1.5) contrast(1.2)' }}
                />
              </div>
            </Link>
            <p className="text-sm leading-relaxed">
              Transforming Indian businesses into mobile-first powerhouses. Instant website to app conversion for the next billion users.
            </p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-primary transition-colors"><Twitter className="h-5 w-5" /></a>
              <a href="#" className="hover:text-primary transition-colors"><Linkedin className="h-5 w-5" /></a>
              <a href="#" className="hover:text-primary transition-colors"><Github className="h-5 w-5" /></a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-white mb-6">Product</h4>
            <ul className="space-y-4 text-sm">
              <li><Link href="/features" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link href="/create" className="hover:text-primary transition-colors">Convert URL</Link></li>
              <li><a href="#" className="hover:text-primary transition-colors">Showcase</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-6">Company</h4>
            <ul className="space-y-4 text-sm">
              <li><Link href="/contact" className="hover:text-primary transition-colors">Contact Us</Link></li>
              <li><Link href="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
              <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="font-bold text-white mb-6">Contact</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" />
                <span>support@webtoapp.in</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-primary" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Hitech City, Hyderabad,<br />Telangana, India</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <p>© 2026 WebToApp Inc. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Cookies</a>
            <a href="#" className="hover:text-white transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}