// Test card issuer detection in Uber email
import { extractTxnFromUsageMail } from './parsers/creditMail';

// Real Uber Eats email with JCB card mentioned
const realUberWithJCB = {
  subject: '日曜日 午後の Uber Eats のご注文',
  from: 'noreply@uber.com',
  body: `合計 ￥915
2025年8月3日


範 様、Uber One をご利用いただきありがとうございます。
EFEKEBAB 池袋店の領収書をお受け取りください。
注文を評価


合計    ￥915
この注文は、Uber One利用により ￥1,330 お得になりました

利用明細を確認するには次へ移動 Uber Eats , または この PDF をダウンロードしてください

お支払い     

JCB ••••1234
2025/08/03 16:05
￥915
注文情報のページにアクセスして、請求書 (利用可能な場合) などの詳細をご覧いただけます。
Uber One とプロモーションのご案内`
};

console.log('=== 🎯 カード発行会社検出テスト ===\n');

console.log('Real Uber + JCB テスト:');
const result = extractTxnFromUsageMail(realUberWithJCB);

if (result) {
  console.log('✅ Transaction extracted successfully');
  console.log('Amount:', result.amount);
  console.log('Date:', result.date);
  console.log('Merchant:', result.merchant);
  console.log('Source Card:', result.sourceCard);
  console.log('Source:', result.source);
  console.log('Notes:', result.notes);
} else {
  console.log('❌ No transaction extracted');
}

console.log('\n=== 期待結果 ===');
console.log('Amount: 915円（複数候補から「合計」近傍を選択）');
console.log('Date: 2025-08-03（年月日検出）');
console.log('Source Card: JCB（本文中のJCB ••••1234から検出）');
console.log('Merchant: 店舗名検出（EFEKEBAB 池袋店など）');