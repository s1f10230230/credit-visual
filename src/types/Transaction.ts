import { CreditTransaction as BaseCreditTransaction } from '../services/gmailService';

// 外貨対応の拡張トランザクション型
export interface ExtendedCreditTransaction extends BaseCreditTransaction {
  // 外貨情報
  originalCurrency?: string;
  originalAmount?: number;
  exchangeRate?: number;
  isOverseas?: boolean;
  
  // 手動編集情報
  isManuallyAdded?: boolean;
  isManuallyEdited?: boolean;
  lastEditedAt?: string;
  
  // 検知情報
  detectionMethod?: 'gmail' | 'manual' | 'pattern_detection' | 'overseas_detection';
  confidence?: number;
  
  // メタデータ
  tags?: string[];
  notes?: string;
}

// 外貨為替レート
export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  date: string;
  source: 'manual' | 'api' | 'estimated';
}

// サブスク検知パターン
export interface SubscriptionPattern {
  id: string;
  merchantName: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'yearly' | 'weekly';
  category: string;
  confidence: number;
  lastDetected: string;
}

// 海外サービステンプレート
export interface OverseasServiceTemplate {
  name: string;
  category: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'yearly';
  description: string;
  website?: string;
  commonMerchantNames: string[];
}

// 取引編集履歴
export interface TransactionEditHistory {
  transactionId: string;
  editedAt: string;
  editType: 'create' | 'update' | 'delete' | 'categorize';
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  reason?: string;
}

export type Transaction = ExtendedCreditTransaction;