/**
 * ブラウザコンソール用ガードテスト
 * 
 * 使い方:
 * 1. http://localhost:3004/?skipauth=true にアクセス
 * 2. ブラウザコンソールを開く
 * 3. window.testGuard() を実行
 */

import { isNonTransactionalAnnouncement, analyzeNonTransactional } from './guards/nonTransactionalDetector';

// ブラウザでテスト実行用
export function runGuardTest() {
  console.log('🧪 === nonTransactionalDetector テスト開始 ===');

  // Olive案内メール（除外対象）
  const oliveExample = {
    from: 'mail@contact.vpass.ne.jp',
    subject: '【重要】Oliveフレキシブルペイ クレジットモードの設定手続きとご契約内容のご案内',
    text: 'Oliveフレキシブルペイ クレジットモードについてご案内いたします。お支払い例として、ご利用金額50,000円の場合、月々のお支払い金額は以下のようになります。'
  };

  console.log('\n🔍 Olive案内メール:');
  console.log('判定結果:', isNonTransactionalAnnouncement(oliveExample));
  console.log('詳細:', analyzeNonTransactional(oliveExample));

  // SMBC利用通知（保持対象）
  const smbcTransaction = {
    from: 'notice@smbc-card.com',
    subject: 'ご利用のお知らせ【三井住友カード】',
    text: 'カードご利用のお知らせ　ご利用金額：785円　ご利用店舗：セブンイレブン'
  };

  console.log('\n🔍 SMBC利用通知:');
  console.log('判定結果:', isNonTransactionalAnnouncement(smbcTransaction));
  console.log('詳細:', analyzeNonTransactional(smbcTransaction));

  // 楽天カード利用通知（保持対象）
  const rakutenTransaction = {
    from: 'info@mail.rakuten-card.co.jp',
    subject: 'カードご利用のお知らせ',
    text: '楽天カードご利用のお知らせ　ご利用金額：3,300円　ご利用店舗：Apple（代行決済）'
  };

  console.log('\n🔍 楽天カード利用通知:');
  console.log('判定結果:', isNonTransactionalAnnouncement(rakutenTransaction));
  console.log('詳細:', analyzeNonTransactional(rakutenTransaction));

  console.log('\n✅ === テスト完了 ===');
  console.log('期待結果: Olive案内=true（除外）, SMBC・楽天=false（保持）');

  return {
    olive: isNonTransactionalAnnouncement(oliveExample),
    smbc: isNonTransactionalAnnouncement(smbcTransaction),
    rakuten: isNonTransactionalAnnouncement(rakutenTransaction)
  };
}

// グローバルに公開
if (typeof window !== 'undefined') {
  (window as any).testGuard = runGuardTest;
}