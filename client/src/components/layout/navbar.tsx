import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut, Menu, LifeBuoy, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type ProductionRequestsMeta = {
  totalCount: number;
};

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
          "relative px-3 py-2 text-[15px] font-medium transition-colors rounded-lg" +
          (active
            ? " text-white bg-white/5"
            : " text-slate-300 hover:text-white hover:bg-white/5")
        }
      >
        {label}
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
  const isStaff = role === "admin" || role === "support" || role === "staff";
  const isSupport = role === "support";
  const isAdmin = role === "admin";
  const permissions = Array.isArray((me as any)?.permissions) ? ((me as any).permissions as string[]) : [];
  const canViewFounderConsole = isAdmin || (isStaff && permissions.includes("view_metrics"));

  const { data: productionRequestsMeta } = useQuery<ProductionRequestsMeta | null>({
    queryKey: ["/api/admin/play/production-requests", "meta"],
    enabled: isAuthed && isStaff,
    staleTime: 15_000,
    refetchInterval: 15_000,
    retry: false,
    queryFn: async () => {
      const res = await fetch("/api/admin/play/production-requests?limit=1&offset=0", {
        credentials: "include",
      });

      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      const json = (await res.json()) as any;
      return { totalCount: Number(json?.totalCount ?? 0) };
    },
  });

  const approvalsCount = productionRequestsMeta?.totalCount ?? 0;
  const approvalsCountLabel = approvalsCount > 99 ? "99+" : String(approvalsCount);

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
    <nav className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
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

        <div className="hidden md:flex items-center gap-1">
          {!isAuthed ? (
            <>
              <NavItem href="/" label="Home" currentPath={location} />
              <NavItem href="/features" label="Features" currentPath={location} />
              <NavItem href="/pricing" label="Pricing" currentPath={location} />
              <NavItem href="/faq" label="FAQ" currentPath={location} />
              <NavItem href="/contact" label="Contact" currentPath={location} />
              <div className="h-5 w-px bg-white/10 mx-4" />
              <Link href="/login">
                <Button variant="ghost" className="font-medium text-[15px] text-slate-300 hover:text-white hover:bg-white/5 px-4 h-10">
                  Sign in
                </Button>
              </Link>
              <Link href="/prompt-create">
                <Button
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold px-6 h-10 rounded-lg shadow-lg glow-primary ml-2"
                >
                  Try Free
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/dashboard">
                <Button 
                  variant="ghost" 
                  className={`gap-2 font-medium h-10 px-4 ${
                    location === "/dashboard" 
                      ? "bg-white/10 text-white" 
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/tickets">
                <Button 
                  variant="ghost" 
                  className={`gap-2 font-medium h-10 px-4 ${
                    location === "/tickets" 
                      ? "bg-white/10 text-white" 
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <LifeBuoy className="h-4 w-4" />
                  Tickets
                </Button>
              </Link>
              <div className="h-5 w-px bg-white/10 mx-3" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-white font-semibold text-sm">
                      {initials}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass border-white/10 w-48">
                  <DropdownMenuItem 
                    onClick={() => setLocation("/profile")}
                    className="text-muted-foreground hover:text-white focus:text-white"
                  >
                    Profile
                  </DropdownMenuItem>
                  {/* Hide Billing for support users - they don't manage billing */}
                  {!isSupport && (
                    <DropdownMenuItem 
                      onClick={() => setLocation("/billing")}
                      className="text-muted-foreground hover:text-white focus:text-white"
                    >
                      Billing
                    </DropdownMenuItem>
                  )}
                  {isStaff && (
                    <DropdownMenuItem 
                      onClick={() => setLocation("/ops")}
                      className="text-muted-foreground hover:text-white focus:text-white"
                    >
                      Ops
                    </DropdownMenuItem>
                  )}
                  {isStaff && (
                    <DropdownMenuItem 
                      onClick={() => setLocation("/admin/play-approvals")}
                      className="text-muted-foreground hover:text-white focus:text-white"
                    >
                      <span className="flex w-full items-center justify-between">
                        <span>Play Approvals</span>
                        {approvalsCount > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-6 h-5 px-2 rounded-full bg-amber-500/20 text-amber-200 text-xs font-semibold">
                            {approvalsCountLabel}
                          </span>
                        ) : null}
                      </span>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem 
                      onClick={() => setLocation("/admin/team")}
                      className="text-muted-foreground hover:text-white focus:text-white"
                    >
                      Team
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem 
                      onClick={() => setLocation("/admin/users")}
                      className="text-muted-foreground hover:text-white focus:text-white"
                    >
                      Users
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem 
                      onClick={() => setLocation("/admin/analytics")}
                      className="text-muted-foreground hover:text-white focus:text-white"
                    >
                      Analytics
                    </DropdownMenuItem>
                  )}
                  {canViewFounderConsole && (
                    <DropdownMenuItem
                      onClick={() => setLocation("/admin/founder")}
                      className="text-muted-foreground hover:text-white focus:text-white"
                    >
                      Founder Console
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem 
                      onClick={() => setLocation("/admin/audit-logs")}
                      className="text-muted-foreground hover:text-white focus:text-white"
                    >
                      Audit Logs
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem 
                    className="text-red-400 hover:text-red-300 focus:text-red-300" 
                    onClick={handleLogout}
                  >
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
                        <Button className="w-full" onClick={() => setLocation("/create")}>
                          Try Free
                        </Button>
                      </SheetClose>
                    </div>
                  </>
                ) : (
                  <>
                    <MobileLink label="Dashboard" onClick={() => setLocation("/dashboard")} />
                    <MobileLink label="My Tickets" onClick={() => setLocation("/tickets")} />
                    <MobileLink label="Profile" onClick={() => setLocation("/profile")} />
                    {/* Hide Billing for support users */}
                    {!isSupport && (
                      <MobileLink label="Billing" onClick={() => setLocation("/billing")} />
                    )}
                    {/* Ops for staff only */}
                    {isStaff && (
                      <MobileLink label="Ops" onClick={() => setLocation("/ops")} />
                    )}
                    {isStaff && (
                      <MobileLink
                        label={approvalsCount > 0 ? `Play Approvals (${approvalsCountLabel})` : "Play Approvals"}
                        onClick={() => setLocation("/admin/play-approvals")}
                      />
                    )}
                    {/* Team for admin only */}
                    {isAdmin && (
                      <MobileLink label="Team" onClick={() => setLocation("/admin/team")} />
                    )}
                    {/* Users for admin only */}
                    {isAdmin && (
                      <MobileLink label="Users" onClick={() => setLocation("/admin/users")} />
                    )}
                    {/* Analytics for admin only */}
                    {isAdmin && (
                      <MobileLink label="Analytics" onClick={() => setLocation("/admin/analytics")} />
                    )}
                    {/* Audit Logs for admin only */}
                    {isAdmin && (
                      <MobileLink label="Audit Logs" onClick={() => setLocation("/admin/audit-logs")} />
                    )}
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