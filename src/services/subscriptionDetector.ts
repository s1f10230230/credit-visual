import { CreditTransaction } from './gmailService';

export interface SubscriptionPattern {
  merchantName: string;
  amount: number;
  dates: string[]; // ISO date strings
  cycleDays?: number;
  confidence: number;
}

export class SubscriptionDetector {
  private static CYCLE_TOLERANCE_DAYS = 5; // 周期の許容誤差（緩和）
  private static MIN_OCCURRENCES = 2; // 最小出現回数
  private static SAME_DAY_THRESHOLD = 2; // 同日同額の閾値
  private static MAX_MONTHLY_FREQUENCY = 4; // 月最大回数（これを超えると交通系等と判定）
  private static MIN_SUBSCRIPTION_CYCLE = 25; // 最小サブスク周期（日）

  /**
   * 取引履歴からサブスクリプションパターンを検出
   */
  static detectSubscriptions(transactions: CreditTransaction[]): SubscriptionPattern[] {
    const patterns: SubscriptionPattern[] = [];
    
    // 1. 同じ店舗名+金額でグループ化
    const groups = this.groupByMerchantAndAmount(transactions);
    
    // 2. 高頻度取引を除外（交通系などは除外）
    const filteredGroups = this.filterHighFrequencyTransactions(groups);
    
    // 3. 各グループでサブスクリプションパターンを分析
    for (const [key, group] of filteredGroups) {
      const [merchantName, amount] = key.split('|');
      const numAmount = parseFloat(amount);
      
      if (group.length >= this.MIN_OCCURRENCES) {
        const pattern = this.analyzePattern(merchantName, numAmount, group);
        if (pattern && this.isValidSubscriptionPattern(pattern)) {
          patterns.push(pattern);
        }
      }
    }

    // 4. 同日同額パターンの検出（重複請求検出）
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
   * 高頻度取引を除外（交通系ICカード、コンビニなど）
   */
  private static filterHighFrequencyTransactions(
    groups: Map<string, CreditTransaction[]>
  ): Map<string, CreditTransaction[]> {
    const filtered = new Map<string, CreditTransaction[]>();
    
    for (const [key, group] of groups) {
      const [merchantName] = key.split('|');
      
      // 交通系・コンビニ系のキーワードをチェック
      const highFrequencyPatterns = [
        /モバイルSuica|MOBILE SUICA/i,
        /PASMO|パスモ/i,
        /JR東日本|JR西日本|JR東海/i,
        /地下鉄|メトロ/i,
        /セブンイレブン|SEVEN/i,
        /ローソン|LAWSON/i,
        /ファミリーマート|FAMILYMART/i,
        /コンビニ/i,
        /自販機|VENDING/i,
      ];
      
      const isHighFrequency = highFrequencyPatterns.some(pattern => 
        pattern.test(merchantName)
      );
      
      // 高頻度でない、または月4回以下の場合のみ残す
      if (!isHighFrequency || this.getMonthlyFrequency(group) <= this.MAX_MONTHLY_FREQUENCY) {
        filtered.set(key, group);
      }
    }
    
    return filtered;
  }

  /**
   * 月平均頻度を計算
   */
  private static getMonthlyFrequency(transactions: CreditTransaction[]): number {
    if (transactions.length === 0) return 0;
    
    const dates = transactions.map(tx => new Date(tx.date));
    const earliest = Math.min(...dates.map(d => d.getTime()));
    const latest = Math.max(...dates.map(d => d.getTime()));
    const daySpan = (latest - earliest) / (1000 * 60 * 60 * 24);
    const monthSpan = Math.max(daySpan / 30, 1); // 最小1ヶ月とする
    
    return transactions.length / monthSpan;
  }

  /**
   * 有効なサブスクリプションパターンかチェック
   */
  private static isValidSubscriptionPattern(pattern: SubscriptionPattern): boolean {
    // 周期が25日未満の場合は除外（日次・週次利用は除外）
    if (pattern.cycleDays && pattern.cycleDays < this.MIN_SUBSCRIPTION_CYCLE) {
      return false;
    }
    
    // 月次パターン（28-35日）に特化
    if (pattern.cycleDays) {
      const isMonthlyPattern = pattern.cycleDays >= 25 && pattern.cycleDays <= 35;
      if (isMonthlyPattern) {
        return true;
      }
    }
    
    // 周期不明だが3ヶ月間で同じ日に課金されている場合
    if (this.hasConsistentMonthlyPattern(pattern.dates)) {
      return true;
    }
    
    return false;
  }

  /**
   * 3ヶ月間で一貫した月次パターンがあるかチェック
   */
  private static hasConsistentMonthlyPattern(dates: string[]): boolean {
    if (dates.length < 2) return false;
    
    const dayOfMonth = dates.map(dateStr => new Date(dateStr).getDate());
    
    // 同じ日付での課金が多いかチェック
    const dayFrequency = new Map<number, number>();
    for (const day of dayOfMonth) {
      dayFrequency.set(day, (dayFrequency.get(day) || 0) + 1);
    }
    
    // 最も頻繁な日付が全体の70%以上を占める
    const maxFrequency = Math.max(...dayFrequency.values());
    return maxFrequency / dates.length >= 0.7;
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
   * 周期検出（月次パターンに特化）
   */
  private static detectCycle(intervals: number[]): number | undefined {
    if (intervals.length === 0) return undefined;
    
    // 月次サブスクリプション候補（25-35日の範囲）
    const monthlyCycles = [28, 29, 30, 31];
    
    for (const cycle of monthlyCycles) {
      const matches = intervals.filter(interval => 
        Math.abs(interval - cycle) <= this.CYCLE_TOLERANCE_DAYS
      ).length;
      
      // 60%以上が月次周期に一致する場合
      if (matches / intervals.length >= 0.6) {
        return cycle;
      }
    }
    
    // 平均間隔を計算
    const avgInterval = Math.round(
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    );
    
    // 月次パターンの範囲内で分散が小さい場合
    if (avgInterval >= this.MIN_SUBSCRIPTION_CYCLE && avgInterval <= 35) {
      const variance = intervals.reduce((sum, interval) => 
        sum + Math.pow(interval - avgInterval, 2), 0
      ) / intervals.length;
      
      if (variance <= 16) { // 標準偏差が4以下
        return avgInterval;
      }
    }
    
    return undefined;
  }

  /**
   * 信頼度計算（月次サブスクリプション重視）
   */
  private static calculateConfidence(
    intervals: number[],
    cycleDays: number | undefined,
    occurrences: number
  ): number {
    let confidence = 0;
    
    // 出現回数による基本信頼度
    confidence += Math.min(occurrences / 6, 0.4); // 6回で最大信頼度
    
    // 周期の規則性
    if (cycleDays) {
      const regularIntervals = intervals.filter(interval => 
        Math.abs(interval - cycleDays) <= this.CYCLE_TOLERANCE_DAYS
      ).length;
      confidence += (regularIntervals / intervals.length) * 0.5;
    }
    
    // 月次サブスクリプション周期ボーナス
    if (cycleDays && cycleDays >= 28 && cycleDays <= 31) {
      confidence += 0.2; // 月次パターンに高いボーナス
    }
    
    // 3ヶ月以上の継続があれば追加ボーナス
    if (occurrences >= 3) {
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