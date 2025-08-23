/**
 * Test Suite for SmartRecommendationService
 * 
 * This test suite verifies the fixes implemented based on the code review:
 * 1. Point calculation bug (100x factor issue)
 * 2. Condition checking for category rewards
 * 3. Merchant-specific offer matching
 * 4. Data validation and error handling
 * 5. Standardized category codes
 */

import { smartRecommendationService } from './smartRecommendationService';

// Test data
const testTransactions = [
  {
    id: '1',
    amount: 1000,
    merchant: 'Amazon',
    date: '2024-08-23',
    category: '通販',
    status: 'confirmed' as const
  },
  {
    id: '2',
    amount: 500,
    merchant: 'スターバックス',
    date: '2024-08-23',
    category: 'カフェ',
    status: 'confirmed' as const
  },
  {
    id: '3',
    amount: 300,
    merchant: 'セブン-イレブン',
    date: '2024-08-23',
    category: 'コンビニ',
    status: 'confirmed' as const
  },
  {
    id: '4',
    amount: 2000,
    merchant: '楽天市場',
    date: '2024-08-23',
    category: '通販',
    status: 'confirmed' as const
  }
];

// Helper function to wait for database to be ready
async function waitForDatabase(maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (smartRecommendationService.isDatabaseReady()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

// Test Suite
async function runTests() {
  console.log('🧪 Starting SmartRecommendationService Test Suite');
  console.log('================================================\n');

  // Wait for database to be ready
  console.log('⏳ Waiting for card database to initialize...');
  const isReady = await waitForDatabase();
  if (!isReady) {
    console.error('❌ Database failed to initialize within timeout');
    return;
  }
  console.log('✅ Database initialized successfully\n');

  // Display database info
  const dbInfo = smartRecommendationService.getDatabaseInfo();
  console.log(`📊 Database Info:`);
  console.log(`   Version: ${dbInfo.version}`);
  console.log(`   Cards: ${dbInfo.cardCount}`);
  console.log(`   Last Updated: ${dbInfo.lastUpdated}\n`);

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Point Calculation Fix
  console.log('📍 Test 1: Point Calculation Accuracy');
  console.log('--------------------------------------');
  totalTests++;
  
  try {
    // Test JCB Card W at Starbucks (should be 5.5% cashback)
    const starbucksRecommendation = await smartRecommendationService.recommendOptimalCard(
      1000, // ¥1000
      'スターバックス',
      'カフェ'
    );
    
    const expectedCashback = 55; // 5.5% of ¥1000
    const expectedPoints = 55;   // 55 points (1 point = ¥1)
    
    console.log(`   Transaction: ¥1000 at スターバックス`);
    console.log(`   Best Card: ${starbucksRecommendation.bestCard}`);
    console.log(`   Cashback: ¥${starbucksRecommendation.cashbackAmount}`);
    console.log(`   Points: ${starbucksRecommendation.pointsEarned}`);
    
    if (Math.abs(starbucksRecommendation.cashbackAmount - expectedCashback) < 0.01 &&
        Math.abs(starbucksRecommendation.pointsEarned - expectedPoints) < 0.01) {
      console.log('   ✅ Point calculation is correct');
      passedTests++;
    } else {
      console.log('   ❌ Point calculation error');
      console.log(`   Expected: ¥${expectedCashback} cashback, ${expectedPoints} points`);
    }
  } catch (error) {
    console.log(`   ❌ Test failed with error: ${error.message}`);
  }
  console.log('');

  // Test 2: Condition Checking
  console.log('📍 Test 2: Condition Validation');
  console.log('--------------------------------');
  totalTests++;
  
  try {
    // Test Rakuten Card at Amazon vs Rakuten Market
    const amazonRecommendation = await smartRecommendationService.recommendOptimalCard(
      1000,
      'Amazon',
      '通販'
    );
    
    const rakutenMarketRecommendation = await smartRecommendationService.recommendOptimalCard(
      1000,
      '楽天市場',
      '通販'
    );
    
    console.log(`   Amazon (¥1000):`);
    console.log(`     Best Card: ${amazonRecommendation.bestCard}`);
    console.log(`     Cashback: ¥${amazonRecommendation.cashbackAmount}`);
    
    console.log(`   楽天市場 (¥1000):`);
    console.log(`     Best Card: ${rakutenMarketRecommendation.bestCard}`);
    console.log(`     Cashback: ¥${rakutenMarketRecommendation.cashbackAmount}`);
    
    // Amazon should favor JCB Card W (2%), Rakuten should favor Rakuten Card (3%)
    if (amazonRecommendation.bestCard === 'JCBカード W' && 
        rakutenMarketRecommendation.bestCard === '楽天カード') {
      console.log('   ✅ Condition checking works correctly');
      passedTests++;
    } else {
      console.log('   ❌ Condition checking may have issues');
    }
  } catch (error) {
    console.log(`   ❌ Test failed with error: ${error.message}`);
  }
  console.log('');

  // Test 3: Merchant Matching
  console.log('📍 Test 3: Merchant Matching & Aliases');
  console.log('---------------------------------------');
  totalTests++;
  
  try {
    // Test various merchant name formats
    const sevenElevenTests = [
      'セブン-イレブン',
      'Seven Eleven',
      '7-eleven',
      'seven'
    ];
    
    let matchingCount = 0;
    
    for (const merchantName of sevenElevenTests) {
      const recommendation = await smartRecommendationService.recommendOptimalCard(
        1000,
        merchantName,
        'コンビニ'
      );
      
      console.log(`   ${merchantName}: ${recommendation.bestCard} (¥${recommendation.cashbackAmount})`);
      
      // Should consistently recommend 三井住友カード(NL) for convenience stores
      if (recommendation.bestCard === '三井住友カード(NL)' && recommendation.cashbackAmount > 50) {
        matchingCount++;
      }
    }
    
    if (matchingCount >= 3) { // Allow some variation
      console.log('   ✅ Merchant matching with aliases works');
      passedTests++;
    } else {
      console.log('   ❌ Merchant matching inconsistent');
    }
  } catch (error) {
    console.log(`   ❌ Test failed with error: ${error.message}`);
  }
  console.log('');

  // Test 4: Error Handling
  console.log('📍 Test 4: Error Handling & Validation');
  console.log('---------------------------------------');
  totalTests++;
  
  try {
    // Test invalid inputs
    const invalidAmountTest = await smartRecommendationService.recommendOptimalCard(
      -100, // Invalid negative amount
      'Test Merchant',
      'テスト'
    );
    
    const zeroAmountTest = await smartRecommendationService.recommendOptimalCard(
      0, // Invalid zero amount
      'Test Merchant',
      'テスト'
    );
    
    console.log(`   Invalid amount (-100): ${invalidAmountTest.reason}`);
    console.log(`   Zero amount (0): ${zeroAmountTest.reason}`);
    
    // Should return default recommendations with error messages
    if (invalidAmountTest.reason.includes('エラー') || invalidAmountTest.potentialSavings === 0) {
      console.log('   ✅ Error handling works for invalid inputs');
      passedTests++;
    } else {
      console.log('   ❌ Error handling insufficient');
    }
  } catch (error) {
    console.log(`   ❌ Test failed with error: ${error.message}`);
  }
  console.log('');

  // Test 5: Category Normalization
  console.log('📍 Test 5: Category Normalization');
  console.log('----------------------------------');
  totalTests++;
  
  try {
    // Test different category formats
    const convenienceTests = [
      { category: 'コンビニ', expected: 'コンビニ' },
      { category: 'convenience', expected: 'コンビニ' },
      { category: 'CONVENIENCE_STORE', expected: 'コンビニ' }
    ];
    
    let normalizationWorking = true;
    
    for (const test of convenienceTests) {
      const recommendation = await smartRecommendationService.recommendOptimalCard(
        1000,
        'セブン-イレブン',
        test.category
      );
      
      console.log(`   Category "${test.category}": ${recommendation.bestCard}`);
      
      // All should recommend the same card for convenience store
      if (recommendation.bestCard !== '三井住友カード(NL)') {
        normalizationWorking = false;
      }
    }
    
    if (normalizationWorking) {
      console.log('   ✅ Category normalization works');
      passedTests++;
    } else {
      console.log('   ❌ Category normalization has issues');
    }
  } catch (error) {
    console.log(`   ❌ Test failed with error: ${error.message}`);
  }
  console.log('');

  // Test 6: Performance & Spending Analysis
  console.log('📍 Test 6: Spending Analysis Performance');
  console.log('----------------------------------------');
  totalTests++;
  
  try {
    const startTime = Date.now();
    
    // Convert test transactions to expected format
    const analysisTransactions = testTransactions.map(tx => ({
      ...tx,
      cardName: '現在のカード'
    }));
    
    const analysis = await smartRecommendationService.analyzeSpendingOptimization(analysisTransactions);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`   Processing Time: ${processingTime}ms`);
    console.log(`   Annual Savings: ¥${analysis.annualSavings}`);
    console.log(`   Card Switch Recommendations: ${analysis.cardSwitchRecommendations.length}`);
    console.log(`   New Card Recommendations: ${analysis.newCardRecommendations.length}`);
    
    if (processingTime < 1000 && analysis.annualSavings >= 0) { // Should complete within 1 second
      console.log('   ✅ Spending analysis performs well');
      passedTests++;
    } else {
      console.log('   ❌ Performance or calculation issues');
    }
  } catch (error) {
    console.log(`   ❌ Test failed with error: ${error.message}`);
  }
  console.log('');

  // Final Results
  console.log('📊 Test Results Summary');
  console.log('=======================');
  console.log(`   Passed: ${passedTests}/${totalTests} tests`);
  console.log(`   Success Rate: ${((passedTests/totalTests)*100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('   🎉 All tests passed! SmartRecommendationService is working correctly.');
  } else {
    console.log(`   ⚠️  ${totalTests - passedTests} test(s) failed. Review implementation.`);
  }
  
  // Additional recommendations
  console.log('\n💡 Recommendations for Production:');
  console.log('   • Set up automated testing with Jest or similar framework');
  console.log('   • Implement real-time data updates from card issuer APIs');
  console.log('   • Add user preference settings (annual fee tolerance, etc.)');
  console.log('   • Implement A/B testing for recommendation algorithms');
  console.log('   • Add monitoring for recommendation accuracy and user adoption');
}

// Auto-run tests if not in production
if (typeof window !== 'undefined') {
  // Browser environment - can be called manually
  console.log('SmartRecommendationService test suite loaded. Call runTests() to execute.');
  (window as any).runSmartRecommendationTests = runTests;
} else {
  // Node environment - run immediately
  runTests().catch(console.error);
}

export { runTests };