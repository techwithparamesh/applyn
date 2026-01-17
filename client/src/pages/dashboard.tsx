import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Download, MoreVertical, Smartphone, Clock, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MOCK_APPS = [
  {
    id: 1,
    name: "TechStore India",
    url: "techstore.in",
    status: "live",
    platform: "both",
    icon: "🛍️",
    lastUpdated: "2 hours ago"
  },
  {
    id: 2,
    name: "Daily News Telugu",
    url: "dailynewstelugu.com",
    status: "processing",
    platform: "android",
    icon: "📰",
    lastUpdated: "5 mins ago"
  },
  {
    id: 3,
    name: "Sharma Coaching",
    url: "sharmacoaching.edu",
    status: "draft",
    platform: "android",
    icon: "🎓",
    lastUpdated: "1 day ago"
  }
];

export default function Dashboard() {
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
          {MOCK_APPS.map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                    {app.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{app.name}</CardTitle>
                    <CardDescription className="text-xs truncate max-w-[150px]">{app.url}</CardDescription>
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
                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="mt-4 flex items-center gap-2">
                  <StatusBadge status={app.status} />
                  <span className="text-xs text-muted-foreground">• {app.lastUpdated}</span>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50/50 border-t p-4 flex justify-between items-center">
                 <div className="flex gap-2 text-xs text-muted-foreground">
                    <Smartphone className="h-3 w-3" />
                    {app.platform === 'both' ? 'Android & iOS' : 'Android Only'}
                 </div>
                 {app.status === 'live' && (
                    <Button variant="outline" size="sm" className="h-8">
                      <Download className="mr-2 h-3 w-3" /> Download
                    </Button>
                 )}
                 {app.status === 'processing' && (
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" disabled>
                      <Clock className="mr-2 h-3 w-3" /> Building...
                    </Button>
                 )}
                  {app.status === 'draft' && (
                    <Link href="/create">
                        <Button variant="secondary" size="sm" className="h-8 text-primary">
                        Continue
                        </Button>
                    </Link>
                 )}
              </CardFooter>
            </Card>
          ))}

          {/* New App Placeholder */}
          <Link href="/create">
            <Card className="h-full border-dashed border-2 flex flex-col items-center justify-center p-8 cursor-pointer hover:border-primary/50 hover:bg-slate-50 transition-all group min-h-[200px]">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                <Plus className="h-6 w-6 text-slate-400 group-hover:text-primary" />
              </div>
              <h3 className="font-semibold text-slate-900">Create New App</h3>
              <p className="text-sm text-muted-foreground text-center mt-1">Convert another website</p>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return <Badge className="bg-green-500 hover:bg-green-600 gap-1"><CheckCircle className="h-3 w-3" /> Live</Badge>;
  }
  if (status === 'processing') {
    return <Badge variant="secondary" className="gap-1 animate-pulse"><Clock className="h-3 w-3" /> Processing</Badge>;
  }
  return <Badge variant="outline" className="gap-1">Draft</Badge>;
}