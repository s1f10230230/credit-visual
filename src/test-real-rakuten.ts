// Test actual Rakuten Card email
import { classifyMailFlexibly } from './lib/flexibleMailFilter';
import { extractTxnFromUsageMail } from './parsers/creditMail';

// Real Rakuten Card email
const realRakutenEmail = {
  subject: 'カード利用お知らせメール',
  from: 'rakuten-card@rakuten-card.co.jp',
  body: `カード利用お知らせメール
━━━━━━━━━━

楽天カード(Visa)をご利用いただき誠にありがとうございます。
楽天カードご利用内容をお知らせいたします。

<カードご利用情報>
《ショッピングご利用分》
■利用日: 2025/08/16
■利用先: APPLE COM BILL
■利用者: 本人
■支払方法: 1回
■利用金額: 3,300 円
■支払月: 2025/09`
};

console.log('=== 🃏 楽天カード実メールテスト ===\n');

console.log('1. Flexible Filter テスト:');
const flexibleResult = classifyMailFlexibly({
  id: 'test-real-rakuten',
  from: realRakutenEmail.from,
  subject: realRakutenEmail.subject
}, {
  plain: realRakutenEmail.body
});

console.log('結果:', {
  ok: flexibleResult.ok,
  trustLevel: flexibleResult.trustLevel,
  amount: flexibleResult.extractedData.amount,
  date: flexibleResult.extractedData.date,
  merchant: flexibleResult.extractedData.merchant,
  confidence: flexibleResult.confidence,
  reasons: flexibleResult.reasons
});

console.log('\n2. Legacy creditMail.ts テスト:');
const legacyResult = extractTxnFromUsageMail(realRakutenEmail);

if (legacyResult) {
  console.log('✅ Transaction extracted successfully');
  console.log('Amount:', legacyResult.amount);
  console.log('Date:', legacyResult.date);
  console.log('Merchant:', legacyResult.merchant);
  console.log('Source Card:', legacyResult.sourceCard);
  console.log('Source:', legacyResult.source);
  console.log('Notes:', legacyResult.notes);
} else {
  console.log('❌ No transaction extracted');
}

console.log('\n=== 📊 期待結果との比較 ===');
console.log('期待値:');
console.log('- Amount: 3,300円');
console.log('- Date: 2025-08-16');
console.log('- Merchant: APPLE COM BILL');
console.log('- Source Card: RAKUTEN/楽天');
console.log('- Trust Level: high (公式ドメイン)');
console.log('- Confidence: 高スコア (全要素揃い)');