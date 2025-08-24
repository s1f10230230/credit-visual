/**
 * 周期性検出アルゴリズム
 * 取引の日付パターンから定期的なサブスクリプションを自動検出
 */

import { CreditTransaction } from './analyticsService';
import { normalizeMerchant } from '../utils/merchantNormalizer';

export interface PeriodicPattern {
  merchantName: string;
  normalizedName: string;
  detectedPeriod: 'monthly' | 'quarterly' | 'yearly' | 'unknown';
  averageDaysBetween: number;
  confidence: number;
  transactionCount: number;
  totalAmount: number;
  averageAmount: number;
  lastTransactionDate: string;
  estimatedNextDate?: string;
  isLikelySubscription: boolean;
  periodVariance: number; // 周期のばらつき
  transactions: CreditTransaction[];
}

export interface PeriodAnalysisResult {
  detectedPeriod: 'monthly' | 'quarterly' | 'yearly' | 'unknown';
  averageDays: number;
  confidence: number;
  variance: number;
  isConsistent: boolean;
}

class PeriodicPatternService {
  private patterns: Map<string, PeriodicPattern> = new Map();
  
  // 期間の定義（日数）
  private readonly PERIOD_DEFINITIONS = {
    monthly: { min: 25, max: 35, ideal: 30 },
    quarterly: { min: 85, max: 95, ideal: 90 },
    yearly: { min: 350, max: 380, ideal: 365 }
  };

  /**
   * 取引データから周期性パターンを検出・更新
   */
  analyzePeriodicPatterns(transactions: CreditTransaction[]): PeriodicPattern[] {
    // 加盟店ごとにグループ化
    const merchantGroups = this.groupTransactionsByMerchant(transactions);
    const patterns: PeriodicPattern[] = [];

    merchantGroups.forEach((merchantTransactions, merchantName) => {
      // 最低3回以上の取引が必要
      if (merchantTransactions.length >= 3) {
        const pattern = this.analyzeTransactionPattern(merchantName, merchantTransactions);
        if (pattern) {
          patterns.push(pattern);
          this.patterns.set(pattern.normalizedName, pattern);
        }
      }
    });

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private groupTransactionsByMerchant(transactions: CreditTransaction[]): Map<string, CreditTransaction[]> {
    const groups = new Map<string, CreditTransaction[]>();

    transactions.forEach(tx => {
      const normalizedName = normalizeMerchant(tx.merchant);
      if (!groups.has(normalizedName)) {
        groups.set(normalizedName, []);
      }
      groups.get(normalizedName)!.push(tx);
    });

    // 日付でソート
    groups.forEach(txList => {
      txList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    return groups;
  }

  private analyzeTransactionPattern(merchantName: string, transactions: CreditTransaction[]): PeriodicPattern | null {
    if (transactions.length < 3) return null;

    const normalizedName = normalizeMerchant(merchantName);
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // 日付差分を計算
    const daysBetween: number[] = [];
    for (let i = 1; i < sortedTx.length; i++) {
      const prevDate = new Date(sortedTx[i - 1].date);
      const currentDate = new Date(sortedTx[i].date);
      const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      daysBetween.push(diffDays);
    }

    // 周期を分析
    const periodAnalysis = this.analyzePeriod(daysBetween);
    
    // 金額の一貫性をチェック
    const amounts = sortedTx.map(tx => tx.amount);
    const amountVariance = this.calculateVariance(amounts);
    const averageAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const amountConsistency = this.calculateAmountConsistency(amounts);

    // サブスクリプションらしさを判定
    const isLikelySubscription = this.determineSubscriptionLikelihood(
      periodAnalysis,
      amountConsistency,
      sortedTx.length,
      averageAmount
    );

    // 信頼度を計算（複数要素を考慮）
    const confidence = this.calculateOverallConfidence(
      periodAnalysis.confidence,
      amountConsistency,
      sortedTx.length,
      periodAnalysis.isConsistent
    );

    // 次回予測日を計算
    const lastDate = new Date(sortedTx[sortedTx.length - 1].date);
    const estimatedNextDate = periodAnalysis.detectedPeriod !== 'unknown' 
      ? this.estimateNextTransactionDate(lastDate, periodAnalysis.averageDays)
      : undefined;

    return {
      merchantName,
      normalizedName,
      detectedPeriod: periodAnalysis.detectedPeriod,
      averageDaysBetween: Math.round(periodAnalysis.averageDays),
      confidence,
      transactionCount: sortedTx.length,
      totalAmount: amounts.reduce((sum, amount) => sum + amount, 0),
      averageAmount: Math.round(averageAmount),
      lastTransactionDate: sortedTx[sortedTx.length - 1].date,
      estimatedNextDate: estimatedNextDate?.toISOString().split('T')[0],
      isLikelySubscription,
      periodVariance: periodAnalysis.variance,
      transactions: sortedTx
    };
  }

  private analyzePeriod(daysBetween: number[]): PeriodAnalysisResult {
    if (daysBetween.length === 0) {
      return {
        detectedPeriod: 'unknown',
        averageDays: 0,
        confidence: 0,
        variance: 0,
        isConsistent: false
      };
    }

    const averageDays = daysBetween.reduce((sum, days) => sum + days, 0) / daysBetween.length;
    const variance = this.calculateVariance(daysBetween);
    
    // 各期間カテゴリとの適合度をチェック
    let bestMatch: 'monthly' | 'quarterly' | 'yearly' | 'unknown' = 'unknown';
    let bestScore = 0;

    Object.entries(this.PERIOD_DEFINITIONS).forEach(([period, def]) => {
      const score = this.calculatePeriodScore(averageDays, variance, def);
      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestMatch = period as 'monthly' | 'quarterly' | 'yearly';
      }
    });

    // 一貫性を判定（分散が平均の25%以下なら一貫性あり）
    const isConsistent = variance < (averageDays * 0.25);

    return {
      detectedPeriod: bestMatch,
      averageDays,
      confidence: bestScore,
      variance,
      isConsistent
    };
  }

  private calculatePeriodScore(averageDays: number, variance: number, definition: { min: number, max: number, ideal: number }): number {
    // 範囲外は0点
    if (averageDays < definition.min || averageDays > definition.max) {
      return 0;
    }

    // 理想値に近いほど高得点
    const distanceFromIdeal = Math.abs(averageDays - definition.ideal);
    const maxDistance = (definition.max - definition.min) / 2;
    const proximityScore = Math.max(0, 1 - (distanceFromIdeal / maxDistance));

    // 分散が小さいほど高得点（一貫性）
    const maxAcceptableVariance = definition.ideal * 0.3;
    const consistencyScore = Math.max(0, 1 - (variance / maxAcceptableVariance));

    // 総合スコア
    return (proximityScore * 0.7) + (consistencyScore * 0.3);
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private calculateAmountConsistency(amounts: number[]): number {
    if (amounts.length < 2) return 1;

    const variance = this.calculateVariance(amounts);
    const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    
    // 変動係数（CV = 標準偏差 / 平均）
    const cv = Math.sqrt(variance) / mean;
    
    // CVが0.1以下（10%以下の変動）なら高い一貫性
    return Math.max(0, 1 - (cv * 5));
  }

  private determineSubscriptionLikelihood(
    periodAnalysis: PeriodAnalysisResult,
    amountConsistency: number,
    transactionCount: number,
    averageAmount: number
  ): boolean {
    // 基本条件
    if (periodAnalysis.detectedPeriod === 'unknown') return false;
    if (!periodAnalysis.isConsistent) return false;
    if (transactionCount < 3) return false;

    // 金額条件（あまりに小額や高額でないか）
    if (averageAmount < 100 || averageAmount > 50000) return false;

    // 一貫性条件
    if (amountConsistency < 0.7) return false;

    // 信頼度条件
    if (periodAnalysis.confidence < 0.5) return false;

    return true;
  }

  private calculateOverallConfidence(
    periodConfidence: number,
    amountConsistency: number,
    transactionCount: number,
    isPeriodConsistent: boolean
  ): number {
    let confidence = 0;

    // 周期の信頼度（40%）
    confidence += periodConfidence * 0.4;

    // 金額の一貫性（30%）
    confidence += amountConsistency * 0.3;

    // 取引回数ボーナス（20%）
    const countBonus = Math.min(1, (transactionCount - 2) / 8); // 3回で0、10回で1
    confidence += countBonus * 0.2;

    // 周期一貫性ボーナス（10%）
    if (isPeriodConsistent) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  private estimateNextTransactionDate(lastDate: Date, averageDaysBetween: number): Date {
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + Math.round(averageDaysBetween));
    return nextDate;
  }

  /**
   * 特定の加盟店の周期パターンを取得
   */
  getPatternForMerchant(merchantName: string): PeriodicPattern | null {
    const normalizedName = normalizeMerchant(merchantName);
    return this.patterns.get(normalizedName) || null;
  }

  /**
   * 未使用判定（期間×2を超えたサービス）
   */
  detectUnusedServices(patterns: PeriodicPattern[]): PeriodicPattern[] {
    const now = new Date();
    return patterns.filter(pattern => {
      if (!pattern.isLikelySubscription) return false;

      const lastTxDate = new Date(pattern.lastTransactionDate);
      const daysSinceLastUse = (now.getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24);

      // 周期×2を超えていたら未使用疑い
      const thresholds = {
        monthly: 60,
        quarterly: 180,
        yearly: 540,
        unknown: 90
      };

      return daysSinceLastUse > thresholds[pattern.detectedPeriod];
    });
  }

  /**
   * 統計情報
   */
  getAnalyticsStats(): any {
    const allPatterns = Array.from(this.patterns.values());
    const subscriptionPatterns = allPatterns.filter(p => p.isLikelySubscription);

    return {
      totalPatterns: allPatterns.length,
      subscriptionPatterns: subscriptionPatterns.length,
      byPeriod: {
        monthly: subscriptionPatterns.filter(p => p.detectedPeriod === 'monthly').length,
        quarterly: subscriptionPatterns.filter(p => p.detectedPeriod === 'quarterly').length,
        yearly: subscriptionPatterns.filter(p => p.detectedPeriod === 'yearly').length,
        unknown: subscriptionPatterns.filter(p => p.detectedPeriod === 'unknown').length,
      },
      avgConfidence: subscriptionPatterns.length > 0 
        ? subscriptionPatterns.reduce((sum, p) => sum + p.confidence, 0) / subscriptionPatterns.length 
        : 0,
      totalMonthlyEstimate: this.calculateMonthlyEstimate(subscriptionPatterns),
      unusedCount: this.detectUnusedServices(subscriptionPatterns).length
    };
  }

  private calculateMonthlyEstimate(patterns: PeriodicPattern[]): number {
    return patterns.reduce((sum, pattern) => {
      const multiplier = {
        monthly: 1,
        quarterly: 1/3,
        yearly: 1/12,
        unknown: 1
      }[pattern.detectedPeriod];

      return sum + (pattern.averageAmount * multiplier);
    }, 0);
  }

  /**
   * デバッグ用：パターン詳細表示
   */
  debugPattern(merchantName: string): any {
    const pattern = this.getPatternForMerchant(merchantName);
    if (!pattern) return null;

    const daysBetween = [];
    for (let i = 1; i < pattern.transactions.length; i++) {
      const prev = new Date(pattern.transactions[i-1].date);
      const curr = new Date(pattern.transactions[i].date);
      daysBetween.push(Math.round((curr.getTime() - prev.getTime()) / (1000*60*60*24)));
    }

    return {
      pattern,
      daysBetween,
      amounts: pattern.transactions.map(tx => tx.amount),
      dates: pattern.transactions.map(tx => tx.date)
    };
  }
}

export const periodicPatternService = new PeriodicPatternService();