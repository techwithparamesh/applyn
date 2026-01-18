import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Plus,
  Download,
  MoreVertical,
  Smartphone,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type AppItem = {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  status: "draft" | "processing" | "live" | "failed" | string;
  platform: "android" | "ios" | "both" | string;
  icon: string;
  primaryColor: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading } = useQuery({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: apps, isLoading: appsLoading } = useQuery<AppItem[]>({
    queryKey: ["/api/apps"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!me,
  });

  useEffect(() => {
    if (!isLoading && !me) {
      setLocation(`/login?returnTo=${encodeURIComponent("/dashboard")}`);
    }
  }, [isLoading, me, setLocation]);

  const handleDelete = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/apps/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/apps"] });
      toast({ title: "Deleted", description: "App removed." });
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">Loading...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Apps</h1>
            <p className="text-muted-foreground">Manage your mobile applications</p>
          </div>
          <Link href="/create">
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Create New App
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appsLoading && (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading your apps...
              </CardContent>
            </Card>
          )}

          {(apps || []).map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                    {app.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{app.name}</CardTitle>
                    <CardDescription className="text-xs truncate max-w-[150px]">
                      {app.url}
                    </CardDescription>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Edit App</DropdownMenuItem>
                    <DropdownMenuItem>Push Notifications</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(app.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>

              <CardContent>
                <div className="mt-4 flex items-center gap-2">
                  <StatusBadge status={app.status} />
                  <span className="text-xs text-muted-foreground">
                    •{" "}
                    {formatDistanceToNow(new Date(app.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </CardContent>

              <CardFooter className="bg-slate-50/50 border-t p-4 flex justify-between items-center">
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Smartphone className="h-3 w-3" />
                  {app.platform === "both"
                    ? "Android & iOS"
                    : app.platform === "ios"
                      ? "iOS Only"
                      : "Android Only"}
                </div>

                {app.status === "live" && (
                  <Button variant="outline" size="sm" className="h-8">
                    <Download className="mr-2 h-3 w-3" /> Download
                  </Button>
                )}

                {app.status === "processing" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground"
                    disabled
                  >
                    <Clock className="mr-2 h-3 w-3" /> Building...
                  </Button>
                )}

                {app.status === "draft" && (
                  <Link href="/create">
                    <Button variant="secondary" size="sm" className="h-8 text-primary">
                      Continue
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
          ))}

          {!appsLoading && (apps || []).length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3 border-dashed">
              <CardContent className="p-8 text-center">
                <h3 className="font-semibold text-slate-900">No apps yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first mobile app from a website.
                </p>
                <div className="mt-4">
                  <Link href="/create">
                    <Button className="shadow-lg shadow-primary/20">
                      <Plus className="mr-2 h-4 w-4" /> Create New App
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "live") {
    return (
      <Badge className="bg-green-500 hover:bg-green-600 gap-1">
        <CheckCircle className="h-3 w-3" /> Live
      </Badge>
    );
  }
  if (status === "processing") {
    return (
      <Badge variant="secondary" className="gap-1 animate-pulse">
        <Clock className="h-3 w-3" /> Processing
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      Draft
    </Badge>
  );
}