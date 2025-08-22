import { subscriptionService, FeatureAccess } from './subscriptionService';

export interface FeatureGate {
  featureId: string;
  isEnabled: boolean;
  requiredPlan: string[];
  trialAvailable: boolean;
  usageLimit?: number;
  currentUsage?: number;
  resetPeriod?: 'daily' | 'weekly' | 'monthly';
  description: string;
  upgradeMessage: string;
}

export interface FeatureUsage {
  featureId: string;
  usageCount: number;
  lastUsed: Date;
  resetDate: Date;
}

export interface PaywallConfig {
  title: string;
  description: string;
  features: string[];
  ctaText: string;
  showTrial: boolean;
  trialDuration?: number;
  alternativeAction?: {
    text: string;
    action: () => void;
  };
}

class FeatureGateService {
  private userId: string = 'default-user'; // In real app, get from auth service
  private featureGates: Map<string, FeatureGate> = new Map();
  private usageTracking: Map<string, FeatureUsage> = new Map();

  constructor() {
    this.initializeFeatureGates();
    this.loadUsageData();
  }

  private initializeFeatureGates(): void {
    const gates: FeatureGate[] = [
      {
        featureId: 'advanced_analytics',
        isEnabled: false,
        requiredPlan: ['premium_monthly', 'premium_yearly', 'family_monthly'],
        trialAvailable: true,
        description: 'AI による高度な支出分析',
        upgradeMessage: 'プレミアムプランでAI分析機能をご利用いただけます'
      },
      {
        featureId: 'export_functionality',
        isEnabled: false,
        requiredPlan: ['premium_monthly', 'premium_yearly', 'family_monthly'],
        trialAvailable: true,
        usageLimit: 3,
        currentUsage: 0,
        resetPeriod: 'monthly',
        description: 'CSV/PDFエクスポート機能',
        upgradeMessage: 'プレミアムプランで無制限エクスポートが可能です'
      },
      {
        featureId: 'custom_categories',
        isEnabled: false,
        requiredPlan: ['premium_monthly', 'premium_yearly', 'family_monthly'],
        trialAvailable: false,
        description: 'カスタムカテゴリ作成',
        upgradeMessage: 'プレミアムプランでカスタムカテゴリを作成できます'
      },
      {
        featureId: 'ai_insights',
        isEnabled: false,
        requiredPlan: ['premium_monthly', 'premium_yearly', 'family_monthly'],
        trialAvailable: true,
        description: 'AI による支出アドバイス',
        upgradeMessage: 'プレミアムプランでAIアドバイスを受けられます'
      },
      {
        featureId: 'family_sharing',
        isEnabled: false,
        requiredPlan: ['family_monthly'],
        trialAvailable: false,
        description: '家族間での家計簿共有',
        upgradeMessage: 'ファミリープランで家族共有機能をご利用いただけます'
      },
      {
        featureId: 'unlimited_cards',
        isEnabled: false,
        requiredPlan: ['premium_monthly', 'premium_yearly', 'family_monthly'],
        trialAvailable: false,
        description: '無制限カード連携',
        upgradeMessage: 'プレミアムプランで無制限にカードを連携できます'
      },
      {
        featureId: 'ad_free',
        isEnabled: false,
        requiredPlan: ['premium_monthly', 'premium_yearly', 'family_monthly'],
        trialAvailable: false,
        description: '広告非表示',
        upgradeMessage: 'プレミアムプランで広告なしでご利用いただけます'
      },
      {
        featureId: 'extended_history',
        isEnabled: false,
        requiredPlan: ['premium_monthly', 'premium_yearly', 'family_monthly'],
        trialAvailable: false,
        description: '12ヶ月履歴保存',
        upgradeMessage: 'プレミアムプランで12ヶ月の履歴を保存できます'
      },
      {
        featureId: 'budget_alerts',
        isEnabled: false,
        requiredPlan: ['premium_monthly', 'premium_yearly', 'family_monthly'],
        trialAvailable: true,
        description: '予算超過アラート',
        upgradeMessage: 'プレミアムプランで予算管理アラートをご利用いただけます'
      },
      {
        featureId: 'priority_support',
        isEnabled: false,
        requiredPlan: ['premium_monthly', 'premium_yearly', 'family_monthly'],
        trialAvailable: false,
        description: '優先サポート',
        upgradeMessage: 'プレミアムプランで優先サポートを受けられます'
      }
    ];

    gates.forEach(gate => {
      this.featureGates.set(gate.featureId, gate);
    });

    this.updateFeatureGatesFromSubscription();
  }

  async checkFeatureAccess(featureId: string): Promise<{
    hasAccess: boolean;
    reason?: string;
    canUseTrial?: boolean;
    usageInfo?: {
      used: number;
      limit: number;
      resetDate: Date;
    };
  }> {
    const gate = this.featureGates.get(featureId);
    
    if (!gate) {
      return { hasAccess: false, reason: 'Unknown feature' };
    }

    // Check if feature is enabled for current subscription
    if (gate.isEnabled) {
      return { hasAccess: true };
    }

    // Check usage limits for trial or limited features
    if (gate.usageLimit) {
      const usage = this.usageTracking.get(featureId);
      
      if (usage && usage.usageCount < gate.usageLimit) {
        if (this.isUsageResetNeeded(usage, gate.resetPeriod)) {
          this.resetUsage(featureId);
        }
        
        return {
          hasAccess: true,
          usageInfo: {
            used: usage.usageCount,
            limit: gate.usageLimit,
            resetDate: usage.resetDate
          }
        };
      }
    }

    return {
      hasAccess: false,
      reason: gate.upgradeMessage,
      canUseTrial: gate.trialAvailable && this.canStartTrial()
    };
  }

  async useFeature(featureId: string): Promise<{
    success: boolean;
    message?: string;
    showPaywall?: PaywallConfig;
  }> {
    const accessCheck = await this.checkFeatureAccess(featureId);
    
    if (!accessCheck.hasAccess) {
      const gate = this.featureGates.get(featureId);
      
      if (!gate) {
        return { success: false, message: '不明な機能です' };
      }

      // Show paywall
      const paywallConfig = this.generatePaywallConfig(gate, accessCheck.canUseTrial);
      
      return {
        success: false,
        message: accessCheck.reason,
        showPaywall: paywallConfig
      };
    }

    // Track usage
    this.trackFeatureUsage(featureId);
    
    return { success: true };
  }

  getFeatureGate(featureId: string): FeatureGate | null {
    return this.featureGates.get(featureId) || null;
  }

  getAllFeatureGates(): FeatureGate[] {
    return Array.from(this.featureGates.values());
  }

  getSubscriptionFeatures(): {
    enabled: string[];
    disabled: string[];
    trialAvailable: string[];
  } {
    const enabled = [];
    const disabled = [];
    const trialAvailable = [];

    for (const [featureId, gate] of this.featureGates.entries()) {
      if (gate.isEnabled) {
        enabled.push(featureId);
      } else {
        disabled.push(featureId);
        if (gate.trialAvailable) {
          trialAvailable.push(featureId);
        }
      }
    }

    return { enabled, disabled, trialAvailable };
  }

  async startTrial(featureId: string): Promise<{
    success: boolean;
    message: string;
    trialEndDate?: Date;
  }> {
    const gate = this.featureGates.get(featureId);
    
    if (!gate) {
      return { success: false, message: '不明な機能です' };
    }

    if (!gate.trialAvailable) {
      return { success: false, message: 'この機能のトライアルは利用できません' };
    }

    if (!this.canStartTrial()) {
      return { success: false, message: 'トライアルは一度のみご利用いただけます' };
    }

    // Start trial for the specific feature
    await this.enableFeatureTrial(featureId);
    
    const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    return {
      success: true,
      message: `${gate.description}の7日間無料トライアルを開始しました`,
      trialEndDate
    };
  }

  getUsageStats(): {
    [featureId: string]: {
      used: number;
      limit?: number;
      resetDate?: Date;
      isLimited: boolean;
    };
  } {
    const stats: any = {};
    
    for (const [featureId, gate] of this.featureGates.entries()) {
      const usage = this.usageTracking.get(featureId);
      
      stats[featureId] = {
        used: usage?.usageCount || 0,
        limit: gate.usageLimit,
        resetDate: usage?.resetDate,
        isLimited: !!gate.usageLimit
      };
    }
    
    return stats;
  }

  private updateFeatureGatesFromSubscription(): void {
    const featureAccess = subscriptionService.getFeatureAccess(this.userId);
    
    // Update each feature gate based on subscription
    this.updateFeatureGate('advanced_analytics', featureAccess.hasAdvancedAnalytics);
    this.updateFeatureGate('export_functionality', featureAccess.hasExportFunctionality);
    this.updateFeatureGate('custom_categories', featureAccess.hasCustomCategories);
    this.updateFeatureGate('ai_insights', featureAccess.hasAIInsights);
    this.updateFeatureGate('family_sharing', featureAccess.hasFamilySharing);
    this.updateFeatureGate('ad_free', featureAccess.hasNoAds);
    this.updateFeatureGate('unlimited_cards', featureAccess.cardLimit === -1);
    this.updateFeatureGate('extended_history', featureAccess.historyDays >= 365);
    this.updateFeatureGate('budget_alerts', featureAccess.hasAdvancedAnalytics);
    this.updateFeatureGate('priority_support', featureAccess.hasAdvancedAnalytics);
  }

  private updateFeatureGate(featureId: string, isEnabled: boolean): void {
    const gate = this.featureGates.get(featureId);
    if (gate) {
      gate.isEnabled = isEnabled;
      this.featureGates.set(featureId, gate);
    }
  }

  private generatePaywallConfig(
    gate: FeatureGate,
    canUseTrial?: boolean
  ): PaywallConfig {
    const plans = subscriptionService.getAllPlans()
      .filter(plan => gate.requiredPlan.includes(plan.id));

    return {
      title: `${gate.description}を利用する`,
      description: gate.upgradeMessage,
      features: this.getRelatedFeatures(gate.featureId),
      ctaText: plans.length > 0 ? `${plans[0].name}にアップグレード` : 'プランを選択',
      showTrial: canUseTrial || false,
      trialDuration: 7,
      alternativeAction: gate.usageLimit ? {
        text: 'フリープランで続行',
        action: () => this.showFreePlanLimits(gate.featureId)
      } : undefined
    };
  }

  private getRelatedFeatures(featureId: string): string[] {
    const featureGroups: {[key: string]: string[]} = {
      'advanced_analytics': [
        'AI による支出パターン分析',
        '節約提案',
        '異常支出の検出',
        '将来の支出予測'
      ],
      'export_functionality': [
        'CSV/PDF/Excel エクスポート',
        '月次・年次レポート',
        '税務資料の準備',
        'カスタムレポート作成'
      ],
      'family_sharing': [
        '家族5人まで共有',
        '家計簿統合機能',
        '子供向け支出管理',
        '家族レポート'
      ]
    };

    return featureGroups[featureId] || [
      'プレミアム機能',
      '高度な分析',
      '優先サポート'
    ];
  }

  private trackFeatureUsage(featureId: string): void {
    const usage = this.usageTracking.get(featureId) || {
      featureId,
      usageCount: 0,
      lastUsed: new Date(),
      resetDate: this.calculateResetDate('monthly')
    };

    usage.usageCount += 1;
    usage.lastUsed = new Date();
    
    this.usageTracking.set(featureId, usage);
    this.saveUsageData();
  }

  private isUsageResetNeeded(
    usage: FeatureUsage,
    resetPeriod?: 'daily' | 'weekly' | 'monthly'
  ): boolean {
    if (!resetPeriod) return false;
    
    const now = new Date();
    return now > usage.resetDate;
  }

  private resetUsage(featureId: string): void {
    const gate = this.featureGates.get(featureId);
    if (!gate) return;

    const usage = this.usageTracking.get(featureId);
    if (usage) {
      usage.usageCount = 0;
      usage.resetDate = this.calculateResetDate(gate.resetPeriod);
      this.usageTracking.set(featureId, usage);
      this.saveUsageData();
    }
  }

  private calculateResetDate(resetPeriod?: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    
    switch (resetPeriod) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + (7 - now.getDay()));
        return nextWeek;
      case 'monthly':
      default:
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }

  private canStartTrial(): boolean {
    return subscriptionService.checkTrialEligibility(this.userId);
  }

  private async enableFeatureTrial(featureId: string): Promise<void> {
    // Enable the specific feature for trial period
    const gate = this.featureGates.get(featureId);
    if (gate) {
      gate.isEnabled = true;
      this.featureGates.set(featureId, gate);
      
      // Set up trial expiration
      setTimeout(() => {
        this.expireFeatureTrial(featureId);
      }, 7 * 24 * 60 * 60 * 1000); // 7 days
    }
  }

  private expireFeatureTrial(featureId: string): void {
    // Check if user has upgraded during trial
    const subscription = subscriptionService.getUserSubscription(this.userId);
    
    if (!subscription || subscription.status === 'trial') {
      const gate = this.featureGates.get(featureId);
      if (gate) {
        gate.isEnabled = false;
        this.featureGates.set(featureId, gate);
        
        // Notify user of trial expiration
        this.notifyTrialExpiration(featureId);
      }
    }
  }

  private notifyTrialExpiration(featureId: string): void {
    const gate = this.featureGates.get(featureId);
    if (gate) {
      const event = new CustomEvent('trial-expired', {
        detail: {
          featureId,
          featureName: gate.description,
          upgradeMessage: gate.upgradeMessage
        }
      });
      window.dispatchEvent(event);
    }
  }

  private showFreePlanLimits(featureId: string): void {
    const event = new CustomEvent('show-free-plan-limits', {
      detail: { featureId }
    });
    window.dispatchEvent(event);
  }

  private loadUsageData(): void {
    try {
      const stored = localStorage.getItem(`featureUsage_${this.userId}`);
      if (stored) {
        const usageData = JSON.parse(stored);
        Object.entries(usageData).forEach(([featureId, usage]: [string, any]) => {
          this.usageTracking.set(featureId, {
            ...usage,
            lastUsed: new Date(usage.lastUsed),
            resetDate: new Date(usage.resetDate)
          });
        });
      }
    } catch (error) {
      console.error('Failed to load usage data:', error);
    }
  }

  private saveUsageData(): void {
    try {
      const usageData: any = {};
      this.usageTracking.forEach((usage, featureId) => {
        usageData[featureId] = {
          ...usage,
          lastUsed: usage.lastUsed.toISOString(),
          resetDate: usage.resetDate.toISOString()
        };
      });
      
      localStorage.setItem(`featureUsage_${this.userId}`, JSON.stringify(usageData));
    } catch (error) {
      console.error('Failed to save usage data:', error);
    }
  }

  // Public method to refresh feature gates when subscription changes
  public refreshFeatureGates(): void {
    this.updateFeatureGatesFromSubscription();
  }

  // Public method to check if ads should be shown
  public shouldShowAds(): boolean {
    const adFreeGate = this.featureGates.get('ad_free');
    return !adFreeGate?.isEnabled;
  }

  // Public method to get card connection limit
  public getCardLimit(): number {
    const featureAccess = subscriptionService.getFeatureAccess(this.userId);
    return featureAccess.cardLimit;
  }

  // Public method to get history retention days
  public getHistoryDays(): number {
    const featureAccess = subscriptionService.getFeatureAccess(this.userId);
    return featureAccess.historyDays;
  }
}

export const featureGateService = new FeatureGateService();