"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ExternalLink, Loader2, Sparkles } from "lucide-react";

interface BillingInfo {
  plan: string;
  stripeCustomerId: string | null;
}

function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-10 w-48" />
    </div>
  );
}

const PLAN_LABELS: Record<string, string> = {
  FREE: "Free",
  PRO: "Pro",
  TEAM: "Team",
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  FREE: "Basic scheduling with limited features.",
  PRO: "Advanced scheduling, payment collection, and integrations.",
  TEAM: "Everything in Pro plus team management and analytics.",
};

export default function BillingPage() {
  const { data: session } = useSession();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: billing, isLoading } = useQuery<BillingInfo>({
    queryKey: ["billing"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) throw new Error("Failed to load billing info");
      const profile = await res.json();
      return {
        plan: profile.plan ?? "FREE",
        stripeCustomerId: profile.stripeCustomerId ?? null,
      };
    },
    enabled: !!session?.user?.id,
  });

  const currentPlan = billing?.plan ?? "FREE";

  const handleManageBilling = async () => {
    if (!billing?.stripeCustomerId) return;

    setIsRedirecting(true);
    try {
      const res = await fetch("/api/payments/billing-portal", {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to create billing portal session");
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Could not open billing portal. Please try again.");
      setIsRedirecting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Billing
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your subscription and payment details.
        </p>
      </div>

      {/* Current plan card */}
      <Card className="border-slate-100 shadow-none">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <CreditCard className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Current Plan
              </h2>
              <p className="text-sm text-slate-500">
                Your active subscription details.
              </p>
            </div>
          </div>

          <Separator className="mb-6" />

          {isLoading ? (
            <BillingSkeleton />
          ) : (
            <div className="space-y-6 max-w-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">
                  Plan:
                </span>
                <Badge variant={currentPlan === "FREE" ? "secondary" : "default"}>
                  {PLAN_LABELS[currentPlan] ?? currentPlan}
                </Badge>
              </div>

              <p className="text-sm text-slate-500">
                {PLAN_DESCRIPTIONS[currentPlan] ??
                  "Manage your scheduling and bookings."}
              </p>

              {currentPlan === "FREE" && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Upgrade to Pro
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Unlock payment collection, custom branding,
                        priority support, and more.
                      </p>
                      <Button
                        className="mt-3 bg-indigo-500 hover:bg-indigo-600 text-white"
                        size="sm"
                      >
                        Upgrade now
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {billing?.stripeCustomerId && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={handleManageBilling}
                    disabled={isRedirecting}
                  >
                    {isRedirecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4" />
                    )}
                    Manage billing
                  </Button>
                  <p className="text-xs text-slate-400 mt-2">
                    Opens the Stripe billing portal to manage payment methods,
                    view invoices, and update your subscription.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
