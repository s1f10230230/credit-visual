# 🚀 Vercel セットアップ手順

## Step 1: Vercel アカウント作成・連携

### 1. Vercelアクセス
```
https://vercel.com
→ "Start Deploying" → GitHub連携
```

### 2. リポジトリインポート
```
New Project → Import Git Repository
→ https://github.com/s1f10230230/credit-visual
→ Import
```

### 3. プロジェクト設定
```
Framework Preset: Vite
Root Directory: ./
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

## Step 2: 環境変数設定

### Vercel Dashboard → Project Settings → Environment Variables

```bash
# 必須設定
VITE_GOOGLE_CLIENT_ID = "your-client-id.apps.googleusercontent.com"

# 任意設定（今は空でOK）
VITE_API_BASE_URL = ""
VITE_VAPID_PUBLIC_KEY = ""
```

## Step 3: デプロイ確認

### デプロイ開始
```
Deploy → プロジェクト作成と同時にデプロイ開始
約2-3分で完了
```

### URL確認
```
https://credit-visual-[random].vercel.app
```

### 動作テスト
- [ ] ページが正常に表示される
- [ ] モバイル表示が適切
- [ ] サンプルデータが表示される

## Step 4: カスタムドメイン設定（任意）

### Vercel Dashboard → Domains
```
Add Domain → credit-visual.vercel.app
または独自ドメイン設定
```

## Step 5: Google OAuth 設定

### Google Cloud Console
```
https://console.cloud.google.com/
→ プロジェクト作成: "Credit Visual Test"
```

### OAuth 同意画面設定
```
APIs & Services → OAuth consent screen

User Type: External
App name: Credit Visual (Test)
User support email: [your-email]
Scopes: 
  - openid
  - email
  - profile  
  - https://www.googleapis.com/auth/gmail.readonly
```

### テストユーザー追加
```
Test users → ADD USERS
友達のGmailアドレスを追加:
- friend1@gmail.com
- friend2@gmail.com
```

### OAuth クライアントID作成
```
Credentials → CREATE CREDENTIALS → OAuth client ID
Application type: Web application

Authorized redirect URIs:
- https://credit-visual-[your-hash].vercel.app
- https://credit-visual-[your-hash].vercel.app/auth/callback
- http://localhost:3000
- http://localhost:3001  
- http://localhost:3002
- http://localhost:3003
```

### クライアントIDを環境変数に設定
```
Vercel Dashboard → Environment Variables
VITE_GOOGLE_CLIENT_ID = "[取得したクライアントID]"

→ Redeploy（環境変数反映）
```

## Step 6: 最終動作確認

### セキュリティテスト
- [ ] HTTPS通信確認
- [ ] OAuth フロー動作確認
- [ ] データ暗号化確認

### 機能テスト  
- [ ] Gmail認証
- [ ] メール取得
- [ ] データ表示
- [ ] UI操作

### パフォーマンステスト
- [ ] 初期読み込み速度
- [ ] モバイル動作
- [ ] レスポンシブ対応

## 完了 🎉

**ステージングURL**: https://credit-visual-[hash].vercel.app

**次**: 友達にテストURL共有 → フィードバック収集

---

## トラブルシューティング

### ビルドエラー
```bash
# ローカルで事前確認
npm run build
npm run preview
```

### OAuth エラー
```
- リダイレクトURIの完全一致確認
- スコープ設定確認  
- テストユーザー追加確認
```

### 環境変数エラー
```
- VITE_ プレフィックス確認
- 値の前後空白除去
- Redeploy実行
```