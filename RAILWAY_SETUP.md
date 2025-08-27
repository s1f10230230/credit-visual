# 🚂 Railway セットアップ手順

Railwayは開発者に優しいクラウドプラットフォームです。PostgreSQL + API を一括でデプロイできます。

## 1. Railway CLI インストールと初期化

```bash
# Railway CLI をグローバルインストール
npm install -g @railway/cli

# GitHubアカウントでログイン
railway login

# プロジェクト作成
railway init

# PostgreSQL データベースを追加
railway add postgresql
```

## 2. データベース設定

### 2-1. データベース接続情報取得
```bash
# 環境変数を表示（DATABASE_URL が自動生成されます）
railway variables
```

### 2-2. データベース接続
```bash
# Railway のデータベースに接続
railway connect postgres
```

### 2-3. スキーマ作成
PostgreSQL接続後、以下のSQLを実行：

```sql
-- ユーザーテーブル
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

-- 取引データテーブル  
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

-- インデックス
CREATE INDEX idx_transactions_user_time ON transactions(user_id, occurred_at DESC);
CREATE INDEX idx_transactions_user_merchant ON transactions(user_id, merchant_normalized);  
CREATE INDEX idx_subscriptions_user_active ON subscriptions(user_id, is_active);
```

## 3. API サーバープロジェクト作成

### 3-1. 新しいディレクトリでプロジェクト初期化
```bash
# API用の新しいディレクトリ
mkdir credit-visual-api
cd credit-visual-api

# package.json作成
npm init -y

# 必要なパッケージをインストール
npm install express cors helmet morgan dotenv
npm install @prisma/client prisma
npm install firebase-admin jsonwebtoken
npm install --save-dev @types/node @types/express @types/cors
npm install --save-dev nodemon typescript ts-node
```

### 3-2. TypeScript設定
```bash
npx tsc --init
```

### 3-3. Prisma初期化
```bash
npx prisma init
```

### 3-4. Railway環境変数を取得
```bash
# 現在の環境変数を確認
railway variables

# 特定の変数を取得
railway variables get DATABASE_URL
```

## 4. 環境変数設定

### 4-1. ローカル開発用 .env
```env
# Railway から取得した DATABASE_URL
DATABASE_URL="postgresql://postgres:password@monorail.proxy.rlwy.net:12345/railway"

# Firebase設定
FIREBASE_PROJECT_ID="credit-visual-app-8b7eb"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"  
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@credit-visual-app-8b7eb.iam.gserviceaccount.com"

# JWT
JWT_SECRET="your-jwt-secret-key"

# ポート
PORT=3001
```

### 4-2. Railway本番環境変数設定
```bash
# Firebase設定をRailwayに追加
railway variables set FIREBASE_PROJECT_ID="credit-visual-app-8b7eb"
railway variables set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
railway variables set FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@credit-visual-app-8b7eb.iam.gserviceaccount.com"
railway variables set JWT_SECRET="your-jwt-secret-key"
railway variables set PORT=3001
```

## 5. 基本APIサーバーコード

### src/server.ts
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

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

// ミドルウェア
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'https://credit-visual-app-8b7eb.firebaseapp.com',
    'https://credit-visual-app-8b7eb.web.app'
  ],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'connected' 
  });
});

// 認証エンドポイント
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { firebaseToken } = req.body;
    
    if (!firebaseToken) {
      return res.status(400).json({ error: 'Firebase token required' });
    }

    // Firebase Token検証
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    
    // ユーザー存在チェック・作成
    let user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid }
    });

    if (!user) {
      // 新規ユーザー作成
      user = await prisma.user.create({
        data: {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email!,
          displayName: decodedToken.name,
          photoUrl: decodedToken.picture,
          planType: 'free',
          gmailConnected: false,
          preferences: {
            notifications: true,
            reminderDays: 3,
            currency: 'JPY'
          }
        }
      });
    }
    
    // 簡単なJWT風レスポンス（後で本格実装）
    res.json({
      token: `mock-jwt-${user.id}`,
      user: {
        uid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoUrl,
        planType: user.planType,
        gmailConnected: user.gmailConnected,
        preferences: user.preferences
      }
    });
    
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// データベース接続テスト
app.get('/api/test-db', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ 
      message: 'Database connected successfully',
      userCount 
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Prisma クリーンアップ
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
```

### package.json スクリプト
```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "prisma generate && tsc",
    "start": "node dist/server.js",
    "deploy": "railway up"
  }
}
```

## 6. Prisma スキーマ設定

### prisma/schema.prisma
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

  transactions   Transaction[]
  subscriptions  Subscription[]

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

model Subscription {
  id              BigInt   @id @default(autoincrement())
  userId          String   @map("user_id") @db.Uuid
  merchantName    String   @map("merchant_name")
  planAmount      Decimal  @db.Decimal(14, 2)
  cycleDays       Int      @default(30) @map("cycle_days")
  nextChargeDate  DateTime? @map("next_charge_date") @db.Date
  isActive        Boolean  @default(true) @map("is_active")
  category        String?
  reasonTags      String[] @default([]) @map("reason_tags")
  firstDetected   DateTime @default(now()) @map("first_detected") @db.Timestamptz
  lastSeen        DateTime @default(now()) @map("last_seen") @db.Timestamptz
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, merchantName])
  @@map("subscriptions")
}
```

## 7. デプロイとテスト

### 7-1. ローカル開発
```bash
# Prismaクライアント生成
npx prisma generate

# 開発サーバー起動
npm run dev
```

### 7-2. Railway デプロイ
```bash
# Railway にデプロイ
railway up

# デプロイ後のURL確認
railway status
```

### 7-3. フロントエンド設定更新
```env
# .env (フロントエンド)
VITE_API_BASE_URL=https://credit-visual-api-production.up.railway.app/api
```

## 8. 動作確認

```bash
# ヘルスチェック
curl https://your-app.up.railway.app/health

# データベース接続テスト
curl https://your-app.up.railway.app/api/test-db
```

---

**Railway の利点:**
- 🚀 簡単デプロイ（コマンド1つ）
- 💰 無料枠あり（月500時間実行）
- 🔧 PostgreSQL自動セットアップ
- 📊 監視・ログ機能内蔵

**所要時間: 約30分**