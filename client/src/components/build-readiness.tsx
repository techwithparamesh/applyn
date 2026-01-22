/**
 * Build Readiness Checker Component
 * 
 * Displays Play Store / App Store readiness status with visual indicators.
 * Shows clear pass/fail states without exposing technical details.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  ArrowUpRight,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

type CheckStatus = "pass" | "fail" | "warning" | "pending";

interface ReadinessCheck {
  id: string;
  name: string;
  description: string;
  status: CheckStatus;
  message?: string;
  required: boolean;
}

interface ReadinessResult {
  ready: boolean;
  checks: ReadinessCheck[];
  passCount: number;
  failCount: number;
  warningCount: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

interface BuildReadinessCheckerProps {
  appId: string;
  plan: string;
  onReadinessChange?: (ready: boolean, store: "playstore" | "appstore") => void;
  showPlayStore?: boolean;
  showAppStore?: boolean;
}

export function BuildReadinessChecker({
  appId,
  plan,
  onReadinessChange,
  showPlayStore = true,
  showAppStore = false,
}: BuildReadinessCheckerProps) {
  const [expandedSection, setExpandedSection] = useState<"playstore" | "appstore" | null>(null);

  // Fetch Play Store readiness
  const { 
    data: playStoreResult, 
    isLoading: playStoreLoading,
    refetch: refetchPlayStore 
  } = useQuery<ReadinessResult>({
    queryKey: [`/api/apps/${appId}/readiness/playstore`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/apps/${appId}/readiness/playstore`);
      return res.json();
    },
    enabled: showPlayStore,
  });

  // Call onReadinessChange when playStoreResult changes
  useEffect(() => {
    if (playStoreResult) {
      onReadinessChange?.(playStoreResult.ready, "playstore");
    }
  }, [playStoreResult, onReadinessChange]);

  // Fetch App Store readiness (Pro plan only)
  const { 
    data: appStoreResult, 
    isLoading: appStoreLoading,
    refetch: refetchAppStore 
  } = useQuery<ReadinessResult>({
    queryKey: [`/api/apps/${appId}/readiness/appstore`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/apps/${appId}/readiness/appstore`);
      return res.json();
    },
    enabled: showAppStore && plan === "pro",
  });

  // Call onReadinessChange when appStoreResult changes
  useEffect(() => {
    if (appStoreResult) {
      onReadinessChange?.(appStoreResult.ready, "appstore");
    }
  }, [appStoreResult, onReadinessChange]);

  // Plan-based feature checks
  const isPlayStoreAvailable = plan === "standard" || plan === "pro";
  const isAppStoreAvailable = plan === "pro";

  return (
    <div className="space-y-4">
      {/* Play Store Readiness */}
      {showPlayStore && (
        <ReadinessCard
          title="Play Store Readiness"
          icon={<Play className="w-5 h-5" />}
          result={playStoreResult}
          loading={playStoreLoading}
          locked={!isPlayStoreAvailable}
          lockedMessage="Upgrade to Standard to publish on Play Store"
          expanded={expandedSection === "playstore"}
          onToggle={() => setExpandedSection(expandedSection === "playstore" ? null : "playstore")}
          onRefresh={() => refetchPlayStore()}
          accentColor="green"
        />
      )}

      {/* App Store Readiness */}
      {showAppStore && (
        <ReadinessCard
          title="App Store Readiness"
          icon={<ShieldCheck className="w-5 h-5" />}
          result={appStoreResult}
          loading={appStoreLoading}
          locked={!isAppStoreAvailable}
          lockedMessage="Upgrade to Pro to publish on App Store"
          expanded={expandedSection === "appstore"}
          onToggle={() => setExpandedSection(expandedSection === "appstore" ? null : "appstore")}
          onRefresh={() => refetchAppStore()}
          accentColor="blue"
        />
      )}
    </div>
  );
}

// ============================================
// READINESS CARD COMPONENT
// ============================================

interface ReadinessCardProps {
  title: string;
  icon: React.ReactNode;
  result?: ReadinessResult;
  loading: boolean;
  locked: boolean;
  lockedMessage: string;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  accentColor: "green" | "blue";
}

function ReadinessCard({
  title,
  icon,
  result,
  loading,
  locked,
  lockedMessage,
  expanded,
  onToggle,
  onRefresh,
  accentColor,
}: ReadinessCardProps) {
  const colorClasses = {
    green: {
      ready: "from-green-500/20 to-emerald-500/10 border-green-500/30",
      notReady: "from-red-500/20 to-orange-500/10 border-red-500/30",
      locked: "from-gray-500/10 to-gray-500/5 border-gray-500/20",
      badge: "bg-green-500/20 text-green-400",
    },
    blue: {
      ready: "from-blue-500/20 to-cyan-500/10 border-blue-500/30",
      notReady: "from-red-500/20 to-orange-500/10 border-red-500/30",
      locked: "from-gray-500/10 to-gray-500/5 border-gray-500/20",
      badge: "bg-blue-500/20 text-blue-400",
    },
  };

  const colors = colorClasses[accentColor];
  const bgClass = locked 
    ? colors.locked 
    : result?.ready 
      ? colors.ready 
      : colors.notReady;

  return (
    <div className={cn(
      "rounded-xl border bg-gradient-to-b p-4 transition-all duration-300",
      bgClass
    )}>
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            locked ? "bg-gray-500/20" : result?.ready ? colors.badge : "bg-red-500/20"
          )}>
            {locked ? (
              <Lock className="w-5 h-5 text-gray-400" />
            ) : loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : result?.ready ? (
              <ShieldCheck className="w-5 h-5 text-green-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div>
            <h4 className="font-semibold text-white">{title}</h4>
            {locked ? (
              <p className="text-sm text-muted-foreground">{lockedMessage}</p>
            ) : loading ? (
              <p className="text-sm text-muted-foreground">Checking requirements...</p>
            ) : result ? (
              <p className="text-sm text-muted-foreground">
                {result.ready ? (
                  <span className="text-green-400">✓ All checks passed</span>
                ) : (
                  <span className="text-red-400">
                    {result.failCount} issue{result.failCount !== 1 ? "s" : ""} found
                  </span>
                )}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!locked && result && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                result.ready 
                  ? "border-green-500/30 text-green-400" 
                  : "border-red-500/30 text-red-400"
              )}
            >
              {result.passCount}/{result.checks.length} passed
            </Badge>
          )}
          {!locked && (
            expanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )
          )}
        </div>
      </div>

      {/* Expanded Checks List */}
      <AnimatePresence>
        {expanded && !locked && result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              {result.checks.map((check) => (
                <CheckItem key={check.id} check={check} />
              ))}
              
              <div className="pt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                  }}
                  className="text-xs"
                >
                  <Loader2 className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />
                  Re-check
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// CHECK ITEM COMPONENT
// ============================================

interface CheckItemProps {
  check: ReadinessCheck;
}

function CheckItem({ check }: CheckItemProps) {
  const statusConfig = {
    pass: {
      icon: <CheckCircle2 className="w-4 h-4 text-green-400" />,
      bgClass: "bg-green-500/10",
      textClass: "text-green-400",
    },
    fail: {
      icon: <XCircle className="w-4 h-4 text-red-400" />,
      bgClass: "bg-red-500/10",
      textClass: "text-red-400",
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
      bgClass: "bg-yellow-500/10",
      textClass: "text-yellow-400",
    },
    pending: {
      icon: <Loader2 className="w-4 h-4 animate-spin text-gray-400" />,
      bgClass: "bg-gray-500/10",
      textClass: "text-gray-400",
    },
  };

  const config = statusConfig[check.status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-3 p-2 rounded-lg transition-colors",
            config.bgClass,
            "hover:bg-white/5"
          )}>
            {config.icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{check.name}</p>
              {check.message && (
                <p className={cn("text-xs truncate", config.textClass)}>
                  {check.message}
                </p>
              )}
            </div>
            {check.required && check.status === "fail" && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Required
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="font-medium">{check.name}</p>
          <p className="text-xs text-muted-foreground mt-1">{check.description}</p>
          {check.message && (
            <p className={cn("text-xs mt-1", config.textClass)}>{check.message}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================
// INLINE READINESS BADGE
// ============================================

interface ReadinessBadgeProps {
  ready: boolean;
  store: "playstore" | "appstore";
  loading?: boolean;
}

export function ReadinessBadge({ ready, store, loading }: ReadinessBadgeProps) {
  if (loading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking...
      </Badge>
    );
  }

  if (ready) {
    return (
      <Badge 
        variant="outline" 
        className="gap-1 border-green-500/30 text-green-400 bg-green-500/10"
      >
        <CheckCircle2 className="w-3 h-3" />
        {store === "playstore" ? "Play Store Ready" : "App Store Ready"}
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className="gap-1 border-red-500/30 text-red-400 bg-red-500/10"
    >
      <XCircle className="w-3 h-3" />
      Not Ready
    </Badge>
  );
}

// ============================================
// PLAN UPGRADE BANNER
// ============================================

interface PlanUpgradeBannerProps {
  currentPlan: string;
  requiredFeature: string;
  requiredPlan: string;
  onUpgrade?: () => void;
}

export function PlanUpgradeBanner({
  currentPlan,
  requiredFeature,
  requiredPlan,
  onUpgrade,
}: PlanUpgradeBannerProps) {
  return (
    <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-yellow-500/20">
          <Lock className="w-5 h-5 text-yellow-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-white">Upgrade Required</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {requiredFeature} is available on the{" "}
            <span className="text-yellow-400 font-medium">{requiredPlan}</span> plan.
          </p>
          {currentPlan === "starter" && (
            <p className="text-xs text-yellow-400/70 mt-2">
              ⚠️ Starter plan builds are preview-only and not eligible for store submission.
            </p>
          )}
        </div>
        {onUpgrade && (
          <Button
            size="sm"
            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400"
            onClick={onUpgrade}
          >
            Upgrade
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
