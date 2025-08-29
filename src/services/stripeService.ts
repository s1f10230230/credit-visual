import { loadStripe, Stripe } from '@stripe/stripe-js';
import { User } from '../types/user';

class StripeService {
  private stripe: Promise<Stripe | null>;

  constructor() {
    this.stripe = loadStripe((import.meta.env as any).VITE_STRIPE_PUBLISHABLE_KEY);
  }

  /**
   * プレミアムプランの購読を開始
   */
  async subscribeToPremium(user: User): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = await this.stripe;
      if (!stripe) {
        throw new Error('Stripe not loaded');
      }

      // バックエンドAPI（将来実装）でCheckoutセッションを作成
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          priceId: 'price_premium_monthly', // Stripeで設定した価格ID
        }),
      });

      const { sessionId } = await response.json();

      // Stripe Checkoutにリダイレクト
      const { error } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Stripe subscription error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 顧客ポータルにリダイレクト（サブスクリプション管理用）
   */
  async redirectToCustomerPortal(user: User): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/create-customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
        }),
      });

      const { url } = await response.json();
      window.location.href = url;

      return { success: true };
    } catch (error) {
      console.error('Customer portal error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * モック版：実際のバックエンドが無い場合の代替実装
   */
  async subscribeToPremiumMock(user: User): Promise<{ success: boolean; error?: string }> {
    try {
      // Firebase Firestoreで直接プレミアムプランに更新（開発時用）
      console.log('Mock premium subscription for user:', user.email);
      
      // 30日間のトライアル期間を設定
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      // 実際の実装では、FirebaseでユーザーのプランType を更新
      // await updateUserPlan(user.uid, 'premium', trialEndDate);

      alert('🎉 30日間の無料トライアルが開始されました！\n\n実際の本番環境では、Stripe決済が統合されます。');
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Mock subscription failed' 
      };
    }
  }
}

export const stripeService = new StripeService();