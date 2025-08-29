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

console.log('=== 🌍 通貨表記バリエーションテスト ===\n');

const currencyTests = [
  { name: 'Uber(&yen;)', email: uberEmail },
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
console.log('Full-width: 2,500円 抽出（￥ + NBSP対応）');
console.log('Mixed: 2,300円 抽出（JPY表記対応）');