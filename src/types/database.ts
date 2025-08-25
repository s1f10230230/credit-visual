import { Timestamp } from 'firebase/firestore';

// Firestoreデータモデル定義

export interface DatabaseTransaction {
  id: string;
  userId: string;
  occurredAt: Timestamp;
  amount: number;
  currency: 'JPY' | 'USD';
  merchantRaw: string;
  merchantNormalized?: string;
  cardLabel?: string;
  messageId: string; // Gmail message ID
  threadId?: string;
  source: 'gmail' | 'manual';
  isSubscription: boolean;
  confidence: number;
  category: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DatabaseSubscription {
  id: string;
  userId: string;
  merchantName: string;
  planAmount: number;
  cycleDays: number; // 30, 90, 365
  nextChargeDate?: Timestamp;
  isActive: boolean;
  category: string;
  reasonTags: string[]; // ["periodic", "same_amount", "coexist"]
  firstDetected: Timestamp;
  lastSeen: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserLabel {
  id: string;
  userId: string;
  merchantName: string;
  isSubscription: boolean; // ユーザー補正
  isHidden: boolean; // 候補から除外
  isKeepAlways: boolean; // 常に保持
  reason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MonthlyAggregate {
  id: string; // userId_YYYY-MM format
  userId: string;
  yearMonth: string; // "2025-08" format
  totalAmount: number;
  subscriptionAmount: number;
  subscriptionCount: number;
  transactionCount: number;
  topCategories: Array<{
    category: string;
    amount: number;
    count: number;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MerchantDictionary {
  id: string;
  nameNormalized: string;
  category: string;
  aliases: string[];
  subscriptionPatterns: string[];
  avgAmount?: number;
  confidence: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// メール本文は既定で保存しない（オンデマンド取得）
export interface EmailCache {
  id: string; // userId_messageId format
  userId: string;
  messageId: string;
  bodyEncrypted: string; // AES暗号化
  mimeType: string;
  cachedAt: Timestamp;
  expiresAt: Timestamp; // 24時間TTL
}

// 同期状態管理
export interface SyncStatus {
  userId: string;
  lastSyncAt: Timestamp;
  lastMessageId?: string;
  totalTransactions: number;
  syncPeriodMonths: number; // 3 for free, 12 for premium
  isInitialSyncComplete: boolean;
  errors: Array<{
    error: string;
    timestamp: Timestamp;
  }>;
  updatedAt: Timestamp;
}