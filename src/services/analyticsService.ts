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

  analyzeSubscriptions(transactions: CreditTransaction[]): SubscriptionSummary {
    const subscriptionTransactions = transactions.filter(tx => tx.is_subscription);
    const merchantSummaries = this.groupByMerchant(subscriptionTransactions);
    
    const monthlyEstimate = this.estimateMonthlySubscriptionCost(subscriptionTransactions);
    
    const savingOpportunities = this.identifySavingOpportunities(subscriptionTransactions);

    return {
      totalMonthlyAmount: monthlyEstimate,
      subscriptionCount: merchantSummaries.length,
      subscriptions: merchantSummaries,
      savingOpportunities
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
    return merchant
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/（代行決済）$/, '');
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