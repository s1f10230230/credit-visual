/**
 * nonTransactionalDetector.ts のテスト
 * 
 * 実行: npm run dev 後にブラウザのコンソールで確認
 * または: npx ts-node src/test-nonTransactionalDetector.ts
 */

import { isNonTransactionalAnnouncement, analyzeNonTransactional } from './guards/nonTransactionalDetector';

console.log('🧪 === nonTransactionalDetector テスト開始 ===');

// テストケース1: Olive案内メール（除外対象）
const oliveExample = {
  from: 'mail@contact.vpass.ne.jp',
  subject: '【重要】Oliveフレキシブルペイ クレジットモードの設定手続きとご契約内容のご案内',
  text: `
    Oliveフレキシブルペイ クレジットモードについてご案内いたします。
    
    お支払い例として、ご利用金額50,000円の場合、
    月々のお支払い金額は以下のようになります。
    
    ・リボ払い: 10,000円
    ・分割払い: 8,500円
    
    詳しくは契約内容をご確認ください。
  `
};

console.log('\n🔍 Olive案内メールテスト:');
console.log('判定結果:', isNonTransactionalAnnouncement(oliveExample)); // true期待
console.log('詳細分析:', analyzeNonTransactional(oliveExample));

// テストケース2: 通常のSMBC利用通知（除外しない）
const smbcTransaction = {
  from: 'notice@smbc-card.com',
  subject: 'ご利用のお知らせ【三井住友カード】',
  text: `
    カードご利用のお知らせ
    
    ご利用金額：785円
    ご利用店舗：セブンイレブン 東京駅前店
    ご利用日時：2024/12/28 14:30
  `
};

console.log('\n🔍 通常のSMBC利用通知テスト:');
console.log('判定結果:', isNonTransactionalAnnouncement(smbcTransaction)); // false期待
console.log('詳細分析:', analyzeNonTransactional(smbcTransaction));

// テストケース3: 楽天カード利用通知（除外しない）
const rakutenTransaction = {
  from: 'info@mail.rakuten-card.co.jp',
  subject: 'カードご利用のお知らせ',
  text: `
    楽天カードご利用のお知らせ
    
    ご利用金額：3,300円
    ご利用店舗：Apple（代行決済）
    ご利用日：12/28
  `
};

console.log('\n🔍 楽天カード利用通知テスト:');
console.log('判定結果:', isNonTransactionalAnnouncement(rakutenTransaction)); // false期待
console.log('詳細分析:', analyzeNonTransactional(rakutenTransaction));

// テストケース4: SMBC案内メール（例示金額あり - 除外対象）
const smbcAnnouncement = {
  from: 'info@vpass.ne.jp',
  subject: '重要なお知らせ - 新サービスのご案内',
  text: `
    新しいサービスについてご案内いたします。
    
    ご利用例：月額1,500円でご利用いただけます。
    シミュレーション結果として、年間18,000円の
    お支払いとなります。
    
    詳細は契約内容をご確認ください。
  `
};

console.log('\n🔍 SMBC案内メール（例示金額）テスト:');
console.log('判定結果:', isNonTransactionalAnnouncement(smbcAnnouncement)); // true期待
console.log('詳細分析:', analyzeNonTransactional(smbcAnnouncement));

// テストケース5: 無関係な送信元（除外しない）
const unrelatedMail = {
  from: 'amazon@amazon.co.jp',
  subject: '重要なお知らせ - 配送について',
  text: `
    お支払い例として2,000円が必要です。
    契約内容についてご案内します。
  `
};

console.log('\n🔍 無関係な送信元テスト:');
console.log('判定結果:', isNonTransactionalAnnouncement(unrelatedMail)); // false期待
console.log('詳細分析:', analyzeNonTransactional(unrelatedMail));

console.log('\n✅ === テスト完了 ===');
console.log('期待結果:');
console.log('- Olive案内: true （除外）');
console.log('- SMBC利用通知: false （保持）');
console.log('- 楽天利用通知: false （保持）');
console.log('- SMBC案内: true （除外）');
console.log('- 無関係送信元: false （保持）');

// ブラウザ用エクスポート
if (typeof window !== 'undefined') {
  (window as any).testNonTransactionalDetector = () => {
    console.log('🧪 ブラウザでのテスト実行');
    // 上記のテストを再実行
  };
}