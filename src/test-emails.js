// 実際のメールデータでのテスト
import { extractTxnFromUsageMail, looksLikeStatement } from './parsers/creditMail.js';

// 楽天カードの実メール
const rakutenEmail = {
  subject: 'カード利用のお知らせ(本人ご利用分)',
  from: 'rakuten-card@rakuten-card.co.jp',
  body: `いつも楽天カードをご利用いただきありがとうございます。
楽天カードご利用内容をお知らせいたします。

楽天カード（Visa）ご利用内容

ショッピングご利用分

ご利用日    ご利用先    ご利用金額

2025/08/17    ﾓﾊﾞｲﾙﾊﾟｽﾓﾁﾔ-ｼﾞ    1,000円 | 支払月：2025/09 | 利用者：本人

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

console.log('=== 楽天カードテスト ===');
console.log('ステートメントチェック:', looksLikeStatement(rakutenEmail));
const rakutenResult = extractTxnFromUsageMail(rakutenEmail);
console.log('楽天結果:', rakutenResult);

console.log('\n=== JCBカードテスト ===');
console.log('ステートメントチェック:', looksLikeStatement(jcbEmail));
const jcbResult = extractTxnFromUsageMail(jcbEmail);
console.log('JCB結果:', jcbResult);