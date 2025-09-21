"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePlan } from "../context/PlanContext";
import { analytics } from "../lib/analytics";

interface PlanGateProps {
  plan?: "free" | "lite" | "pro";
  allowed: Array<"lite" | "pro">;
  children: ReactNode;
  fallback?: ReactNode;
  onUpgradeClick?: () => void;
  feature?: string; // For analytics tracking
}

export function PlanGate({
  plan,
  allowed,
  children,
  fallback,
  onUpgradeClick,
  feature = "unknown",
}: PlanGateProps) {
  const { plan: contextPlan } = usePlan();
  const effectivePlan = plan ?? contextPlan;
  const router = useRouter();

  const handleUpgradeClick = () => {
    // Track unlock click event
    analytics.trackUnlockClick(feature, effectivePlan);
    
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      // Default action: redirect to billing page
      router.push("/billing");
    }
  };

  const handleCompareClick = () => {
    // Track compare click event
    analytics.trackUnlockClick(`${feature}_compare`, effectivePlan);
    
    // Redirect to billing page for plan comparison
    router.push("/billing");
  };

  if (effectivePlan === "free" && allowed.length) {
    const requiresLite = allowed.includes("lite");
    const requiresPro = allowed.includes("pro");
    
    let title = "🔒 プレミアム機能";
    let message = "この機能は Lite（¥490/月）または Pro（¥990/月）でご利用いただけます";
    let ctaText = "アップグレードして解放";
    
    if (!requiresLite && requiresPro) {
      message = "この機能は Pro（¥990/月）でご利用いただけます";
      ctaText = "Proにアップグレード";
    } else if (requiresLite && !requiresPro) {
      message = "この機能は Lite（¥490/月）でご利用いただけます";
      ctaText = "Liteにアップグレード";
    }
    
    return (
      <div className="relative">
        <div className="opacity-30 pointer-events-none">
          {children}
        </div>
        
        {fallback ?? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="card p-6 text-center max-w-sm bg-bg/95 backdrop-blur-sm border-primary/20">
              <div className="text-lg mb-3">{title}</div>
              <p className="text-body text-muted mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <button 
                  type="button" 
                  onClick={handleUpgradeClick}
                  className="btn btn-primary w-full"
                >
                  {ctaText}
                </button>
                <button
                  type="button"
                  onClick={handleCompareClick}
                  className="btn btn-outline w-full text-sm"
                >
                  機能の違いを見る
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  return <>{children}</>;
}
