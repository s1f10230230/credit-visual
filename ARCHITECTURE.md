# アーキテクチャ設計（更新版）

## システム構成

### フロントエンド
- **React + TypeScript** (現在の実装)
- **Material-UI** でのUI
- **Firebase Auth** でGoogle認証
- **Firebase Hosting** でのデプロイ

### バックエンド
- **Node.js + Express** (新規)
- **PostgreSQL** でデータ保存
- **Prisma** でORM
- **JWT** でセッション管理

### インフラ
- **Firebase**: 認証 + ホスティング
- **PostgreSQL**: メインデータベース（Supabase/Railway/Vercel Postgres）
- **API**: Vercel Functions または Express サーバー

## データベース設計（PostgreSQL）

```sql
-- ユーザー
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  photo_url TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free', -- 'free' | 'premium'
  subscription_end TIMESTAMPTZ,
  gmail_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 取引データ
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'JPY',
  merchant_raw TEXT NOT NULL,
  merchant_normalized TEXT,
  card_label TEXT,
  message_id TEXT NOT NULL, -- Gmail message ID
  source TEXT NOT NULL DEFAULT 'gmail',
  is_subscription BOOLEAN DEFAULT FALSE,
  confidence DECIMAL(3,2) DEFAULT 0.8,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

-- サブスクリプション
CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL,
  plan_amount DECIMAL(14,2) NOT NULL,
  cycle_days INTEGER NOT NULL DEFAULT 30,
  next_charge_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  category TEXT,
  reason_tags TEXT[] DEFAULT '{}',
  first_detected TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, merchant_name)
);

-- ユーザーラベル（補正データ）
CREATE TABLE user_labels (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL,
  is_subscription BOOLEAN,
  is_hidden BOOLEAN DEFAULT FALSE,
  is_keep_always BOOLEAN DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, merchant_name)
);

-- 月次集計
CREATE TABLE monthly_aggregates (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  year_month DATE NOT NULL, -- 各月の1日
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  subscription_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  subscription_count INTEGER NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  top_categories JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(user_id, year_month)
);

-- 同期ステータス
CREATE TABLE sync_status (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_id TEXT,
  total_transactions INTEGER DEFAULT 0,
  sync_period_months INTEGER DEFAULT 3,
  is_initial_sync_complete BOOLEAN DEFAULT FALSE,
  errors JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_transactions_user_time ON transactions(user_id, occurred_at DESC);
CREATE INDEX idx_transactions_user_merchant ON transactions(user_id, merchant_normalized);
CREATE INDEX idx_subscriptions_user_active ON subscriptions(user_id, is_active);
CREATE INDEX idx_monthly_aggregates_user_ym ON monthly_aggregates(user_id, year_month);
```

## API設計

### 認証フロー
1. フロントエンド：Firebase Auth でGoogleログイン
2. Firebase ID Token を取得
3. バックエンド：ID Token を検証してJWT発行
4. 以降のAPI呼び出しでJWTを使用

### エンドポイント設計
```
GET  /api/auth/verify          # Firebase Token検証
POST /api/auth/refresh         # JWT更新

GET  /api/transactions         # 取引一覧取得
POST /api/sync/gmail          # Gmail同期実行
GET  /api/sync/status         # 同期ステータス

GET  /api/subscriptions       # サブスク一覧
POST /api/subscriptions/label # ユーザー補正

GET  /api/analytics/monthly   # 月次データ
GET  /api/analytics/trends    # トレンド分析

POST /api/payments/checkout   # Stripe決済
GET  /api/user/profile        # ユーザー情報
DELETE /api/user/data         # 全データ削除
```