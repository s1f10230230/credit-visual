import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { databaseService } from '../services/databaseService';
import { syncService, SyncProgress } from '../services/syncService';
import { DatabaseTransaction } from '../types/database';
import { CreditTransaction } from '../services/gmailService';
import { applyFreemiumRestrictions } from '../utils/dateFilters';

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

  const loadTransactionsFromDB = async (): Promise<void> => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);

      // データベースからトランザクション取得
      const monthsToLoad = isPremium ? 12 : 3;
      const dbTransactions = await databaseService.getUserTransactions(
        currentUser.uid, 
        monthsToLoad
      );

      // DatabaseTransaction を CreditTransaction 形式に変換
      const creditTransactions: CreditTransaction[] = dbTransactions.map(dbTx => ({
        id: dbTx.messageId,
        amount: dbTx.amount,
        merchant: dbTx.merchantRaw,
        date: dbTx.occurredAt.toDate().toISOString(),
        category: dbTx.category,
        status: 'confirmed' as const,
        cardName: dbTx.cardLabel,
        isSubscription: dbTx.isSubscription,
        confidence: dbTx.confidence
      }));

      // フリーミアム制限を適用
      const filteredTransactions = applyFreemiumRestrictions(
        creditTransactions, 
        isPremium
      );

      setTransactions(filteredTransactions);

      // 同期ステータス取得
      const syncStatus = await databaseService.getSyncStatus(currentUser.uid);
      if (syncStatus) {
        setLastSyncAt(syncStatus.lastSyncAt.toDate());
      }

    } catch (err) {
      console.error('Failed to load transactions from DB:', err);
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (): Promise<void> => {
    if (!currentUser) return;

    try {
      setError(null);
      
      // 同期実行
      await syncService.syncUserData(currentUser.uid, isPremium);
      
      // データベースから再読み込み
      await loadTransactionsFromDB();

    } catch (err) {
      console.error('Refresh failed:', err);
      setError(err instanceof Error ? err.message : '同期に失敗しました');
    }
  };

  // 初回ロード
  useEffect(() => {
    if (currentUser) {
      loadTransactionsFromDB();
    }
  }, [currentUser?.uid, isPremium]);

  // 同期プログレスの監視
  useEffect(() => {
    const unsubscribe = syncService.onProgress(setSyncProgress);
    return unsubscribe;
  }, []);

  // 定期的な同期（5分間隔）
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      syncService.syncUserData(currentUser.uid, isPremium);
    }, 5 * 60 * 1000); // 5分

    return () => clearInterval(interval);
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