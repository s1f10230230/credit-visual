import { gmailService, CreditTransaction } from './gmailService';
import { databaseService } from './databaseService';
import { SyncStatus } from '../types/database';

export interface SyncProgress {
  phase: 'initial' | 'background' | 'incremental';
  progress: number; // 0-100
  message: string;
  totalTransactions: number;
  newTransactions: number;
  errors: string[];
}

class SyncService {
  private syncInProgress = false;
  private listeners: Array<(progress: SyncProgress) => void> = [];

  /**
   * プログレスリスナーを登録
   */
  onProgress(callback: (progress: SyncProgress) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyProgress(progress: SyncProgress) {
    this.listeners.forEach(listener => listener(progress));
  }

  /**
   * メイン同期処理（段階的ロード戦略）
   */
  async syncUserData(userId: string, isPremium: boolean): Promise<void> {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return;
    }

    this.syncInProgress = true;

    try {
      const syncStatus = await databaseService.getSyncStatus(userId);
      
      if (!syncStatus?.isInitialSyncComplete) {
        // 初回同期：直近3ヶ月
        await this.initialSync(userId);
        
        if (isPremium) {
          // プレミアムユーザーは即座に12ヶ月同期
          await this.backgroundSync(userId, 12);
        }
      } else {
        // 増分同期：新しいメールのみ
        await this.incrementalSync(userId, syncStatus);
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 初回同期（直近3ヶ月）
   */
  private async initialSync(userId: string): Promise<void> {
    this.notifyProgress({
      phase: 'initial',
      progress: 0,
      message: '初回データ取得中（直近3ヶ月）...',
      totalTransactions: 0,
      newTransactions: 0,
      errors: []
    });

    try {
      // Gmail APIで直近3ヶ月のメールを取得
      const transactions = await gmailService.getCreditTransactions();
      
      this.notifyProgress({
        phase: 'initial',
        progress: 50,
        message: 'データベースに保存中...',
        totalTransactions: transactions.length,
        newTransactions: transactions.length,
        errors: []
      });

      // データベースに保存
      await databaseService.saveTransactions(userId, transactions);
      
      // 既存のDBトランザクション取得
      const dbTransactions = await databaseService.getUserTransactions(userId, 3);
      
      // 月次集計を作成
      await databaseService.updateMonthlyAggregates(userId, dbTransactions);

      // 同期ステータス更新
      await databaseService.updateSyncStatus(userId, {
        lastSyncAt: new Date(),
        isInitialSyncComplete: true,
        totalTransactions: transactions.length,
        syncPeriodMonths: 3
      });

      this.notifyProgress({
        phase: 'initial',
        progress: 100,
        message: '初回同期完了',
        totalTransactions: transactions.length,
        newTransactions: transactions.length,
        errors: []
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.notifyProgress({
        phase: 'initial',
        progress: 0,
        message: '初回同期に失敗',
        totalTransactions: 0,
        newTransactions: 0,
        errors: [errorMessage]
      });

      throw error;
    }
  }

  /**
   * バックグラウンド同期（プレミアムユーザー用12ヶ月）
   */
  private async backgroundSync(userId: string, totalMonths: number): Promise<void> {
    this.notifyProgress({
      phase: 'background',
      progress: 0,
      message: 'より詳細なデータを取得中...',
      totalTransactions: 0,
      newTransactions: 0,
      errors: []
    });

    try {
      // 3ヶ月ずつ段階的に取得（パフォーマンス考慮）
      let totalNewTransactions = 0;
      const batchSize = 3;
      const batches = Math.ceil((totalMonths - 3) / batchSize); // 初回3ヶ月を除く

      for (let batch = 0; batch < batches; batch++) {
        const startMonth = 3 + (batch * batchSize);
        const endMonth = Math.min(startMonth + batchSize, totalMonths);
        
        this.notifyProgress({
          phase: 'background',
          progress: Math.round((batch / batches) * 100),
          message: `${startMonth}-${endMonth}ヶ月前のデータを取得中...`,
          totalTransactions: totalNewTransactions,
          newTransactions: 0,
          errors: []
        });

        // この期間のトランザクションを取得（実際にはGmail APIの制限により簡略化）
        const batchTransactions = await this.getTransactionsForPeriod(startMonth, endMonth);
        
        if (batchTransactions.length > 0) {
          await databaseService.saveTransactions(userId, batchTransactions);
          totalNewTransactions += batchTransactions.length;
        }

        // 少し待機（API制限考慮）
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 全体の月次集計を再計算
      const allTransactions = await databaseService.getUserTransactions(userId, totalMonths);
      await databaseService.updateMonthlyAggregates(userId, allTransactions);

      // 同期ステータス更新
      await databaseService.updateSyncStatus(userId, {
        syncPeriodMonths: totalMonths,
        totalTransactions: allTransactions.length
      });

      this.notifyProgress({
        phase: 'background',
        progress: 100,
        message: '拡張データ取得完了',
        totalTransactions: totalNewTransactions,
        newTransactions: totalNewTransactions,
        errors: []
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Background sync failed';
      
      this.notifyProgress({
        phase: 'background',
        progress: 0,
        message: 'バックグラウンド同期でエラーが発生',
        totalTransactions: 0,
        newTransactions: 0,
        errors: [errorMessage]
      });

      // バックグラウンド同期の失敗は致命的ではないので、ログのみ
      console.error('Background sync failed:', error);
    }
  }

  /**
   * 増分同期（新着メールのみ）
   */
  private async incrementalSync(userId: string, syncStatus: SyncStatus): Promise<void> {
    this.notifyProgress({
      phase: 'incremental',
      progress: 0,
      message: '新着データをチェック中...',
      totalTransactions: syncStatus.totalTransactions,
      newTransactions: 0,
      errors: []
    });

    try {
      // 最後の同期以降の新着メールを取得
      const lastSyncDate = syncStatus.lastSyncAt.toDate();
      const newTransactions = await this.getNewTransactionsSince(lastSyncDate);

      if (newTransactions.length === 0) {
        this.notifyProgress({
          phase: 'incremental',
          progress: 100,
          message: '新着データなし',
          totalTransactions: syncStatus.totalTransactions,
          newTransactions: 0,
          errors: []
        });
        return;
      }

      this.notifyProgress({
        phase: 'incremental',
        progress: 50,
        message: '新着データを保存中...',
        totalTransactions: syncStatus.totalTransactions,
        newTransactions: newTransactions.length,
        errors: []
      });

      // 新しいトランザクションを保存
      await databaseService.saveTransactions(userId, newTransactions);

      // 月次集計更新（影響を受ける月のみ）
      const recentTransactions = await databaseService.getUserTransactions(userId, 1);
      await databaseService.updateMonthlyAggregates(userId, recentTransactions);

      // 同期ステータス更新
      await databaseService.updateSyncStatus(userId, {
        lastSyncAt: new Date(),
        totalTransactions: syncStatus.totalTransactions + newTransactions.length
      });

      this.notifyProgress({
        phase: 'incremental',
        progress: 100,
        message: '同期完了',
        totalTransactions: syncStatus.totalTransactions + newTransactions.length,
        newTransactions: newTransactions.length,
        errors: []
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Incremental sync failed';
      
      this.notifyProgress({
        phase: 'incremental',
        progress: 0,
        message: '同期に失敗',
        totalTransactions: syncStatus.totalTransactions,
        newTransactions: 0,
        errors: [errorMessage]
      });

      throw error;
    }
  }

  /**
   * 指定期間のトランザクションを取得（模擬実装）
   */
  private async getTransactionsForPeriod(
    startMonthsBack: number, 
    endMonthsBack: number
  ): Promise<CreditTransaction[]> {
    // 実際の実装では、Gmail APIのdate範囲指定を使用
    // 現在は簡略化のため空配列を返す
    console.log(`Getting transactions for ${startMonthsBack}-${endMonthsBack} months back`);
    return [];
  }

  /**
   * 指定日時以降の新着トランザクションを取得
   */
  private async getNewTransactionsSince(lastSyncDate: Date): Promise<CreditTransaction[]> {
    // Gmail APIのafter:検索を使用して新着メールのみ取得
    const afterQuery = `after:${Math.floor(lastSyncDate.getTime() / 1000)}`;
    console.log('Incremental sync query:', afterQuery);
    
    // 現在の実装では全件取得しているため、日付フィルタリングで代用
    const allTransactions = await gmailService.getCreditTransactions();
    return allTransactions.filter(tx => new Date(tx.date) > lastSyncDate);
  }
}

export const syncService = new SyncService();