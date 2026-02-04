import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getQueryFn } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Lock } from "lucide-react";
import { PLANS, type PlanId as PricingPlanId } from "@shared/pricing";
import { track } from "@/lib/analytics";

export type FeatureKey =
  | "download_build"
  | "publish_play"
  | "remove_watermark"
  | "custom_branding"
  | "white_label"
  | "push_notifications"
  | "advanced_analytics";

type PlanId = "preview" | "starter" | "standard" | "pro" | "agency";

type SubscriptionInfo = {
  plan: string | null;
  planStatus: string | null;
  planStartDate: string | null;
  planExpiryDate: string | null;
  remainingRebuilds: number;
  daysUntilExpiry: number | null;
  planDetails: {
    name: string;
    price: number;
    monthlyEquivalent: number;
    rebuildsPerYear: number;
    features: Record<string, boolean>;
  } | null;
  isActive: boolean;
  isExpired: boolean;
  needsRenewal: boolean;
};

type RequirePlanOptions = {
  reason?: string;
  requiredPlan?: PlanId;
};

type UpgradeModalState = {
  open: boolean;
  feature?: FeatureKey;
  requiredPlan?: PlanId;
  reason?: string;
};

type PlanGateApi = {
  subscription: SubscriptionInfo | null | undefined;
  subscriptionLoading: boolean;
  isAllowed: (feature: FeatureKey) => boolean;
  requirePlan: (feature: FeatureKey, options?: RequirePlanOptions) => boolean;
  shouldShowWatermark: boolean;
};

const PlanGateContext = createContext<PlanGateApi | null>(null);

function planRank(plan: PlanId): number {
  switch (plan) {
    case "preview":
      return 0;
    case "starter":
      return 1;
    case "standard":
      return 2;
    case "pro":
      return 3;
    case "agency":
      return 4;
    default:
      return 0;
  }
}

export function requiredPlanForFeature(feature: FeatureKey): PlanId {
  switch (feature) {
    case "download_build":
      return "starter";
    case "publish_play":
      return "standard";
    case "remove_watermark":
      return "starter";
    case "custom_branding":
      return "standard";
    case "white_label":
      return "pro";
    case "push_notifications":
      return "standard";
    case "advanced_analytics":
      return "pro";
    default:
      return "pro";
  }
}

function labelForFeature(feature: FeatureKey): string {
  switch (feature) {
    case "download_build":
      return "Download Builds";
    case "publish_play":
      return "Publish to Google Play";
    case "remove_watermark":
      return "Remove Watermark";
    case "custom_branding":
      return "Custom Branding";
    case "white_label":
      return "White-label";
    case "push_notifications":
      return "Push Notifications";
    case "advanced_analytics":
      return "Advanced Analytics";
  }
}

export function formatPlanLabel(plan: PlanId | undefined): string {
  if (!plan) return "";
  return plan === "preview" ? "Preview" : plan.charAt(0).toUpperCase() + plan.slice(1);
}

function moneyInr(n: number): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `₹${Math.round(n).toLocaleString("en-IN")}`;
  }
}

function planForModal(planId: PricingPlanId) {
  return PLANS[planId];
}

function comparePlans(a: PricingPlanId, b: PricingPlanId) {
  const A = planForModal(a);
  const B = planForModal(b);

  return [
    { label: "Publish to Google Play", a: A.features.playStoreReady, b: B.features.playStoreReady },
    { label: "iOS App Store support", a: A.features.appStoreReady, b: B.features.appStoreReady },
    { label: "Push notifications", a: A.features.pushNotifications, b: B.features.pushNotifications },
    { label: "Custom branding", a: A.features.customBranding, b: B.features.customBranding },
    { label: "White-label", a: A.features.whiteLabel, b: B.features.whiteLabel },
    { label: "Store compliance updates", a: A.features.storeComplianceUpdates, b: B.features.storeComplianceUpdates },
  ];
}

function UpgradeModal({ state, onOpenChange }: { state: UpgradeModalState; onOpenChange: (open: boolean) => void }) {
  const [, setLocation] = useLocation();

  const [billing, setBilling] = useState<"annual" | "monthly">("annual");

  const requiredPlan = state.requiredPlan;
  const feature = state.feature;

  const required = (requiredPlan || "pro") as PricingPlanId;
  const recommended: PricingPlanId = required === "agency" ? "agency" : required;
  const upgradeChoices: PricingPlanId[] = (() => {
    if (recommended === "starter") return ["starter", "standard"];
    if (recommended === "standard") return ["standard", "pro"];
    if (recommended === "pro") return ["pro", "agency"];
    return ["standard", "pro"];
  })();

  const showPublishCta = feature === "publish_play";

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">{showPublishCta ? "You’re ready to publish." : "Your app is ready to go live 🚀"}</DialogTitle>
          <DialogDescription>
            {showPublishCta ? (
              "Choose a plan to go live and publish your app."
            ) : feature ? (
              <span>
                To use <span className="text-white font-medium">{labelForFeature(feature)}</span>, upgrade to{" "}
                <span className="text-white font-medium">{formatPlanLabel(requiredPlan)}</span> or higher.
              </span>
            ) : (
              "Upgrade to unlock this feature."
            )}
          </DialogDescription>
        </DialogHeader>

        {state.reason && (
          <div className="text-sm text-muted-foreground bg-white/5 border border-white/10 rounded-lg p-3">{state.reason}</div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">Choose billing</div>
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs rounded-full transition ${billing === "monthly" ? "bg-white/10 text-white" : "text-muted-foreground"}`}
              onClick={() => {
                setBilling("monthly");
                void track("funnel.billing.toggle", { billing: "monthly", feature, requiredPlan });
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs rounded-full transition ${billing === "annual" ? "bg-white/10 text-white" : "text-muted-foreground"}`}
              onClick={() => {
                setBilling("annual");
                void track("funnel.billing.toggle", { billing: "annual", feature, requiredPlan });
              }}
            >
              Annual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upgradeChoices.map((pid) => {
            const p = planForModal(pid);
            const isRecommended = pid === recommended;
            const priceLabel =
              billing === "monthly"
                ? `${moneyInr(p.monthlyEquivalent)}/mo`
                : `${moneyInr(p.price)}/year`;

            return (
              <div
                key={pid}
                className={`rounded-xl border p-4 bg-white/5 ${isRecommended ? "border-cyan-500/30" : "border-white/10"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-white font-semibold">{p.name}</div>
                      {isRecommended ? (
                        <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-500/30">Recommended</Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{p.tagline}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold">{priceLabel}</div>
                    {billing === "monthly" ? (
                      <div className="text-[11px] text-muted-foreground">billed annually</div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">includes updates & support</div>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-white/90">
                    <Crown className="h-4 w-4 text-cyan-300" />
                    <span className="font-medium">Key benefits</span>
                  </div>
                  <ul className="space-y-1 text-muted-foreground">
                    {p.featureList.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 mt-0.5 text-green-300" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {upgradeChoices.length === 2 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-white font-medium">
              <Lock className="h-4 w-4 text-white/80" />
              Plan comparison
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {comparePlans(upgradeChoices[0], upgradeChoices[1]).map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <div className="text-muted-foreground">{row.label}</div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 text-center text-xs text-white/80">{row.a ? "✓" : "—"}</div>
                    <div className="w-12 text-center text-xs text-white">{row.b ? "✓" : "—"}</div>
                  </div>
                </div>
              ))}
              <div className="mt-2 text-xs text-muted-foreground">
                Showing {planForModal(upgradeChoices[0]).name} vs {planForModal(upgradeChoices[1]).name}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            className="border-white/10 hover:bg-white/5"
            onClick={() => {
              void track("funnel.upgrade.dismiss", { feature, requiredPlan });
              onOpenChange(false);
            }}
          >
            Not now
          </Button>
          <Button
            className="bg-cyan-600 hover:bg-cyan-700"
            onClick={() => {
              void track("funnel.upgrade.cta", { feature, requiredPlan, cta: showPublishCta ? "upgrade_publish" : "view_plans" });
              onOpenChange(false);
              setLocation("/pricing");
            }}
          >
            {showPublishCta ? "Choose Plan & Publish" : "View Plans"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlanGateProvider({ children }: { children: React.ReactNode }) {
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<SubscriptionInfo | null>({
    queryKey: ["/api/subscription"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const [modal, setModal] = useState<UpgradeModalState>({ open: false });

  const lastOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = lastOpenRef.current;
    const isOpen = modal.open;

    if (!wasOpen && isOpen) {
      void track("funnel.upgrade.open", { feature: modal.feature, requiredPlan: modal.requiredPlan, reason: modal.reason });
    }
    if (wasOpen && !isOpen) {
      void track("funnel.upgrade.close", { feature: modal.feature, requiredPlan: modal.requiredPlan });
    }

    lastOpenRef.current = isOpen;
  }, [modal.open, modal.feature, modal.requiredPlan, modal.reason]);

  const isAllowed = useCallback(
    (feature: FeatureKey) => {
      const required = requiredPlanForFeature(feature);
      const plan = (subscription?.plan || "preview") as PlanId;
      const isActive = Boolean(subscription?.isActive);

      if (!isActive) return false;
      return planRank(plan) >= planRank(required);
    },
    [subscription],
  );

  const requirePlan = useCallback(
    (feature: FeatureKey, options?: RequirePlanOptions) => {
      const requiredPlan = options?.requiredPlan ?? requiredPlanForFeature(feature);

      const plan = (subscription?.plan || "preview") as PlanId;
      const isActive = Boolean(subscription?.isActive);
      const allowed = isActive && planRank(plan) >= planRank(requiredPlan);
      if (allowed) return true;

      setModal({
        open: true,
        feature,
        requiredPlan,
        reason: options?.reason,
      });
      return false;
    },
    [subscription],
  );

  const shouldShowWatermark = useMemo(() => {
    const plan = (subscription?.plan || "preview") as PlanId;
    const isActive = Boolean(subscription?.isActive);
    return !isActive || plan === "preview";
  }, [subscription]);

  const api: PlanGateApi = useMemo(
    () => ({
      subscription,
      subscriptionLoading,
      isAllowed,
      requirePlan,
      shouldShowWatermark,
    }),
    [subscription, subscriptionLoading, isAllowed, requirePlan, shouldShowWatermark],
  );

  return (
    <PlanGateContext.Provider value={api}>
      {children}
      <UpgradeModal state={modal} onOpenChange={(open) => setModal((s) => ({ ...s, open }))} />
    </PlanGateContext.Provider>
  );
}

export function usePlanGate(): PlanGateApi {
  const ctx = useContext(PlanGateContext);
  if (!ctx) {
    throw new Error("usePlanGate must be used within PlanGateProvider");
  }
  return ctx;
}
