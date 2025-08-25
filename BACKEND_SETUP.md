# バックエンドAPI セットアップ手順

## アーキテクチャ概要

```
Frontend (React)     Backend (Node.js)     Database
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ Firebase Auth│───▶│ JWT Verification│───▶│ PostgreSQL   │
│ (Login only) │    │ Express Server  │    │ (All Data)   │
└──────────────┘    └─────────────────┘    └──────────────┘
       │                       │                    │
       │              ┌─────────────────┐           │
       └─────────────▶│ Firebase Admin  │───────────┘
                      │ Token Validation│
                      └─────────────────┘
```

## 1. PostgreSQL セットアップ

### オプション A: Supabase（推奨・無料枠あり）

1. https://supabase.com/ でアカウント作成
2. 新プロジェクト作成: `credit-visual-db`
3. Database → SQL Editor で以下を実行：

```sql
-- ユーザー
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  photo_url TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free',
  subscription_end TIMESTAMPTZ,
  gmail_connected BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{"notifications": true, "reminderDays": 3, "currency": "JPY"}',
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
  message_id TEXT NOT NULL,
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

-- ユーザーラベル
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
  year_month DATE NOT NULL,
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

### オプション B: Railway

```bash
# Railway CLI インストール
npm install -g @railway/cli

# プロジェクト作成
railway login
railway init
railway add postgresql
```

### オプション C: ローカル PostgreSQL

```bash
# Docker で PostgreSQL 起動
docker run --name credit-visual-db \
  -e POSTGRES_PASSWORD=password123 \
  -e POSTGRES_DB=credit_visual \
  -p 5432:5432 \
  -d postgres:15

# または Homebrew (Mac)
brew install postgresql
brew services start postgresql
createdb credit_visual
```

## 2. Node.js API サーバー作成

### プロジェクト初期化

```bash
mkdir credit-visual-api
cd credit-visual-api
npm init -y

# 必要パッケージインストール
npm install express cors helmet morgan dotenv
npm install @prisma/client prisma
npm install firebase-admin
npm install jsonwebtoken bcryptjs
npm install stripe
npm install --save-dev @types/node @types/express @types/cors
npm install --save-dev nodemon typescript ts-node
```

### Prisma スキーマ設定

```bash
npx prisma init
```

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  firebaseUid     String   @unique @map("firebase_uid")
  email           String   @unique
  displayName     String?  @map("display_name")
  photoUrl        String?  @map("photo_url")
  planType        String   @default("free") @map("plan_type")
  subscriptionEnd DateTime? @map("subscription_end") @db.Timestamptz
  gmailConnected  Boolean  @default(false) @map("gmail_connected")
  preferences     Json     @default("{\"notifications\": true, \"reminderDays\": 3, \"currency\": \"JPY\"}")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz

  transactions      Transaction[]
  subscriptions     Subscription[]
  userLabels        UserLabel[]
  monthlyAggregates MonthlyAggregate[]
  syncStatus        SyncStatus?

  @@map("users")
}

model Transaction {
  id                  BigInt   @id @default(autoincrement())
  userId              String   @map("user_id") @db.Uuid
  occurredAt          DateTime @map("occurred_at") @db.Timestamptz
  amount              Decimal  @db.Decimal(14, 2)
  currency            String   @default("JPY")
  merchantRaw         String   @map("merchant_raw")
  merchantNormalized  String?  @map("merchant_normalized")
  cardLabel           String?  @map("card_label")
  messageId           String   @map("message_id")
  source              String   @default("gmail")
  isSubscription      Boolean  @default(false) @map("is_subscription")
  confidence          Decimal  @default(0.8) @db.Decimal(3, 2)
  category            String?
  createdAt           DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt           DateTime @updatedAt @map("updated_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, messageId])
  @@map("transactions")
}

// 他のモデルも同様に定義...
```

### 環境変数 (.env)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/credit_visual"
FIREBASE_PROJECT_ID="your-firebase-project"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
JWT_SECRET="your-jwt-secret-key"
STRIPE_SECRET_KEY="sk_test_..."
GMAIL_CLIENT_ID="125736450282-..."
GMAIL_CLIENT_SECRET="GOCSPX-..."
PORT=3001
```

## 3. API サーバーコード

### src/server.ts

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import syncRoutes from './routes/sync';
import userRoutes from './routes/user';
import paymentRoutes from './routes/payments';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェア
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'https://your-app.firebaseapp.com'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());

// ルーティング
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/user', userRoutes);
app.use('/api/payments', paymentRoutes);

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
```

### src/middleware/auth.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';

// Firebase Admin初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // JWT検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
```

## 4. デプロイ選択肢

### オプション A: Vercel（推奨）

```bash
npm install -g vercel
vercel

# または
# package.json に追加
"scripts": {
  "build": "prisma generate && tsc",
  "start": "node dist/server.js"
}
```

### オプション B: Railway

```bash
railway login
railway init
railway up
```

### オプション C: Render

1. GitHub にコードをプッシュ
2. https://render.com でサービス作成
3. 環境変数設定

## 5. セットアップ完了確認

```bash
# APIサーバー起動
npm run dev

# ヘルスチェック
curl http://localhost:3001/health

# Firebase認証テスト
curl -X POST http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"firebaseToken":"your-firebase-id-token"}'
```

## 6. フロントエンド環境変数更新

```env
VITE_API_BASE_URL=http://localhost:3001/api
# または本番URL
VITE_API_BASE_URL=https://your-api.vercel.app/api
```

この設定で、Firebase認証＋PostgreSQLデータベースの完全なアーキテクチャが完成します！