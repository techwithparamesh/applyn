import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type UserRole = "admin" | "support" | "user";

type TeamMember = {
  id: string;
  username: string;
  name: string | null;
  role: UserRole;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type Me = {
  id: string;
  username: string;
  name: string | null;
  role: UserRole;
};

export default function AdminTeam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading: meLoading } = useQuery<Me | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (meLoading) return;
    if (!me) {
      setLocation(`/login?returnTo=${encodeURIComponent("/admin/team")}`);
      return;
    }
    if (me.role !== "admin") {
      setLocation("/dashboard");
      toast({
        title: "Access denied",
        description: "Admin access required.",
        variant: "destructive",
      });
    }
  }, [meLoading, me, setLocation, toast]);

  const { data: team, isLoading: teamLoading, error: teamError } = useQuery<TeamMember[]>({
    queryKey: ["/api/admin/team-members"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me && me.role === "admin",
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("support");

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && email.includes("@") && (role === "admin" || role === "support");
  }, [email, role]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/team-members", {
        email,
        role,
      });
      return (await res.json()) as { user: TeamMember; tempPassword: string };
    },
    onSuccess: async (payload) => {
      setEmail("");
      setRole("support");
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/team-members"] });
      toast({
        title: "Team member created",
        description: `Temporary password: ${payload.tempPassword}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not create team member",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3 items-end">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="support@yourcompany.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!canSubmit || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Add team member"}
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-semibold">Members</div>
              {teamError && (
                <div className="mt-2 text-sm text-destructive">{String(teamError)}</div>
              )}
              {teamLoading ? (
                <div className="mt-2 text-sm text-muted-foreground">Loading...</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {(team || []).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-md border bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.username}</div>
                        <div className="text-xs text-muted-foreground">{u.role}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{u.name || "—"}</div>
                    </div>
                  ))}
                  {(team || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">No team members yet.</div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>
              This MVP creates a team account with a temporary password. Share it securely with the
              teammate and have them change it after first login.
            </div>
            <div>
              Build logs are restricted to Admin/Support and never returned to end users.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
