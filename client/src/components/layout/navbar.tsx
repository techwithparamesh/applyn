import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Smartphone, Plus, LogOut, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const [location] = useLocation();
  const isDashboard = location.startsWith("/dashboard") || location.startsWith("/create");

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/">
          <div className="flex items-center gap-2 font-bold text-xl text-primary cursor-pointer">
            <Smartphone className="h-6 w-6" />
            <span>WebToApp</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {!isDashboard ? (
            <>
              <Link href="/features">
                <a className={`text-sm font-medium transition-colors hover:text-primary ${location === "/features" ? "text-primary font-semibold" : "text-muted-foreground"}`}>Features</a>
              </Link>
              <Link href="/pricing">
                <a className={`text-sm font-medium transition-colors hover:text-primary ${location === "/pricing" ? "text-primary font-semibold" : "text-muted-foreground"}`}>Pricing</a>
              </Link>
              <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">FAQ</a>
              <div className="h-6 w-px bg-border" />
              <Link href="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link href="/create">
                <Button size="sm" className="bg-primary hover:bg-primary/90">Convert URL</Button>
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
        <div className="md:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </nav>
  );
}