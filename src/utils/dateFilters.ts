import { AnalyticsTransaction } from '../services/analyticsService';

/**
 * フリーミアム制限を適用してトランザクションをフィルタリング
 */
export const applyFreemiumRestrictions = (
  transactions: AnalyticsTransaction[],
  isPremium: boolean,
  monthsLimit: number = 3
): AnalyticsTransaction[] => {
  if (isPremium) {
    return transactions; // プレミアムユーザーは制限なし
  }

  // 無料ユーザーは直近N ヶ月のみ
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsLimit);
  
  return transactions.filter(transaction => 
    new Date(transaction.date) >= cutoffDate
  );
};

/**
 * 利用可能な月のリストを取得（フリーミアム制限適用）
 */
export const getAvailableMonths = (
  transactions: AnalyticsTransaction[],
  isPremium: boolean,
  monthsLimit: number = 3
): string[] => {
  const filteredTransactions = applyFreemiumRestrictions(transactions, isPremium, monthsLimit);
  
  const monthsSet = new Set<string>();
  filteredTransactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(monthKey);
  });

  return Array.from(monthsSet).sort().reverse(); // 新しい月から順番
};

/**
 * 月別支出データの取得（フリーミアム制限適用）
 */
export const getMonthlySpendingData = (
  transactions: AnalyticsTransaction[],
  isPremium: boolean
): Array<{ month: string; amount: number; subscriptions: number }> => {
  const filteredTransactions = applyFreemiumRestrictions(transactions, isPremium);
  
  const monthlyData = new Map<string, { amount: number; subscriptions: number }>();
  
  filteredTransactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const existing = monthlyData.get(monthKey) || { amount: 0, subscriptions: 0 };
    existing.amount += transaction.amount;
    if (transaction.is_subscription) {
      existing.subscriptions++;
    }
    
    monthlyData.set(monthKey, existing);
  });

  return Array.from(monthlyData.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

/**
 * プレミアム機能が必要かチェック
 */
export const requiresPremiumFeature = (
  featureName: string,
  isPremium: boolean
): boolean => {
  const premiumFeatures = [
    'duplicate_detection',
    'cancellation_recommendations', 
    '12_month_analytics',
    'billing_reminders',
    'advanced_analytics'
  ];
  
  return premiumFeatures.includes(featureName) && !isPremium;
};