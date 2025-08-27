import { CreditTransaction } from './gmailService';

export interface SubscriptionPattern {
  merchantName: string;
  amount: number;
  dates: string[]; // ISO date strings
  cycleDays?: number;
  confidence: number;
}

export class SubscriptionDetector {
  private static CYCLE_TOLERANCE_DAYS = 3; // 周期の許容誤差
  private static MIN_OCCURRENCES = 2; // 最小出現回数
  private static SAME_DAY_THRESHOLD = 2; // 同日同額の閾値

  /**
   * 取引履歴からサブスクリプションパターンを検出
   */
  static detectSubscriptions(transactions: CreditTransaction[]): SubscriptionPattern[] {
    const patterns: SubscriptionPattern[] = [];
    
    // 1. 同じ店舗名+金額でグループ化
    const groups = this.groupByMerchantAndAmount(transactions);
    
    // 2. 各グループでサブスクリプションパターンを分析
    for (const [key, group] of groups) {
      const [merchantName, amount] = key.split('|');
      const numAmount = parseFloat(amount);
      
      if (group.length >= this.MIN_OCCURRENCES) {
        const pattern = this.analyzePattern(merchantName, numAmount, group);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }

    // 3. 同日同額パターンの検出
    const sameDayPatterns = this.detectSameDayPatterns(transactions);
    patterns.push(...sameDayPatterns);
    
    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 店舗名と金額でグループ化
   */
  private static groupByMerchantAndAmount(
    transactions: CreditTransaction[]
  ): Map<string, CreditTransaction[]> {
    const groups = new Map<string, CreditTransaction[]>();
    
    for (const tx of transactions) {
      // 店舗名の正規化
      const normalizedMerchant = this.normalizeMerchantName(tx.merchant);
      const key = `${normalizedMerchant}|${tx.amount}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(tx);
    }
    
    return groups;
  }

  /**
   * 店舗名の正規化
   */
  private static normalizeMerchantName(merchant: string): string {
    return merchant
      .replace(/\s+/g, '')
      .replace(/[（）()]/g, '')
      .replace(/株式会社|㈱|Corp|Inc|Ltd/gi, '')
      .toUpperCase();
  }

  /**
   * パターン分析
   */
  private static analyzePattern(
    merchantName: string,
    amount: number,
    transactions: CreditTransaction[]
  ): SubscriptionPattern | null {
    if (transactions.length < this.MIN_OCCURRENCES) {
      return null;
    }

    // 日付順にソート
    const sortedTxs = transactions.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const dates = sortedTxs.map(tx => tx.date);
    
    // 周期を分析
    const intervals = this.calculateIntervals(dates);
    const cycleDays = this.detectCycle(intervals);
    
    // 信頼度計算
    const confidence = this.calculateConfidence(intervals, cycleDays, transactions.length);
    
    if (confidence > 0.5) {
      return {
        merchantName,
        amount,
        dates,
        cycleDays,
        confidence
      };
    }
    
    return null;
  }

  /**
   * 日付間隔を計算
   */
  private static calculateIntervals(dates: string[]): number[] {
    const intervals: number[] = [];
    
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const daysDiff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(daysDiff);
    }
    
    return intervals;
  }

  /**
   * 周期検出
   */
  private static detectCycle(intervals: number[]): number | undefined {
    if (intervals.length === 0) return undefined;
    
    // 一般的な周期候補
    const commonCycles = [7, 14, 28, 30, 31, 365];
    
    for (const cycle of commonCycles) {
      const matches = intervals.filter(interval => 
        Math.abs(interval - cycle) <= this.CYCLE_TOLERANCE_DAYS
      ).length;
      
      // 50%以上が周期に一致する場合
      if (matches / intervals.length >= 0.5) {
        return cycle;
      }
    }
    
    // 平均間隔を計算
    const avgInterval = Math.round(
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    );
    
    // 分散が小さい場合は周期として認識
    const variance = intervals.reduce((sum, interval) => 
      sum + Math.pow(interval - avgInterval, 2), 0
    ) / intervals.length;
    
    if (variance <= 9) { // 標準偏差が3以下
      return avgInterval;
    }
    
    return undefined;
  }

  /**
   * 信頼度計算
   */
  private static calculateConfidence(
    intervals: number[],
    cycleDays: number | undefined,
    occurrences: number
  ): number {
    let confidence = 0;
    
    // 出現回数による基本信頼度
    confidence += Math.min(occurrences / 12, 0.5); // 最大0.5
    
    // 周期の規則性
    if (cycleDays) {
      const regularIntervals = intervals.filter(interval => 
        Math.abs(interval - cycleDays) <= this.CYCLE_TOLERANCE_DAYS
      ).length;
      confidence += (regularIntervals / intervals.length) * 0.4;
    }
    
    // 一般的なサブスクリプション周期ボーナス
    if (cycleDays && [7, 14, 28, 30, 31, 365].includes(cycleDays)) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 同日同額パターンの検出（怪しい重複請求）
   */
  private static detectSameDayPatterns(
    transactions: CreditTransaction[]
  ): SubscriptionPattern[] {
    const dayAmountGroups = new Map<string, CreditTransaction[]>();
    
    // 同じ日付と金額でグループ化
    for (const tx of transactions) {
      const dateStr = new Date(tx.date).toISOString().split('T')[0];
      const key = `${dateStr}|${tx.amount}`;
      
      if (!dayAmountGroups.has(key)) {
        dayAmountGroups.set(key, []);
      }
      dayAmountGroups.get(key)!.push(tx);
    }
    
    const patterns: SubscriptionPattern[] = [];
    
    // 同日同額が複数回発生するパターンを検出
    for (const [key, group] of dayAmountGroups) {
      if (group.length >= this.SAME_DAY_THRESHOLD) {
        const [dateStr, amount] = key.split('|');
        const merchants = [...new Set(group.map(tx => tx.merchant))];
        
        // 同じ店舗で同日同額が複数回
        if (merchants.length === 1) {
          patterns.push({
            merchantName: merchants[0],
            amount: parseFloat(amount),
            dates: group.map(tx => tx.date),
            confidence: 0.9, // 高い信頼度で怪しいパターンとして検出
          });
        }
      }
    }
    
    return patterns;
  }

  /**
   * 既存取引をサブスクリプションとしてマーク
   */
  static markSubscriptions(
    transactions: CreditTransaction[],
    patterns: SubscriptionPattern[]
  ): CreditTransaction[] {
    const updatedTransactions = [...transactions];
    
    for (const pattern of patterns) {
      for (const tx of updatedTransactions) {
        const normalizedTxMerchant = this.normalizeMerchantName(tx.merchant);
        const normalizedPatternMerchant = this.normalizeMerchantName(pattern.merchantName);
        
        if (normalizedTxMerchant === normalizedPatternMerchant && 
            tx.amount === pattern.amount) {
          tx.isSubscription = true;
          tx.confidence = pattern.confidence;
        }
      }
    }
    
    return updatedTransactions;
  }

  /**
   * 次回請求日の予測
   */
  static predictNextCharge(pattern: SubscriptionPattern): string | null {
    if (!pattern.cycleDays || pattern.dates.length === 0) {
      return null;
    }
    
    const lastDate = new Date(pattern.dates[pattern.dates.length - 1]);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + pattern.cycleDays);
    
    return nextDate.toISOString().split('T')[0];
  }
}