import { User } from '../types/user';
import { CreditTransaction } from './gmailService';

export interface ApiTransaction {
  id: string;
  userId: string;
  occurredAt: string; // ISO string
  amount: number;
  currency: string;
  merchantRaw: string;
  merchantNormalized?: string;
  cardLabel?: string;
  messageId: string;
  source: string;
  isSubscription: boolean;
  confidence: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSubscription {
  id: string;
  userId: string;
  merchantName: string;
  planAmount: number;
  cycleDays: number;
  nextChargeDate?: string;
  isActive: boolean;
  category: string;
  reasonTags: string[];
  firstDetected: string;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncResponse {
  success: boolean;
  newTransactions: number;
  totalTransactions: number;
  message: string;
  errors?: string[];
}

class ApiService {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  }

  /**
   * Firebase ID Token を設定
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * 共通のfetch関数
   */
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Firebase Token検証とJWT取得
   */
  async verifyAuth(firebaseToken: string): Promise<{ token: string; user: User }> {
    return this.request<{ token: string; user: User }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ firebaseToken }),
    });
  }

  /**
   * ユーザーの取引データを取得
   */
  async getTransactions(monthsBack?: number): Promise<ApiTransaction[]> {
    const params = monthsBack ? `?monthsBack=${monthsBack}` : '';
    return this.request<ApiTransaction[]>(`/transactions${params}`);
  }

  /**
   * Gmail同期を実行
   */
  async syncGmail(): Promise<SyncResponse> {
    return this.request<SyncResponse>('/sync/gmail', {
      method: 'POST',
    });
  }

  /**
   * 同期ステータスを取得
   */
  async getSyncStatus(): Promise<{
    lastSyncAt: string;
    totalTransactions: number;
    isInitialSyncComplete: boolean;
    syncPeriodMonths: number;
  }> {
    return this.request('/sync/status');
  }

  /**
   * サブスクリプション一覧を取得
   */
  async getSubscriptions(): Promise<ApiSubscription[]> {
    return this.request<ApiSubscription[]>('/subscriptions');
  }

  /**
   * ユーザー補正ラベルを保存
   */
  async saveUserLabel(merchantName: string, isSubscription: boolean, isHidden: boolean): Promise<void> {
    await this.request('/subscriptions/label', {
      method: 'POST',
      body: JSON.stringify({
        merchantName,
        isSubscription,
        isHidden,
      }),
    });
  }

  /**
   * 月次分析データを取得
   */
  async getMonthlyAnalytics(): Promise<Array<{
    yearMonth: string;
    totalAmount: number;
    subscriptionAmount: number;
    subscriptionCount: number;
    transactionCount: number;
    topCategories: Array<{ category: string; amount: number; count: number }>;
  }>> {
    return this.request('/analytics/monthly');
  }

  /**
   * ユーザープロフィールを取得
   */
  async getUserProfile(): Promise<User> {
    return this.request<User>('/user/profile');
  }

  /**
   * ユーザープロフィールを更新
   */
  async updateUserProfile(updates: Partial<User>): Promise<User> {
    return this.request<User>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * 全ユーザーデータを削除
   */
  async deleteAllUserData(): Promise<{ success: boolean; message: string }> {
    return this.request('/user/data', {
      method: 'DELETE',
    });
  }

  /**
   * Stripe決済セッションを作成
   */
  async createStripeCheckoutSession(): Promise<{ sessionUrl: string }> {
    return this.request<{ sessionUrl: string }>('/payments/checkout', {
      method: 'POST',
    });
  }

  /**
   * Stripe顧客ポータルURLを取得
   */
  async getStripeCustomerPortal(): Promise<{ portalUrl: string }> {
    return this.request<{ portalUrl: string }>('/payments/portal');
  }
}

export const apiService = new ApiService();