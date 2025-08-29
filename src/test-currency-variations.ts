// Test currency variations and edge cases
import { classifyMailFlexibly } from './lib/flexibleMailFilter';

// Uber Eats style with &yen; HTML entity
const uberEmail = {
  id: 'test-uber',
  subject: 'Uber Eats - Receipt',
  from: 'noreply@uber.com',
  body: {
    html: `<div>
      <p>Your order from McDonald's</p>
      <p>Order total: &yen;1,250</p>
      <p>Thank you for your order!</p>
    </div>`
  }
};

// Problematic Uber Eats case - number concatenation issue
const uberProblematicEmail = {
  id: 'test-uber-problematic',
  subject: 'Uber Eats - Receipt',
  from: 'noreply@uber.com',
  body: {
    html: `<div>
      <span>&yen;915</span><span>2025年8月注文</span>
      <p>Your order details...</p>
      <p>Total: &yen;915</p>
    </div>`
  }
};

// Full-width yen with NBSP
const fullWidthYenEmail = {
  id: 'test-fullwidth',
  subject: 'Payment Notification',
  from: 'payment@example.com',
  body: {
    plain: `お支払い完了通知
    
合計金額: ￥　2,500
決済方法: クレジットカード`
  }
};

// Mixed currency notation
const mixedCurrencyEmail = {
  id: 'test-mixed',
  subject: 'Purchase Receipt',
  from: 'orders@merchant.com', 
  body: {
    plain: `購入明細

商品代金: ¥1,800
送料: ￥500円
合計: 2,300 JPY`
  }
};

// Real Uber Eats email with complex structure
const realUberEmail = {
  id: 'test-real-uber',
  subject: '日曜日 午後の Uber Eats のご注文',
  from: 'noreply@uber.com',
  body: {
    plain: `合計 ￥915
2025年8月3日


範 様、Uber One をご利用いただきありがとうございます。
EFEKEBAB 池袋店の領収書をお受け取りください。
注文を評価


合計    ￥915
この注文は、Uber One利用により ￥1,330 お得になりました

利用明細を確認するには次へ移動 Uber Eats , または この PDF をダウンロードしてください

お支払い     

JCB ••••1234
2025/08/03 16:05
￥915
注文情報のページにアクセスして、請求書 (利用可能な場合) などの詳細をご覧いただけます。
Uber One とプロモーションのご案内`
  }
};

console.log('=== 🌍 通貨表記バリエーションテスト ===\n');

const currencyTests = [
  { name: 'Uber(&yen;)', email: uberEmail },
  { name: 'Uber Problematic (¥915+2025年)', email: uberProblematicEmail },
  { name: 'Real Uber (複数￥915+年混在)', email: realUberEmail },
  { name: 'Full-width￥+NBSP', email: fullWidthYenEmail },
  { name: 'Mixed Currency', email: mixedCurrencyEmail }
];

currencyTests.forEach(({ name, email }) => {
  console.log(`${name} テスト:`);
  const result = classifyMailFlexibly(email, email.body);
  
  const status = result.ok ? '✅ PASS' : '❌ FAIL';
  const amount = result.extractedData.amount || 'N/A';
  const confidence = result.confidence;
  
  console.log(`${status} | Amount: ${amount} | Confidence: ${confidence}%`);
  console.log('Details:', result);
  console.log('');
});

console.log('=== 期待結果 ===');
console.log('Uber: 1,250円 抽出（&yen; HTML entity → ¥ 変換）');
console.log('Uber Problematic: 915円 抽出（¥9152025 → ¥915に修正、コンテキスト優先）');
console.log('Real Uber: 915円 抽出（3回出現する￥915から「合計」近傍を優先選択）');
console.log('Full-width: 2,500円 抽出（￥ + NBSP対応）');
console.log('Mixed: 2,300円 抽出（JPY表記対応）');