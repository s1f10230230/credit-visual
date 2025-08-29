// 実際のメールデータでのテスト
import { extractTxnFromUsageMail, looksLikeStatement } from './parsers/creditMail';
import { classifyCreditMailToTxn } from './services/merchantClassifier';

// 楽天カードの実メール
const rakutenEmail = {
  subject: 'カード利用のお知らせ(本人ご利用分)',
  from: 'rakuten-card@rakuten-card.co.jp', 
  body: `いつも楽天カードをご利用いただきありがとうございます。
楽天カードご利用内容をお知らせいたします。

楽天カード（Visa）ご利用内容


ショッピングご利用分


ご利用日    ご利用先    ご利用金額

 
2025/08/17    ﾓﾊﾞｲﾙﾊﾟｽﾓﾁﾔ-ｼﾞ    1,000円｜ 支払月：2025/09 ｜ 利用者：本人
 

合計　1,000 円


0 円
支払方法：1回`
};

// JCBカードの実メール  
const jcbEmail = {
  subject: 'JCBカード／ショッピングご利用のお知らせ',
  from: 'mail@qa.jcb.co.jp',
  body: `翠尾　翔音 様
カード名称　：　【ＯＳ】ＪＣＢカードＷ　ＮＬ

いつも【ＯＳ】ＪＣＢカードＷ　ＮＬをご利用いただきありがとうございます。
JCBカードのご利用がありましたのでご連絡します。
JCBでは安全安心にカードを利用いただけるよう、「カードご利用通知」を配信しています。

【ご利用日時(日本時間)】　2025/08/28 19:47
【ご利用金額】　159円
【ご利用先】　ロケツトナウ`
};

// 三井住友カードの実メール
const smcbEmail = {
  subject: 'ご利用のお知らせ【三井住友カード】',
  from: 'smbc-card@smbc-card.com',
  body: `PeAr1 様

いつも三井住友カードをご利用いただきありがとうございます。
Ｏｌｉｖｅ／クレジットについてカードの利用内容をお知らせします。

ご利用内容

ご利用日時：2025/08/26 13:00
ROCKET NOW（買物）
785円

本メールはカードご利用の承認照会に基づく通知であり、カードのご利用及びご請求を確定するものではございません。
ご利用情報が明細に反映するまではお日にちがかかる場合がございます。`
};

console.log('=== 🎯 楽天カード実メールテスト ===');
console.log('件名:', rakutenEmail.subject);
console.log('ステートメント判定:', looksLikeStatement(rakutenEmail));

const rakutenClassification = classifyCreditMailToTxn(rakutenEmail);
console.log('楽天分類結果:', rakutenClassification);

const rakutenTxn = extractTxnFromUsageMail(rakutenEmail);
console.log('楽天取引抽出:', rakutenTxn);

console.log('\n=== 🎯 JCBカード実メールテスト ===');
console.log('件名:', jcbEmail.subject);
console.log('ステートメント判定:', looksLikeStatement(jcbEmail));

const jcbClassification = classifyCreditMailToTxn(jcbEmail);
console.log('JCB分類結果:', jcbClassification);

const jcbTxn = extractTxnFromUsageMail(jcbEmail);
console.log('JCB取引抽出:', jcbTxn);

console.log('\n=== 🎯 三井住友カード実メールテスト ===');
console.log('件名:', smcbEmail.subject);
console.log('ステートメント判定:', looksLikeStatement(smcbEmail));

const smcbClassification = classifyCreditMailToTxn(smcbEmail);
console.log('三井住友分類結果:', smcbClassification);

const smcbTxn = extractTxnFromUsageMail(smcbEmail);
console.log('三井住友取引抽出:', smcbTxn);

// 期待結果の確認
console.log('\n=== 🎯 期待結果 ===');
console.log('楽天: 1000円, ﾓﾊﾞｲﾙﾊﾟｽﾓﾁﾔ-ｼﾞ, 2025-08-17');
console.log('JCB: 159円, ロケツトナウ, 2025-08-28');
console.log('三井住友: 785円, ROCKET NOW, 2025-08-26');