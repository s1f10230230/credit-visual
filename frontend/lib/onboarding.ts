export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
  highlight?: string;
  isNew?: boolean;
  planRequired?: "free" | "lite" | "pro";
}

export const ONBOARDING_STEPS: Record<string, OnboardingStep[]> = {
  free: [
    {
      id: "welcome",
      title: "Subscanへようこそ！",
      description: "1分でサブスクリプションを可視化します。まずはメール明細を貼り付けてみましょう。",
      action: "demo-textarea",
      actionLabel: "メール明細を貼り付ける",
      highlight: "#demo-input"
    },
    {
      id: "analyze",
      title: "サブスクを瞬時に検出",
      description: "AIが自動でサブスクリプションを識別し、月額費用を計算します。",
      highlight: "#analyze-button"
    },
    {
      id: "results",
      title: "上位3件を表示中",
      description: "Freeプランでは上位3件まで表示されます。全件を確認するにはLiteプランをお試しください。",
      highlight: "#results-section"
    }
  ],
  
  lite: [
    {
      id: "welcome-lite",
      title: "🎉 Liteプランにようこそ！",
      description: "アップグレードありがとうございます！新しい機能をご紹介します。",
      isNew: true
    },
    {
      id: "unlimited-analysis",
      title: "✨ 無制限解析が利用可能",
      description: "メール数の制限なし！すべてのサブスクリプションを確認できます。",
      highlight: "#results-section",
      isNew: true
    },
    {
      id: "detailed-reports",
      title: "📊 詳細レポート機能",
      description: "月次・年次の詳細分析、カテゴリ別集計、トレンド分析が可能になりました。",
      action: "reports-tab",
      actionLabel: "レポートを見る",
      highlight: "#reports-tab",
      isNew: true
    },
    {
      id: "export-features",
      title: "💾 データエクスポート",
      description: "CSV・JSON形式でデータをエクスポートし、他のツールと連携できます。",
      action: "export-button",
      actionLabel: "エクスポートを試す",
      highlight: "#export-button",
      isNew: true
    },
    {
      id: "history-access",
      title: "📅 12ヶ月履歴",
      description: "過去12ヶ月分のデータを保持し、長期的なトレンド分析が可能です。",
      highlight: "#history-section",
      isNew: true
    }
  ],
  
  pro: [
    {
      id: "welcome-pro",
      title: "🌟 Proプランにようこそ！",
      description: "最上位プランへのアップグレードありがとうございます！完全自動化機能をご案内します。",
      isNew: true
    },
    {
      id: "gmail-integration",
      title: "🔗 Gmail自動連携",
      description: "Gmailと連携して、新しいメールを自動で解析します。手動作業は不要です！",
      action: "connect-gmail",
      actionLabel: "Gmailと連携する",
      highlight: "#gmail-connect",
      isNew: true
    },
    {
      id: "realtime-notifications",
      title: "🔔 リアルタイム通知",
      description: "新しいサブスクや料金変更を即座に通知。見逃しを防ぎます。",
      action: "notification-settings",
      actionLabel: "通知設定",
      highlight: "#notifications-tab",
      isNew: true
    },
    {
      id: "advanced-filters",
      title: "🎯 高度フィルタリング",
      description: "金額・カテゴリ・頻度による詳細フィルタで、欲しい情報をピンポイントで抽出。",
      highlight: "#filters-section",
      isNew: true
    },
    {
      id: "priority-support",
      title: "🆘 優先サポート",
      description: "専用サポートチャンネルで迅速な問題解決をサポートします。",
      action: "contact-support",
      actionLabel: "サポートに連絡",
      highlight: "#support-button",
      isNew: true
    },
    {
      id: "automation-complete",
      title: "🎯 完全自動化完了",
      description: "これで設定は完了！あとは自動でサブスク管理が行われます。",
      isNew: true
    }
  ]
};

export const UPGRADE_CELEBRATION_STEPS: Record<string, OnboardingStep[]> = {
  "free-to-lite": [
    {
      id: "upgrade-celebration",
      title: "🎉 Liteプランにアップグレード完了！",
      description: "ありがとうございます！新機能が解放されました。",
      isNew: true
    },
    {
      id: "features-unlocked",
      title: "🔓 解放された機能",
      description: "• 無制限解析\n• 詳細レポート\n• CSV/JSONエクスポート\n• 12ヶ月履歴",
      isNew: true
    }
  ],
  
  "free-to-pro": [
    {
      id: "upgrade-celebration",
      title: "🌟 Proプランにアップグレード完了！",
      description: "最上位プランへようこそ！すべての機能が利用可能になりました。",
      isNew: true
    },
    {
      id: "features-unlocked",
      title: "🔓 解放された機能",
      description: "• Gmail自動連携\n• リアルタイム通知\n• 高度フィルタリング\n• 優先サポート\n• すべてのLite機能",
      isNew: true
    }
  ],
  
  "lite-to-pro": [
    {
      id: "upgrade-celebration",
      title: "🌟 Proプランにアップグレード完了！",
      description: "完全自動化への扉が開かれました！",
      isNew: true
    },
    {
      id: "features-unlocked",
      title: "🔓 新たに解放された機能",
      description: "• Gmail自動連携\n• リアルタイム通知\n• 高度フィルタリング\n• 優先サポート",
      isNew: true
    }
  ]
};

export function getOnboardingSteps(plan: string, fromPlan?: string): OnboardingStep[] {
  // アップグレード直後の場合は特別なフローを表示
  if (fromPlan && fromPlan !== plan) {
    const upgradeKey = `${fromPlan}-to-${plan}`;
    const celebrationSteps = UPGRADE_CELEBRATION_STEPS[upgradeKey] || [];
    const planSteps = ONBOARDING_STEPS[plan] || ONBOARDING_STEPS.free;
    
    // お祝いステップ + 新機能のみのプランステップ
    const newFeatureSteps = planSteps.filter(step => step.isNew);
    return [...celebrationSteps, ...newFeatureSteps];
  }
  
  // 通常のオンボーディング
  return ONBOARDING_STEPS[plan] || ONBOARDING_STEPS.free;
}

export function hasNewFeatures(currentPlan: string, previousPlan?: string): boolean {
  if (!previousPlan) return false;
  
  const planHierarchy = { free: 0, lite: 1, pro: 2 };
  const currentLevel = planHierarchy[currentPlan as keyof typeof planHierarchy] || 0;
  const previousLevel = planHierarchy[previousPlan as keyof typeof planHierarchy] || 0;
  
  return currentLevel > previousLevel;
}

export function getNewFeatureCount(currentPlan: string, previousPlan?: string): number {
  if (!hasNewFeatures(currentPlan, previousPlan)) return 0;
  
  const currentSteps = ONBOARDING_STEPS[currentPlan] || [];
  return currentSteps.filter(step => step.isNew).length;
}