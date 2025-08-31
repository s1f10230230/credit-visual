/**
 * 楽天カード Apple決済 ライブテスト
 */

import { extractTxnFromUsageMail } from './parsers/creditMail';

// 実際のメール例
const emailData = {
  subject: 'カードご利用のお知らせ',
  from: 'info@mail.rakuten-card.co.jp',
  body: `━━━━━━━━━━
カード利用お知らせメール
━━━━━━━━━━

楽天カード(Visa)をご利用いただき誠にありがとうございます。
楽天カードご利用内容をお知らせいたします。

<カードご利用情報>
《ショッピングご利用分》
■利用日: 2025/07/29
■利用先: APPLE COM BILL
■利用者: 本人
■支払方法: 1回
■利用金額: 3,300 円
■支払月: 2025/08

ご利用ありがとうございました。`
};

console.log('🍎 === 楽天カード Apple決済 ライブテスト ===\n');

const result = extractTxnFromUsageMail(emailData);

console.log('📧 Input Email:');
console.log('From:', emailData.from);
console.log('Subject:', emailData.subject);
console.log('Body preview:', emailData.body.substring(0, 200) + '...');

console.log('\n🎯 Parsing Result:');
if (result) {
  console.log('✅ SUCCESS!');
  console.log('Amount:', result.amount, '円');
  console.log('Merchant:', result.merchant);
  console.log('Date:', result.date);
  console.log('Source Card:', result.sourceCard);
  console.log('Notes:', result.notes);
} else {
  console.log('❌ FAILED - No transaction extracted');
}

console.log('\n📝 Expected:');
console.log('Amount: 3300円');
console.log('Merchant: APPLE COM BILL');
console.log('Date: 2025-07-29');

// パターンの直接テスト
console.log('\n🧪 Direct Pattern Test:');
const body = emailData.body;

// 金額パターン
const amountRegex = /■利用金額[:：]\s*([0-9,，]+)\s*円/i;
const amountMatch = body.match(amountRegex);
console.log('Amount pattern match:', amountMatch);

// 店舗パターン
const merchantRegex = /■利用先[:：]\s*([A-Z0-9\s]+)/i;
const merchantMatch = body.match(merchantRegex);
console.log('Merchant pattern match:', merchantMatch);

// 日付パターン
const dateRegex = /■利用日[:：]\s*([0-9]+)\/([0-9]+)\/([0-9]+)/i;
const dateMatch = body.match(dateRegex);
console.log('Date pattern match:', dateMatch);

// グローバル関数として公開
if (typeof window !== 'undefined') {
  (window as any).testRakutenApple = () => {
    console.log('🍎 Testing Rakuten Apple extraction...');
    return extractTxnFromUsageMail(emailData);
  };
}