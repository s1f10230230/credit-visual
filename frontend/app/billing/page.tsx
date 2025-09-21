"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { analytics } from "../../lib/analytics";
import { ErrorState } from "../../components/ErrorState";

interface Plan {
  name: string;
  price: string;
  monthlyPrice?: string;
  features: string[];
  popular?: boolean;
  description: string;
}

const plans: Plan[] = [
  {
    name: "Free",
    price: "¥0",
    description: "基本機能でサブスク管理を開始",
    features: [
      "手動ファイル取込",
      "基本分析（上位3件）",
      "月次サマリー",
      "サブスク検出",
    ],
  },
  {
    name: "Lite",
    price: "¥490",
    monthlyPrice: "/月",
    description: "本格的な分析とエクスポート機能",
    features: [
      "Freeの全機能",
      "完全分析（無制限）",
      "CSV/JSONエクスポート",
      "カード別詳細分析",
      "12ヶ月履歴",
    ],
    popular: true,
  },
  {
    name: "Pro",
    price: "¥990",
    monthlyPrice: "/月",
    description: "高度な自動化と無制限機能",
    features: [
      "Liteの全機能",
      "Gmail自動同期",
      "リアルタイム通知",
      "高度なフィルタリング",
      "無制限履歴",
      "優先サポート",
    ],
  },
];

async function createCheckoutSession(plan: string, email: string): Promise<string> {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan, email }),
  });

  if (!response.ok) {
    throw new Error("Failed to create checkout session");
  }

  const data = await response.json();
  return data.checkout_url;
}

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  // Track page view with plan visibility
  useEffect(() => {
    plans.forEach(plan => {
      analytics.trackPlanView(plan.name.toLowerCase(), 'billing');
    });
  }, []);

  const handleUpgrade = async (planName: string) => {
    if (!email) {
      setError("メールアドレスを入力してください");
      return;
    }

    // Track plan upgrade intent
    const planPrice = plans.find(p => p.name === planName)?.price || '0';
    const amount = parseInt(planPrice.replace(/[^0-9]/g, '')) || 0;
    analytics.trackPlanUpgrade('free', planName.toLowerCase(), amount);
    analytics.trackCheckoutStart(planName.toLowerCase(), amount);

    setLoading(planName);
    setError("");
    try {
      const checkoutUrl = await createCheckoutSession(planName.toLowerCase(), email);
      
      // In a real app, you'd redirect to Stripe checkout
      if (checkoutUrl.includes("billing.example.com")) {
        alert(`デモ環境: ${planName}プランの購読が開始されました！\n実際の環境では Stripe Checkout に移動します。`);
      } else {
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      setError("エラーが発生しました: " + error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-heading-lg text-text mb-4">プラン選択</h1>
        <p className="text-body-lg text-muted max-w-2xl mx-auto">
          サブスクリプション管理をより効率的に。最適なプランをお選びください。
        </p>
      </div>

      {/* Email Input */}
      <div className="max-w-md mx-auto mb-8">
        <div className="card p-6">
          <label className="block text-body text-text font-medium mb-2">
            メールアドレス
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@example.com"
            className="input w-full"
          />
          {error && (
            <div className="mt-3">
              <ErrorState
                message={error}
                variant="error"
                dismissible
                onDismiss={() => setError("")}
              />
            </div>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`card p-6 lg:p-8 relative transition-all hover:scale-105 ${
              plan.popular ? "border-primary bg-primary/5" : ""
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  人気プラン
                </div>
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-heading-md text-text mb-2">{plan.name}</h3>
              <p className="text-body text-muted mb-4">{plan.description}</p>
              <div className="mb-4">
                <span className="text-3xl lg:text-4xl font-bold text-primary">{plan.price}</span>
                {plan.monthlyPrice && (
                  <span className="text-body text-muted ml-1">{plan.monthlyPrice}</span>
                )}
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-positive rounded-full flex-shrink-0"></div>
                  <span className="text-body text-text">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              {plan.name === "Free" ? (
                <div className="text-center py-3 px-4 rounded-xl bg-muted/20 text-muted font-medium">
                  現在のプラン
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.name)}
                  disabled={!email || loading === plan.name}
                  className={`btn w-full ${
                    plan.popular ? "btn-primary" : "btn-outline"
                  }`}
                >
                  {loading === plan.name ? "処理中..." : `${plan.name}にアップグレード`}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="text-center mb-12">
        <div className="card p-6 max-w-md mx-auto">
          <p className="text-body text-muted mb-4">
            すでにアカウントをお持ちですか？
          </p>
          <Link href="/auth" className="btn btn-outline">
            ログインページへ
          </Link>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto">
        <div className="card p-6 lg:p-8">
          <h3 className="text-heading-md text-text mb-6">よくある質問</h3>
          
          <div className="space-y-6">
            <div className="border-b border-line pb-6 last:border-b-0 last:pb-0">
              <h4 className="text-body-lg text-text font-semibold mb-2">
                いつでもキャンセルできますか？
              </h4>
              <p className="text-body text-muted">
                はい、いつでもサブスクリプションをキャンセルできます。キャンセル料は一切かかりません。
              </p>
            </div>
            
            <div className="border-b border-line pb-6 last:border-b-0 last:pb-0">
              <h4 className="text-body-lg text-text font-semibold mb-2">
                データは安全ですか？
              </h4>
              <p className="text-body text-muted">
                すべてのデータは暗号化され、プライバシーを最優先に保護されています。金融グレードのセキュリティ基準を満たしています。
              </p>
            </div>
            
            <div className="border-b border-line pb-6 last:border-b-0 last:pb-0">
              <h4 className="text-body-lg text-text font-semibold mb-2">
                プランの変更はいつでも可能ですか？
              </h4>
              <p className="text-body text-muted">
                はい。アップグレードは即座反映され、ダウングレードは次回更新時に適用されます。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}