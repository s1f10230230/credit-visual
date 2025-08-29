// Test Olive setup mail misclassification issue
import { classifyMailFlexibly } from './lib/flexibleMailFilter';
import { extractTxnFromUsageMail } from './parsers/creditMail';

// Real Olive setup notification email
const oliveSetupEmail = {
  subject: '【重要】Oliveフレキシブルペイ クレジットモードの設定手続きとご契約内容のご案内',
  from: 'mail@contact.vpass.ne.jp',
  body: `Ｏｌｉｖｅ／クレジット会員 様

※本メールは2025年8月20日時点、Oliveフレキシブルペイ クレジットモードの設定手続きが完了していない方へお送りしております。なお、本メールは重要なお知らせのため、メール配信を「受け取らない」に設定されている方にも送信しております。

平素よりOliveフレキシブルペイをご愛顧いただき、誠にありがとうございます。
「Oliveフレキシブルペイ クレジットモード」のご利用には、「三井住友銀行アプリ」からの設定手続きが必要となりますので、以下の内容に沿ってお手続きをお願いします。
また、「Oliveフレキシブルペイ クレジットモード」ご入会時のご契約内容をご案内いたしますので、ご確認いただきますようお願いいたします。
※最新のご契約内容についてはVpassアプリおよび会員規約をご確認ください。

【設定手続方法】
以下のリンクより、設定手続きをお願いいたします。
https://www.smbc-card.com/wapp/for_smbcapp/examination.html
※カードをお申し込みした端末からのみアクセスが可能です。

【リンクが開けない、お手続きにお困りの場合】
1．リンクが開けない場合は、「三井住友銀行アプリ」を起動してください。
※クレジットモードのお申し込みから一定期間を経過している場合、「三井住友銀行アプリ」からの設定手続きができない場合がございます。
2．お手続きにお困りの場合は、以下のリンクより設定手続き方法をご確認ください。
https://www.smbc-card.com/olive_flexible_pay/feature/credit_mode_setup.jsp

【ご留意点】
今回お手続きをしていただけない場合、一定期間経過後、弊社にてクレジットモードを解約させていただく場合がございますので、あらかじめご了承ください。

●分割払いのお支払い例
◆利用金額50,000円、10回払いで分割払いをご利用された場合
（1）分割払い手数料…50,000円×（8.20円÷100円）＝4,100円
（2）支払総額…50,000円＋4,100円＝54,100円
（3）分割支払い額…54,100円÷10回＝5,410円

■リボ払いの内容
●手数料率：実質年率15.000％

●ご利用方法：マイ・ペイすリボをお申し込みの場合`
};

console.log('=== 🔍 Olive設定案内メール誤認識テスト ===\n');

console.log('1. Flexible Filter テスト:');
const flexibleResult = classifyMailFlexibly({
  id: 'test-olive-setup',
  from: oliveSetupEmail.from,
  subject: oliveSetupEmail.subject
}, {
  plain: oliveSetupEmail.body
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
const legacyResult = extractTxnFromUsageMail(oliveSetupEmail);

if (legacyResult) {
  console.log('✅ Transaction extracted');
  console.log('Amount:', legacyResult.amount);
  console.log('Date:', legacyResult.date);
  console.log('Merchant:', legacyResult.merchant);
  console.log('Source Card:', legacyResult.sourceCard);
} else {
  console.log('❌ No transaction extracted (正常)');
}

console.log('\n=== 📊 問題分析 ===');
console.log('このメールは「設定案内」であり、実際の利用通知ではありません。');
console.log('50,000円は分割払いの【例示】であり、実際の取引ではありません。');
console.log('期待結果: このメールは除外されるべき（取引として認識すべきでない）');

console.log('\n=== 🔍 詳細解析 ===');
console.log('件名キーワード:', oliveSetupEmail.subject.includes('設定手続き') ? '「設定手続き」含む' : '設定関連なし');
console.log('本文キーワード:', oliveSetupEmail.body.includes('お支払い例') ? '「お支払い例」含む' : '例示なし');
console.log('金額文脈:', oliveSetupEmail.body.includes('利用金額50,000円') ? '例示文脈で50,000円' : '実利用金額');