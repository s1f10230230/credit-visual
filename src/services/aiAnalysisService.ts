import { CreditTransaction, CategorySummary, MerchantSummary } from './analyticsService';

export interface SpendingPattern {
  type: 'recurring' | 'seasonal' | 'irregular' | 'growing' | 'declining';
  confidence: number;
  description: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  amount?: number;
  variance?: number;
}

export interface SpendingInsight {
  type: 'subscription_alert' | 'category_trend' | 'unusual_spending' | 'saving_opportunity' | 'budget_warning';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  savings?: number;
  actionable: boolean;
  category?: string;
  merchant?: string;
  confidence: number;
  details?: any;
}

export interface SmartRecommendation {
  type: 'card_optimization' | 'budget_adjustment' | 'subscription_review' | 'category_optimization' | 'cashback_opportunity';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  estimatedSavings?: number;
  implementationSteps: string[];
  priority: number;
}

export interface BudgetPrediction {
  category: string;
  predictedAmount: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  factors: string[];
  recommendation?: string;
}

export interface AnomalyDetection {
  transaction: CreditTransaction;
  anomalyType: 'amount' | 'frequency' | 'location' | 'category' | 'time';
  score: number;
  explanation: string;
  isLikelyFraud: boolean;
}

class AIAnalysisService {
  private readonly PATTERN_DETECTION_THRESHOLD = 0.7;
  private readonly ANOMALY_THRESHOLD = 0.8;
  
  async analyzeSpendingPatterns(transactions: CreditTransaction[]): Promise<{
    insights: SpendingInsight[];
    recommendations: SmartRecommendation[];
    patterns: SpendingPattern[];
    predictions: BudgetPrediction[];
    anomalies: AnomalyDetection[];
  }> {
    try {
      const insights = await this.generateSpendingInsights(transactions);
      const recommendations = await this.generateSmartRecommendations(transactions);
      const patterns = this.detectSpendingPatterns(transactions);
      const predictions = this.predictFutureSpending(transactions);
      const anomalies = this.detectAnomalies(transactions);

      return {
        insights,
        recommendations,
        patterns,
        predictions,
        anomalies
      };
    } catch (error) {
      console.error('AI analysis failed:', error);
      return this.getFallbackAnalysis(transactions);
    }
  }

  private async generateSpendingInsights(transactions: CreditTransaction[]): Promise<SpendingInsight[]> {
    const insights: SpendingInsight[] = [];
    
    // サブスクリプション分析
    const subscriptionInsights = this.analyzeSubscriptions(transactions);
    insights.push(...subscriptionInsights);
    
    // カテゴリトレンド分析
    const trendInsights = this.analyzeCategoryTrends(transactions);
    insights.push(...trendInsights);
    
    // 異常支出の検出
    const unusualSpendingInsights = this.analyzeUnusualSpending(transactions);
    insights.push(...unusualSpendingInsights);
    
    // 節約機会の発見
    const savingInsights = this.identifySavingOpportunities(transactions);
    insights.push(...savingInsights);

    return insights.sort((a, b) => this.getInsightPriority(b) - this.getInsightPriority(a));
  }

  private analyzeSubscriptions(transactions: CreditTransaction[]): SpendingInsight[] {
    const insights: SpendingInsight[] = [];
    const subscriptionTxs = transactions.filter(tx => tx.is_subscription);
    
    if (subscriptionTxs.length === 0) return insights;

    // 月額サブスク費用の計算
    const monthlySubscriptionCost = this.calculateMonthlySubscriptionCost(subscriptionTxs);
    
    if (monthlySubscriptionCost > 20000) {
      insights.push({
        type: 'subscription_alert',
        title: 'サブスクリプション費用が高額です',
        message: `月額サブスクリプション費用が${monthlySubscriptionCost.toLocaleString()}円に達しています。未使用のサービスがないか確認をお勧めします。`,
        severity: 'warning',
        savings: Math.round(monthlySubscriptionCost * 0.3),
        actionable: true,
        confidence: 0.9
      });
    }

    // 重複サービスの検出
    const duplicateServices = this.detectDuplicateServices(subscriptionTxs);
    duplicateServices.forEach(duplicate => {
      insights.push({
        type: 'subscription_alert',
        title: '重複サービスを検出',
        message: `${duplicate.category}カテゴリで複数のサービスを利用しています: ${duplicate.services.join(', ')}`,
        severity: 'info',
        savings: duplicate.potentialSavings,
        actionable: true,
        confidence: 0.8,
        category: duplicate.category
      });
    });

    // 長期未使用サブスクの検出
    const unusedSubscriptions = this.detectUnusedSubscriptions(subscriptionTxs);
    unusedSubscriptions.forEach(unused => {
      insights.push({
        type: 'subscription_alert',
        title: '長期未使用のサブスクリプション',
        message: `${unused.merchant}は${unused.daysSinceLastUse}日間利用されていません。解約を検討してください。`,
        severity: 'warning',
        savings: unused.monthlyCost,
        actionable: true,
        merchant: unused.merchant,
        confidence: 0.85
      });
    });

    return insights;
  }

  private analyzeCategoryTrends(transactions: CreditTransaction[]): SpendingInsight[] {
    const insights: SpendingInsight[] = [];
    
    // 月ごとのカテゴリ別支出を計算
    const monthlySpending = this.groupTransactionsByMonth(transactions);
    
    if (monthlySpending.length < 2) return insights;

    const currentMonth = monthlySpending[monthlySpending.length - 1];
    const previousMonth = monthlySpending[monthlySpending.length - 2];

    Object.keys(currentMonth.categories).forEach(category => {
      const currentAmount = currentMonth.categories[category] || 0;
      const previousAmount = previousMonth.categories[category] || 0;
      
      if (previousAmount > 0) {
        const changePercent = ((currentAmount - previousAmount) / previousAmount) * 100;
        
        if (Math.abs(changePercent) > 30) {
          const direction = changePercent > 0 ? '増加' : '減少';
          const severity = Math.abs(changePercent) > 50 ? 'warning' : 'info';
          
          insights.push({
            type: 'category_trend',
            title: `${category}の支出が${direction}しています`,
            message: `${category}カテゴリの支出が先月比${Math.abs(changePercent).toFixed(1)}%${direction}しました（${previousAmount.toLocaleString()}円 → ${currentAmount.toLocaleString()}円）`,
            severity,
            actionable: changePercent > 0,
            category,
            confidence: 0.8
          });
        }
      }
    });

    return insights;
  }

  private analyzeUnusualSpending(transactions: CreditTransaction[]): SpendingInsight[] {
    const insights: SpendingInsight[] = [];
    
    // 各カテゴリの平均支出額を計算
    const categoryAverages = this.calculateCategoryAverages(transactions);
    
    // 最近の取引で平均を大きく上回るものを検出
    const recentTransactions = transactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return txDate > thirtyDaysAgo;
      });

    recentTransactions.forEach(tx => {
      const categoryAverage = categoryAverages[tx.category] || 0;
      
      if (categoryAverage > 0 && tx.amount > categoryAverage * 2) {
        insights.push({
          type: 'unusual_spending',
          title: '通常より高額な支出を検出',
          message: `${tx.merchant}での支出（${tx.amount.toLocaleString()}円）が${tx.category}カテゴリの平均額（${categoryAverage.toLocaleString()}円）を大きく上回っています`,
          severity: tx.amount > categoryAverage * 3 ? 'warning' : 'info',
          actionable: false,
          category: tx.category,
          merchant: tx.merchant,
          confidence: 0.7
        });
      }
    });

    return insights;
  }

  private identifySavingOpportunities(transactions: CreditTransaction[]): SpendingInsight[] {
    const insights: SpendingInsight[] = [];
    
    // コンビニ利用の分析
    const convenienceSpending = this.analyzeConvenienceStoreSpending(transactions);
    if (convenienceSpending.monthlyAmount > 15000) {
      insights.push({
        type: 'saving_opportunity',
        title: 'コンビニ利用の最適化',
        message: `コンビニでの月間支出が${convenienceSpending.monthlyAmount.toLocaleString()}円です。スーパーマーケット利用で約30%節約できる可能性があります。`,
        severity: 'info',
        savings: Math.round(convenienceSpending.monthlyAmount * 0.3),
        actionable: true,
        category: 'コンビニ',
        confidence: 0.75
      });
    }

    // カード利用の最適化
    const cardOptimization = this.analyzeCardUsageOptimization(transactions);
    cardOptimization.forEach(optimization => {
      insights.push({
        type: 'saving_opportunity',
        title: 'カード利用の最適化',
        message: optimization.message,
        severity: 'info',
        savings: optimization.savings,
        actionable: true,
        confidence: 0.8,
        details: optimization
      });
    });

    return insights;
  }

  private async generateSmartRecommendations(transactions: CreditTransaction[]): Promise<SmartRecommendation[]> {
    const recommendations: SmartRecommendation[] = [];
    
    // カード最適化の推奨
    const cardRecs = this.generateCardOptimizationRecommendations(transactions);
    recommendations.push(...cardRecs);
    
    // 予算調整の推奨
    const budgetRecs = this.generateBudgetRecommendations(transactions);
    recommendations.push(...budgetRecs);
    
    // サブスクリプション見直しの推奨
    const subscriptionRecs = this.generateSubscriptionRecommendations(transactions);
    recommendations.push(...subscriptionRecs);

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private detectSpendingPatterns(transactions: CreditTransaction[]): SpendingPattern[] {
    const patterns: SpendingPattern[] = [];
    
    // 定期的な支出パターンの検出
    const recurringPatterns = this.detectRecurringPatterns(transactions);
    patterns.push(...recurringPatterns);
    
    // 季節的なパターンの検出
    const seasonalPatterns = this.detectSeasonalPatterns(transactions);
    patterns.push(...seasonalPatterns);
    
    // 増加/減少トレンドの検出
    const trendPatterns = this.detectTrendPatterns(transactions);
    patterns.push(...trendPatterns);

    return patterns.filter(p => p.confidence >= this.PATTERN_DETECTION_THRESHOLD);
  }

  private predictFutureSpending(transactions: CreditTransaction[]): BudgetPrediction[] {
    const predictions: BudgetPrediction[] = [];
    
    // カテゴリ別の将来予測
    const categoryData = this.groupTransactionsByCategory(transactions);
    
    Object.keys(categoryData).forEach(category => {
      const categoryTransactions = categoryData[category];
      const prediction = this.predictCategorySpending(categoryTransactions);
      
      if (prediction.confidence > 0.6) {
        predictions.push({
          category,
          ...prediction
        });
      }
    });

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  private detectAnomalies(transactions: CreditTransaction[]): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];
    
    transactions.forEach(transaction => {
      const anomalyScore = this.calculateAnomalyScore(transaction, transactions);
      
      if (anomalyScore > this.ANOMALY_THRESHOLD) {
        anomalies.push({
          transaction,
          anomalyType: this.identifyAnomalyType(transaction, transactions),
          score: anomalyScore,
          explanation: this.generateAnomalyExplanation(transaction, transactions),
          isLikelyFraud: anomalyScore > 0.9
        });
      }
    });

    return anomalies.sort((a, b) => b.score - a.score);
  }

  // Helper methods implementation would continue here...
  // For brevity, I'm including key helper methods

  private calculateMonthlySubscriptionCost(subscriptionTxs: CreditTransaction[]): number {
    const merchantTotals = new Map<string, number>();
    
    subscriptionTxs.forEach(tx => {
      const merchant = tx.merchant;
      merchantTotals.set(merchant, (merchantTotals.get(merchant) || 0) + tx.amount);
    });
    
    return Array.from(merchantTotals.values()).reduce((sum, amount) => sum + amount, 0);
  }

  private detectDuplicateServices(subscriptionTxs: CreditTransaction[]): any[] {
    const servicesByCategory = new Map<string, Set<string>>();
    
    subscriptionTxs.forEach(tx => {
      if (!servicesByCategory.has(tx.category)) {
        servicesByCategory.set(tx.category, new Set());
      }
      servicesByCategory.get(tx.category)!.add(tx.merchant);
    });
    
    const duplicates = [];
    for (const [category, services] of servicesByCategory.entries()) {
      if (services.size > 1) {
        duplicates.push({
          category,
          services: Array.from(services),
          potentialSavings: Math.round(subscriptionTxs
            .filter(tx => tx.category === category)
            .reduce((sum, tx) => sum + tx.amount, 0) * 0.5)
        });
      }
    }
    
    return duplicates;
  }

  private detectUnusedSubscriptions(subscriptionTxs: CreditTransaction[]): any[] {
    // This would integrate with actual usage data in a real implementation
    const now = new Date();
    const unused = [];
    
    const merchantLastSeen = new Map<string, Date>();
    subscriptionTxs.forEach(tx => {
      const txDate = new Date(tx.date);
      const lastSeen = merchantLastSeen.get(tx.merchant);
      
      if (!lastSeen || txDate > lastSeen) {
        merchantLastSeen.set(tx.merchant, txDate);
      }
    });
    
    for (const [merchant, lastDate] of merchantLastSeen.entries()) {
      const daysSinceLastUse = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastUse > 60) {
        const monthlyCost = subscriptionTxs
          .filter(tx => tx.merchant === merchant)
          .reduce((sum, tx) => sum + tx.amount, 0) / subscriptionTxs.filter(tx => tx.merchant === merchant).length;
        
        unused.push({
          merchant,
          daysSinceLastUse,
          monthlyCost: Math.round(monthlyCost)
        });
      }
    }
    
    return unused;
  }

  private groupTransactionsByMonth(transactions: CreditTransaction[]): any[] {
    const monthlyData = new Map<string, any>();
    
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth().toString().padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          month: monthKey,
          total: 0,
          categories: {}
        });
      }
      
      const monthData = monthlyData.get(monthKey)!;
      monthData.total += tx.amount;
      monthData.categories[tx.category] = (monthData.categories[tx.category] || 0) + tx.amount;
    });
    
    return Array.from(monthlyData.values()).sort((a, b) => a.month.localeCompare(b.month));
  }

  private calculateCategoryAverages(transactions: CreditTransaction[]): {[category: string]: number} {
    const categoryTotals = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    
    transactions.forEach(tx => {
      categoryTotals.set(tx.category, (categoryTotals.get(tx.category) || 0) + tx.amount);
      categoryCounts.set(tx.category, (categoryCounts.get(tx.category) || 0) + 1);
    });
    
    const averages: {[category: string]: number} = {};
    for (const [category, total] of categoryTotals.entries()) {
      const count = categoryCounts.get(category) || 1;
      averages[category] = total / count;
    }
    
    return averages;
  }

  private analyzeConvenienceStoreSpending(transactions: CreditTransaction[]): any {
    const convenienceTxs = transactions.filter(tx => tx.category === 'コンビニ');
    const monthlyAmount = convenienceTxs
      .filter(tx => {
        const txDate = new Date(tx.date);
        const now = new Date();
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    return {
      monthlyAmount,
      transactionCount: convenienceTxs.length,
      averageAmount: convenienceTxs.length > 0 ? monthlyAmount / convenienceTxs.length : 0
    };
  }

  private analyzeCardUsageOptimization(transactions: CreditTransaction[]): any[] {
    // Placeholder for card-specific optimization analysis
    return [];
  }

  private generateCardOptimizationRecommendations(transactions: CreditTransaction[]): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];
    
    // Example recommendation for card optimization
    const cardUsage = this.analyzeCardUsageDistribution(transactions);
    
    if (cardUsage.some(card => card.percentage < 20)) {
      recommendations.push({
        type: 'card_optimization',
        title: 'カード利用の最適化',
        description: '特定のカテゴリでより高還元率のカードを使用することで、年間数万円の節約が可能です。',
        impact: 'medium',
        estimatedSavings: 25000,
        implementationSteps: [
          '各カードの還元率を確認',
          'カテゴリ別の最適なカードを選択',
          '自動支払い設定の見直し'
        ],
        priority: 3
      });
    }
    
    return recommendations;
  }

  private generateBudgetRecommendations(transactions: CreditTransaction[]): SmartRecommendation[] {
    // Implementation for budget-related recommendations
    return [];
  }

  private generateSubscriptionRecommendations(transactions: CreditTransaction[]): SmartRecommendation[] {
    // Implementation for subscription-related recommendations
    return [];
  }

  private detectRecurringPatterns(transactions: CreditTransaction[]): SpendingPattern[] {
    // Implementation for recurring pattern detection
    return [];
  }

  private detectSeasonalPatterns(transactions: CreditTransaction[]): SpendingPattern[] {
    // Implementation for seasonal pattern detection
    return [];
  }

  private detectTrendPatterns(transactions: CreditTransaction[]): SpendingPattern[] {
    // Implementation for trend pattern detection
    return [];
  }

  private groupTransactionsByCategory(transactions: CreditTransaction[]): {[category: string]: CreditTransaction[]} {
    return transactions.reduce((groups, tx) => {
      if (!groups[tx.category]) {
        groups[tx.category] = [];
      }
      groups[tx.category].push(tx);
      return groups;
    }, {} as {[category: string]: CreditTransaction[]});
  }

  private predictCategorySpending(categoryTransactions: CreditTransaction[]): any {
    // Simple linear trend prediction
    const monthlyTotals = this.calculateMonthlyTotals(categoryTransactions);
    
    if (monthlyTotals.length < 3) {
      return { confidence: 0 };
    }
    
    const trend = this.calculateLinearTrend(monthlyTotals);
    
    return {
      predictedAmount: Math.max(0, trend.prediction),
      confidence: trend.confidence,
      trend: trend.direction,
      factors: ['過去の支出パターン', '季節性', 'トレンド'],
      recommendation: trend.direction === 'increasing' ? '支出増加傾向です。予算の見直しを検討してください。' : undefined
    };
  }

  private calculateMonthlyTotals(transactions: CreditTransaction[]): number[] {
    const monthlyTotals = new Map<string, number>();
    
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + tx.amount);
    });
    
    return Array.from(monthlyTotals.values());
  }

  private calculateLinearTrend(values: number[]): any {
    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const prediction = slope * n + intercept;
    const direction = slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable';
    
    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    
    return {
      prediction,
      direction,
      confidence: Math.max(0, Math.min(1, rSquared))
    };
  }

  private calculateAnomalyScore(transaction: CreditTransaction, allTransactions: CreditTransaction[]): number {
    // Simple anomaly detection based on amount and frequency
    const categoryTransactions = allTransactions.filter(tx => tx.category === transaction.category);
    
    if (categoryTransactions.length < 5) return 0;
    
    const amounts = categoryTransactions.map(tx => tx.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    
    const zScore = Math.abs((transaction.amount - mean) / stdDev);
    
    // Normalize z-score to 0-1 range
    return Math.min(1, zScore / 3);
  }

  private identifyAnomalyType(transaction: CreditTransaction, allTransactions: CreditTransaction[]): 'amount' | 'frequency' | 'location' | 'category' | 'time' {
    // For simplicity, focus on amount anomalies
    return 'amount';
  }

  private generateAnomalyExplanation(transaction: CreditTransaction, allTransactions: CreditTransaction[]): string {
    const categoryTransactions = allTransactions.filter(tx => tx.category === transaction.category);
    const avgAmount = categoryTransactions.reduce((sum, tx) => sum + tx.amount, 0) / categoryTransactions.length;
    
    const ratio = transaction.amount / avgAmount;
    
    if (ratio > 2) {
      return `この取引の金額（${transaction.amount.toLocaleString()}円）は、${transaction.category}カテゴリの平均額（${Math.round(avgAmount).toLocaleString()}円）の${ratio.toFixed(1)}倍です。`;
    }
    
    return '通常のパターンから外れた取引です。';
  }

  private analyzeCardUsageDistribution(transactions: CreditTransaction[]): any[] {
    const cardUsage = new Map<string, number>();
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    transactions.forEach(tx => {
      const platform = tx.platform || 'その他';
      cardUsage.set(platform, (cardUsage.get(platform) || 0) + tx.amount);
    });
    
    return Array.from(cardUsage.entries()).map(([platform, amount]) => ({
      platform,
      amount,
      percentage: (amount / totalAmount) * 100
    }));
  }

  private getInsightPriority(insight: SpendingInsight): number {
    const severityScore = insight.severity === 'critical' ? 3 : insight.severity === 'warning' ? 2 : 1;
    const savingsScore = insight.savings ? Math.min(3, Math.floor(insight.savings / 5000)) : 0;
    const actionableScore = insight.actionable ? 1 : 0;
    const confidenceScore = Math.floor(insight.confidence * 2);
    
    return severityScore + savingsScore + actionableScore + confidenceScore;
  }

  private getFallbackAnalysis(transactions: CreditTransaction[]): any {
    return {
      insights: [{
        type: 'info',
        title: '基本分析を実行中',
        message: 'AI分析機能は一時的に利用できません。基本的な分析結果を表示しています。',
        severity: 'info',
        actionable: false,
        confidence: 1.0
      }],
      recommendations: [],
      patterns: [],
      predictions: [],
      anomalies: []
    };
  }
}

export const aiAnalysisService = new AIAnalysisService();