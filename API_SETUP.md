# 🔧 API サーバー作成手順（Supabase + Node.js）

Supabaseが完了しているので、Node.js API サーバーを作成します。

## 1. プロジェクト初期化

### 1-1. 新しいディレクトリ作成
```bash
# プロジェクトルートのひとつ上に移動
cd ..
mkdir credit-visual-api
cd credit-visual-api
```

### 1-2. package.json初期化
```bash
npm init -y
```

### 1-3. 必要パッケージインストール
```bash
# 基本的なサーバーパッケージ
npm install express cors helmet morgan dotenv

# Prisma（PostgreSQLクライアント）
npm install @prisma/client prisma

# Firebase Admin SDK
npm install firebase-admin

# JWT認証
npm install jsonwebtoken

# 開発依存関係
npm install --save-dev @types/node @types/express @types/cors @types/jsonwebtoken
npm install --save-dev nodemon typescript ts-node
```

## 2. TypeScript設定

### 2-1. tsconfig.json作成
```bash
npx tsc --init
```

### 2-2. tsconfig.json を以下に更新:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 3. Prisma設定

### 3-1. Prisma初期化
```bash
npx prisma init
```

### 3-2. prisma/schema.prisma を更新
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

model UserLabel {
  id             BigInt   @id @default(autoincrement())
  userId         String   @map("user_id") @db.Uuid
  merchantName   String   @map("merchant_name")
  isSubscription Boolean? @map("is_subscription")
  isHidden       Boolean  @default(false) @map("is_hidden")
  isKeepAlways   Boolean  @default(false) @map("is_keep_always")
  reason         String?
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, merchantName])
  @@map("user_labels")
}

model MonthlyAggregate {
  userId            String   @map("user_id") @db.Uuid
  yearMonth         DateTime @map("year_month") @db.Date
  totalAmount       Decimal  @default(0) @db.Decimal(14, 2) @map("total_amount")
  subscriptionAmount Decimal  @default(0) @db.Decimal(14, 2) @map("subscription_amount")
  subscriptionCount Int      @default(0) @map("subscription_count")
  transactionCount  Int      @default(0) @map("transaction_count")
  topCategories     Json     @default("[]") @map("top_categories")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, yearMonth])
  @@map("monthly_aggregates")
}

model SyncStatus {
  userId                  String   @id @map("user_id") @db.Uuid
  lastSyncAt              DateTime @default(now()) @map("last_sync_at") @db.Timestamptz
  lastMessageId           String?  @map("last_message_id")
  totalTransactions       Int      @default(0) @map("total_transactions")
  syncPeriodMonths        Int      @default(3) @map("sync_period_months")
  isInitialSyncComplete   Boolean  @default(false) @map("is_initial_sync_complete")
  errors                  Json     @default("[]")
  updatedAt               DateTime @updatedAt @map("updated_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sync_status")
}
```

## 4. 環境変数設定

### 4-1. .env ファイル作成
```env
# Supabase PostgreSQL接続
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres"

# Firebase Admin SDK設定
FIREBASE_PROJECT_ID="credit-visual-app-8b7eb"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@credit-visual-app-8b7eb.iam.gserviceaccount.com"

# JWT設定
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# サーバー設定
PORT=3001
NODE_ENV=development

# CORS設定
FRONTEND_URL="http://localhost:5173"
FRONTEND_PROD_URL="https://credit-visual-app-8b7eb.firebaseapp.com"
```

### 4-2. Firebase Admin SDK キー取得
1. Firebase Console → プロジェクト設定 ⚙️
2. 「サービス アカウント」タブ
3. 「新しい秘密鍵の生成」→ JSONダウンロード
4. JSONの内容を .env に設定:
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

## 5. ディレクトリ構造作成
```bash
mkdir src
mkdir src/routes
mkdir src/middleware 
mkdir src/services
mkdir src/types
```

## 6. 基本APIサーバーコード

### src/server.ts
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';

// 環境変数読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

// ミドルウェア
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.FRONTEND_PROD_URL || 'https://credit-visual-app-8b7eb.firebaseapp.com'
  ],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());

// ルーティング
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// データベース接続テスト
app.get('/api/test-db', async (req, res) => {
  try {
    await prisma.$connect();
    const userCount = await prisma.user.count();
    res.json({ 
      message: 'Database connected successfully',
      userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// グレースフルシャットダウン
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Database test: http://localhost:${PORT}/api/test-db`);
});
```

## 7. package.json スクリプト設定

### package.json の "scripts" セクションを更新:
```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "prisma generate && tsc",
    "start": "node dist/server.js",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  }
}
```

## 8. Prismaクライアント生成とテスト

```bash
# Prismaクライアント生成
npx prisma generate

# データベーススキーマをSupabaseにプッシュ
npx prisma db push

# 開発サーバー起動
npm run dev
```

## 9. 動作確認

### 9-1. ヘルスチェック
```bash
curl http://localhost:3001/health
```

### 9-2. データベース接続テスト
```bash
curl http://localhost:3001/api/test-db
```

成功すれば以下のような出力:
```json
{
  "message": "Database connected successfully",
  "userCount": 0,
  "timestamp": "2025-01-XX..."
}
```

---

**次のステップ**: Firebase認証エンドポイントとトランザクション管理の実装

所要時間: 約15分