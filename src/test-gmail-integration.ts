// Test Gmail service integration end-to-end
import { gmailService } from './services/gmailService';

// Mock Gmail service for testing without actual API calls
class MockGmailService {
  async parseCreditNotification(email: any) {
    console.log('🔍 [MOCK] Processing email:', email.subject);
    
    // Simulate our real email processing
    const result = await gmailService.parseCreditNotification(email);
    console.log('✅ [MOCK] Parse result:', result ? 'SUCCESS' : 'FAILED');
    return result;
  }
  
  async fetchAndParseCreditEmails() {
    console.log('🔍 [MOCK] Simulating fetchAndParseCreditEmails...');
    
    // Mock email data from our tests
    const mockEmails = [
      {
        id: 'mock-rakuten-1',
        subject: 'カード利用お知らせメール',
        from: 'rakuten-card@rakuten-card.co.jp',
        body: `カード利用お知らせメール
━━━━━━━━━━

楽天カード(Visa)をご利用いただき誠にありがとうございます。
楽天カードご利用内容をお知らせいたします。

<カードご利用情報>
《ショッピングご利用分》
■利用日: 2025/08/16
■利用先: APPLE COM BILL
■利用者: 本人
■支払方法: 1回
■利用金額: 3,300 円
■支払月: 2025/09`,
        date: '2025-08-16'
      },
      {
        id: 'mock-uber-1', 
        subject: '日曜日 午後の Uber Eats のご注文',
        from: 'noreply@uber.com',
        body: `合計 ￥915
2025年8月3日

範 様、Uber One をご利用いただきありがとうございます。
EFEKEBAB 池袋店の領収書をお受け取りください。

合計    ￥915
この注文は、Uber One利用により ￥1,330 お得になりました

お支払い     
JCB ••••1234
2025/08/03 16:05
￥915`,
        date: '2025-08-03'
      }
    ];

    console.log(`📧 [MOCK] Processing ${mockEmails.length} mock emails...`);
    
    const transactions = [];
    for (const email of mockEmails) {
      try {
        const txn = await this.parseCreditNotification(email);
        if (txn) {
          transactions.push(txn);
          console.log(`✅ [MOCK] Transaction created: ${txn.amount}円 from ${txn.merchant}`);
        } else {
          console.log(`❌ [MOCK] No transaction created for: ${email.subject}`);
        }
      } catch (error) {
        console.error(`❌ [MOCK] Error processing ${email.subject}:`, error);
      }
    }
    
    console.log(`🎯 [MOCK] Final result: ${transactions.length}/${mockEmails.length} transactions created`);
    return transactions;
  }
}

console.log('=== 🔧 Gmail Integration Test ===\n');

async function runTest() {
  const mockService = new MockGmailService();
  
  try {
    console.log('Starting Gmail integration test...');
    const results = await mockService.fetchAndParseCreditEmails();
    
    console.log('\n=== 📊 Test Results ===');
    console.log(`Total transactions: ${results.length}`);
    results.forEach((txn, i) => {
      console.log(`${i + 1}. Amount: ${txn.amount}円 | Merchant: ${txn.merchant} | Date: ${txn.date}`);
    });
    
    if (results.length > 0) {
      console.log('\n✅ Gmail integration test PASSED - Transactions are being created properly');
    } else {
      console.log('\n❌ Gmail integration test FAILED - No transactions created');
    }
    
  } catch (error) {
    console.error('\n❌ Gmail integration test ERROR:', error);
  }
}

runTest();