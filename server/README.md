# Credit Visual Server

クレジットカード取引の店舗分類を行うサーバーサイドAPI

## セットアップ

1. 依存関係のインストール
```bash
npm install
```

2. 環境変数の設定
```bash
cp env.example .env
# .envファイルを編集してANTHROPIC_API_KEYを設定
```

3. サーバーの起動
```bash
# 開発モード
npm run dev

# 本番モード
npm start
```

## API エンドポイント

### POST /api/classify-merchant
店舗名を分類するAPI

**リクエスト:**
```json
{
  "prompt": "分類したいテキスト",
  "systemPrompt": "システムプロンプト"
}
```

**レスポンス:**
```json
{
  "response": "分類結果",
  "model": "使用されたモデル",
  "usage": "使用量情報"
}
```

### GET /health
ヘルスチェック用エンドポイント

## 環境変数

- `ANTHROPIC_API_KEY`: Anthropic APIキー
- `PORT`: サーバーポート（デフォルト: 3001）
- `NODE_ENV`: 環境設定

## セキュリティ

- CORSが有効化されています
- APIキーは環境変数で管理
- エラーハンドリングとログ出力
