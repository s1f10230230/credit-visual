/**
 * 楽天カード Apple決済 デバッグ
 */

// 正規表現パターンを直接テスト
const merchantPattern = new RegExp([
  // JCB: 【】括弧形式 (最優先)
  '【ご利用先】\\s*(.+?)(?:\\s*$)',
  // 楽天カード: ■利用先: 形式 (Apple決済対応 - 最優先で追加)
  '■\\s*利用先\\s*[:：]\\s*(.+?)(?:\\n|$)',
  // 一般的なコロン形式
  '■?\\s*(?:利用先|ご利用店(?:舗名)?|ご利用先|加盟店名)\\s*[:：]\\s*(.+)',
].join('|'), 'im');

const testText = `━━━━━━━━━━
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

ご利用ありがとうございました。`;

console.log('🔍 === 楽天カード Apple決済 デバッグ ===\n');

console.log('テストテキスト:');
console.log(testText);
console.log('\n' + '='.repeat(50));

console.log('\n📝 正規表現パターン:');
console.log(merchantPattern.source);

console.log('\n🎯 マッチ結果:');
const match = testText.match(merchantPattern);
if (match) {
  console.log('✅ マッチ成功!');
  console.log('Full match:', match[0]);
  console.log('Groups:', match.slice(1).filter(g => g !== undefined));
  
  // どのパターンがヒットしたか特定
  if (match[1]) console.log('Pattern 1 (JCB): ', match[1]);
  if (match[2]) console.log('Pattern 2 (楽天): ', match[2]);
  if (match[3]) console.log('Pattern 3 (汎用): ', match[3]);
} else {
  console.log('❌ マッチ失敗');
}

// 個別パターンテスト
console.log('\n🧪 個別パターンテスト:');

const rakutenPattern = /■\s*利用先\s*[:：]\s*(.+?)(?:\n|$)/im;
console.log('楽天専用パターン:', rakutenPattern.source);
const rakutenMatch = testText.match(rakutenPattern);
console.log('楽天パターンマッチ:', rakutenMatch);

const genericPattern = /■?\s*(?:利用先|ご利用店(?:舗名)?|ご利用先|加盟店名)\s*[:：]\s*(.+)/im;
console.log('\n汎用パターン:', genericPattern.source);
const genericMatch = testText.match(genericPattern);
console.log('汎用パターンマッチ:', genericMatch);

// 金額抽出テスト
const amountPattern = /(?:¥|￥)\s*([0-9０-９,，]+)(?!\s*20\d{2})|([0-9０-９,，]+)\s*円(?!\s*20\d{2})|([0-9０-９,，]+)\s*JPY\b/gi;
console.log('\n💰 金額抽出テスト:');
const amountMatches = Array.from(testText.matchAll(amountPattern));
console.log('金額マッチ:', amountMatches);

export { testText };