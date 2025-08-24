import { periodicPatternService } from './periodicPatternService';
import { subscriptionDictionaryService } from './subscriptionDictionaryService';

export interface CreditTransaction {
  id: string;
  amount: number;
  currency: "JPY" | "USD";
  date: string;
  merchant: string;
  category: string;
  platform: string;
  is_subscription: boolean;
  confidence: number;
  evidence: string;
  notes: string;
  needsReview?: boolean;
  pending?: boolean;
  source?: string;
}

export interface CardSummary {
  cardType: string;
  totalAmount: number;
  transactionCount: number;
  transactions: CreditTransaction[];
  monthlyAverage: number;
  percentageOfTotal: number;
}

export interface MerchantSummary {
  merchant: string;
  totalAmount: number;
  frequency: number;
  category: string;
  averageAmount: number;
  percentageOfTotal: number;
  isSubscription: boolean;
  transactions: CreditTransaction[];
}

export interface CategorySummary {
  category: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
  averageAmount: number;
  merchants: string[];
}

export interface SubscriptionSummary {
  totalMonthlyAmount: number;
  subscriptionCount: number;
  subscriptions: MerchantSummary[];
  savingOpportunities: {
    merchant: string;
    lastUsed: string;
    monthlyCost: number;
    suggestion: string;
  }[];
}

export interface SpendingInsights {
  totalSpending: number;
  monthlySpending: number;
  topCategories: CategorySummary[];
  topMerchants: MerchantSummary[];
  subscriptionAnalysis: SubscriptionSummary;
  trends: {
    category: string;
    change: number;
    direction: 'increase' | 'decrease' | 'stable';
  }[];
  alerts: {
    type: 'subscription_alert' | 'category_spike' | 'unusual_spending';
    message: string;
    severity: 'low' | 'medium' | 'high';
    savings?: number;
  }[];
}

class AnalyticsService {
  groupByCard(transactions: CreditTransaction[]): CardSummary[] {
    const grouped = new Map<string, CreditTransaction[]>();
    
    transactions.forEach(tx => {
      const cardType = this.detectCardType(tx);
      if (!grouped.has(cardType)) {
        grouped.set(cardType, []);
      }
      grouped.get(cardType)!.push(tx);
    });

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    return Array.from(grouped.entries()).map(([cardType, txs]) => {
      const cardTotal = txs.reduce((sum, tx) => sum + tx.amount, 0);
      return {
        cardType,
        totalAmount: cardTotal,
        transactionCount: txs.length,
        transactions: txs,
        monthlyAverage: this.calculateMonthlyAverage(txs),
        percentageOfTotal: totalAmount > 0 ? (cardTotal / totalAmount) * 100 : 0
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  groupByMerchant(transactions: CreditTransaction[]): MerchantSummary[] {
    const grouped = new Map<string, CreditTransaction[]>();
    
    transactions.forEach(tx => {
      const normalizedMerchant = this.normalizeMerchantName(tx.merchant);
      if (!grouped.has(normalizedMerchant)) {
        grouped.set(normalizedMerchant, []);
      }
      grouped.get(normalizedMerchant)!.push(tx);
    });

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    return Array.from(grouped.entries()).map(([merchant, txs]) => {
      const merchantTotal = txs.reduce((sum, tx) => sum + tx.amount, 0);
      return {
        merchant,
        totalAmount: merchantTotal,
        frequency: txs.length,
        category: txs[0].category,
        averageAmount: Math.round(merchantTotal / txs.length),
        percentageOfTotal: totalAmount > 0 ? (merchantTotal / totalAmount) * 100 : 0,
        isSubscription: txs.some(tx => tx.is_subscription),
        transactions: txs
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  groupByCategory(transactions: CreditTransaction[]): CategorySummary[] {
    const grouped = new Map<string, CreditTransaction[]>();
    
    transactions.forEach(tx => {
      if (!grouped.has(tx.category)) {
        grouped.set(tx.category, []);
      }
      grouped.get(tx.category)!.push(tx);
    });

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    return Array.from(grouped.entries()).map(([category, txs]) => {
      const categoryTotal = txs.reduce((sum, tx) => sum + tx.amount, 0);
      const uniqueMerchants = [...new Set(txs.map(tx => tx.merchant))];
      
      return {
        category,
        totalAmount: categoryTotal,
        transactionCount: txs.length,
        percentage: totalAmount > 0 ? (categoryTotal / totalAmount) * 100 : 0,
        averageAmount: Math.round(categoryTotal / txs.length),
        merchants: uniqueMerchants
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  analyzeSubscriptions(transactions: CreditTransaction[], userCorrections?: Map<string, boolean>): SubscriptionSummary {
    // ユーザー補正を適用
    let adjustedTransactions = transactions;
    if (userCorrections && userCorrections.size > 0) {
      adjustedTransactions = transactions.map(tx => {
        const normalizedMerchant = this.normalizeMerchantName(tx.merchant);
        const userCorrection = userCorrections.get(normalizedMerchant);
        if (userCorrection !== undefined) {
          return { ...tx, is_subscription: userCorrection };
        }
        return tx;
      });
    }
    
    // 周期性検出を実行（新機能）
    const periodicPatterns = periodicPatternService.analyzePeriodicPatterns(adjustedTransactions);
    
    // 周期性に基づいてサブスク判定を追加・補正
    const enhancedTransactions = adjustedTransactions.map(tx => {
      const pattern = periodicPatterns.find(p => 
        this.normalizeMerchantName(tx.merchant) === p.normalizedName
      );
      
      // 周期性が検出された場合は自動的にサブスクとして扱う
      if (pattern && pattern.isLikelySubscription && pattern.confidence > 0.6) {
        return { ...tx, is_subscription: true };
      }
      
      return tx;
    });
    
    const subscriptionTransactions = enhancedTransactions.filter(tx => tx.is_subscription);
    const merchantSummaries = this.groupByMerchant(subscriptionTransactions);
    
    const monthlyEstimate = this.estimateMonthlySubscriptionCost(subscriptionTransactions);
    
    // 未使用サービス検出を改善（期間ベース）
    const unusedServices = periodicPatternService.detectUnusedServices(periodicPatterns);
    const enhancedSavingOpportunities = this.identifyEnhancedSavingOpportunities(
      subscriptionTransactions, 
      unusedServices
    );

    return {
      totalMonthlyAmount: monthlyEstimate,
      subscriptionCount: merchantSummaries.length,
      subscriptions: merchantSummaries,
      savingOpportunities: enhancedSavingOpportunities,
      periodicPatterns, // 新フィールド
      unusedServices: unusedServices.length
    };
  }

  generateSpendingInsights(transactions: CreditTransaction[], previousMonthTransactions?: CreditTransaction[]): SpendingInsights {
    const totalSpending = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const monthlySpending = this.calculateMonthlySpending(transactions);
    
    const topCategories = this.groupByCategory(transactions).slice(0, 5);
    const topMerchants = this.groupByMerchant(transactions).slice(0, 10);
    const subscriptionAnalysis = this.analyzeSubscriptions(transactions);
    
    const trends = this.calculateTrends(transactions, previousMonthTransactions);
    const alerts = this.generateAlerts(transactions, subscriptionAnalysis);

    return {
      totalSpending,
      monthlySpending,
      topCategories,
      topMerchants,
      subscriptionAnalysis,
      trends,
      alerts
    };
  }

  exportToCSV(transactions: CreditTransaction[]): string {
    const headers = [
      'Date', 'Merchant', 'Category', 'Amount', 'Currency', 
      'Platform', 'Is_Subscription', 'Confidence', 'Notes'
    ];

    const rows = transactions.map(tx => [
      tx.date,
      tx.merchant,
      tx.category,
      tx.amount.toString(),
      tx.currency,
      tx.platform,
      tx.is_subscription ? 'Yes' : 'No',
      tx.confidence.toString(),
      tx.notes
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  private detectCardType(transaction: CreditTransaction): string {
    if (transaction.platform) {
      return transaction.platform;
    }
    
    if (transaction.id.includes('jcb')) return 'JCB';
    if (transaction.id.includes('rakuten')) return '楽天カード';
    if (transaction.id.includes('visa')) return 'VISA';
    if (transaction.id.includes('mastercard')) return 'Mastercard';
    if (transaction.id.includes('amex')) return 'American Express';
    
    return 'その他';
  }

  private normalizeMerchantName(merchant: string): string {
    // Import の代わりに直接実装（循環参照を避けるため）
    if (!merchant) return '';
    
    let normalized = merchant.toLowerCase();
    
    // 全角文字を半角に変換
    normalized = normalized.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (s) => 
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    );
    
    // 記号・区切り文字を空白に統一
    normalized = normalized.replace(/[＊*・\-\u30FC＿_\|\/@#$%&+=]/g, ' ');
    
    // 長いID/数字列を除去（3桁以上の数字）
    normalized = normalized.replace(/\b\d{3,}\b/g, '');
    
    // 短いID/数字も除去（末尾の1-2桁の数字）
    normalized = normalized.replace(/\s+\d{1,2}$/, '');
    
    // 複数の空白を1つに
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    // よく使われる接頭辞・接尾辞を除去
    normalized = normalized.replace(/^(stripe|sq|paypal|apple|google)\s*[\*\s]*/i, '');
    normalized = normalized.replace(/\s*(inc|ltd|llc|corp|co|jp|com)\.?$/i, '');
    
    // 従来の処理も実行
    return normalized
      .normalize("NFKC")
      .replace(/（代行決済）$/, '')
      .replace(/^\w/, c => c.toUpperCase()); // 先頭文字を大文字に
  }

  private calculateMonthlyAverage(transactions: CreditTransaction[]): number {
    if (transactions.length === 0) return 0;
    
    const dates = transactions.map(tx => new Date(tx.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    const monthsDiff = Math.max(1, 
      (maxDate.getFullYear() - minDate.getFullYear()) * 12 + 
      (maxDate.getMonth() - minDate.getMonth()) + 1
    );
    
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    return Math.round(totalAmount / monthsDiff);
  }

  private calculateMonthlySpending(transactions: CreditTransaction[]): number {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const currentMonthTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });
    
    return currentMonthTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  }

  private estimateMonthlySubscriptionCost(subscriptionTransactions: CreditTransaction[]): number {
    const merchantFrequency = new Map<string, number>();
    
    subscriptionTransactions.forEach(tx => {
      const merchant = this.normalizeMerchantName(tx.merchant);
      merchantFrequency.set(merchant, (merchantFrequency.get(merchant) || 0) + tx.amount);
    });
    
    return Math.round(Array.from(merchantFrequency.values()).reduce((sum, amount) => sum + amount, 0));
  }

  // 強化された節約提案（周期性・未使用検出ベース）
  private identifyEnhancedSavingOpportunities(subscriptionTransactions: CreditTransaction[], unusedServices: any[]): any[] {
    const opportunities = [];

    // 従来の節約提案
    const traditionalOpportunities = this.identifySavingOpportunities(subscriptionTransactions);
    opportunities.push(...traditionalOpportunities);

    // 未使用サービスの提案
    unusedServices.forEach(service => {
      opportunities.push({
        type: 'unused_service',
        merchant: service.merchantName,
        monthlyCost: service.averageAmount,
        lastUsed: service.lastTransactionDate,
        suggestion: `${service.averageDaysBetween}日間隔のサービスですが、最終利用から長期間経過。解約を検討してください。`,
        priority: 'high',
        estimatedSavings: service.averageAmount * 12,
        confidence: service.confidence
      });
    });

    return opportunities.sort((a, b) => (b.monthlyCost || 0) - (a.monthlyCost || 0));
  }

  private identifySavingOpportunities(subscriptionTransactions: CreditTransaction[]): any[] {
    const merchantUsage = new Map<string, { lastUsed: Date; totalSpent: number; frequency: number }>();
    
    subscriptionTransactions.forEach(tx => {
      const merchant = this.normalizeMerchantName(tx.merchant);
      const txDate = new Date(tx.date);
      
      if (!merchantUsage.has(merchant)) {
        merchantUsage.set(merchant, { lastUsed: txDate, totalSpent: 0, frequency: 0 });
      }
      
      const usage = merchantUsage.get(merchant)!;
      if (txDate > usage.lastUsed) {
        usage.lastUsed = txDate;
      }
      usage.totalSpent += tx.amount;
      usage.frequency += 1;
    });

    const now = new Date();
    const opportunities = [];
    
    for (const [merchant, usage] of merchantUsage.entries()) {
      const daysSinceLastUse = Math.floor((now.getTime() - usage.lastUsed.getTime()) / (1000 * 60 * 60 * 24));
      const monthlyEstimate = usage.totalSpent / usage.frequency;
      
      if (daysSinceLastUse > 60) {
        opportunities.push({
          merchant,
          lastUsed: usage.lastUsed.toISOString().split('T')[0],
          monthlyCost: Math.round(monthlyEstimate),
          suggestion: `${daysSinceLastUse}日間利用履歴がありません。解約を検討してください。`
        });
      }
    }
    
    return opportunities.sort((a, b) => b.monthlyCost - a.monthlyCost);
  }

  private calculateTrends(currentTransactions: CreditTransaction[], previousTransactions?: CreditTransaction[]): any[] {
    if (!previousTransactions) return [];
    
    const currentCategories = this.groupByCategory(currentTransactions);
    const previousCategories = this.groupByCategory(previousTransactions);
    
    const trends = [];
    
    for (const currentCat of currentCategories) {
      const previousCat = previousCategories.find(p => p.category === currentCat.category);
      
      if (previousCat) {
        const change = ((currentCat.totalAmount - previousCat.totalAmount) / previousCat.totalAmount) * 100;
        const direction = Math.abs(change) < 5 ? 'stable' : (change > 0 ? 'increase' : 'decrease');
        
        trends.push({
          category: currentCat.category,
          change: Math.round(change),
          direction
        });
      }
    }
    
    return trends.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  private generateAlerts(transactions: CreditTransaction[], subscriptionAnalysis: SubscriptionSummary): any[] {
    const alerts = [];
    
    if (subscriptionAnalysis.totalMonthlyAmount > 20000) {
      alerts.push({
        type: 'subscription_alert',
        message: `サブスクが月${subscriptionAnalysis.totalMonthlyAmount.toLocaleString()}円を超えています。見直しをお勧めします。`,
        severity: 'high',
        savings: Math.round(subscriptionAnalysis.totalMonthlyAmount * 0.3)
      });
    }
    
    const categoryTotals = this.groupByCategory(transactions);
    const convenienceSpending = categoryTotals.find(c => c.category === 'コンビニ');
    
    if (convenienceSpending && convenienceSpending.totalAmount > 15000) {
      alerts.push({
        type: 'category_spike',
        message: `コンビニ利用が月${convenienceSpending.totalAmount.toLocaleString()}円と高額です。`,
        severity: 'medium',
        savings: 5000
      });
    }
    
    if (subscriptionAnalysis.savingOpportunities.length > 0) {
      const totalSavings = subscriptionAnalysis.savingOpportunities.reduce((sum, opp) => sum + opp.monthlyCost, 0);
      alerts.push({
        type: 'subscription_alert',
        message: `未使用のサブスクで月${totalSavings.toLocaleString()}円節約できる可能性があります。`,
        severity: 'medium',
        savings: totalSavings
      });
    }
    
    return alerts;
  }
}

export const analyticsService = new AnalyticsService();