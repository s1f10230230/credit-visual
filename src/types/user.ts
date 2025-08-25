export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  planType: 'free' | 'premium';
  subscriptionEnd?: Date;
  createdAt: Date;
  lastLoginAt: Date;
  gmailConnected: boolean;
  preferences: {
    notifications: boolean;
    reminderDays: number; // 何日前にリマインダーを送るか
    currency: 'JPY' | 'USD';
  };
}

export interface UserSubscription {
  userId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planType: 'free' | 'premium';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  notifications: boolean;
  reminderDays: number;
  currency: 'JPY' | 'USD';
  darkMode: boolean;
  language: 'ja' | 'en';
}