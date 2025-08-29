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

console.log('=== 📊 結果サマリー ===');
const results = [
  { name: '楽天', result: rakutenResult },
  { name: 'JCB', result: jcbResult },
  { name: '三井住友', result: smcbResult },
  { name: 'MUFG風', result: mufgResult },
  { name: 'プロモ混在', result: promoResult }
];

results.forEach(({ name, result }) => {
  const status = result.ok ? '✅ PASS' : '❌ FAIL';
  const trust = result.trustLevel || 'N/A';
  const amount = result.extractedData.amount || 'N/A';
  const confidence = result.confidence;
  
  console.log(`${name}: ${status} | Trust: ${trust} | Amount: ${amount} | Confidence: ${confidence}%`);
});

console.log('\n=== 期待結果との比較 ===');
console.log('すべてのメールで金額が正しく抽出され、適切な trust level が設定されることを期待');
console.log('プロモーション混在メールも金額が取れれば通すが、confidence は下がる想定');