import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, ApiTransaction } from '../services/apiService';
import { CreditTransaction } from '../services/gmailService';
import { applyFreemiumRestrictions } from '../utils/dateFilters';

export interface SyncProgress {
  phase: 'initial' | 'background' | 'incremental';
  progress: number;
  message: string;
  totalTransactions: number;
  newTransactions: number;
  errors: string[];
}

export interface TransactionDataState {
  transactions: CreditTransaction[];
  loading: boolean;
  error: string | null;
  syncProgress: SyncProgress | null;
  lastSyncAt: Date | null;
  refresh: () => Promise<void>;
}

/**
 * トランザクションデータの管理Hook
 * - データベースからの読み込み
 * - 段階的同期の管理
 * - フリーミアム制限の適用
 */
export const useTransactionData = (): TransactionDataState => {
  const { currentUser, isPremium } = useAuth();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const loadTransactionsFromAPI = async (): Promise<void> => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);

      // APIからトランザクション取得
      const monthsToLoad = isPremium ? 12 : 3;
      const apiTransactions = await apiService.getTransactions(monthsToLoad);

      // ApiTransaction を CreditTransaction 形式に変換
      const creditTransactions: CreditTransaction[] = apiTransactions.map(apiTx => ({
        id: apiTx.messageId,
        amount: apiTx.amount,
        merchant: apiTx.merchantRaw,
        date: apiTx.occurredAt,
        category: apiTx.category,
        status: 'confirmed' as const,
        cardName: apiTx.cardLabel,
        isSubscription: apiTx.isSubscription,
        confidence: apiTx.confidence
      }));

      // フリーミアム制限を適用
      const filteredTransactions = applyFreemiumRestrictions(
        creditTransactions, 
        isPremium
      );

      setTransactions(filteredTransactions);

      // 同期ステータス取得
      const syncStatus = await apiService.getSyncStatus();
      if (syncStatus) {
        setLastSyncAt(new Date(syncStatus.lastSyncAt));
      }

    } catch (err) {
      console.error('Failed to load transactions from API:', err);
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (): Promise<void> => {
    if (!currentUser) return;

    try {
      setError(null);
      setSyncProgress({ 
        phase: 'incremental', 
        progress: 0, 
        message: '同期開始中...', 
        totalTransactions: 0, 
        newTransactions: 0, 
        errors: [] 
      });
      
      // Gmail同期をAPI経由で実行
      const syncResult = await apiService.syncGmail();
      
      setSyncProgress({ 
        phase: 'incremental', 
        progress: 100, 
        message: syncResult.message, 
        totalTransactions: syncResult.totalTransactions, 
        newTransactions: syncResult.newTransactions, 
        errors: syncResult.errors || [] 
      });
      
      // データを再読み込み
      await loadTransactionsFromAPI();
      
      // プログレス状態をクリア
      setTimeout(() => setSyncProgress(null), 3000);

    } catch (err) {
      console.error('Refresh failed:', err);
      setError(err instanceof Error ? err.message : '同期に失敗しました');
      setSyncProgress(null);
    }
  };

  // 初回ロード
  useEffect(() => {
    if (currentUser) {
      loadTransactionsFromAPI();
    }
  }, [currentUser?.uid, isPremium]);

  return {
    transactions,
    loading,
    error,
    syncProgress,
    lastSyncAt,
    refresh
  };
};