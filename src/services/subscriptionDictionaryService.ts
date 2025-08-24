/**
 * 日本の主要サブスクリプションサービス辞書
 * パターンマッチングによる高精度な検出
 */

import subscriptionData from '../data/subscriptionServices.json';

export interface SubscriptionService {
  name: string;
  patterns: string[];
  aliases: string[];
  averagePrice: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  description: string;
}

export interface ServiceCategory {
  category: string;
  services: SubscriptionService[];
}

export interface SubscriptionMatch {
  serviceName: string;
  category: string;
  confidence: number;
  matchedPattern: string;
  estimatedPrice: number;
  frequency: string;
  description: string;
}

class SubscriptionDictionaryService {
  private services: Map<string, ServiceCategory> = new Map();
  private allServices: SubscriptionService[] = [];
  private patternCache: Map<string, SubscriptionMatch | null> = new Map();

  constructor() {
    this.loadServices();
  }

  private loadServices() {
    // JSONデータを読み込み
    Object.entries(subscriptionData).forEach(([categoryKey, categoryData]: [string, any]) => {
      const category: ServiceCategory = {
        category: categoryData.category,
        services: categoryData.services
      };
      
      this.services.set(categoryKey, category);
      this.allServices.push(...category.services);
    });

    console.log(`Loaded ${this.allServices.length} subscription services across ${this.services.size} categories`);
  }

  /**
   * 加盟店名からサブスクリプションサービスを検出
   */
  detectService(merchantName: string, amount?: number): SubscriptionMatch | null {
    if (!merchantName) return null;

    // キャッシュをチェック
    const cacheKey = `${merchantName.toLowerCase()}_${amount || 0}`;
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!;
    }

    const normalizedMerchant = this.normalizeMerchantName(merchantName);
    let bestMatch: SubscriptionMatch | null = null;
    let highestConfidence = 0;

    // 全サービスをチェック
    for (const [categoryKey, category] of this.services.entries()) {
      for (const service of category.services) {
        const match = this.matchService(normalizedMerchant, service, category.category, amount);
        if (match && match.confidence > highestConfidence) {
          bestMatch = match;
          highestConfidence = match.confidence;
        }
      }
    }

    // キャッシュに保存
    this.patternCache.set(cacheKey, bestMatch);
    return bestMatch;
  }

  private matchService(
    merchantName: string, 
    service: SubscriptionService, 
    category: string, 
    amount?: number
  ): SubscriptionMatch | null {
    let confidence = 0;
    let matchedPattern = '';

    // パターンマッチング
    for (const pattern of service.patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(merchantName)) {
        // パターンの詳細度に基づいて信頼度を設定
        const patternLength = pattern.length;
        const patternConfidence = Math.min(0.9, 0.5 + (patternLength / 20));
        
        if (patternConfidence > confidence) {
          confidence = patternConfidence;
          matchedPattern = pattern;
        }
      }
    }

    // 金額ベースの信頼度補正
    if (confidence > 0 && amount) {
      const priceMatch = this.calculatePriceConfidence(amount, service.averagePrice);
      confidence = Math.min(0.95, confidence + priceMatch * 0.2);
    }

    if (confidence < 0.3) return null;

    return {
      serviceName: service.name,
      category,
      confidence,
      matchedPattern,
      estimatedPrice: service.averagePrice,
      frequency: service.frequency,
      description: service.description
    };
  }

  private calculatePriceConfidence(actualAmount: number, expectedAmount: number): number {
    if (actualAmount === 0 || expectedAmount === 0) return 0;
    
    const ratio = Math.min(actualAmount, expectedAmount) / Math.max(actualAmount, expectedAmount);
    
    // 金額が近いほど高い信頼度（±30%以内で高評価）
    if (ratio >= 0.7) return 1.0;
    if (ratio >= 0.5) return 0.7;
    if (ratio >= 0.3) return 0.4;
    return 0.1;
  }

  private normalizeMerchantName(merchant: string): string {
    return merchant
      .toLowerCase()
      .replace(/[０-９Ａ-Ｚａ-ｚ]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[＊*・\-\u30FC＿_\|\/@#$%&+=]/g, ' ')
      .replace(/\b\d{3,}\b/g, '')
      .replace(/\s+\d{1,2}$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * カテゴリ別のサービス一覧を取得
   */
  getServicesByCategory(categoryKey?: string): ServiceCategory[] {
    if (categoryKey && this.services.has(categoryKey)) {
      return [this.services.get(categoryKey)!];
    }
    return Array.from(this.services.values());
  }

  /**
   * 全サービス一覧を取得
   */
  getAllServices(): SubscriptionService[] {
    return this.allServices;
  }

  /**
   * サービス名で検索
   */
  searchServices(query: string): SubscriptionService[] {
    const normalizedQuery = query.toLowerCase();
    return this.allServices.filter(service =>
      service.name.toLowerCase().includes(normalizedQuery) ||
      service.aliases.some(alias => alias.toLowerCase().includes(normalizedQuery)) ||
      service.patterns.some(pattern => pattern.toLowerCase().includes(normalizedQuery))
    );
  }

  /**
   * 価格帯でフィルタ
   */
  getServicesByPriceRange(minPrice: number, maxPrice: number): SubscriptionService[] {
    return this.allServices.filter(service =>
      service.averagePrice >= minPrice && service.averagePrice <= maxPrice
    );
  }

  /**
   * 頻度でフィルタ
   */
  getServicesByFrequency(frequency: 'monthly' | 'quarterly' | 'yearly'): SubscriptionService[] {
    return this.allServices.filter(service => service.frequency === frequency);
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    const totalServices = this.allServices.length;
    const categories = this.services.size;
    
    const byFrequency = {
      monthly: this.allServices.filter(s => s.frequency === 'monthly').length,
      quarterly: this.allServices.filter(s => s.frequency === 'quarterly').length,
      yearly: this.allServices.filter(s => s.frequency === 'yearly').length,
    };

    const avgPrice = {
      all: Math.round(this.allServices.reduce((sum, s) => sum + s.averagePrice, 0) / totalServices),
      monthly: Math.round(this.getServicesByFrequency('monthly').reduce((sum, s) => sum + s.averagePrice, 0) / byFrequency.monthly),
    };

    const priceDistribution = {
      under1000: this.allServices.filter(s => s.averagePrice < 1000).length,
      '1000-3000': this.allServices.filter(s => s.averagePrice >= 1000 && s.averagePrice < 3000).length,
      '3000-5000': this.allServices.filter(s => s.averagePrice >= 3000 && s.averagePrice < 5000).length,
      over5000: this.allServices.filter(s => s.averagePrice >= 5000).length,
    };

    return {
      totalServices,
      categories,
      byFrequency,
      avgPrice,
      priceDistribution,
      cacheHitRate: this.patternCache.size > 0 ? 
        Array.from(this.patternCache.values()).filter(v => v !== null).length / this.patternCache.size : 0
    };
  }

  /**
   * キャッシュクリア
   */
  clearCache() {
    this.patternCache.clear();
  }

  /**
   * カスタムサービスを追加（ユーザー定義）
   */
  addCustomService(service: SubscriptionService, categoryKey: string = 'custom') {
    if (!this.services.has(categoryKey)) {
      this.services.set(categoryKey, {
        category: 'カスタム',
        services: []
      });
    }

    this.services.get(categoryKey)!.services.push(service);
    this.allServices.push(service);
    this.clearCache(); // キャッシュをクリア
  }

  /**
   * デバッグ用：マッチング詳細を表示
   */
  debugMatch(merchantName: string, amount?: number): any {
    const normalizedMerchant = this.normalizeMerchantName(merchantName);
    const results = [];

    for (const [categoryKey, category] of this.services.entries()) {
      for (const service of category.services) {
        const match = this.matchService(normalizedMerchant, service, category.category, amount);
        if (match && match.confidence > 0.1) {
          results.push({
            service: service.name,
            category: category.category,
            confidence: match.confidence,
            matchedPattern: match.matchedPattern,
            normalizedInput: normalizedMerchant
          });
        }
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}

export const subscriptionDictionaryService = new SubscriptionDictionaryService();