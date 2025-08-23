import { CreditTransaction } from './analyticsService';
import cardDatabaseData from '../data/cardDatabase.json';

export interface CardBenefit {
  cardName: string;
  issuer: string;
  generalCashback: number; // %
  categories: {
    [category: string]: {
      cashback: number;
      points: number;
      multiplier: number;
      conditions?: string;
    };
  };
  specialOffers: {
    merchant: string;
    cashback: number;
    validUntil?: string;
    conditions?: string;
  }[];
  annualFee: number;
  pointValue: number; // ¥ per point
  pointExpiry: number; // months
  pointCurrency?: string;
  tags?: string[];
}

interface CardDatabaseConfig {
  lastUpdated: string;
  version: string;
  cards: CardBenefit[];
  categoryMapping: { [key: string]: string[] };
  merchantAliases: { [key: string]: string[] };
}

export interface OptimalCardRecommendation {
  bestCard: string;
  currentCard: string;
  potentialSavings: number;
  cashbackAmount: number;
  pointsEarned: number;
  reason: string;
  confidence: number;
  alternatives: {
    cardName: string;
    savings: number;
    reason: string;
  }[];
}

export interface RealTimeAlert {
  type: 'optimal_card' | 'budget_warning' | 'deal_alert' | 'point_expiry';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  action?: {
    text: string;
    url?: string;
    callback?: () => void;
  };
  expiresAt?: Date;
  locationBased?: boolean;
}

export interface LocationContext {
  latitude: number;
  longitude: number;
  nearbyMerchants: {
    name: string;
    category: string;
    distance: number;
    offers?: string[];
  }[];
}

class SmartRecommendationService {
  private cardDatabase: CardBenefit[] = [];
  private categoryMapping: { [key: string]: string[] } = {};
  private merchantAliases: { [key: string]: string[] } = {};
  private userCards: string[] = [];
  private realtimeAlerts: RealTimeAlert[] = [];
  private locationUpdateInterval: number | null = null;
  private databaseVersion: string = '';

  constructor() {
    this.initializeCardDatabase().then(() => {
      this.startRealtimeMonitoring();
    }).catch(error => {
      console.error('Failed to initialize card database:', error);
    });
  }
  
  // Public method to check if database is ready
  isDatabaseReady(): boolean {
    return this.cardDatabase.length > 0;
  }
  
  // Method to get database info
  getDatabaseInfo(): { version: string; cardCount: number; lastUpdated?: string } {
    return {
      version: this.databaseVersion,
      cardCount: this.cardDatabase.length,
      lastUpdated: cardDatabaseData.lastUpdated
    };
  }

  private async initializeCardDatabase(): Promise<void> {
    try {
      const config = cardDatabaseData as CardDatabaseConfig;
      
      this.cardDatabase = config.cards;
      this.categoryMapping = config.categoryMapping;
      this.merchantAliases = config.merchantAliases;
      this.databaseVersion = config.version;
      
      console.log(`Card database loaded: ${this.cardDatabase.length} cards, version ${this.databaseVersion}`);
      
      // Validate data integrity
      this.validateCardDatabase();
      
    } catch (error) {
      console.error('Failed to load card database:', error);
      this.loadFallbackDatabase();
    }
  }
  
  private validateCardDatabase(): void {
    for (const card of this.cardDatabase) {
      if (!card.cardName || !card.issuer || card.generalCashback == null) {
        console.warn(`Invalid card data:`, card);
      }
      
      // Validate category data
      for (const [category, benefit] of Object.entries(card.categories)) {
        if (benefit.cashback == null || benefit.points == null) {
          console.warn(`Invalid category benefit for ${card.cardName}:${category}`, benefit);
        }
      }
    }
  }
  
  private loadFallbackDatabase(): void {
    console.log('Loading fallback card database...');
    // Minimal fallback data
    this.cardDatabase = [
      {
        cardName: "楽天カード",
        issuer: "楽天",
        generalCashback: 1.0,
        categories: {
          "その他": { cashback: 1.0, points: 100, multiplier: 1 }
        },
        specialOffers: [],
        annualFee: 0,
        pointValue: 1.0,
        pointExpiry: 12
      }
    ];
  }

  async recommendOptimalCard(
    amount: number,
    merchant: string,
    category: string,
    location?: LocationContext
  ): Promise<OptimalCardRecommendation> {
    try {
      // Input validation
      if (!amount || amount <= 0) {
        throw new Error('Invalid amount provided');
      }
      
      if (!this.isDatabaseReady()) {
        console.warn('Card database not ready, using fallback');
        return this.getDefaultRecommendation();
      }
      
      // Normalize inputs
      const normalizedMerchant = merchant.trim();
      const normalizedCategory = this.normalizeCategory(category.trim());
      
      // Analyze all available cards for this transaction
      const recommendations = this.cardDatabase.map(card => {
        try {
          const benefit = this.calculateBenefit(card, amount, normalizedMerchant, normalizedCategory);
          return {
            card,
            benefit,
            score: this.calculateOptimalityScore(card, benefit, amount)
          };
        } catch (cardError) {
          console.warn(`Error calculating benefit for ${card.cardName}:`, cardError);
          return {
            card,
            benefit: { cashbackAmount: 0, pointsEarned: 0, cashback: 0 },
            score: 0
          };
        }
      }).filter(rec => rec.score >= 0); // Filter out invalid results

      if (recommendations.length === 0) {
        throw new Error('No valid card recommendations found');
      }

      // Sort by score (highest benefit)
      recommendations.sort((a, b) => b.score - a.score);
      
      const bestRecommendation = recommendations[0];
      const currentCardBenefit = this.getCurrentCardBenefit(amount, normalizedMerchant, normalizedCategory);
      const potentialSavings = bestRecommendation.benefit.cashbackAmount - currentCardBenefit.cashbackAmount;

      return {
        bestCard: bestRecommendation.card.cardName,
        currentCard: this.getCurrentCard(),
        potentialSavings: Math.max(0, potentialSavings),
        cashbackAmount: bestRecommendation.benefit.cashbackAmount,
        pointsEarned: bestRecommendation.benefit.pointsEarned,
        reason: this.generateRecommendationReason(bestRecommendation.card, normalizedMerchant, normalizedCategory),
        confidence: this.calculateConfidence(bestRecommendation, recommendations),
        alternatives: recommendations.slice(1, 4).map(rec => ({
          cardName: rec.card.cardName,
          savings: Math.max(0, rec.benefit.cashbackAmount - currentCardBenefit.cashbackAmount),
          reason: this.generateAlternativeReason(rec.card, normalizedMerchant, normalizedCategory)
        }))
      };

    } catch (error) {
      console.error('Failed to recommend optimal card:', error);
      return this.getDefaultRecommendation(error.message);
    }
  }

  async setupRealTimeAlerts(): Promise<void> {
    // Location-based alerts
    if (navigator.geolocation) {
      this.startLocationMonitoring();
    }

    // Budget monitoring
    this.startBudgetMonitoring();

    // Point expiry monitoring
    this.startPointExpiryMonitoring();

    // Deal alerts
    this.startDealMonitoring();
  }

  async sendRealTimeAlert(alert: RealTimeAlert): Promise<void> {
    // Add to alerts queue
    this.realtimeAlerts.unshift(alert);
    
    // Keep only latest 50 alerts
    this.realtimeAlerts = this.realtimeAlerts.slice(0, 50);

    // Send push notification for high priority alerts
    if (alert.priority === 'high' || alert.priority === 'urgent') {
      await this.sendPushNotification(alert);
    }

    // Trigger UI update
    window.dispatchEvent(new CustomEvent('realtime-alert', { detail: alert }));
  }

  getRealTimeAlerts(): RealTimeAlert[] {
    // Filter non-expired alerts
    const now = new Date();
    return this.realtimeAlerts.filter(alert => 
      !alert.expiresAt || alert.expiresAt > now
    );
  }

  async analyzeSpendingOptimization(transactions: CreditTransaction[]): Promise<{
    annualSavings: number;
    monthlyOptimization: number;
    cardSwitchRecommendations: {
      category: string;
      fromCard: string;
      toCard: string;
      monthlySavings: number;
    }[];
    newCardRecommendations: {
      cardName: string;
      annualSavings: number;
      annualFee: number;
      netBenefit: number;
      reason: string;
    }[];
  }> {
    const categorySpending = this.groupByCategory(transactions);
    let totalAnnualSavings = 0;
    const cardSwitchRecommendations = [];
    const newCardRecommendations = [];

    // Analyze each category
    for (const [category, categoryTxs] of Object.entries(categorySpending)) {
      const monthlyAmount = categoryTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const annualAmount = monthlyAmount * 12;

      // Find optimal card for this category
      const optimalCard = this.findOptimalCardForCategory(category, monthlyAmount);
      const currentBenefit = this.getCurrentCardBenefit(monthlyAmount, '', category);
      const optimalBenefit = this.calculateBenefit(optimalCard, monthlyAmount, '', category);

      const monthlySavings = optimalBenefit.cashbackAmount - currentBenefit.cashbackAmount;
      const annualSavings = monthlySavings * 12;

      if (annualSavings > optimalCard.annualFee + 1000) { // Worth switching if saves >¥1000 after fee
        totalAnnualSavings += annualSavings;

        if (this.userCards.includes(optimalCard.cardName)) {
          // User already has the card - recommend switching
          cardSwitchRecommendations.push({
            category,
            fromCard: this.getCurrentCard(),
            toCard: optimalCard.cardName,
            monthlySavings
          });
        } else {
          // Recommend getting new card
          newCardRecommendations.push({
            cardName: optimalCard.cardName,
            annualSavings,
            annualFee: optimalCard.annualFee,
            netBenefit: annualSavings - optimalCard.annualFee,
            reason: `${category}カテゴリで${optimalBenefit.cashback}%還元`
          });
        }
      }
    }

    return {
      annualSavings: totalAnnualSavings,
      monthlyOptimization: totalAnnualSavings / 12,
      cardSwitchRecommendations,
      newCardRecommendations: newCardRecommendations
        .sort((a, b) => b.netBenefit - a.netBenefit)
        .slice(0, 3) // Top 3 recommendations
    };
  }

  private calculateBenefit(card: CardBenefit, amount: number, merchant: string, category: string): {
    cashbackAmount: number;
    pointsEarned: number;
    cashback: number;
  } {
    if (!card) {
      throw new Error('Card data is null or undefined');
    }
    
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount for benefit calculation');
    }

    // Check for special merchant offers first
    const specialOffer = card.specialOffers?.find(offer => 
      this.matchesMerchant(merchant, offer.merchant) && this.isOfferValid(offer)
    );

    if (specialOffer && this.validateOfferConditions(specialOffer, merchant, category)) {
      const cashbackAmount = amount * (specialOffer.cashback / 100);
      return {
        cashbackAmount,
        pointsEarned: cashbackAmount / (card.pointValue || 1.0),
        cashback: specialOffer.cashback
      };
    }

    // Check category-specific benefits
    const categories = card.categories || {};
    const categoryBenefit = categories[category] || categories["その他"];
    
    if (categoryBenefit && this.validateCategoryConditions(categoryBenefit, merchant, category)) {
      const cashbackAmount = amount * (categoryBenefit.cashback / 100);
      // Fix: Convert points from per-100-yen basis to actual points earned
      const pointsEarned = (categoryBenefit.points / 100) * (amount / 100);
      return {
        cashbackAmount,
        pointsEarned,
        cashback: categoryBenefit.cashback
      };
    }

    // Use general cashback as fallback
    const generalCashback = card.generalCashback || 0;
    const cashbackAmount = amount * (generalCashback / 100);
    return {
      cashbackAmount,
      pointsEarned: cashbackAmount / (card.pointValue || 1.0),
      cashback: generalCashback
    };
  }

  private calculateOptimalityScore(card: CardBenefit, benefit: any, amount: number): number {
    // Score based on cashback amount, considering annual fee
    const monthlyFee = card.annualFee / 12;
    const netMonthlyBenefit = benefit.cashbackAmount - monthlyFee;
    
    // Boost score for no annual fee cards
    const feeBonus = card.annualFee === 0 ? 1.2 : 1.0;
    
    return netMonthlyBenefit * feeBonus;
  }

  private generateRecommendationReason(card: CardBenefit, merchant: string, category: string): string {
    const specialOffer = card.specialOffers.find(offer => 
      merchant.toLowerCase().includes(offer.merchant.toLowerCase())
    );

    if (specialOffer) {
      return `${merchant}で${specialOffer.cashback}%の高還元率`;
    }

    const categoryBenefit = card.categories[category];
    if (categoryBenefit && categoryBenefit.cashback > card.generalCashback) {
      return `${category}カテゴリで${categoryBenefit.cashback}%還元`;
    }

    return `基本還元率${card.generalCashback}%`;
  }

  private generateAlternativeReason(card: CardBenefit, merchant: string, category: string): string {
    const categoryBenefit = card.categories[category];
    if (categoryBenefit) {
      return `${category}で${categoryBenefit.cashback}%還元`;
    }
    return `基本${card.generalCashback}%還元`;
  }

  private getCurrentCard(): string {
    return this.userCards[0] || "現在のカード";
  }

  private getCurrentCardBenefit(amount: number, merchant: string, category: string): {
    cashbackAmount: number;
    pointsEarned: number;
    cashback: number;
  } {
    // Use first card in user's cards as current card
    const currentCard = this.cardDatabase.find(card => card.cardName === this.getCurrentCard());
    if (currentCard) {
      return this.calculateBenefit(currentCard, amount, merchant, category);
    }

    // Default benefit (average credit card)
    return {
      cashbackAmount: amount * 0.005, // 0.5%
      pointsEarned: amount * 0.005,
      cashback: 0.5
    };
  }

  private calculateConfidence(best: any, all: any[]): number {
    if (all.length < 2) return 0.5;
    
    const bestScore = best.score;
    const secondBestScore = all[1].score;
    
    // Higher confidence when there's a clear winner
    const scoreGap = bestScore - secondBestScore;
    return Math.min(0.95, 0.5 + (scoreGap / bestScore));
  }

  private getDefaultRecommendation(errorMessage?: string): OptimalCardRecommendation {
    const fallbackCard = this.cardDatabase.length > 0 ? this.cardDatabase[0].cardName : "楽天カード";
    const reason = errorMessage ? `エラー: ${errorMessage}` : "一般的に利用しやすいカード";
    
    return {
      bestCard: fallbackCard,
      currentCard: "現在のカード",
      potentialSavings: 0,
      cashbackAmount: 0,
      pointsEarned: 0,
      reason,
      confidence: 0.3,
      alternatives: []
    };
  }

  private groupByCategory(transactions: CreditTransaction[]): {[category: string]: CreditTransaction[]} {
    return transactions.reduce((groups, tx) => {
      if (!groups[tx.category]) {
        groups[tx.category] = [];
      }
      groups[tx.category].push(tx);
      return groups;
    }, {} as {[category: string]: CreditTransaction[]});
  }

  private findOptimalCardForCategory(category: string, monthlyAmount: number): CardBenefit {
    return this.cardDatabase.reduce((best, card) => {
      const benefit = this.calculateBenefit(card, monthlyAmount, '', category);
      const bestBenefit = this.calculateBenefit(best, monthlyAmount, '', category);
      
      return benefit.cashbackAmount > bestBenefit.cashbackAmount ? card : best;
    });
  }

  private isOfferValid(offer: any): boolean {
    if (!offer.validUntil) return true;
    
    const expiryDate = new Date(offer.validUntil);
    return expiryDate > new Date();
  }

  private matchesMerchant(transactionMerchant: string, offerMerchant: string): boolean {
    const normalizeText = (text: string) => text.toLowerCase().replace(/[\s\-\u30FB]/g, '');
    const txMerchant = normalizeText(transactionMerchant);
    const offerMerch = normalizeText(offerMerchant);
    
    // Exact match or contains
    if (txMerchant === offerMerch || txMerchant.includes(offerMerch) || offerMerch.includes(txMerchant)) {
      return true;
    }
    
    // Check merchant aliases
    for (const [canonical, aliases] of Object.entries(this.merchantAliases)) {
      const normalizedCanonical = normalizeText(canonical);
      if (normalizedCanonical === offerMerch || offerMerch.includes(normalizedCanonical)) {
        // Check if transaction merchant matches any alias
        for (const alias of aliases) {
          if (txMerchant.includes(normalizeText(alias))) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  private normalizeCategory(category: string): string {
    const categoryLower = category.toLowerCase();
    
    // Find matching standardized category
    for (const [standardCategory, variations] of Object.entries(this.categoryMapping)) {
      for (const variation of variations) {
        if (categoryLower === variation.toLowerCase()) {
          return variations[0]; // Return primary Japanese term
        }
      }
    }
    
    return category; // Return original if no mapping found
  }

  private validateOfferConditions(offer: any, merchant: string, category: string): boolean {
    if (!offer.conditions) return true;
    
    // Simple condition validation - can be expanded
    const conditions = offer.conditions.toLowerCase();
    
    // Check if merchant matches specific conditions
    if (conditions.includes('タッチ決済')) {
      // In real implementation, would check payment method
      return true; // Assume touch payment capable
    }
    
    return true; // Default to true for now
  }

  private validateCategoryConditions(categoryBenefit: any, merchant: string, category: string): boolean {
    if (!categoryBenefit.conditions) return true;
    
    const conditions = categoryBenefit.conditions.toLowerCase();
    const merchantLower = merchant.toLowerCase();
    
    // Check specific merchant conditions
    if (conditions.includes('楽天市場') && !merchantLower.includes('楽天')) {
      return false;
    }
    if (conditions.includes('amazon') && !merchantLower.includes('amazon')) {
      return false;
    }
    if (conditions.includes('eneos') && !merchantLower.includes('eneos')) {
      return false;
    }
    if (conditions.includes('セブン-イレブン') && !merchantLower.includes('セブン') && !merchantLower.includes('seven')) {
      return false;
    }
    if (conditions.includes('ローソン') && !merchantLower.includes('ローソン') && !merchantLower.includes('lawson')) {
      return false;
    }
    if (conditions.includes('スターバックス') && !merchantLower.includes('スターバックス') && !merchantLower.includes('starbucks')) {
      return false;
    }
    
    return true;
  }

  private startLocationMonitoring(): void {
    this.locationUpdateInterval = window.setInterval(async () => {
      try {
        const position = await this.getCurrentPosition();
        await this.checkLocationBasedOffers(position);
      } catch (error) {
        console.error('Location monitoring error:', error);
      }
    }, 60000); // Check every minute
  }

  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  }

  private async checkLocationBasedOffers(position: GeolocationPosition): Promise<void> {
    // Mock implementation - in real app would call location API
    const nearbyMerchants = [
      { name: "スターバックス", category: "カフェ", distance: 100 },
      { name: "セブン-イレブン", category: "コンビニ", distance: 50 }
    ];

    for (const merchant of nearbyMerchants) {
      if (merchant.distance < 200) { // Within 200m
        const recommendation = await this.recommendOptimalCard(500, merchant.name, merchant.category);
        
        if (recommendation.potentialSavings > 10) {
          await this.sendRealTimeAlert({
            type: 'optimal_card',
            priority: 'medium',
            title: `💳 ${merchant.name}でお得なカード`,
            message: `${recommendation.bestCard}で¥${Math.round(recommendation.potentialSavings)}お得に`,
            action: {
              text: '詳細を見る',
              callback: () => window.dispatchEvent(new CustomEvent('show-card-recommendation', { detail: recommendation }))
            },
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
            locationBased: true
          });
        }
      }
    }
  }

  private startBudgetMonitoring(): void {
    // Monitor budget thresholds
    setInterval(() => {
      this.checkBudgetThresholds();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private checkBudgetThresholds(): void {
    // Implementation would check actual spending vs budget
    // This is a simplified version
    const monthlySpending = 150000; // Mock current spending
    const monthlyBudget = 180000; // Mock budget
    
    const percentageUsed = (monthlySpending / monthlyBudget) * 100;
    
    if (percentageUsed > 90) {
      this.sendRealTimeAlert({
        type: 'budget_warning',
        priority: 'urgent',
        title: '⚠️ 予算の90%に到達',
        message: `今月の支出: ¥${monthlySpending.toLocaleString()}/¥${monthlyBudget.toLocaleString()}`,
        action: {
          text: '支出を確認',
          callback: () => window.dispatchEvent(new CustomEvent('show-budget-details'))
        }
      });
    }
  }

  private startPointExpiryMonitoring(): void {
    // Check for expiring points monthly
    setInterval(() => {
      this.checkExpiringPoints();
    }, 24 * 60 * 60 * 1000); // Daily check
  }

  private checkExpiringPoints(): void {
    // Mock implementation - would check actual point balances
    const expiringPoints = [
      { card: "楽天カード", points: 1500, expiryDate: "2024-01-31" }
    ];

    expiringPoints.forEach(pointInfo => {
      const daysUntilExpiry = Math.ceil(
        (new Date(pointInfo.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry <= 30) {
        this.sendRealTimeAlert({
          type: 'point_expiry',
          priority: daysUntilExpiry <= 7 ? 'urgent' : 'high',
          title: '💎 ポイント有効期限注意',
          message: `${pointInfo.card}の${pointInfo.points}ポイントが${daysUntilExpiry}日後に失効`,
          action: {
            text: 'ポイントを使う',
            url: 'https://point.rakuten.co.jp'
          }
        });
      }
    });
  }

  private startDealMonitoring(): void {
    // Check for special deals and campaigns
    setInterval(() => {
      this.checkSpecialDeals();
    }, 60 * 60 * 1000); // Check hourly
  }

  private checkSpecialDeals(): void {
    // Mock implementation - would check deal APIs
    const activeDeals = [
      {
        merchant: "Amazon",
        discount: "20%キャッシュバック",
        card: "JCBカード W",
        validUntil: "今日まで"
      }
    ];

    activeDeals.forEach(deal => {
      this.sendRealTimeAlert({
        type: 'deal_alert',
        priority: 'medium',
        title: `🎯 ${deal.merchant}でお得`,
        message: `${deal.card}で${deal.discount} (${deal.validUntil})`,
        action: {
          text: 'ショッピングに行く',
          url: `https://amazon.co.jp`
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    });
  }

  private async sendPushNotification(alert: RealTimeAlert): Promise<void> {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(alert.title, {
        body: alert.message,
        icon: '/icons/icon-192x192.png',
        tag: alert.type,
        requireInteraction: alert.priority === 'urgent'
      });
    }
  }

  // Public methods for setting user data
  setUserCards(cards: string[]): void {
    this.userCards = cards;
  }

  addUserCard(cardName: string): void {
    if (!this.userCards.includes(cardName)) {
      this.userCards.push(cardName);
    }
  }

  removeUserCard(cardName: string): void {
    this.userCards = this.userCards.filter(card => card !== cardName);
  }

  getAvailableCards(): CardBenefit[] {
    return this.cardDatabase;
  }

  // Clean up when component unmounts
  destroy(): void {
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
    }
  }
}

export const smartRecommendationService = new SmartRecommendationService();