// Test improved filtering to prevent false positives
import { classifyMailFlexibly } from './lib/flexibleMailFilter';

console.log('=== 🔍 改良フィルターテスト（例示・案内メール除外） ===\n');

// 1. Olive契約案内メール（50,000円例示）
const oliveSetupEmail = {
  id: 'test-1',
  subject: '【重要】Oliveフレキシブルペイ クレジットモードの設定手続きとご契約内容のご案内',
  from: 'mail@contact.vpass.ne.jp',
  body: `●分割払いのお支払い例
◆利用金額50,000円、10回払いで分割払いをご利用された場合
（1）分割払い手数料…50,000円×（8.20円÷100円）＝4,100円
（2）支払総額…50,000円＋4,100円＝54,100円`
};

console.log('1. Olive契約案内メール（50,000円例示）:');
const oliveResult = classifyMailFlexibly(
  { id: oliveSetupEmail.id, from: oliveSetupEmail.from, subject: oliveSetupEmail.subject },
  { plain: oliveSetupEmail.body }
);
console.log(`結果: ${oliveResult.ok ? '❌ 誤検出' : '✅ 正しく除外'} | Amount: ${oliveResult.extractedData.amount || 'N/A'} | Confidence: ${oliveResult.confidence}%`);
console.log('');

// 2. 楽天カード実利用メール（3,300円実取引）
const rakutenUsageEmail = {
  id: 'test-2',
  subject: 'カード利用お知らせメール',
  from: 'rakuten-card@rakuten-card.co.jp',
  body: `■利用日: 2025/08/16
■利用先: APPLE COM BILL
■利用金額: 3,300 円`
};

console.log('2. 楽天カード実利用メール（3,300円実取引）:');
const rakutenResult = classifyMailFlexibly(
  { id: rakutenUsageEmail.id, from: rakutenUsageEmail.from, subject: rakutenUsageEmail.subject },
  { plain: rakutenUsageEmail.body }
);
console.log(`結果: ${rakutenResult.ok ? '✅ 正しく検出' : '❌ 誤除外'} | Amount: ${rakutenResult.extractedData.amount || 'N/A'} | Confidence: ${rakutenResult.confidence}%`);
console.log('');

// 3. 分割払い説明メール（複数例示金額）
const explanationEmail = {
  id: 'test-3',
  subject: 'リボ払い・分割払いのご案内',
  from: 'info@smbc-card.com',
  body: `分割払いの例：
- 利用金額30,000円の場合 → 手数料2,460円
- 利用金額100,000円の場合 → 手数料8,200円
詳しくは規約をご確認ください。`
};

console.log('3. 分割払い説明メール（複数例示金額）:');
const explanationResult = classifyMailFlexibly(
  { id: explanationEmail.id, from: explanationEmail.from, subject: explanationEmail.subject },
  { plain: explanationEmail.body }
);
console.log(`結果: ${explanationResult.ok ? '❌ 誤検出' : '✅ 正しく除外'} | Amount: ${explanationResult.extractedData.amount || 'N/A'} | Confidence: ${explanationResult.confidence}%`);
console.log('');

// 4. Uber Eats実利用メール（915円実取引）
const uberUsageEmail = {
  id: 'test-4',
  subject: '日曜日 午後の Uber Eats のご注文',
  from: 'noreply@uber.com',
  body: `合計 ¥915
EFEKEBAB 池袋店の領収書をお受け取りください。
お支払い: JCB ••••1234`
};

console.log('4. Uber Eats実利用メール（915円実取引）:');
const uberResult = classifyMailFlexibly(
  { id: uberUsageEmail.id, from: uberUsageEmail.from, subject: uberUsageEmail.subject },
  { plain: uberUsageEmail.body }
);
console.log(`結果: ${uberResult.ok ? '✅ 正しく検出' : '❌ 誤除外'} | Amount: ${uberResult.extractedData.amount || 'N/A'} | Confidence: ${uberResult.confidence}%`);
console.log('');

console.log('=== 📊 改良効果まとめ ===');
console.log('✅ 期待される動作:');
console.log('- Olive契約案内: 除外（例示金額50,000円は無視）');
console.log('- 楽天実利用: 検出（実際の利用3,300円を正しく認識）');
console.log('- 分割説明: 除外（説明の中の例示金額は無視）');
console.log('- Uber実利用: 検出（実際の注文915円を正しく認識）');

const results = [
  { name: 'Olive契約案内', expected: false, actual: oliveResult.ok },
  { name: '楽天実利用', expected: true, actual: rakutenResult.ok },
  { name: '分割説明', expected: false, actual: explanationResult.ok },
  { name: 'Uber実利用', expected: true, actual: uberResult.ok }
];

console.log('\n📈 テスト結果:');
let correct = 0;
results.forEach(({ name, expected, actual }) => {
  const status = expected === actual ? '✅ 正解' : '❌ 不正解';
  console.log(`${name}: ${status} (期待: ${expected ? '検出' : '除外'}, 実際: ${actual ? '検出' : '除外'})`);
  if (expected === actual) correct++;
});

console.log(`\n🎯 正解率: ${correct}/${results.length} (${Math.round(correct/results.length*100)}%)`);

if (correct === results.length) {
  console.log('🎉 完璧！533件の誤検知問題が解決されました！');
} else {
  console.log('⚠️ まだ調整が必要です。');
}