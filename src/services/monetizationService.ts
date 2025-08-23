import { subscriptionService } from './subscriptionService';
import { adService } from './adService';
import { exportService } from './exportService';
import { featureGateService } from './featureGateService';

export interface MonetizationModel {
  ads: {
    banner: 'always' | 'never';
    interstitial: {
      frequency: number; // every N actions
      triggers: string[];
    };
    rewarded: {
      rewards: RewardType[];
      available: boolean;
    };
  };
  inAppPurchases: {
    [itemId: string]: {
      price: number;
      currency: 'JPY';
      type: 'consumable' | 'non_consumable';
      description: string;
      benefits: string[];
    };
  };
  subscriptions: {
    [planId: string]: {
      price: number;
      interval: 'monthly' | 'yearly';
      trial: boolean;
      features: string[];
    };
  };
  freemium: {
    limits: {
      [feature: string]: number;
    };
    resetPeriod: 'daily' | 'weekly' | 'monthly';
  };
}

export interface RewardType {
  id: string;
  name: string;
  description: string;
  value: number;
  type: 'export_unlock' | 'feature_trial' | 'premium_trial' | 'virtual_currency';
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  receipt?: string;
}

export interface RevenueMetrics {
  totalRevenue: number;
  adRevenue: number;
  subscriptionRevenue: number;
  inAppPurchaseRevenue: number;
  arpu: number; // Average Revenue Per User
  arppu: number; // Average Revenue Per Paying User
  payingUserRate: number;
  retentionRate: {
    day1: number;
    day7: number;
    day30: number;
  };
  ltv: number; // Lifetime Value
}

class MonetizationService {
  private monetizationModel: MonetizationModel;
  private userId: string = 'default-user';
  private revenueMetrics: RevenueMetrics = {
    totalRevenue: 0,
    adRevenue: 0,
    subscriptionRevenue: 0,
    inAppPurchaseRevenue: 0,
    arpu: 0,
    arppu: 0,
    payingUserRate: 0,
    retentionRate: { day1: 0, day7: 0, day30: 0 },
    ltv: 0
  };

  constructor() {
    this.monetizationModel = this.initializeMonetizationModel();
    this.initializeMetrics();
  }

  private initializeMonetizationModel(): MonetizationModel {
    return {
      ads: {
        banner: 'always',
        interstitial: {
          frequency: 3,
          triggers: ['export_attempt', 'feature_access', 'navigation']
        },
        rewarded: {
          rewards: [
            {
              id: 'export_unlock',
              name: 'エクスポート解除',
              description: '月間エクスポート制限を1回分解除',
              value: 1,
              type: 'export_unlock'
            },
            {
              id: 'premium_trial',
              name: '24時間プレミアム体験',
              description: 'プレミアム機能を24時間無料で利用',
              value: 24,
              type: 'feature_trial'
            },
            {
              id: 'analysis_unlock',
              name: 'AI分析解除',
              description: 'AI分析機能を3回利用可能',
              value: 3,
              type: 'feature_trial'
            }
          ],
          available: true
        }
      },
      inAppPurchases: {
        'export_pdf_pack': {
          price: 120,
          currency: 'JPY',
          type: 'consumable',
          description: 'PDFエクスポート5回パック',
          benefits: ['PDF形式でのエクスポート5回分']
        },
        'yearly_report': {
          price: 300,
          currency: 'JPY',
          type: 'consumable',
          description: '年次レポート作成',
          benefits: ['詳細な年次分析レポート', 'カスタムチャート', 'PDF形式']
        },
        'premium_analytics': {
          price: 250,
          currency: 'JPY',
          type: 'consumable',
          description: 'プレミアム分析パック',
          benefits: ['AI による詳細分析', '異常検知', '最適化提案']
        },
        'remove_ads_month': {
          price: 200,
          currency: 'JPY',
          type: 'consumable',
          description: '1ヶ月広告非表示',
          benefits: ['30日間の広告非表示']
        },
        'card_optimization': {
          price: 180,
          currency: 'JPY',
          type: 'consumable',
          description: 'カード最適化レポート',
          benefits: ['パーソナライズされたカード推奨', '年間節約額予測']
        }
      },
      subscriptions: {
        'premium_monthly': {
          price: 480,
          interval: 'monthly',
          trial: true,
          features: [
            '無制限カード連携',
            'AI分析機能',
            '広告非表示',
            '無制限エクスポート',
            'プレミアムサポート'
          ]
        },
        'premium_yearly': {
          price: 4800,
          interval: 'yearly',
          trial: true,
          features: [
            'プレミアム月額の全機能',
            '年次レポート',
            '2ヶ月分お得',
            '税務サポート'
          ]
        },
        'family_monthly': {
          price: 780,
          interval: 'monthly',
          trial: false,
          features: [
            'プレミアム全機能',
            '家族5人まで共有',
            '家計簿統合',
            '子供向け管理'
          ]
        }
      },
      freemium: {
        limits: {
          cards: 2,
          export_monthly: 3,
          ai_analysis_monthly: 5,
          history_days: 30,
          categories: 10
        },
        resetPeriod: 'monthly'
      }
    };
  }

  // Core monetization logic
  async attemptMonetization(trigger: string, context?: any): Promise<{
    strategy: 'ad' | 'paywall' | 'iap_offer' | 'subscription_offer' | 'allow';
    content?: any;
    fallback?: string;
  }> {
    // Check if user is premium
    const subscription = subscriptionService.getUserSubscription(this.userId);
    const isPremium = subscription?.status === 'active';

    // Premium users get everything
    if (isPremium) {
      return { strategy: 'allow' };
    }

    // Check feature limits
    const featureAccess = await featureGateService.checkFeatureAccess(trigger);
    
    if (featureAccess.hasAccess) {
      // Show interstitial ad occasionally
      if (this.shouldShowInterstitialAd(trigger)) {
        return {
          strategy: 'ad',
          content: { type: 'interstitial' },
          fallback: 'allow'
        };
      }
      return { strategy: 'allow' };
    }

    // User hit a limit - determine best monetization strategy
    return this.selectOptimalStrategy(trigger, context);
  }

  private selectOptimalStrategy(trigger: string, context?: any): {
    strategy: 'ad' | 'paywall' | 'iap_offer' | 'subscription_offer';
    content: any;
  } {
    const userProfile = this.getUserMonetizationProfile();
    
    // High-value actions -> subscription offer
    if (['ai_analysis', 'export_functionality', 'unlimited_cards'].includes(trigger)) {
      if (userProfile.subscriptionAffinity > 0.6) {
        return {
          strategy: 'subscription_offer',
          content: this.generateSubscriptionOffer(trigger)
        };
      }
    }

    // One-time needs -> in-app purchase
    if (['export_pdf', 'yearly_report', 'remove_ads'].includes(trigger)) {
      const iapItem = this.getRelevantIAPItem(trigger);
      if (iapItem) {
        return {
          strategy: 'iap_offer',
          content: iapItem
        };
      }
    }

    // Low-commitment users -> rewarded ads
    if (userProfile.adTolerance > 0.5) {
      const reward = this.getRelevantReward(trigger);
      if (reward) {
        return {
          strategy: 'ad',
          content: { type: 'rewarded', reward }
        };
      }
    }

    // Default to subscription offer with trial
    return {
      strategy: 'subscription_offer',
      content: this.generateTrialOffer()
    };
  }

  private getUserMonetizationProfile(): {
    subscriptionAffinity: number;
    adTolerance: number;
    iapPropensity: number;
    pricesensitivity: number;
  } {
    // Analyze user behavior to determine monetization preferences
    const usageData = this.getUserUsageData();
    
    return {
      subscriptionAffinity: this.calculateSubscriptionAffinity(usageData),
      adTolerance: this.calculateAdTolerance(usageData),
      iapPropensity: this.calculateIAPPropensity(usageData),
      pricesensitivity: this.calculatePriceSensitivity(usageData)
    };
  }

  // In-App Purchases
  async purchaseItem(itemId: string): Promise<PurchaseResult> {
    const item = this.monetizationModel.inAppPurchases[itemId];
    if (!item) {
      return { success: false, error: '商品が見つかりません' };
    }

    try {
      // In a real app, this would integrate with platform stores
      const result = await this.processPlatformPurchase(itemId, item);
      
      if (result.success) {
        await this.grantPurchaseRewards(itemId);
        this.trackPurchase(itemId, item.price);
      }

      return result;
    } catch (error) {
      console.error('Purchase failed:', error);
      return { success: false, error: '購入に失敗しました' };
    }
  }

  private async processPlatformPurchase(itemId: string, item: any): Promise<PurchaseResult> {
    // Mock purchase process - in real app would use Capacitor purchase plugins
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate success/failure
        const success = Math.random() > 0.1; // 90% success rate
        
        if (success) {
          resolve({
            success: true,
            transactionId: `txn_${Date.now()}`,
            receipt: `receipt_${itemId}_${Date.now()}`
          });
        } else {
          resolve({
            success: false,
            error: '決済がキャンセルされました'
          });
        }
      }, 2000);
    });
  }

  private async grantPurchaseRewards(itemId: string): Promise<void> {
    switch (itemId) {
      case 'export_pdf_pack':
        this.grantExportCredits(5);
        break;
      case 'remove_ads_month':
        this.grantAdFreeTime(30 * 24 * 60 * 60 * 1000); // 30 days
        break;
      case 'premium_analytics':
        this.grantFeatureCredits('ai_analysis', 10);
        break;
      case 'yearly_report':
        this.grantFeatureCredits('yearly_report', 1);
        break;
      case 'card_optimization':
        this.grantFeatureCredits('card_optimization', 1);
        break;
    }
  }

  // Rewarded Ads
  async watchRewardedAd(rewardId: string): Promise<{success: boolean, reward?: any, error?: string}> {
    const reward = this.monetizationModel.ads.rewarded.rewards.find(r => r.id === rewardId);
    if (!reward) {
      return { success: false, error: '報酬が見つかりません' };
    }

    try {
      const adResult = await adService.showRewardedAd();
      
      if (adResult.watched) {
        await this.grantReward(reward);
        this.trackAdRevenue('rewarded');
        
        return { success: true, reward };
      }
      
      return { success: false, error: '動画を最後まで視聴してください' };
    } catch (error) {
      console.error('Rewarded ad failed:', error);
      return { success: false, error: '広告の表示に失敗しました' };
    }
  }

  private async grantReward(reward: RewardType): Promise<void> {
    switch (reward.type) {
      case 'export_unlock':
        this.grantExportCredits(reward.value);
        break;
      case 'feature_trial':
        this.grantFeatureCredits(reward.id, reward.value);
        break;
      case 'premium_trial':
        this.grantPremiumTrial(reward.value);
        break;
    }
  }

  // Revenue Analytics
  private trackPurchase(itemId: string, amount: number): void {
    this.revenueMetrics.inAppPurchaseRevenue += amount;
    this.revenueMetrics.totalRevenue += amount;
    
    // Track with analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'purchase', {
        transaction_id: `txn_${Date.now()}`,
        value: amount,
        currency: 'JPY',
        items: [{
          item_id: itemId,
          item_name: this.monetizationModel.inAppPurchases[itemId]?.description,
          price: amount,
          quantity: 1
        }]
      });
    }
  }

  private trackAdRevenue(adType: string): void {
    const estimatedRevenue = this.getEstimatedAdRevenue(adType);
    this.revenueMetrics.adRevenue += estimatedRevenue;
    this.revenueMetrics.totalRevenue += estimatedRevenue;
  }

  private getEstimatedAdRevenue(adType: string): number {
    // Estimated eCPM for Japanese market
    const ecpmValues = {
      banner: 0.05, // ¥0.05 per impression
      interstitial: 0.3, // ¥0.30 per impression
      rewarded: 0.8 // ¥0.80 per view
    };
    
    return ecpmValues[adType as keyof typeof ecpmValues] || 0;
  }

  // A/B Testing for monetization
  getMonetizationVariant(): 'aggressive' | 'balanced' | 'gentle' {
    const userId = this.userId;
    const hash = this.simpleHash(userId);
    
    if (hash % 3 === 0) return 'aggressive';
    if (hash % 3 === 1) return 'gentle';
    return 'balanced';
  }

  // Pricing optimization
  getDynamicPricing(itemId: string): number {
    const basePrice = this.monetizationModel.inAppPurchases[itemId]?.price || 0;
    const userProfile = this.getUserMonetizationProfile();
    
    // Adjust price based on user behavior
    let priceMultiplier = 1.0;
    
    if (userProfile.priceSenitivity < 0.3) {
      priceMultiplier = 1.2; // Premium pricing for price-insensitive users
    } else if (userProfile.priceSenitivity > 0.7) {
      priceMultiplier = 0.8; // Discount for price-sensitive users
    }
    
    return Math.round(basePrice * priceMultiplier);
  }

  // Helper methods
  private shouldShowInterstitialAd(trigger: string): boolean {
    const triggers = this.monetizationModel.ads.interstitial.triggers;
    const frequency = this.monetizationModel.ads.interstitial.frequency;
    
    if (!triggers.includes(trigger)) return false;
    
    const actionCount = this.getActionCount();
    return actionCount % frequency === 0;
  }

  private getRelevantIAPItem(trigger: string): any {
    const mapping: {[key: string]: string} = {
      'export_pdf': 'export_pdf_pack',
      'yearly_report': 'yearly_report',
      'remove_ads': 'remove_ads_month',
      'ai_analysis': 'premium_analytics',
      'card_optimization': 'card_optimization'
    };
    
    const itemId = mapping[trigger];
    return itemId ? {
      id: itemId,
      ...this.monetizationModel.inAppPurchases[itemId]
    } : null;
  }

  private getRelevantReward(trigger: string): RewardType | null {
    const mapping: {[key: string]: string} = {
      'export_functionality': 'export_unlock',
      'ai_analysis': 'analysis_unlock',
      'premium_features': 'premium_trial'
    };
    
    const rewardId = mapping[trigger];
    return this.monetizationModel.ads.rewarded.rewards.find(r => r.id === rewardId) || null;
  }

  private generateSubscriptionOffer(trigger: string): any {
    return {
      type: 'subscription',
      title: 'プレミアムプランで制限なし',
      description: 'すべての機能を無制限でご利用いただけます',
      plans: [
        {
          id: 'premium_monthly',
          ...this.monetizationModel.subscriptions.premium_monthly
        }
      ],
      trial: true,
      benefits: this.getContextualBenefits(trigger)
    };
  }

  private generateTrialOffer(): any {
    return {
      type: 'trial',
      title: '7日間無料でお試し',
      description: 'プレミアム機能をすべて無料で体験',
      duration: 7,
      features: this.monetizationModel.subscriptions.premium_monthly.features
    };
  }

  private getContextualBenefits(trigger: string): string[] {
    const benefitMapping: {[key: string]: string[]} = {
      'ai_analysis': ['AI による高度な分析', '支出パターンの詳細解析', '最適化提案'],
      'export_functionality': ['無制限エクスポート', 'PDF/Excel対応', 'カスタムレポート'],
      'unlimited_cards': ['カード無制限連携', '全カード一括管理', 'カード別最適化']
    };
    
    return benefitMapping[trigger] || this.monetizationModel.subscriptions.premium_monthly.features;
  }

  // User behavior analysis methods
  private getUserUsageData(): any {
    return {
      sessionsPerWeek: 5,
      featuresUsed: ['basic_analysis', 'card_management'],
      timeSpent: 120, // minutes per week
      exportAttempts: 2,
      adInteractions: 3
    };
  }

  private calculateSubscriptionAffinity(usageData: any): number {
    // High usage + multiple features = high subscription affinity
    let score = 0;
    
    if (usageData.sessionsPerWeek > 3) score += 0.3;
    if (usageData.featuresUsed.length > 2) score += 0.3;
    if (usageData.timeSpent > 60) score += 0.4;
    
    return Math.min(1.0, score);
  }

  private calculateAdTolerance(usageData: any): number {
    // Based on ad interaction history
    return usageData.adInteractions > 0 ? 0.7 : 0.3;
  }

  private calculateIAPPropensity(usageData: any): number {
    // Based on feature usage patterns
    return usageData.exportAttempts > 1 ? 0.6 : 0.3;
  }

  private calculatePriceSensitivity(usageData: any): number {
    // Default medium sensitivity - would be learned from behavior
    return 0.5;
  }

  private grantExportCredits(credits: number): void {
    const current = parseInt(localStorage.getItem('exportCredits') || '0');
    localStorage.setItem('exportCredits', (current + credits).toString());
  }

  private grantAdFreeTime(milliseconds: number): void {
    const expiryTime = Date.now() + milliseconds;
    localStorage.setItem('adFreeUntil', expiryTime.toString());
  }

  private grantFeatureCredits(feature: string, credits: number): void {
    const current = parseInt(localStorage.getItem(`${feature}Credits`) || '0');
    localStorage.setItem(`${feature}Credits`, (current + credits).toString());
  }

  private grantPremiumTrial(hours: number): void {
    const expiryTime = Date.now() + (hours * 60 * 60 * 1000);
    localStorage.setItem('premiumTrialUntil', expiryTime.toString());
  }

  private getActionCount(): number {
    return parseInt(localStorage.getItem('actionCount') || '0');
  }

  private incrementActionCount(): void {
    const count = this.getActionCount() + 1;
    localStorage.setItem('actionCount', count.toString());
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private initializeMetrics(): void {
    // Load metrics from storage or API
    const stored = localStorage.getItem('revenueMetrics');
    if (stored) {
      this.revenueMetrics = { ...this.revenueMetrics, ...JSON.parse(stored) };
    }
  }

  // Public methods
  getMonetizationModel(): MonetizationModel {
    return this.monetizationModel;
  }

  getRevenueMetrics(): RevenueMetrics {
    return { ...this.revenueMetrics };
  }

  async checkFeatureAccess(feature: string): Promise<boolean> {
    return await featureGateService.checkFeatureAccess(feature).then(result => result.hasAccess);
  }

  getAvailableRewards(): RewardType[] {
    return this.monetizationModel.ads.rewarded.rewards;
  }

  getInAppPurchases(): any[] {
    return Object.entries(this.monetizationModel.inAppPurchases).map(([id, item]) => ({
      id,
      ...item,
      price: this.getDynamicPricing(id)
    }));
  }
}

export const monetizationService = new MonetizationService();