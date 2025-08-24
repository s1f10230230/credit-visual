import { ExtendedCreditTransaction, SubscriptionPattern, OverseasServiceTemplate, ExchangeRate } from '../types/Transaction';

// 海外サブスクテンプレート
const OVERSEAS_SERVICES: OverseasServiceTemplate[] = [
  {
    name: 'ChatGPT Plus',
    category: 'サブスク',
    amount: 20,
    currency: 'USD',
    frequency: 'monthly',
    description: 'OpenAI ChatGPT Plus subscription',
    website: 'https://openai.com',
    commonMerchantNames: ['OPENAI', 'STRIPE*OPENAI', 'CHATGPT', 'OpenAI ChatGPT']
  },
  {
    name: 'Claude Pro',
    category: 'サブスク', 
    amount: 20,
    currency: 'USD',
    frequency: 'monthly',
    description: 'Anthropic Claude Pro subscription',
    commonMerchantNames: ['ANTHROPIC', 'CLAUDE', 'STRIPE*ANTHROPIC']
  },
  {
    name: 'Midjourney',
    category: 'サブスク',
    amount: 10,
    currency: 'USD', 
    frequency: 'monthly',
    description: 'AI image generation service',
    commonMerchantNames: ['MIDJOURNEY', 'MJ', 'STRIPE*MIDJOURNEY']
  },
  {
    name: 'GitHub Copilot',
    category: 'サブスク',
    amount: 10,
    currency: 'USD',
    frequency: 'monthly',
    description: 'AI coding assistant',
    commonMerchantNames: ['GITHUB', 'MICROSOFT*GITHUB', 'COPILOT']
  },
  {
    name: 'Netflix',
    category: 'サブスク',
    amount: 15.99,
    currency: 'USD',
    frequency: 'monthly',
    description: 'Streaming service',
    commonMerchantNames: ['NETFLIX', 'NETFLIX.COM', 'NF*NETFLIX']
  },
  {
    name: 'Spotify Premium',
    category: 'サブスク',
    amount: 9.99,
    currency: 'USD',
    frequency: 'monthly',
    description: 'Music streaming service',
    commonMerchantNames: ['SPOTIFY', 'SPOTIFY AB', 'SPOTIFY*PREMIUM']
  },
  {
    name: 'Adobe Creative Cloud',
    category: 'サブスク',
    amount: 29.99,
    currency: 'USD',
    frequency: 'monthly',
    description: 'Creative software suite',
    commonMerchantNames: ['ADOBE', 'ADOBE*CREATIVE', 'ADOBE SYSTEMS']
  },
  {
    name: 'Dropbox Plus',
    category: 'サブスク',
    amount: 11.99,
    currency: 'USD',
    frequency: 'monthly',
    description: 'Cloud storage service',
    commonMerchantNames: ['DROPBOX', 'DROPBOX*PLUS', 'DBX*DROPBOX']
  },
  {
    name: 'Notion Pro',
    category: 'サブスク',
    amount: 10,
    currency: 'USD',
    frequency: 'monthly',
    description: 'Productivity workspace',
    commonMerchantNames: ['NOTION', 'NOTION LABS', 'STRIPE*NOTION']
  },
  {
    name: 'Figma Professional',
    category: 'サブスク',
    amount: 15,
    currency: 'USD',
    frequency: 'monthly',
    description: 'Design collaboration tool',
    commonMerchantNames: ['FIGMA', 'FIGMA INC', 'STRIPE*FIGMA']
  }
];

// 通貨ごとの一般的な為替レート（概算）
const ESTIMATED_EXCHANGE_RATES: { [key: string]: number } = {
  'USD': 150,
  'EUR': 165,
  'GBP': 190,
  'KRW': 0.11,
  'CNY': 21,
};

class OverseasSubscriptionService {
  private detectedPatterns: Map<string, SubscriptionPattern> = new Map();
  private exchangeRates: Map<string, ExchangeRate> = new Map();

  constructor() {
    this.loadStoredData();
  }

  // 海外利用からサブスクを検知
  detectOverseasSubscription(transactions: ExtendedCreditTransaction[]): ExtendedCreditTransaction[] {
    return transactions.map(tx => {
      // 海外取引でない場合はそのまま返す
      if (!this.isOverseasTransaction(tx)) {
        return tx;
      }

      // 海外取引の場合は分析を実行
      const detection = this.analyzeOverseasTransaction(tx);
      if (detection.isSubscription) {
        return {
          ...tx,
          category: 'サブスク',
          originalCurrency: detection.currency,
          originalAmount: detection.originalAmount,
          exchangeRate: detection.exchangeRate,
          isOverseas: true,
          detectionMethod: 'overseas_detection',
          confidence: detection.confidence,
          merchant: detection.detectedService || tx.merchant,
        };
      }
      
      // 海外取引だがサブスクでない場合
      return {
        ...tx,
        isOverseas: true,
      };
    });
  }

  // 海外取引の判定
  private isOverseasTransaction(tx: ExtendedCreditTransaction): boolean {
    const overseasKeywords = ['海外利用', '海外ショッピング', 'OVERSEAS', 'FOREIGN'];
    return overseasKeywords.some(keyword => 
      tx.merchant.includes(keyword) || tx.category?.includes(keyword)
    );
  }

  // 海外取引の分析
  private analyzeOverseasTransaction(tx: ExtendedCreditTransaction): {
    isSubscription: boolean;
    currency: string;
    originalAmount: number;
    exchangeRate: number;
    confidence: number;
    detectedService?: string;
  } {
    // 1. 金額パターンからサービス推定（加盟店名も考慮）
    const serviceMatch = this.matchServiceByAmount(tx.amount, tx.merchant);
    if (serviceMatch) {
      return {
        isSubscription: true,
        currency: serviceMatch.currency,
        originalAmount: serviceMatch.amount,
        exchangeRate: tx.amount / serviceMatch.amount,
        confidence: 0.9, // 加盟店名も一致した場合は信頼度を上げる
        detectedService: serviceMatch.name,
      };
    }

    // 2. 定期性チェック（2回目以降の取引のみ）
    const isRecurring = this.checkRecurringPattern(tx);
    if (isRecurring) {
      // 一般的なUSD換算で推定
      const estimatedUSD = Math.round((tx.amount / 150) * 100) / 100;
      return {
        isSubscription: true,
        currency: 'USD',
        originalAmount: estimatedUSD,
        exchangeRate: 150,
        confidence: 0.7, // 定期性が確認された場合は信頼度を上げる
      };
    }

    return {
      isSubscription: false,
      currency: 'JPY',
      originalAmount: tx.amount,
      exchangeRate: 1,
      confidence: 0.1,
    };
  }

  // 金額からサービスマッチング
  private matchServiceByAmount(jpyAmount: number, merchant: string = ''): OverseasServiceTemplate | null {
    for (const service of OVERSEAS_SERVICES) {
      const estimatedRate = ESTIMATED_EXCHANGE_RATES[service.currency] || 150;
      const estimatedJPY = service.amount * estimatedRate;
      
      // 為替変動を考慮した範囲マッチング（±10%）
      const tolerance = estimatedJPY * 0.1;
      const isAmountMatch = Math.abs(jpyAmount - estimatedJPY) <= tolerance;
      
      if (isAmountMatch) {
        // 金額が合致した場合、加盟店名もチェック
        const isMerchantMatch = service.commonMerchantNames.some(name =>
          merchant.toUpperCase().includes(name.toUpperCase())
        );
        
        // 加盟店名が一致する場合のみ返す
        if (isMerchantMatch) {
          return service;
        }
        
        console.log(`Amount matches ${service.name} but merchant "${merchant}" doesn't match expected names:`, service.commonMerchantNames);
      }
    }
    return null;
  }

  // 定期性チェック（簡易版）
  private checkRecurringPattern(tx: ExtendedCreditTransaction): boolean {
    const key = `${tx.merchant}_${tx.amount}`;
    const existing = this.detectedPatterns.get(key);
    
    if (existing) {
      const daysDiff = Math.abs(
        (new Date(tx.date).getTime() - new Date(existing.lastDetected).getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      
      // 約30日間隔なら定期的とみなす
      return daysDiff >= 25 && daysDiff <= 35;
    }

    // 初回記録
    this.detectedPatterns.set(key, {
      id: key,
      merchantName: tx.merchant,
      amount: tx.amount,
      currency: 'JPY',
      frequency: 'monthly',
      category: tx.category || 'その他',
      confidence: 0.3,
      lastDetected: tx.date,
    });

    return false;
  }

  // 海外サービステンプレート取得
  getOverseasServices(): OverseasServiceTemplate[] {
    return OVERSEAS_SERVICES;
  }

  // 通貨換算
  convertCurrency(amount: number, fromCurrency: string, toCurrency: string = 'JPY'): number {
    if (fromCurrency === toCurrency) return amount;
    
    const rate = this.getExchangeRate(fromCurrency, toCurrency);
    return Math.round(amount * rate);
  }

  // 為替レート取得
  private getExchangeRate(from: string, to: string): number {
    const key = `${from}_${to}`;
    const stored = this.exchangeRates.get(key);
    
    if (stored) {
      // 24時間以内のレートを使用
      const age = Date.now() - new Date(stored.date).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        return stored.rate;
      }
    }

    // 概算レート使用
    return ESTIMATED_EXCHANGE_RATES[from] || 150;
  }

  // 為替レート手動設定
  setExchangeRate(from: string, to: string, rate: number): void {
    const key = `${from}_${to}`;
    this.exchangeRates.set(key, {
      from,
      to,
      rate,
      date: new Date().toISOString(),
      source: 'manual'
    });
    this.saveStoredData();
  }

  // サブスクパターン学習
  learnSubscriptionPattern(tx: ExtendedCreditTransaction, isSubscription: boolean): void {
    const key = `${tx.merchant}_${tx.amount}`;
    
    if (isSubscription) {
      this.detectedPatterns.set(key, {
        id: key,
        merchantName: tx.merchant,
        amount: tx.originalAmount || tx.amount,
        currency: tx.originalCurrency || 'JPY',
        frequency: 'monthly',
        category: tx.category || 'サブスク',
        confidence: 0.9,
        lastDetected: tx.date,
      });
    } else {
      this.detectedPatterns.delete(key);
    }
    
    this.saveStoredData();
  }

  // データ永続化
  private saveStoredData(): void {
    localStorage.setItem('overseas_subscription_patterns', 
      JSON.stringify(Array.from(this.detectedPatterns.values()))
    );
    localStorage.setItem('exchange_rates', 
      JSON.stringify(Array.from(this.exchangeRates.values()))
    );
  }

  private loadStoredData(): void {
    try {
      const patterns = localStorage.getItem('overseas_subscription_patterns');
      if (patterns) {
        const parsedPatterns: SubscriptionPattern[] = JSON.parse(patterns);
        parsedPatterns.forEach(pattern => {
          this.detectedPatterns.set(pattern.id, pattern);
        });
      }

      const rates = localStorage.getItem('exchange_rates');
      if (rates) {
        const parsedRates: ExchangeRate[] = JSON.parse(rates);
        parsedRates.forEach(rate => {
          this.exchangeRates.set(`${rate.from}_${rate.to}`, rate);
        });
      }
    } catch (error) {
      console.error('Failed to load stored overseas subscription data:', error);
    }
  }

  // 統計取得
  getDetectionStats(): {
    totalDetected: number;
    byService: { [serviceName: string]: number };
    totalMonthlyCost: { jpy: number; usd: number };
  } {
    const patterns = Array.from(this.detectedPatterns.values());
    const byService: { [serviceName: string]: number } = {};
    let totalJPY = 0;
    let totalUSD = 0;

    patterns.forEach(pattern => {
      byService[pattern.merchantName] = (byService[pattern.merchantName] || 0) + 1;
      
      if (pattern.currency === 'USD') {
        totalUSD += pattern.amount;
        totalJPY += pattern.amount * this.getExchangeRate('USD', 'JPY');
      } else {
        totalJPY += pattern.amount;
      }
    });

    return {
      totalDetected: patterns.length,
      byService,
      totalMonthlyCost: { jpy: Math.round(totalJPY), usd: Math.round(totalUSD * 100) / 100 }
    };
  }
}

export const overseasSubscriptionService = new OverseasSubscriptionService();