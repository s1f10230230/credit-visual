import { EmailData } from './gmailService';

/**
 * クレジットカード利用通知メールの高精度フィルタリングサービス
 * 広告メール（LabBase、Jalanなど）を除外し、真の利用通知メールのみを抽出
 */
export class CreditCardEmailFilter {
  // 主要カード会社のドメインホワイトリスト
  private static CARD_COMPANY_DOMAINS = [
    // 楽天カード
    'rakuten-card.co.jp',
    'mail.rakuten-card.co.jp',
    
    // 三井住友カード
    'smbc-card.com',
    'smbc-card.co.jp',
    'mail.smbc-card.com',
    
    // JCB
    'jcb.co.jp',
    'mail.jcb.co.jp',
    'jcb.com',
    
    // MUFG（三菱UFJ）
    'cr.mufg.jp',
    'nicos.co.jp',
    'dccard.co.jp',
    
    // みずほ銀行・カード
    'mizuhobank.co.jp',
    'mizuho-fg.co.jp',
    'uccards.co.jp',
    
    // セゾンカード
    'saisoncard.co.jp',
    'saison-card.co.jp',
    
    // イオンカード
    'aeon.co.jp',
    'aeonbank.co.jp',
    'aeoncredit.co.jp',
    
    // エポスカード
    'eposcard.co.jp',
    
    // オリコカード
    'orico.co.jp',
    
    // ジャックスカード
    'jaccs.co.jp',
    
    // ダイナースクラブ
    'diners.co.jp',
    
    // アメリカン・エキスプレス
    'americanexpress.co.jp',
    'americanexpress.com',
    
    // View（ビューカード）
    'jreast.co.jp',
    'viewcard.co.jp',
    
    // その他主要カード
    'lifecard.co.jp',
    'jaccs.co.jp',
    'cedyna.co.jp',
    'pocketcard.co.jp'
  ];

  // 広告・プロモーションメールのネガティブキーワード
  private static PROMOTIONAL_KEYWORDS = [
    // キャンペーン系
    'キャンペーン', 'campaign', 'セール', 'sale', 'クーポン', 'coupon',
    'プレゼント', 'present', 'ギフト', 'gift', '当選', '抽選',
    
    // 期間限定系
    '期間限定', '特別価格', '割引', 'discount', 'off', '％OFF',
    '今だけ', 'タイムセール', '限定オファー', 'special offer',
    
    // アクション系
    '今すぐクリック', 'click here', '詳細はこちら', 'more details',
    '申し込み', 'apply now', '登録', 'register', '予約', 'booking',
    
    // 企業固有（既知の誤検出源）
    'LabBase', 'labbase', 'Jalan', 'jalan', 'じゃらん'
  ];

  // 利用通知メール特有のキーワード
  private static TRANSACTION_KEYWORDS = [
    // 件名によく含まれるフレーズ
    'カード利用', 'ご利用', '利用通知', '決済完了', 'お支払い完了',
    'transaction', 'payment', 'charge',
    
    // 本文によく含まれるフレーズ
    '利用日', '利用先', '利用金額', 'ご利用金額', '決済金額',
    '加盟店', '店舗', '支払方法', '一回払い'
  ];

  // 配信停止系のフレーズ（広告メールの特徴）
  private static UNSUBSCRIBE_PATTERNS = [
    '配信停止', 'unsubscribe', '配信解除', '購読解除',
    'メール配信', 'newsletter', 'メルマガ', 'opt-out',
    '今後このようなメール', 'メール設定'
  ];

  /**
   * メールがクレジットカード利用通知かどうかを判定
   */
  static isValidTransactionEmail(email: EmailData): {
    isValid: boolean;
    confidence: number;
    reason: string;
    filterResults: {
      domainCheck: boolean;
      negativeKeywordCheck: boolean;
      transactionKeywordCheck: boolean;
      structureCheck: boolean;
      unsubscribeCheck: boolean;
    };
  } {
    const { subject, body, from } = email;
    let confidence = 0;
    const reasons: string[] = [];
    
    // 1. ドメインチェック
    const domainCheck = this.checkDomain(from);
    if (domainCheck.isValid) {
      confidence += 0.4; // 高い重み
      reasons.push(`信頼できるカード会社ドメイン: ${domainCheck.domain}`);
    } else {
      confidence -= 0.3;
      reasons.push(`未知のドメイン: ${domainCheck.domain}`);
    }

    // 2. ネガティブキーワードチェック（広告メール除外）
    const negativeCheck = this.checkNegativeKeywords(subject, body);
    if (negativeCheck.hasPromoKeywords) {
      confidence -= 0.5; // 大きく減点
      reasons.push(`プロモーション要素検出: ${negativeCheck.keywords.join(', ')}`);
    }

    // 3. 取引通知キーワードチェック
    const transactionCheck = this.checkTransactionKeywords(subject, body);
    if (transactionCheck.score > 0) {
      confidence += transactionCheck.score * 0.3;
      reasons.push(`取引通知キーワード: ${transactionCheck.keywords.join(', ')}`);
    }

    // 4. メール構造チェック（金額・日付・店舗の存在）
    const structureCheck = this.checkEmailStructure(body);
    if (structureCheck.hasValidStructure) {
      confidence += 0.2;
      reasons.push('取引詳細情報を確認');
    }

    // 5. 配信停止リンクチェック（広告メールの特徴）
    const unsubscribeCheck = this.checkUnsubscribeIndicators(subject, body);
    if (unsubscribeCheck.hasUnsubscribe) {
      confidence -= 0.3;
      reasons.push('配信停止要素を検出（広告メールの可能性）');
    }

    const isValid = confidence > 0.3; // 閾値調整可能
    
    return {
      isValid,
      confidence: Math.max(0, Math.min(1, confidence)),
      reason: reasons.join('; '),
      filterResults: {
        domainCheck: domainCheck.isValid,
        negativeKeywordCheck: !negativeCheck.hasPromoKeywords,
        transactionKeywordCheck: transactionCheck.score > 0,
        structureCheck: structureCheck.hasValidStructure,
        unsubscribeCheck: !unsubscribeCheck.hasUnsubscribe
      }
    };
  }

  /**
   * 送信元ドメインをチェック
   */
  private static checkDomain(from: string): { isValid: boolean; domain: string } {
    const emailMatch = from.match(/@([^>]+)/);
    if (!emailMatch) return { isValid: false, domain: 'unknown' };
    
    const domain = emailMatch[1].toLowerCase().trim();
    
    // 完全一致チェック
    const isExactMatch = this.CARD_COMPANY_DOMAINS.some(cardDomain => 
      domain === cardDomain || domain.endsWith('.' + cardDomain)
    );

    if (isExactMatch) {
      return { isValid: true, domain };
    }

    // 部分一致でも主要キーワードが含まれる場合は許可
    const cardKeywords = ['card', 'credit', '銀行', 'bank', 'financial'];
    const hasCardKeyword = cardKeywords.some(keyword => 
      domain.includes(keyword)
    );

    return { 
      isValid: hasCardKeyword, 
      domain 
    };
  }

  /**
   * ネガティブキーワード（広告要素）をチェック
   */
  private static checkNegativeKeywords(subject: string, body: string): { 
    hasPromoKeywords: boolean; 
    keywords: string[] 
  } {
    const text = (subject + ' ' + body).toLowerCase();
    const foundKeywords = this.PROMOTIONAL_KEYWORDS.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );

    return {
      hasPromoKeywords: foundKeywords.length > 0,
      keywords: foundKeywords
    };
  }

  /**
   * 取引通知特有のキーワードをチェック
   */
  private static checkTransactionKeywords(subject: string, body: string): {
    score: number;
    keywords: string[]
  } {
    const text = (subject + ' ' + body).toLowerCase();
    const foundKeywords = this.TRANSACTION_KEYWORDS.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );

    // キーワード数に基づくスコア（正規化）
    const score = Math.min(foundKeywords.length / this.TRANSACTION_KEYWORDS.length, 1);

    return {
      score,
      keywords: foundKeywords
    };
  }

  /**
   * メール構造をチェック（金額、日付、店舗情報の存在）
   */
  private static checkEmailStructure(body: string): { 
    hasValidStructure: boolean;
    elements: string[]
  } {
    const foundElements: string[] = [];

    // 金額パターン
    const amountPatterns = [
      /[¥￥]?[\d,]+\s*円/,
      /金額[：:\s]*[¥￥]?[\d,]+\s*円/,
      /\d+\s*yen/i
    ];
    if (amountPatterns.some(pattern => pattern.test(body))) {
      foundElements.push('金額');
    }

    // 日付パターン
    const datePatterns = [
      /\d{4}[年\/\-]\d{1,2}[月\/\-]\d{1,2}/,
      /利用日/,
      /\d{1,2}\/\d{1,2}\/\d{4}/
    ];
    if (datePatterns.some(pattern => pattern.test(body))) {
      foundElements.push('日付');
    }

    // 店舗・利用先パターン
    const merchantPatterns = [
      /利用先/,
      /加盟店/,
      /店舗/,
      /ご利用先/
    ];
    if (merchantPatterns.some(pattern => pattern.test(body))) {
      foundElements.push('利用先');
    }

    return {
      hasValidStructure: foundElements.length >= 2, // 最低2要素必要
      elements: foundElements
    };
  }

  /**
   * 配信停止要素をチェック（広告メールの特徴）
   */
  private static checkUnsubscribeIndicators(subject: string, body: string): {
    hasUnsubscribe: boolean;
    indicators: string[]
  } {
    const text = (subject + ' ' + body).toLowerCase();
    const foundIndicators = this.UNSUBSCRIBE_PATTERNS.filter(pattern => 
      text.includes(pattern.toLowerCase())
    );

    return {
      hasUnsubscribe: foundIndicators.length > 0,
      indicators: foundIndicators
    };
  }

  /**
   * 複数メールを一括フィルタリング
   */
  static filterTransactionEmails(emails: EmailData[]): {
    validEmails: EmailData[];
    rejectedEmails: Array<{
      email: EmailData;
      reason: string;
      confidence: number;
    }>;
    stats: {
      total: number;
      valid: number;
      rejected: number;
      confidence: {
        high: number; // > 0.7
        medium: number; // 0.3 - 0.7
        low: number; // < 0.3
      };
    };
  } {
    const validEmails: EmailData[] = [];
    const rejectedEmails: Array<{
      email: EmailData;
      reason: string;
      confidence: number;
    }> = [];

    let highConfidence = 0;
    let mediumConfidence = 0;
    let lowConfidence = 0;

    for (const email of emails) {
      const result = this.isValidTransactionEmail(email);
      
      if (result.confidence > 0.7) highConfidence++;
      else if (result.confidence >= 0.3) mediumConfidence++;
      else lowConfidence++;

      if (result.isValid) {
        validEmails.push(email);
      } else {
        rejectedEmails.push({
          email,
          reason: result.reason,
          confidence: result.confidence
        });
      }
    }

    return {
      validEmails,
      rejectedEmails,
      stats: {
        total: emails.length,
        valid: validEmails.length,
        rejected: rejectedEmails.length,
        confidence: {
          high: highConfidence,
          medium: mediumConfidence,
          low: lowConfidence
        }
      }
    };
  }

  /**
   * フィルタ設定をカスタマイズ
   */
  static customizeFilter(options: {
    additionalDomains?: string[];
    additionalNegativeKeywords?: string[];
    confidenceThreshold?: number;
  }): void {
    if (options.additionalDomains) {
      this.CARD_COMPANY_DOMAINS.push(...options.additionalDomains);
    }

    if (options.additionalNegativeKeywords) {
      this.PROMOTIONAL_KEYWORDS.push(...options.additionalNegativeKeywords);
    }

    // 閾値は今回の実装では静的ですが、将来的に動的変更可能に
  }
}