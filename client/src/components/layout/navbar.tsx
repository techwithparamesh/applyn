import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Plus, LogOut, Menu, LifeBuoy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


function NavItem({
  href,
  label,
  currentPath,
}: {
  href: string;
  label: string;
  currentPath: string;
}) {
  const active = currentPath === href;
  return (
    <Link href={href}>
      <a
        aria-current={active ? "page" : undefined}
        className={
          "relative text-sm font-semibold transition-colors" +
          (active
            ? " text-white"
            : " text-slate-200/80 hover:text-white")
        }
      >
        {label}
        <span
          className={
            "pointer-events-none absolute -bottom-2 left-0 h-px w-full bg-primary transition-opacity" +
            (active ? " opacity-100" : " opacity-0")
          }
        />
      </a>
    </Link>
  );
}

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { data: me } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const isAuthed = !!me;
  const role = ((me as any)?.role as string | undefined) || "user";
  const isStaff = role === "admin" || role === "support";

  const initials = (() => {
    const name = (me as any)?.name as string | null | undefined;
    const username = (me as any)?.username as string | undefined;
    const base = (name && name.trim().length > 0 ? name : username) || "";
    const first = base.trim()[0]?.toUpperCase();
    return first || "U";
  })();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } finally {
      queryClient.clear();
      setLocation("/");
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-24 items-center justify-between px-4">
        <Link href="/">
          <div className="flex items-center cursor-pointer group">
            <span className="text-xl font-semibold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-400 to-sky-300 bg-clip-text text-transparent">
              Applyn
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {!isAuthed ? (
            <>
              <NavItem href="/" label="Home" currentPath={location} />
              <NavItem href="/features" label="Features" currentPath={location} />
              <NavItem href="/pricing" label="Pricing" currentPath={location} />
              <NavItem href="/faq" label="FAQ" currentPath={location} />
              <NavItem href="/contact" label="Contact" currentPath={location} />
              <div className="h-6 w-px bg-white/10" />
              <Link href="/login">
                <Button variant="ghost" size="sm" className="font-semibold text-slate-200/80 hover:text-white hover:bg-white/5">
                  Sign in
                </Button>
              </Link>
              <Link href="/login?returnTo=%2Fcreate">
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-black font-extrabold px-6 rounded-xl shadow-lg shadow-primary/20 transition-transform hover:scale-[1.03] active:scale-[0.98]"
                >
                  Get Started
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
              <Link href="/tickets">
                <Button variant={location === "/tickets" ? "secondary" : "ghost"} size="sm" className="gap-2">
                  <LifeBuoy className="h-4 w-4" />
                  Tickets
                </Button>
              </Link>
              <Link href="/create">
                <Button variant={location === "/create" ? "secondary" : "ghost"} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New App
                </Button>
              </Link>
              <div className="h-6 w-px bg-white/10" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5">
                    <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-100 font-bold">
                      {initials}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation("/profile")}>Profile</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/billing")}>Billing</DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem onClick={() => setLocation("/ops")}>Ops</DropdownMenuItem>
                  )}
                  {role === "admin" && (
                    <DropdownMenuItem onClick={() => setLocation("/admin/team")}>Team</DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
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
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-background text-slate-100 border-white/10">
              <div className="mt-10 space-y-4">
                {!isAuthed ? (
                  <>
                    <MobileLink label="Home" onClick={() => setLocation("/")} />
                    <MobileLink label="Features" onClick={() => setLocation("/features")} />
                    <MobileLink label="Pricing" onClick={() => setLocation("/pricing")} />
                    <MobileLink label="FAQ" onClick={() => setLocation("/faq")} />
                    <MobileLink label="Contact" onClick={() => setLocation("/contact")} />
                    <div className="pt-4 space-y-2">
                      <SheetClose asChild>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setLocation("/login")}
                        >
                          Sign in
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button className="w-full" onClick={() => setLocation("/login?returnTo=%2Fcreate")}>
                          Get Started
                        </Button>
                      </SheetClose>
                    </div>
                  </>
                ) : (
                  <>
                    <MobileLink label="Dashboard" onClick={() => setLocation("/dashboard")} />
                    <MobileLink label="My Tickets" onClick={() => setLocation("/tickets")} />
                    <MobileLink label="Create App" onClick={() => setLocation("/create")} />
                    <MobileLink label="Profile" onClick={() => setLocation("/profile")} />
                    <MobileLink label="Billing" onClick={() => setLocation("/billing")} />
                    <div className="pt-4">
                      <SheetClose asChild>
                        <Button className="w-full" variant="destructive" onClick={handleLogout}>
                          Log out
                        </Button>
                      </SheetClose>
                    </div>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}

function MobileLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <SheetClose asChild>
      <Button
        variant="ghost"
        className="w-full justify-start text-base text-slate-200/90 hover:text-white hover:bg-white/5"
        onClick={onClick}
      >
        {label}
      </Button>
    </SheetClose>
  );
}