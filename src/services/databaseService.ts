import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  DatabaseTransaction, 
  DatabaseSubscription, 
  UserLabel, 
  MonthlyAggregate, 
  SyncStatus 
} from '../types/database';
import { CreditTransaction } from './gmailService';

class DatabaseService {
  // Collections
  private readonly TRANSACTIONS = 'transactions';
  private readonly SUBSCRIPTIONS = 'subscriptions';
  private readonly USER_LABELS = 'userLabels';
  private readonly MONTHLY_AGGREGATES = 'monthlyAggregates';
  private readonly SYNC_STATUS = 'syncStatus';

  /**
   * トランザクションを保存
   */
  async saveTransactions(userId: string, transactions: CreditTransaction[]): Promise<void> {
    const batch = writeBatch(db);
    const transactionsRef = collection(db, this.TRANSACTIONS);

    for (const transaction of transactions) {
      // 重複チェック用のドキュメントID
      const docId = `${userId}_${transaction.id}`;
      const docRef = doc(transactionsRef, docId);

      const dbTransaction: Omit<DatabaseTransaction, 'id'> = {
        userId,
        occurredAt: Timestamp.fromDate(new Date(transaction.date)),
        amount: transaction.amount,
        currency: 'JPY', // デフォルトでJPY
        merchantRaw: transaction.merchant,
        merchantNormalized: this.normalizeMerchantName(transaction.merchant),
        cardName: transaction.cardName,
        messageId: transaction.id,
        source: 'gmail',
        isSubscription: transaction.isSubscription || false,
        confidence: transaction.confidence || 0.8,
        category: transaction.category,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      batch.set(docRef, dbTransaction);
    }

    await batch.commit();
    console.log(`Saved ${transactions.length} transactions to database`);
  }

  /**
   * ユーザーのトランザクションを取得
   */
  async getUserTransactions(
    userId: string, 
    monthsBack: number = 3
  ): Promise<DatabaseTransaction[]> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

    const q = query(
      collection(db, this.TRANSACTIONS),
      where('userId', '==', userId),
      where('occurredAt', '>=', Timestamp.fromDate(cutoffDate)),
      orderBy('occurredAt', 'desc'),
      limit(1000) // 安全な上限
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as DatabaseTransaction));
  }

  /**
   * サブスクリプションを保存・更新
   */
  async saveSubscription(userId: string, subscription: DatabaseSubscription): Promise<string> {
    const subscriptionsRef = collection(db, this.SUBSCRIPTIONS);
    
    // 既存チェック
    const q = query(
      subscriptionsRef,
      where('userId', '==', userId),
      where('merchantName', '==', subscription.merchantName)
    );
    
    const existing = await getDocs(q);
    
    if (existing.empty) {
      // 新規作成
      const docRef = await addDoc(subscriptionsRef, {
        ...subscription,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } else {
      // 既存更新
      const docRef = existing.docs[0].ref;
      await updateDoc(docRef, {
        ...subscription,
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    }
  }

  /**
   * ユーザーのサブスクリプションを取得
   */
  async getUserSubscriptions(userId: string): Promise<DatabaseSubscription[]> {
    const q = query(
      collection(db, this.SUBSCRIPTIONS),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('planAmount', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as DatabaseSubscription));
  }

  /**
   * ユーザーラベル（補正データ）を保存
   */
  async saveUserLabel(userId: string, label: Omit<UserLabel, 'id' | 'userId'>): Promise<void> {
    const labelsRef = collection(db, this.USER_LABELS);
    const docId = `${userId}_${this.hashMerchantName(label.merchantName)}`;
    
    await updateDoc(doc(labelsRef, docId), {
      userId,
      ...label,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * ユーザーラベルを取得
   */
  async getUserLabels(userId: string): Promise<Map<string, UserLabel>> {
    const q = query(
      collection(db, this.USER_LABELS),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    const labelsMap = new Map<string, UserLabel>();
    
    snapshot.docs.forEach(doc => {
      const label = { id: doc.id, ...doc.data() } as UserLabel;
      labelsMap.set(label.merchantName, label);
    });

    return labelsMap;
  }

  /**
   * 月次集計を作成・更新
   */
  async updateMonthlyAggregates(userId: string, transactions: DatabaseTransaction[]): Promise<void> {
    const monthlyData = new Map<string, MonthlyAggregate>();
    
    // トランザクションを月ごとにグループ化
    transactions.forEach(tx => {
      const date = tx.occurredAt.toDate();
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData.has(yearMonth)) {
        monthlyData.set(yearMonth, {
          id: `${userId}_${yearMonth}`,
          userId,
          yearMonth,
          totalAmount: 0,
          subscriptionAmount: 0,
          subscriptionCount: 0,
          transactionCount: 0,
          topCategories: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } as MonthlyAggregate);
      }

      const monthData = monthlyData.get(yearMonth)!;
      monthData.totalAmount += tx.amount;
      monthData.transactionCount++;
      
      if (tx.isSubscription) {
        monthData.subscriptionAmount += tx.amount;
        monthData.subscriptionCount++;
      }
    });

    // バッチで保存
    const batch = writeBatch(db);
    const aggregatesRef = collection(db, this.MONTHLY_AGGREGATES);

    for (const [yearMonth, aggregate] of monthlyData) {
      const docRef = doc(aggregatesRef, aggregate.id);
      batch.set(docRef, aggregate, { merge: true });
    }

    await batch.commit();
    console.log(`Updated ${monthlyData.size} monthly aggregates`);
  }

  /**
   * 同期ステータスを更新
   */
  async updateSyncStatus(userId: string, status: Partial<SyncStatus>): Promise<void> {
    const syncRef = doc(db, this.SYNC_STATUS, userId);
    
    await updateDoc(syncRef, {
      ...status,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 同期ステータスを取得
   */
  async getSyncStatus(userId: string): Promise<SyncStatus | null> {
    const syncRef = doc(db, this.SYNC_STATUS, userId);
    const snapshot = await getDoc(syncRef);
    
    if (!snapshot.exists()) {
      // 初期ステータス作成
      const initialStatus: SyncStatus = {
        userId,
        lastSyncAt: Timestamp.now(),
        totalTransactions: 0,
        syncPeriodMonths: 3,
        isInitialSyncComplete: false,
        errors: [],
        updatedAt: serverTimestamp(),
      } as SyncStatus;
      
      await updateDoc(syncRef, initialStatus);
      return initialStatus;
    }

    return { id: snapshot.id, ...snapshot.data() } as SyncStatus;
  }

  /**
   * ユーザーデータ完全削除（GDPR対応）
   */
  async deleteAllUserData(userId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // 全コレクションから該当ユーザーのデータを削除
    const collections = [
      this.TRANSACTIONS,
      this.SUBSCRIPTIONS,
      this.USER_LABELS,
      this.MONTHLY_AGGREGATES
    ];

    for (const collectionName of collections) {
      const q = query(
        collection(db, collectionName),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
    }

    // 同期ステータスも削除
    batch.delete(doc(db, this.SYNC_STATUS, userId));

    await batch.commit();
    console.log(`Deleted all data for user: ${userId}`);
  }

  // ヘルパー関数
  private normalizeMerchantName(merchant: string): string {
    return merchant
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hashMerchantName(merchant: string): string {
    // 簡単なハッシュ関数（本番では crypto.subtle.digest を使用）
    let hash = 0;
    for (let i = 0; i < merchant.length; i++) {
      const char = merchant.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash).toString(36);
  }
}

export const databaseService = new DatabaseService();