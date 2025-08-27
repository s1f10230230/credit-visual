# 🚀 クイックスタート（最小構成）

Firebase設定済み ✅  
次は**Supabase + Vercel**で最速セットアップ！

## 1. Supabase でデータベース作成（5分）

### 1-1. Supabaseアカウント作成
1. https://supabase.com/ → Sign Up
2. GitHubアカウントでログイン推奨

### 1-2. プロジェクト作成
1. 「New Project」
2. Name: `credit-visual-db`
3. Password: 強力なパスワード（メモしておく）
4. Region: `Northeast Asia (Tokyo)`
5. 「Create new project」（1-2分待機）

### 1-3. データベーススキーマ作成
1. 左サイドバー「SQL Editor」
2. 「New query」
3. 以下をコピペして実行：

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

-- インデックス作成
CREATE INDEX idx_transactions_user_time ON transactions(user_id, occurred_at DESC);
CREATE INDEX idx_transactions_user_merchant ON transactions(user_id, merchant_normalized);
```

### 1-4. 接続情報取得
1. 左サイドバー「Settings」→「Database」
2. 「Connection string」の「URI」をコピー
3. パスワード部分を実際のパスワードに置換

例: `postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres`

## 2. APIサーバーコード作成（10分）

### 2-1. 新しいディレクトリ作成
```bash
cd ..  # credit_visual のひとつ上
mkdir credit-visual-api
cd credit-visual-api
```

### 2-2. 初期化とパッケージインストール
```bash
npm init -y
npm install express cors helmet morgan dotenv prisma @prisma/client
npm install firebase-admin jsonwebtoken
npm install --save-dev typescript @types/node @types/express nodemon ts-node
```

### 2-3. TypeScript設定
```bash
npx tsc --init
```

### 2-4. Prisma初期化
```bash
npx prisma init
```

### 2-5. .env ファイル作成
```env
# Supabaseから取得したURL
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres"

# Firebase設定（Admin SDK用）
FIREBASE_PROJECT_ID="credit-visual-app-8b7eb"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC..."
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@credit-visual-app-8b7eb.iam.gserviceaccount.com"

# JWT設定
JWT_SECRET="your-super-secret-jwt-key-here"

# Port
PORT=3001
```

### 2-6. Firebase Admin SDK キー取得
1. Firebase Console → プロジェクト設定 → サービスアカウント
2. 「新しい秘密鍵の生成」→ JSONダウンロード
3. JSONの内容を.envに設定

## 3. 基本的なAPIコード

### src/server.ts
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

dotenv.config();

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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'https://credit-visual-app-8b7eb.firebaseapp.com'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 認証テスト
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { firebaseToken } = req.body;
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    
    // 簡単なレスポンス（後で拡張）
    res.json({
      token: 'mock-jwt-token',
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name,
        photoURL: decodedToken.picture,
        planType: 'free',
        gmailConnected: false,
        preferences: { notifications: true, reminderDays: 3, currency: 'JPY' }
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
```

### package.json のscripts更新
```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

## 4. テスト起動

```bash
# APIサーバー起動
npm run dev

# 別ターミナルでフロントエンド起動
cd ../credit_visual
npm run dev
```

## 5. 動作確認

1. http://localhost:5173 にアクセス
2. 「Googleでログイン」をクリック
3. 認証が通れば成功！

---

**ここまでで基本認証が動作します。**
**データ保存・同期機能は次のフェーズで実装！**

所要時間: 約20分
コスト: 完全無料（Supabase無料枠内）