import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SupportChatbot } from "@/components/support-chatbot";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import CreateApp from "@/pages/create-app";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Features from "@/pages/features";
import Pricing from "@/pages/pricing";
import FAQ from "@/pages/faq";
import Contact from "@/pages/contact";
import Profile from "@/pages/profile";
import Billing from "@/pages/billing";
import AdminTeam from "@/pages/admin-team";
import Ops from "@/pages/ops";
import Tickets from "@/pages/tickets";
import EditApp from "@/pages/edit-app";
import PushNotifications from "@/pages/push-notifications";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/features" component={Features} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/faq" component={FAQ} />
      <Route path="/contact" component={Contact} />
      <Route path="/profile" component={Profile} />
      <Route path="/billing" component={Billing} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/admin/team" component={AdminTeam} />
      <Route path="/ops" component={Ops} />
      <Route path="/tickets" component={Tickets} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/create" component={CreateApp} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/apps/:id/edit" component={EditApp} />
      <Route path="/apps/:id/push" component={PushNotifications} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <SupportChatbot />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;