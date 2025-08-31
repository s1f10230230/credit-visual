// src/lib/flexibleMailFilter.ts
import officialDomainsConfig from '../config/official-domains.json';

export type MailMeta = {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  labelIds?: string[];
  headers?: Record<string, string>;
};

export type MailText = { plain?: string; html?: string };

export type TrustLevel = 'high' | 'medium' | 'low';

export type FlexibleClassification = {
  ok: boolean;
  trustLevel?: TrustLevel;
  amountYen?: number;
  extractedData: {
    amount?: number;
    date?: string;
    merchant?: string;
  };
  reasons: string[];
  confidence: number; // 0-100
};

// 正規表現パターン
const patterns = {
  // 金額抽出 - 年（20xx）直後を除外する負の先読み付き + 楽天カード対応
  amount: /■利用金額[:：]\s*([0-9０-９,，]+)\s*円|(?:¥|￥)\s*([0-9０-９,，]+)(?!\s*20\d{2})|([0-9０-９,，]+)\s*円(?!\s*20\d{2})|([0-9０-９,，]+)\s*JPY\b/gi,
  
  // 日付 + 時刻（任意）対応
  date: /(\d{4})[\/年\-.](\d{1,2})[\/月\-.](\d{1,2})(?:[日\s]|\s+)?(\d{1,2}:\d{2})?/g,
  
  // 店舗名パターン (グローバルフラグ削除でmatch[1]問題を修正)
  merchant: {
    // 楽天カード: ■利用先: 形式 (Apple決済対応 - 最優先)
    rakuten: /■利用先[:：]\s*([A-Z0-9\s]+)/i,
    labeled: /(?:ご利用先|利用先|店名|加盟店|merchant)[:：]\s*(.+?)(?:\n|$)/i,
    bracket: /【(.+?)】/,
    parenthesis: /(.+?)（.+?）/,
    // 行頭: 任意文字列（数字含まない） + 空白 + 金額
    inlineBeforeAmount: /^([^\d\n\r]+?)\s+[0-9,，]+円/m
  },
  
  // 件名・本文の緩やかな判定パターン
  creditRelated: /(ご利用|利用|請求|請求額|明細|注文|領収|購入|決済|支払|課金|charged|charge|payment|receipt|invoice)/gi,
  
  // 除外すべきプロモパターン
  promotional: /(クーポン|キャンペーン|セール|割引|ポイント還元|メルマガ|newsletter)/gi
};

// ドメイン判定
function extractDomainFromEmail(email: string): string {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].toLowerCase().trim() : '';
}

function getDomainTrustLevel(domain: string): TrustLevel | null {
  const config = officialDomainsConfig;
  
  // より厳密に: サブドメインは許容するが endsWith で判定
  if (config.domains.primary_issuers.some(d => domain.endsWith(d))) {
    return 'high';
  }
  
  if (config.domains.trusted_merchants.some(d => domain.endsWith(d))) {
    return 'medium';
  }
  
  if (config.domains.user_added.some(d => domain.endsWith(d))) {
    return 'medium';
  }
  
  return null;
}

// 正規化関数
function normalizeAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  
  // 全角数字を半角に変換
  const normalized = amountStr
    .replace(/[０-９]/g, (d) => String('０１２３４５６７８９'.indexOf(d)))
    .replace(/[,，]/g, '');
    
  const amount = parseInt(normalized, 10);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function chooseBestAmount(text: string, candidates: { match: RegExpMatchArray, amount: number }[]): number | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].amount;

  // コンテキスト語パターン - 金額近傍にあると信頼度UP
  const ctxRe = /(合計|総額|Amount|Total|ご利用金額|決済金額|支払|請求|課金|利用額)/i;
  
  const scored = candidates.map(({ match, amount }) => {
    const idx = match.index ?? text.indexOf(match[0]);
    let score = 0;
    
    // 直後に西暦が続くなら大幅減点（¥9152025 … など）
    const tail = text.slice(idx + match[0].length, idx + match[0].length + 6);
    if (/20\d{2}/.test(tail.replace(/\s/g, ''))) {
      score -= 100;
    }
    
    // 近傍±40文字にコンテキスト語があるか
    const context = text.slice(Math.max(0, idx - 40), idx + 40);
    if (ctxRe.test(context)) {
      score += 50;
    }
    
    // 単発レシート常識範囲（1〜300,000円）内なら加点
    if (amount >= 1 && amount <= 300_000) {
      score += 30;
    } else if (amount > 1_000_000) {
      score -= 20; // 100万超えは減点（月次請求の可能性はあるが）
    }
    
    return { amount, score, match };
  });
  
  // 最高スコアの候補を返す
  scored.sort((a, b) => b.score - a.score);
  return scored[0].score > -50 ? scored[0].amount : null; // あまりに低スコアなら除外
}

function extractAmountFromText(text: string): number | null {
  const matches = Array.from(text.matchAll(patterns.amount));
  
  const candidates: { match: RegExpMatchArray, amount: number }[] = [];
  
  for (const match of matches) {
    // Check which group matched - 楽天カード対応で match[1] も含む
    const amountStr = match[1] || match[2] || match[3] || match[4];
    if (amountStr) {
      const amount = normalizeAmount(amountStr);
      if (amount && amount >= 1 && amount <= 10_000_000) { // 上限は緩め（月次請求考慮）
        candidates.push({ match, amount });
      }
    }
  }
  
  return chooseBestAmount(text, candidates);
}

function extractDateFromText(text: string): string | null {
  const matches = text.matchAll(patterns.date);
  
  for (const match of matches) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    
    const date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date.getTime())) {
      return `${year}-${month}-${day}`;
    }
  }
  
  return null;
}

function extractMerchantFromText(text: string): string | null {
  // 楽天カード専用パターンを最優先
  let match = text.match(patterns.merchant.rakuten);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Try labeled patterns
  match = text.match(patterns.merchant.labeled);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Try bracket patterns
  match = text.match(patterns.merchant.bracket);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Try parenthesis patterns  
  match = text.match(patterns.merchant.parenthesis);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Try inline patterns: e.g. "ROCKET NOW 785円"
  match = text.match(patterns.merchant.inlineBeforeAmount);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  return null;
}

function pickBodyText(body: MailText): string {
  if (body.plain && body.plain.trim()) {
    return body.plain
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')         // NBSP
      .replace(/&yen;|&#165;/gi, '¥')  // HTMLエンティティ
      .trim();
  }
  if (body.html && body.html.trim()) {
    // Enhanced HTML to text conversion preventing number concatenation
    return body.html
      .replace(/&yen;|&#165;/gi, '¥')   // 通貨
      .replace(/&nbsp;|\u00A0/gi, ' ')   // NBSP→半角スペース
      .replace(/>\s*</g, '>\n<')         // タグの隣接を改行で分離
      .replace(/([0-9０-９])年/g, '$1 年') // 連結しがちな箇所に薄い区切り
      .replace(/([0-9０-９])月/g, '$1 月')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

export function buildFlexibleGmailQuery(days = 365): string {
  // 非常に緩やかなクエリ - 金額関連の可能性があるものは全部拾う
  return [
    `newer_than:${days}d`,
    '(' + [
      // 件名パターン
      'subject:(利用 OR 請求 OR 明細 OR 注文 OR 領収 OR 購入 OR 決済 OR 支払)',
      'subject:(receipt OR order OR invoice OR statement OR payment OR charge)',
      
      // 本文に含まれがちなパターン
      '"ご利用金額"',
      '"利用金額"', 
      '"請求金額"',
      '"円"',
      '"¥"',
      '"JPY"',
      
      // カード会社ドメイン
      'from:(rakuten-card.co.jp OR smbc-card.com OR jcb.co.jp OR mufg.jp OR aeon.co.jp)'
    ].join(' OR ') + ')'
  ].join(' ');
}

export function classifyMailFlexibly(
  meta: MailMeta,
  body: MailText,
  logPrefix = ''
): FlexibleClassification {
  console.log(`${logPrefix}🔍 [FLEXIBLE] Processing: ${meta.subject?.substring(0, 50)}`);
  
  const reasons: string[] = [];
  const subject = meta.subject || '';
  const from = meta.from || '';
  const text = pickBodyText(body);
  
  let confidence = 0;
  let trustLevel: TrustLevel = 'low';
  
  if (!text) {
    console.log(`${logPrefix}❌ [FLEXIBLE] No email body text`);
    return {
      ok: false,
      extractedData: {},
      reasons: ['no-text'],
      confidence: 0
    };
  }
  
  // 1) ドメインチェック
  const domain = extractDomainFromEmail(from);
  const domainTrust = getDomainTrustLevel(domain);
  
  if (domainTrust === 'high') {
    trustLevel = 'high';
    confidence += 50;
    reasons.push('official-issuer-domain');
  } else if (domainTrust === 'medium') {
    trustLevel = 'medium';
    confidence += 30;
    reasons.push('trusted-domain');
  } else {
    reasons.push('unknown-domain');
  }
  
  // 2) 件名・本文のクレジット関連チェック
  const subjectMatches = (subject.match(patterns.creditRelated) || []).length;
  const bodyMatches = (text.match(patterns.creditRelated) || []).length;
  
  if (subjectMatches > 0) {
    confidence += 20;
    reasons.push('credit-related-subject');
  }
  
  if (bodyMatches > 0) {
    confidence += 10;
    reasons.push('credit-related-content');
  }
  
  // 3) プロモーション除外チェック（但し完全排除はしない）
  const promoMatches = (subject + text).match(patterns.promotional);
  if (promoMatches && promoMatches.length > 2) {
    confidence -= 20;
    reasons.push('promotional-content');
  }
  
  // 4) 金額抽出 - これが最重要！
  const amount = extractAmountFromText(text);
  if (!amount) {
    console.log(`${logPrefix}❌ [FLEXIBLE] No amount found`);
    return {
      ok: false,
      extractedData: {},
      reasons: [...reasons, 'no-amount'],
      confidence: Math.max(0, confidence - 30)
    };
  }
  
  confidence += 30; // 金額が取れれば大幅加点
  reasons.push('amount-extracted');
  
  // 5) 日付・店舗名抽出（オプション）
  const date = extractDateFromText(text);
  const merchant = extractMerchantFromText(text);
  
  if (date) {
    confidence += 10;
    reasons.push('date-extracted');
  }
  
  if (merchant) {
    confidence += 10;
    reasons.push('merchant-extracted');
  }
  
  // 6) 最終判定
  const finalTrustLevel = confidence >= 60 ? 'high' : 
                         confidence >= 40 ? 'medium' : 'low';
  
  console.log(`${logPrefix}✅ [FLEXIBLE] Success: amount=${amount}, trust=${finalTrustLevel}, confidence=${confidence}`);
  
  return {
    ok: true,
    trustLevel: finalTrustLevel,
    amountYen: amount,
    extractedData: {
      amount,
      date,
      merchant
    },
    reasons,
    confidence
  };
}