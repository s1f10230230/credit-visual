# 🚀 デプロイメント & テスト手順

## Phase 1: Vercel デプロイ

### 1. Vercelプロジェクト作成
```bash
# GitHub連携でリポジトリをインポート
# Framework: Vite
# Build Command: npm run build  
# Output Directory: dist
```

### 2. 環境変数設定（Vercel Dashboard）
```
Project Settings > Environment Variables

VITE_GOOGLE_CLIENT_ID = [Google Cloud Consoleから取得]
VITE_API_BASE_URL = [バックエンドURL or 空]
VITE_APP_ENV = production
```

### 3. デプロイ確認
- https://credit-visual-xxx.vercel.app でアクセス確認
- モバイルレスポンシブ動作確認
- 基本機能（サンプルデータ表示）確認

## Phase 2: Google OAuth 設定

### 1. Google Cloud Console設定

#### OAuth同意画面
```
User Type: External
App name: Credit Visual (Test)
User support email: [あなたのメール]
Developer contact: [あなたのメール]
Scopes: 
  - openid
  - email  
  - profile
  - https://www.googleapis.com/auth/gmail.readonly
```

#### テストユーザー追加
```
OAuth consent screen > Test users > ADD USERS
- [友達のGmailアドレス1]
- [友達のGmailアドレス2]
- [テスト用アカウント]
```

#### OAuth クライアントID作成
```
Credentials > CREATE CREDENTIALS > OAuth client ID
Application type: Web application
Name: Credit Visual Web Client

Authorized redirect URIs:
- https://credit-visual-xxx.vercel.app
- https://credit-visual-xxx.vercel.app/auth/callback
- http://localhost:3000 (開発用)
- http://localhost:3001
- http://localhost:3002 
- http://localhost:3003
```

### 2. セキュリティ設定確認
- ✅ gmail.readonly スコープのみ
- ✅ メール本文の永続保存なし
- ✅ 暗号化された一時保存のみ
- ✅ データ削除機能実装

## Phase 3: 友達向けテスト手順

### テストユーザーへの案内

**📱 Credit Visual - モバイルテスト**

こんにちは！スマホアプリのUIテストをお願いします 🙏

**テストURL**: https://credit-visual-xxx.vercel.app

**手順**:
1. **スマホでアクセス** (Chrome/Safari推奨)
2. **Gmail連携ボタン**をタップ
3. **Googleアカウント**でログイン（あなたのGmailアカウント）
4. **権限許可**（メール読み取りのみ - 安全です）
5. **UI操作**を自由に試してください

**確認してほしいポイント**:
- 📱 画面サイズに最適化されているか
- 👆 ボタンは押しやすいか  
- 💳 取引データは正しく表示されるか
- 🔄 スワイプ操作で画面切り替えできるか
- ⚡ 動作はスムーズか

**注意事項**:
- テストモードなので一部機能制限あり
- データは暗号化保存（テスト後削除可）
- 不具合があれば気軽に教えてください！

**テスト時間**: 10-15分程度

## Phase 4: データ収集 & フィードバック

### チェック項目

#### UI/UX
- [ ] モバイル表示の見やすさ
- [ ] タッチ操作の反応性
- [ ] ナビゲーションの直感性
- [ ] 情報密度の適切さ

#### 機能動作
- [ ] Gmail認証の成功率
- [ ] 取引データの抽出精度
- [ ] カテゴリ分類の正確性
- [ ] カード別集計の機能

#### パフォーマンス  
- [ ] 読み込み速度
- [ ] 操作レスポンス
- [ ] メモリ使用量（ブラウザが重くならない）

#### 対応端末
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] タブレット
- [ ] 各種画面サイズ

### フィードバック収集方法

**Googleフォーム**: [作成して追加]

**質問項目**:
1. 使いやすさ (1-5点)
2. デザインの印象
3. 改善してほしい点
4. 追加してほしい機能
5. 総合評価

## Phase 5: セキュリティチェック

### 必須確認項目
- [ ] HTTPSでの通信
- [ ] トークンの適切な管理
- [ ] 最小権限でのAPI呼び出し
- [ ] ユーザーデータの暗号化
- [ ] データ削除機能の動作

### コンプライアンス
- [ ] プライバシーポリシー表示
- [ ] データ利用に関する同意
- [ ] 第三者共有なし
- [ ] 日本の個人情報保護法準拠

## 🎯 成功基準

**UI/UX**: 8割以上のユーザーが「使いやすい」と評価
**機能**: Gmail連携成功率 90%以上  
**パフォーマンス**: 3秒以内の初期読み込み
**セキュリティ**: ゼロインシデント

---

**次のステップ**: フィードバック収集 → UI改善 → 本格リリース準備