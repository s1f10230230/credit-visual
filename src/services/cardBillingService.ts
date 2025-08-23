import cardBillingData from '../data/cardBillingCycles.json';

export interface BillingCycle {
  closingDate: number | 'variable';
  paymentDate: number | 'variable';
  description: string;
}

export interface CardBillingSettings {
  cardName: string;
  closingDate: number;
  paymentDate: number;
  isCustom: boolean;
}

class CardBillingService {
  private customSettings: Map<string, CardBillingSettings> = new Map();

  constructor() {
    this.loadCustomSettings();
  }

  // デフォルトの締め日・支払日を取得
  getDefaultBillingCycle(cardName: string): BillingCycle | null {
    const cycles = cardBillingData.cardBillingCycles as Record<string, BillingCycle>;
    
    // 完全一致を試行
    if (cycles[cardName]) {
      return cycles[cardName];
    }

    // 部分一致を試行（楽天カード、三井住友カードなど）
    for (const [key, value] of Object.entries(cycles)) {
      if (cardName.includes(key.replace('カード', '')) || key.includes(cardName.replace('カード', ''))) {
        return value;
      }
    }

    return null;
  }

  // カード設定を取得（カスタム設定 > デフォルト設定 > デフォルト値）
  getCardBillingSettings(cardName: string): CardBillingSettings {
    // カスタム設定があればそれを返す
    if (this.customSettings.has(cardName)) {
      return this.customSettings.get(cardName)!;
    }

    // デフォルト設定を取得
    const defaultCycle = this.getDefaultBillingCycle(cardName);
    
    if (defaultCycle && typeof defaultCycle.closingDate === 'number' && typeof defaultCycle.paymentDate === 'number') {
      return {
        cardName,
        closingDate: defaultCycle.closingDate,
        paymentDate: defaultCycle.paymentDate,
        isCustom: false
      };
    }

    // デフォルト値（月末締め、翌月27日払い）
    return {
      cardName,
      closingDate: 31, // 月末
      paymentDate: 27,
      isCustom: false
    };
  }

  // カスタム設定を保存
  setCustomBillingSettings(settings: CardBillingSettings): void {
    this.customSettings.set(settings.cardName, { ...settings, isCustom: true });
    this.saveCustomSettings();
  }

  // 現在の請求期間を計算
  getCurrentBillingPeriod(cardName: string, referenceDate: Date = new Date()): {
    periodStart: Date;
    periodEnd: Date;
    paymentDate: Date;
  } {
    const settings = this.getCardBillingSettings(cardName);
    const { closingDate, paymentDate } = settings;

    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();

    // 締め日の計算
    let periodEnd: Date;
    if (closingDate === 31) {
      // 月末締めの場合
      periodEnd = new Date(year, month + 1, 0); // 次月の0日 = 当月末
    } else {
      periodEnd = new Date(year, month, closingDate);
      
      // 現在日が締め日より後なら、次月の締め日
      if (referenceDate.getDate() > closingDate) {
        periodEnd = new Date(year, month + 1, closingDate);
      }
    }

    // 請求期間開始日（前月の締め日翌日）
    let periodStart: Date;
    if (closingDate === 31) {
      periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 1);
    } else {
      periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, closingDate + 1);
    }

    // 支払日の計算（締め日の翌月）
    const paymentDateObj = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, paymentDate);

    return {
      periodStart,
      periodEnd,
      paymentDate: paymentDateObj
    };
  }

  // 取引が属する請求期間を判定
  getTransactionBillingPeriod(transaction: { date: string; cardName?: string }, cardName?: string): {
    periodStart: Date;
    periodEnd: Date;
    paymentDate: Date;
    monthLabel: string;
  } {
    const transactionDate = new Date(transaction.date);
    const targetCardName = cardName || transaction.cardName || 'デフォルトカード';
    
    const settings = this.getCardBillingSettings(targetCardName);
    const { closingDate } = settings;

    const year = transactionDate.getFullYear();
    const month = transactionDate.getMonth();

    // 取引日が属する請求期間を特定
    let billingPeriodEnd: Date;
    
    if (closingDate === 31) {
      // 月末締めの場合
      if (transactionDate.getDate() <= 31) {
        billingPeriodEnd = new Date(year, month + 1, 0);
      } else {
        billingPeriodEnd = new Date(year, month + 2, 0);
      }
    } else {
      // 特定日締めの場合
      if (transactionDate.getDate() <= closingDate) {
        billingPeriodEnd = new Date(year, month, closingDate);
      } else {
        billingPeriodEnd = new Date(year, month + 1, closingDate);
      }
    }

    const billingPeriod = this.getCurrentBillingPeriod(targetCardName, billingPeriodEnd);
    const monthLabel = `${billingPeriod.periodEnd.getFullYear()}年${billingPeriod.periodEnd.getMonth() + 1}月`;

    return {
      ...billingPeriod,
      monthLabel
    };
  }

  // 利用可能なカードのリスト
  getAvailableCards(): string[] {
    const defaultCards = Object.keys(cardBillingData.cardBillingCycles);
    const customCards = Array.from(this.customSettings.keys());
    
    return [...new Set([...defaultCards, ...customCards])];
  }

  private saveCustomSettings(): void {
    const settingsArray = Array.from(this.customSettings.entries());
    localStorage.setItem('cardBillingCustomSettings', JSON.stringify(settingsArray));
  }

  private loadCustomSettings(): void {
    const saved = localStorage.getItem('cardBillingCustomSettings');
    if (saved) {
      try {
        const settingsArray = JSON.parse(saved) as [string, CardBillingSettings][];
        this.customSettings = new Map(settingsArray);
      } catch (error) {
        console.error('Failed to load custom billing settings:', error);
      }
    }
  }

  // 全カスタム設定をリセット
  resetAllCustomSettings(): void {
    this.customSettings.clear();
    localStorage.removeItem('cardBillingCustomSettings');
  }
}

export const cardBillingService = new CardBillingService();