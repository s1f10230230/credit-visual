export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: "JPY" | "USD";
  interval: "monthly" | "yearly";
  cardLimit: number;
  historyDays: number;
  features: string[];
  popular?: boolean;
}

export interface UserSubscription {
  userId: string;
  planId: string;
  status: "active" | "inactive" | "canceled" | "trial";
  startDate: string;
  endDate?: string;
  autoRenew: boolean;
  paymentMethod?: string;
  trialEndDate?: string;
}

export interface FeatureAccess {
  hasAdvancedAnalytics: boolean;
  hasExportFunctionality: boolean;
  hasCustomCategories: boolean;
  hasAIInsights: boolean;
  hasFamilySharing: boolean;
  hasNoAds: boolean;
  cardLimit: number;
  historyDays: number;
}

class SubscriptionService {
  private plans: SubscriptionPlan[] = [
    {
      id: "free",
      name: "フリー",
      price: 0,
      currency: "JPY",
      interval: "monthly",
      cardLimit: 2,
      historyDays: 30,
      features: [
        "基本分析",
        "月次レポート",
        "2枚のカード連携",
        "30日履歴"
      ]
    },
    {
      id: "premium_monthly",
      name: "プレミアム（月額）",
      price: 480,
      currency: "JPY",
      interval: "monthly",
      cardLimit: -1,
      historyDays: 365,
      popular: true,
      features: [
        "無制限カード連携",
        "AI支出分析",
        "予算管理アラート",
        "CSV/PDFエクスポート",
        "広告非表示",
        "カスタムカテゴリ",
        "12ヶ月履歴",
        "優先サポート"
      ]
    },
    {
      id: "premium_yearly",
      name: "プレミアム（年額）",
      price: 4800,
      currency: "JPY",
      interval: "yearly",
      cardLimit: -1,
      historyDays: 365,
      features: [
        "プレミアム月額の全機能",
        "2ヶ月分お得",
        "年次レポート",
        "税務サポート機能"
      ]
    },
    {
      id: "family_monthly",
      name: "ファミリー（月額）",
      price: 780,
      currency: "JPY",
      interval: "monthly",
      cardLimit: -1,
      historyDays: 365,
      features: [
        "プレミアム全機能",
        "家族5人まで共有",
        "家計簿統合機能",
        "子供向け支出管理",
        "家族レポート"
      ]
    }
  ];

  private userSubscriptions = new Map<string, UserSubscription>();

  async subscribeToPlan(userId: string, planId: string, paymentMethod?: string): Promise<{success: boolean, message: string}> {
    const plan = this.plans.find(p => p.id === planId);
    
    if (!plan) {
      return { success: false, message: "プランが見つかりません" };
    }

    if (plan.id === "free") {
      // フリープランは即座に有効化
      this.userSubscriptions.set(userId, {
        userId,
        planId,
        status: "active",
        startDate: new Date().toISOString(),
        autoRenew: false
      });
      return { success: true, message: "フリープランに登録しました" };
    }

    try {
      // 実際の決済処理をここに実装
      // App Store / Google Play Billing API との連携
      const paymentResult = await this.processPayment(userId, plan, paymentMethod);
      
      if (paymentResult.success) {
        const subscription: UserSubscription = {
          userId,
          planId,
          status: "active",
          startDate: new Date().toISOString(),
          autoRenew: true,
          paymentMethod
        };

        // トライアル期間の設定（プレミアムプランは7日間無料）
        if (planId.includes("premium") && !this.hasHadTrial(userId)) {
          subscription.status = "trial";
          subscription.trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        }

        this.userSubscriptions.set(userId, subscription);
        
        return { 
          success: true, 
          message: subscription.status === "trial" 
            ? "7日間の無料トライアルが開始されました" 
            : "サブスクリプションに登録しました"
        };
      }
      
      return { success: false, message: paymentResult.message };
      
    } catch (error) {
      console.error("Subscription error:", error);
      return { success: false, message: "決済処理中にエラーが発生しました" };
    }
  }

  async cancelSubscription(userId: string, immediate = false): Promise<{success: boolean, message: string}> {
    const subscription = this.userSubscriptions.get(userId);
    
    if (!subscription) {
      return { success: false, message: "アクティブなサブスクリプションが見つかりません" };
    }

    if (subscription.planId === "free") {
      return { success: false, message: "フリープランはキャンセルできません" };
    }

    try {
      // 決済プラットフォームでのキャンセル処理
      await this.cancelPayment(userId, subscription.planId);
      
      if (immediate) {
        subscription.status = "canceled";
        subscription.endDate = new Date().toISOString();
        subscription.autoRenew = false;
      } else {
        // 期間終了まで利用可能
        subscription.autoRenew = false;
        const plan = this.plans.find(p => p.id === subscription.planId);
        if (plan) {
          const endDate = plan.interval === "yearly" 
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          subscription.endDate = endDate.toISOString();
        }
      }
      
      return { 
        success: true, 
        message: immediate 
          ? "サブスクリプションをキャンセルしました" 
          : "自動更新を停止しました。現在の期間終了まで利用できます"
      };
      
    } catch (error) {
      console.error("Cancellation error:", error);
      return { success: false, message: "キャンセル処理中にエラーが発生しました" };
    }
  }

  getUserSubscription(userId: string): UserSubscription | null {
    return this.userSubscriptions.get(userId) || null;
  }

  getFeatureAccess(userId: string): FeatureAccess {
    const subscription = this.getUserSubscription(userId);
    const plan = subscription ? this.plans.find(p => p.id === subscription.planId) : this.plans.find(p => p.id === "free");
    
    if (!plan) {
      return this.getFreeFeatureAccess();
    }

    // サブスクリプションの有効性をチェック
    if (subscription && !this.isSubscriptionActive(subscription)) {
      return this.getFreeFeatureAccess();
    }

    const isPremium = plan.id.includes("premium") || plan.id.includes("family");
    const isFamily = plan.id.includes("family");

    return {
      hasAdvancedAnalytics: isPremium,
      hasExportFunctionality: isPremium,
      hasCustomCategories: isPremium,
      hasAIInsights: isPremium,
      hasFamilySharing: isFamily,
      hasNoAds: isPremium,
      cardLimit: plan.cardLimit,
      historyDays: plan.historyDays
    };
  }

  getAllPlans(): SubscriptionPlan[] {
    return this.plans;
  }

  getPlan(planId: string): SubscriptionPlan | null {
    return this.plans.find(p => p.id === planId) || null;
  }

  async restorePurchase(userId: string): Promise<{success: boolean, message: string}> {
    try {
      // App Store / Google Play の購入履歴を確認
      const purchaseHistory = await this.fetchPurchaseHistory(userId);
      
      if (purchaseHistory.length > 0) {
        const latestPurchase = purchaseHistory[0];
        const subscription: UserSubscription = {
          userId,
          planId: latestPurchase.planId,
          status: "active",
          startDate: latestPurchase.startDate,
          endDate: latestPurchase.endDate,
          autoRenew: latestPurchase.autoRenew,
          paymentMethod: latestPurchase.paymentMethod
        };
        
        this.userSubscriptions.set(userId, subscription);
        return { success: true, message: "購入履歴を復元しました" };
      }
      
      return { success: false, message: "復元可能な購入履歴が見つかりません" };
      
    } catch (error) {
      console.error("Restore error:", error);
      return { success: false, message: "購入履歴の復元中にエラーが発生しました" };
    }
  }

  checkTrialEligibility(userId: string): boolean {
    return !this.hasHadTrial(userId);
  }

  async startTrial(userId: string): Promise<{success: boolean, message: string}> {
    if (!this.checkTrialEligibility(userId)) {
      return { success: false, message: "トライアルは一度のみご利用いただけます" };
    }

    const trialSubscription: UserSubscription = {
      userId,
      planId: "premium_monthly",
      status: "trial",
      startDate: new Date().toISOString(),
      trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: false
    };

    this.userSubscriptions.set(userId, trialSubscription);
    this.markTrialUsed(userId);

    return { success: true, message: "7日間の無料トライアルを開始しました" };
  }

  getUsageStats(userId: string): {
    cardsUsed: number;
    transactionsAnalyzed: number;
    daysOfHistory: number;
    exportsThisMonth: number;
  } {
    // 実際の使用状況を取得するためのプレースホルダー
    // 実装時は実際のデータベースから取得
    return {
      cardsUsed: 1,
      transactionsAnalyzed: 45,
      daysOfHistory: 30,
      exportsThisMonth: 0
    };
  }

  private getFreeFeatureAccess(): FeatureAccess {
    return {
      hasAdvancedAnalytics: false,
      hasExportFunctionality: false,
      hasCustomCategories: false,
      hasAIInsights: false,
      hasFamilySharing: false,
      hasNoAds: false,
      cardLimit: 2,
      historyDays: 30
    };
  }

  private isSubscriptionActive(subscription: UserSubscription): boolean {
    const now = new Date();
    
    if (subscription.status === "canceled") {
      return false;
    }
    
    if (subscription.status === "trial") {
      return subscription.trialEndDate ? new Date(subscription.trialEndDate) > now : false;
    }
    
    if (subscription.endDate) {
      return new Date(subscription.endDate) > now;
    }
    
    return subscription.status === "active";
  }

  private async processPayment(userId: string, plan: SubscriptionPlan, paymentMethod?: string): Promise<{success: boolean, message: string}> {
    // ここで実際の決済処理を実装
    // App Store Connect API や Google Play Billing API との連携
    
    // プレースホルダー実装
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, message: "決済が完了しました" });
      }, 1000);
    });
  }

  private async cancelPayment(userId: string, planId: string): Promise<void> {
    // 決済プラットフォームでのキャンセル処理
    // プレースホルダー実装
  }

  private async fetchPurchaseHistory(userId: string): Promise<any[]> {
    // App Store / Google Play の購入履歴を取得
    // プレースホルダー実装
    return [];
  }

  private hasHadTrial(userId: string): boolean {
    // ユーザーが過去にトライアルを利用したかどうかを確認
    // 実装時は永続ストレージから取得
    return false;
  }

  private markTrialUsed(userId: string): void {
    // ユーザーのトライアル利用履歴を記録
    // 実装時は永続ストレージに保存
  }
}

export const subscriptionService = new SubscriptionService();