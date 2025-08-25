# Firebase セットアップ手順

## 1. Firebase プロジェクト作成

### 1-1. Firebaseコンソールにアクセス
1. https://console.firebase.google.com/ にアクセス
2. Googleアカウントでログイン

### 1-2. 新しいプロジェクトを作成
1. 「プロジェクトを作成」をクリック
2. プロジェクト名: `credit-visual-app` (または好きな名前)
3. Google Analytics: 「有効にする」を選択（推奨）
4. Analyticsの場所: 日本
5. 「プロジェクトを作成」をクリック

### 1-3. Webアプリを追加
1. プロジェクト概要で「Web」アイコン（</>`）をクリック
2. アプリのニックネーム: `credit-visual-web`
3. Firebase Hosting: 「設定する」にチェック（推奨）
4. 「アプリを登録」をクリック

### 1-4. 設定値をコピー
Firebase SDK の設定オブジェクトが表示されるので、以下をメモ：

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## 2. Authentication 設定

### 2-1. Authentication を有効化
1. 左サイドバーの「Authentication」をクリック
2. 「始める」をクリック

### 2-2. ログイン方法を設定
1. 「Sign-in method」タブをクリック
2. 「Google」を選択
3. 「有効にする」をオンに
4. プロジェクトサポートメール: あなたのGmailアドレス
5. 「保存」をクリック

### 2-3. 承認済みドメイン設定
1. 「Settings」タブ → 「承認済みドメイン」
2. 以下を追加：
   - `localhost` （開発用）
   - あなたのドメイン（本番用）

## 3. Firestore Database 設定

### 3-1. Firestore を作成
1. 左サイドバーの「Firestore Database」をクリック
2. 「データベースの作成」をクリック
3. セキュリティルール: 「テストモードで開始」を選択（後で変更）
4. ロケーション: `asia-northeast1 (東京)` を選択
5. 「有効にする」をクリック

### 3-2. インデックスを作成（重要）
「インデックス」タブで以下を作成：

#### transactions コレクション用
```
コレクション: transactions
フィールド: userId (昇順), occurredAt (降順)
```

#### subscriptions コレクション用  
```
コレクション: subscriptions
フィールド: userId (昇順), isActive (昇順), planAmount (降順)
```

### 3-3. セキュリティルール設定
「ルール」タブで以下のルールを設定：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のデータのみアクセス可能
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    match /subscriptions/{subscriptionId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    match /userLabels/{labelId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    match /monthlyAggregates/{aggregateId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    match /syncStatus/{userId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
    
    // 管理者のみアクセス可能
    match /merchantDictionary/{docId} {
      allow read: if true;  // 全ユーザー読み取り可能
      allow write: if false;  // 管理者のみ（Functionsで更新）
    }
  }
}
```

## 4. 環境変数の設定

プロジェクトルートの `.env` ファイルを更新：

```env
# Firebase Configuration（ステップ1-4でコピーした値）
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com  
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## 5. Gmail API 設定（既存の更新）

### 5-1. Google Cloud Console でスコープ追加
1. https://console.cloud.google.com/ 
2. Firebase プロジェクトを選択
3. 「APIs & Services」→「OAuth consent screen」
4. 「Scopes」で以下を追加：
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/userinfo.email` 
   - `https://www.googleapis.com/auth/userinfo.profile`

### 5-2. 承認済みJavaScriptオリジンを更新
1. 「認証情報」→「OAuth 2.0 クライアント ID」を選択  
2. 「承認済みJavaScriptオリジン」に以下を追加：
   - `http://localhost:5173` （Vite開発サーバー）
   - `https://your-project.firebaseapp.com` （Firebase Hosting）

## 6. テスト手順

### 6-1. アプリを起動
```bash
npm run dev
```

### 6-2. 動作確認
1. http://localhost:5173 にアクセス
2. 「Googleでログイン」をクリック
3. Gmail連携を許可
4. ダッシュボードが表示されることを確認
5. Firebaseコンソールで以下を確認：
   - Authentication に新しいユーザーが追加
   - Firestore に users コレクションが作成

## 7. デプロイ（オプション）

### 7-1. Firebase CLI インストール
```bash
npm install -g firebase-tools
firebase login
```

### 7-2. Firebase Hosting 設定
```bash
firebase init hosting
# プロジェクト選択: 作成したFirebaseプロジェクト
# public directory: dist
# single-page app: Yes
# GitHub Actions: No（後で設定可能）
```

### 7-3. デプロイ
```bash
npm run build
firebase deploy
```

## トラブルシューティング

### よくあるエラー

1. **"Firebase: Error (auth/unauthorized-domain)"**
   - Firebase Console で承認済みドメインに localhost を追加

2. **"Missing or insufficient permissions"**  
   - Firestore セキュリティルールを確認
   - ユーザーがログインしているか確認

3. **"Gmail API quota exceeded"**
   - Google Cloud Console でクォータ制限を確認
   - API キーの制限設定を確認

### 開発用の一時的な設定

テスト中はセキュリティルールを一時的に緩くできます：

```javascript
// 開発用（本番では絶対に使わないこと）
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

この手順でFirebase環境が完全にセットアップされ、フリーミアム型サブスク管理アプリが動作可能になります！