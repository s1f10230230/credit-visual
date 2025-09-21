"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";

const PLAN_CONFIG = {
  free: {
    name: "Free",
    color: "bg-gray-600",
    textColor: "text-white",
    features: ["10通まで解析", "基本レポート", "サブスク検出"],
    limits: "10通/月"
  },
  lite: {
    name: "Lite",
    color: "bg-blue-600",
    textColor: "text-white", 
    features: ["無制限解析", "詳細レポート", "CSV/JSONエクスポート", "12ヶ月履歴"],
    limits: "無制限"
  },
  pro: {
    name: "Pro",
    color: "bg-purple-600",
    textColor: "text-white",
    features: ["Gmail自動連携", "リアルタイム通知", "高度フィルター", "優先サポート", "すべてのLite機能"],
    limits: "完全自動化"
  }
};

export function UserStatusBadge() {
  const { isAuthenticated, userId } = useAuth();
  const { plan, setPlan } = usePlan();
  const [showDropdown, setShowDropdown] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const router = useRouter();

  if (!isAuthenticated) {
    return null;
  }

  const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG] || PLAN_CONFIG.free;

  const handleUpgrade = async (targetPlan: string) => {
    try {
      setUpgrading(true);
      setShowDropdown(false);

      // Call upgrade API
      const response = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userId,
          currentPlan: plan,
          newPlan: targetPlan,
        }),
      });

      if (!response.ok) {
        throw new Error("アップグレードに失敗しました");
      }

      const data = await response.json();
      
      // Update plan in context
      setPlan(targetPlan);
      
      // Redirect to dashboard with upgrade celebration
      router.push(`/dashboard?tour=1&from-plan=${plan}`);

    } catch (error) {
      console.error("Upgrade error:", error);
      alert("アップグレードに失敗しました。もう一度お試しください。");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`${planConfig.color} ${planConfig.textColor} px-3 py-1 rounded-full text-sm font-medium hover:opacity-90 transition-opacity flex items-center space-x-2`}
      >
        <span>{planConfig.name}</span>
        <span className="text-xs opacity-75">{planConfig.limits}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-80 bg-card border border-line rounded-lg shadow-lg z-20">
            <div className="p-4">
              {/* User Info */}
              <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-line">
                <div className={`w-8 h-8 ${planConfig.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                  {planConfig.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-text">{userId}</div>
                  <div className="text-sm text-muted">{planConfig.name}プラン</div>
                </div>
              </div>

              {/* Current Plan Features */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-text mb-2">利用可能な機能</h4>
                <ul className="space-y-1">
                  {planConfig.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-text">
                      <span className="text-positive mr-2">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Plan Upgrade CTA */}
              {plan !== "pro" && (
                <div className="pt-4 border-t border-line">
                  <div className="text-center">
                    <p className="text-sm text-muted mb-3">
                      {plan === "free" ? "より多くの機能を利用" : "完全自動化でさらに便利に"}
                    </p>
                    <button 
                      onClick={() => handleUpgrade(plan === "free" ? "lite" : "pro")}
                      disabled={upgrading}
                      className="btn btn-primary text-sm w-full"
                    >
                      {upgrading ? "処理中..." : (plan === "free" ? "Liteにアップグレード" : "Proにアップグレード")}
                    </button>
                  </div>
                </div>
              )}

              {/* Next Billing (Mock) */}
              {plan !== "free" && (
                <div className="pt-3 border-t border-line mt-3">
                  <p className="text-xs text-muted text-center">
                    次回更新: 2024年10月21日
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}