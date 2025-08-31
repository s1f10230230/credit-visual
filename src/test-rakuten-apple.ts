/**
 * 楽天カード Apple決済 抽出テスト
 * 
 * 問題: APPLE COM BILL が抽出されない
 * 修正: ■利用先: 形式の専用パターン追加
 */

import { parseCreditNotification } from './parsers/creditMail';

// 実際の楽天カード Apple決済メール
const rakutenAppleEmail = {
  subject: 'カードご利用のお知らせ',
  from: 'info@mail.rakuten-card.co.jp',
  rawEmailBody: `━━━━━━━━━━
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

console.log('🍎 === 楽天カード Apple決済テスト ===\n');

const result = parseCreditNotification(rakutenAppleEmail);

if (result) {
  console.log('✅ 抽出成功!');
  console.log(`金額: ${result.amount}円`);
  console.log(`店舗: ${result.merchant}`);
  console.log(`日付: ${result.date}`);
  console.log(`発行元: ${result.sourceCard || 'Unknown'}`);
} else {
  console.log('❌ 抽出失敗 - 楽天カード Apple決済が正しく認識されませんでした');
}

console.log('\n=== 期待結果 ===');
console.log('金額: 3300円');
console.log('店舗: APPLE COM BILL');
console.log('日付: 2025-07-29');
console.log('発行元: Rakuten Card');

// 他の楽天カードパターンも確認
const rakutenNormalEmail = {
  subject: 'カードご利用のお知らせ',
  from: 'info@mail.rakuten-card.co.jp',
  rawEmailBody: `楽天カードご利用内容をお知らせいたします。

2025/08/15    セブン-イレブン 東京駅前    1,200円
2025/08/14    Amazon.co.jp               2,500円`
};

console.log('\n🏪 === 楽天カード 通常パターン ===');
const normalResult = parseCreditNotification(rakutenNormalEmail);

if (normalResult) {
  console.log('✅ 通常パターンも動作OK');
  console.log(`店舗: ${normalResult.merchant}, 金額: ${normalResult.amount}円`);
} else {
  console.log('❌ 通常パターンに影響あり - 要確認');
}

export { rakutenAppleEmail, rakutenNormalEmail };