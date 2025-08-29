// 動的カード発行会社対応パーサー
import cardIssuersConfig from '../config/card-issuers.json';
import { RawEmail, Txn } from './creditMail';

interface IssuerConfig {
  issuer: string;
  service_names: string[];
  from_domains: string[];
  subject_regex: string[];
  body_markers: string[];
  field_extractors: {
    date_time: string[];
    amount: string;
    merchant: string[];
  };
  notes: string;
}

interface CardIssuersConfig {
  spec_version: string;
  global_extractors: {
    amount: string;
    datetime_iso: string;
    datetime_jp: string;
    merchant_variants: string[];
  };
  issuers: IssuerConfig[];
}

class DynamicCardParser {
  private config: CardIssuersConfig;
  private compiledExtractors: Map<string, RegExp>;

  constructor() {
    this.config = cardIssuersConfig as CardIssuersConfig;
    this.compiledExtractors = new Map();
    this.compileExtractors();
  }

  private compileExtractors() {
    // Global extractors をコンパイル
    const global = this.config.global_extractors;
    this.compiledExtractors.set('amount', new RegExp(global.amount, 'gi'));
    this.compiledExtractors.set('datetime_iso', new RegExp(global.datetime_iso, 'gi'));
    this.compiledExtractors.set('datetime_jp', new RegExp(global.datetime_jp, 'gi'));

    // Merchant variants
    global.merchant_variants.forEach((pattern, index) => {
      this.compiledExtractors.set(`merchant_${index}`, new RegExp(pattern, 'gi'));
    });
  }

  // 発行会社を特定
  identifyIssuer(email: RawEmail): { issuer: IssuerConfig; confidence: 'high' | 'medium' | 'low' } | null {
    const fromDomain = this.extractDomainFromEmail(email.from || '');
    
    for (const issuer of this.config.issuers) {
      let score = 0;
      let matchReasons: string[] = [];

      // 1. From ドメインチェック (最高点)
      if (issuer.from_domains.some(domain => fromDomain.includes(domain))) {
        score += 100;
        matchReasons.push(`domain:${fromDomain}`);
      }

      // 2. 件名パターンチェック
      const subjectMatches = issuer.subject_regex.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(email.subject);
      });
      if (subjectMatches) {
        score += 50;
        matchReasons.push('subject_match');
      }

      // 3. 本文マーカーチェック
      const bodyMatches = issuer.body_markers.filter(marker => {
        return email.body.includes(marker);
      }).length;
      if (bodyMatches > 0) {
        score += bodyMatches * 20;
        matchReasons.push(`body_markers:${bodyMatches}`);
      }

      // 判定
      if (score >= 100) {
        console.log(`🎯 [DYNAMIC] High confidence issuer: ${issuer.issuer} (score: ${score}, reasons: ${matchReasons.join(', ')})`);
        return { issuer, confidence: 'high' };
      } else if (score >= 70) {
        console.log(`🎯 [DYNAMIC] Medium confidence issuer: ${issuer.issuer} (score: ${score}, reasons: ${matchReasons.join(', ')})`);
        return { issuer, confidence: 'medium' };
      } else if (score >= 30) {
        console.log(`🎯 [DYNAMIC] Low confidence issuer: ${issuer.issuer} (score: ${score}, reasons: ${matchReasons.join(', ')})`);
        return { issuer, confidence: 'low' };
      }
    }

    return null;
  }

  // 動的抽出
  extractTransaction(email: RawEmail): Txn | null {
    console.log('🔍 [DYNAMIC] Processing email:', email.subject?.substring(0, 50));

    // 発行会社特定
    const issuerResult = this.identifyIssuer(email);
    if (!issuerResult) {
      console.log('❌ [DYNAMIC] No issuer identified');
      return null;
    }

    const { issuer, confidence } = issuerResult;
    console.log(`✅ [DYNAMIC] Identified issuer: ${issuer.issuer} (${confidence})`);

    // 金額抽出
    const amount = this.extractAmount(email.body);
    if (!amount) {
      console.log('❌ [DYNAMIC] No amount found');
      return null;
    }

    // 店舗名抽出
    const merchant = this.extractMerchant(email.body);

    // 日付抽出
    const date = this.extractDate(email.body);

    console.log(`✅ [DYNAMIC] Extracted: ${amount}円, ${merchant || '不明店舗'}, ${date || '日付不明'}`);

    return {
      amount,
      date,
      merchant: merchant || undefined,
      sourceCard: issuer.issuer,
      source: 'usage',
      notes: `Dynamic parser: ${confidence} confidence`
    };
  }

  private extractDomainFromEmail(email: string): string {
    const match = email.match(/@([^>]+)/);
    return match ? match[1].toLowerCase() : '';
  }

  private extractAmount(text: string): number | null {
    const regex = this.compiledExtractors.get('amount');
    if (!regex) return null;

    const match = regex.exec(text);
    if (!match) return null;

    const amountStr = match[1]?.replace(/[,，]/g, '');
    const amount = parseInt(amountStr, 10);
    
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  private extractMerchant(text: string): string | null {
    // Try all merchant patterns
    for (let i = 0; i < this.config.global_extractors.merchant_variants.length; i++) {
      const regex = this.compiledExtractors.get(`merchant_${i}`);
      if (!regex) continue;

      const match = regex.exec(text);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractDate(text: string): string | null {
    // Try ISO format first
    const isoRegex = this.compiledExtractors.get('datetime_iso');
    if (isoRegex) {
      const match = isoRegex.exec(text);
      if (match && match[1]) {
        // Convert to YYYY-MM-DD format
        const dateStr = match[1].replace(/[年月]/g, '/').replace(/日/g, '');
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }

    // Try Japanese format
    const jpRegex = this.compiledExtractors.get('datetime_jp');
    if (jpRegex) {
      const match = jpRegex.exec(text);
      if (match && match[1] && match[2] && match[3]) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    return null;
  }
}

export const dynamicCardParser = new DynamicCardParser();
export { type IssuerConfig };