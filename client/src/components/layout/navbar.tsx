import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Smartphone, Plus, LogOut, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import logoImg from "@assets/ChatGPT_Image_Jan_17,_2026,_01_09_57_PM_1768635605492.png";

export function Navbar() {
  const [location] = useLocation();
  const isDashboard = location.startsWith("/dashboard") || location.startsWith("/create");

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        <Link href="/">
          <div className="flex items-center cursor-pointer group">
            <img 
              src={logoImg} 
              alt="Applyn Logo" 
              className="h-14 w-auto object-contain transition-transform group-hover:scale-105" 
            />
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {!isDashboard ? (
            <>
              <Link href="/">
                <a className={`text-sm font-bold tracking-tight transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-slate-600"}`}>Home</a>
              </Link>
              <Link href="/pricing">
                <a className={`text-sm font-bold tracking-tight transition-colors hover:text-primary ${location === "/pricing" ? "text-primary" : "text-slate-600"}`}>Pricing</a>
              </Link>
              <Link href="/faq">
                <a className={`text-sm font-bold tracking-tight transition-colors hover:text-primary ${location === "/faq" ? "text-primary" : "text-slate-600"}`}>FAQ</a>
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <Link href="/login">
                <button className="text-sm font-bold text-slate-600 hover:text-primary transition-colors cursor-pointer">Sign in</button>
              </Link>
              <Link href="/create">
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-8 h-12 rounded-full shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 border-none">
                  Create My App
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/dashboard">
                <Button variant={location === "/dashboard" ? "secondary" : "ghost"} size="sm" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/create">
                <Button variant={location === "/create" ? "secondary" : "ghost"} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New App
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      JD
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Billing</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden flex items-center gap-4">
          <Link href="/create">
            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-full px-4 border-none text-xs">
              Create My App
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="text-slate-900">
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </nav>
  );
}