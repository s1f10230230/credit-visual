// Test new flexible email filter with real data
import { classifyMailFlexibly } from './lib/flexibleMailFilter';

// 楽天カードの実メール
const rakutenEmail = {
  id: 'test-1',
  subject: 'カード利用のお知らせ(本人ご利用分)',
  from: 'rakuten-card@rakuten-card.co.jp', 
  body: {
    plain: `いつも楽天カードをご利用いただきありがとうございます。
楽天カードご利用内容をお知らせいたします。

楽天カード（Visa）ご利用内容


ショッピングご利用分


ご利用日    ご利用先    ご利用金額

 
2025/08/17    ﾓﾊﾞｲﾙﾊﾟｽﾓﾁﾔ-ｼﾞ    1,000円｜ 支払月：2025/09 ｜ 利用者：本人
 

合計　1,000 円


0 円
支払方法：1回`
  }
};

// JCBカードの実メール  
const jcbEmail = {
  id: 'test-2',
  subject: 'JCBカード／ショッピングご利用のお知らせ',
  from: 'mail@qa.jcb.co.jp',
  body: {
    plain: `翠尾　翔音 様
カード名称　：　【ＯＳ】ＪＣＢカードＷ　ＮＬ

いつも【ＯＳ】ＪＣＢカードＷ　ＮＬをご利用いただきありがとうございます。
JCBカードのご利用がありましたのでご連絡します。
JCBでは安全安心にカードを利用いただけるよう、「カードご利用通知」を配信しています。

【ご利用日時(日本時間)】　2025/08/28 19:47
【ご利用金額】　159円
【ご利用先】　ロケツトナウ`
  }
};

// 三井住友カードの実メール
const smcbEmail = {
  id: 'test-3',
  subject: 'ご利用のお知らせ【三井住友カード】',
  from: 'smbc-card@smbc-card.com',
  body: {
    plain: `PeAr1 様

いつも三井住友カードをご利用いただきありがとうございます。
Ｏｌｉｖｅ／クレジットについてカードの利用内容をお知らせします。

ご利用内容

ご利用日時：2025/08/26 13:00
ROCKET NOW（買物）
785円

本メールはカードご利用の承認照会に基づく通知であり、カードのご利用及びご請求を確定するものではございません。
ご利用情報が明細に反映するまではお日にちがかかる場合がございます。`
  }
};

// 金額のみのメール（MUFGスタイル）
const mufgStyleEmail = {
  id: 'test-4',
  subject: '【重要】カード利用速報',
  from: 'info@cr.mufg.jp',
  body: {
    plain: `カード利用のお知らせ

以下のご利用がありました。

利用金額：2,500円

詳細は後日お送りする明細書をご確認ください。`
  }
};

// プロモーション混在メール
const promoMixedEmail = {
  id: 'test-5',
  subject: '【お得】楽天カードご利用ありがとうございます',
  from: 'promo@rakuten-card.co.jp',
  body: {
    plain: `いつもご利用ありがとうございます！

今回のご利用：1,200円

★期間限定キャンペーン実施中★
ポイント還元率アップ中！この機会をお見逃しなく！
セール商品も多数ご用意しております。`
  }
};

console.log('=== 🔬 新しい柔軟フィルターのテスト ===\n');

console.log('1. 楽天カード実メールテスト');
const rakutenResult = classifyMailFlexibly(rakutenEmail, rakutenEmail.body);
console.log('結果:', rakutenResult);
console.log('');

console.log('2. JCBカード実メールテスト');
const jcbResult = classifyMailFlexibly(jcbEmail, jcbEmail.body);
console.log('結果:', jcbResult);
console.log('');

console.log('3. 三井住友カード実メールテスト');
const smcbResult = classifyMailFlexibly(smcbEmail, smcbEmail.body);
console.log('結果:', smcbResult);
console.log('');

console.log('4. MUFG風金額のみメールテスト');
const mufgResult = classifyMailFlexibly(mufgStyleEmail, mufgStyleEmail.body);
console.log('結果:', mufgResult);
console.log('');

console.log('5. プロモーション混在メールテスト');
const promoResult = classifyMailFlexibly(promoMixedEmail, promoMixedEmail.body);
console.log('結果:', promoResult);
console.log('');

// 加盟店なしのメール
const noMerchantEmail = {
  id: 'test-6',
  subject: '【ご利用速報】金額のみ',
  from: 'alert@dcard.docomo.ne.jp',
  body: {
    plain: `カードご利用のお知らせ
ご利用金額: 5,432円
詳細はWEB明細でご確認ください。`
  }
};

console.log('6. 加盟店なしメールテスト');
const noMerchantResult = classifyMailFlexibly(noMerchantEmail, noMerchantEmail.body);
console.log('結果:', noMerchantResult);
console.log('');

// 請求確定メール（利用速報ではない）
const statementEmail = {
  id: 'test-7',
  subject: '【MUFGカード】ご請求金額確定のお知らせ',
  from: 'notice@cr.mufg.jp',
  body: {
    plain: `2025年08月ご請求金額が確定しました。
請求金額: 12,345円
詳細はMUFGカードWEBサービスをご確認ください。`
  }
};

console.log('7. 請求確定メールテスト');
const statementResult = classifyMailFlexibly(statementEmail, statementEmail.body);
console.log('結果:', statementResult);
console.log('');

console.log('=== 📊 結果サマリー ===');
const results = [
  { name: '楽天', result: rakutenResult },
  { name: 'JCB', result: jcbResult },
  { name: '三井住友', result: smcbResult },
  { name: 'MUFG風', result: mufgResult },
  { name: 'プロモ混在', result: promoResult },
  { name: '加盟店なし', result: noMerchantResult },
  { name: '請求確定', result: statementResult }
];

results.forEach(({ name, result }) => {
  const status = result.ok ? '✅ PASS' : '❌ FAIL';
  const trust = result.trustLevel || 'N/A';
  const amount = result.extractedData.amount || 'N/A';
  const confidence = result.confidence;
  
  console.log(`${name}: ${status} | Trust: ${trust} | Amount: ${amount} | Confidence: ${confidence}%`);
});

// 追加テストケース：その他の主要カード会社
const mufgEmail = {
  id: 'test-8',
  subject: '【MUFGカード】ご利用速報',
  from: 'info@cr.mufg.jp',
  body: {
    plain: `MUFGカードをご利用いただき、ありがとうございます。

■ご利用内容
ご利用日：2025年08月28日
ご利用先：Amazon.co.jp
ご利用金額：3,480円

※この通知は利用速報です。詳細は後日WEB明細をご確認ください。`
  }
};

const nicosEmail = {
  id: 'test-9',
  subject: 'NICOSカード ご利用のお知らせ',
  from: 'info@nicos.co.jp',
  body: {
    plain: `いつもNICOSカードをご利用いただきありがとうございます。

【ご利用日時】2025/08/28 15:32
【ご利用金額】1,580円
【ご利用店舗名】セブンイレブン千代田店

ご利用明細の詳細はNICOS WEBサービスでご確認ください。`
  }
};

const oricoEmail = {
  id: 'test-10',
  subject: '【Orico】カード利用通知',
  from: 'notice@orico.co.jp',
  body: {
    plain: `Oricoカードご利用のお知らせ

利用日時: 2025/08/28 12:15
加盟店名: ローソン渋谷店
利用金額: 890円

本メールは自動送信です。`
  }
};

const eposEmail = {
  id: 'test-11',
  subject: 'エポスカード ご利用通知',
  from: 'mail@eposcard.co.jp',
  body: {
    plain: `エポスカードをご利用いただきありがとうございます。

◆ご利用内容◆
ご利用日：2025年8月28日
ご利用先：マルイ新宿店
ご利用額：12,800円

※ご不明な点がございましたらお客様センターまでお問い合わせください。`
  }
};

const paypayEmail = {
  id: 'test-12',
  subject: 'PayPayカード 利用通知',
  from: 'noreply@paypay-card.co.jp',
  body: {
    plain: `PayPayカードご利用のお知らせ

利用日: 2025/08/28
店舗: Uber Eats
決済金額: 1,250円

PayPayアプリでもご確認いただけます。`
  }
};

const aeonEmail = {
  id: 'test-13',
  subject: 'イオンカード ご利用明細',
  from: 'info@aeoncard.co.jp',
  body: {
    plain: `イオンカードをご利用いただきありがとうございます。

■ ご利用明細 ■
利用日：2025年08月28日
利用先：イオンモール幕張新都心
お支払い金額：4,560円

WAONポイントも貯まります！`
  }
};

const amexEmail = {
  id: 'test-14',
  subject: 'American Express Card - Transaction Alert',
  from: 'DoNotReply@americanexpress.com',
  body: {
    plain: `Dear Cardholder,

A charge has been made to your American Express Card.

Transaction Date: 08/28/2025
Merchant: STARBUCKS SHIBUYA
Amount: ¥650

Thank you for using your American Express Card.`
  }
};

const dcEmail = {
  id: 'test-15',
  subject: 'DCカード ご利用のお知らせ',
  from: 'info@dccard.co.jp',
  body: {
    plain: `DCカードをご利用いただき、ありがとうございます。

▼利用内容▼
ご利用日時：2025年08月28日 16:45
ご利用先：ファミリーマート品川店
ご利用金額：720円

※本メールは自動配信されています。`
  }
};

console.log('\n=== 🏢 主要カード会社の追加テスト ===\n');

const additionalEmails = [
  { name: 'MUFG', email: mufgEmail },
  { name: 'NICOS', email: nicosEmail },
  { name: 'Orico', email: oricoEmail },
  { name: 'EPOS', email: eposEmail },
  { name: 'PayPay', email: paypayEmail },
  { name: 'AEON', email: aeonEmail },
  { name: 'AMEX', email: amexEmail },
  { name: 'DC', email: dcEmail }
];

const additionalResults: any[] = [];

additionalEmails.forEach(({ name, email }) => {
  console.log(`${additionalEmails.indexOf({ name, email }) + 8}. ${name}カードテスト`);
  const result = classifyMailFlexibly(email, email.body);
  console.log('結果:', result);
  console.log('');
  
  additionalResults.push({ name, result });
});

console.log('=== 📊 全体結果サマリー ===');

// 既存の結果に新しい結果を追加
const allResults = [
  ...results,
  ...additionalResults
];

allResults.forEach(({ name, result }) => {
  const status = result.ok ? '✅ PASS' : '❌ FAIL';
  const trust = result.trustLevel || 'N/A';
  const amount = result.extractedData.amount || 'N/A';
  const merchant = result.extractedData.merchant || 'N/A';
  const date = result.extractedData.date || 'N/A';
  const confidence = result.confidence;
  
  console.log(`${name}: ${status} | Trust: ${trust} | Amount: ${amount} | Merchant: ${merchant} | Date: ${date} | Confidence: ${confidence}%`);
});

console.log('\n=== 期待結果との比較 ===');
console.log('すべてのメールで金額が正しく抽出され、適切な trust level が設定されることを期待');
console.log('プロモーション混在メールも金額が取れれば通すが、confidence は下がる想定');
console.log('各カード会社固有のフォーマットでも情報が正しく抽出されることを確認');