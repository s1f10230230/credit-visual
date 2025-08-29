// src/lib/mailMetaGate.ts
// 本文を取る前に、From/Subject/Label/List-Unsubscribe でプロモを雑に落とす

export type MetaLite = {
  id: string;
  from: string;     // raw "From"
  subject: string;  // raw "Subject"
  labelIds: string[];  // e.g. ["CATEGORY_PROMOTIONS","IMPORTANT"]
  headers: Record<string,string>;
};

const RX_DOMAIN = /@([^>\s]+)>?$/; // 末尾のドメイン抜き出し（"XXX <foo@bar.com>"にも対応）
const RX_IS_RECEIPT_SUBJECT =
  /(ご利用内容|ご利用明細|ご請求|請求額|ご請求額|ご注文|注文|領収|領収書|購入|決済|支払|支払い|receipt|invoice|order|payment|statement)/i;

const PROMO_SUBJECT =
  /(クーポン|キャンペーン|セール|割引|タイムセール|今だけ|ポイント|LIVE配信|先行発売|限定|特典|お得|プレゼント)/i;

const ALLOW_DOMAINS = new Set<string>([
  // 発行会社・決済・レシート系。ユーザーに合わせて増減
  "rakuten-card.co.jp",
  "mufgcard.com",
  "smbc-card.com",
  "jcb.co.jp",
  "aeon.co.jp",
  "visa.co.jp",
  "mastercard.com",
  "pay.rakuten.co.jp",
  "stripe.com",
  "unitedcinemas.jp",
  "amazon.co.jp",          // ※promotionsも多いので後述の二段ゲートで
  "contact.zozo.jp",       // 付与連絡はレシート寄りのことがある
]);

const BLOCK_DOMAINS = new Set<string>([
  // ログに出ている典型的なプロモ送信元
  "daytona-park.com",
  "yslb.jp",
  "jalan.net",
  "mynavi.jp",
  "salon-ms.jp",
  "vantagetradings.com",
  "ccg.nintendo.com",
  "minna-no-ginko.com",
]);

function extractDomain(from: string): string | null {
  const m = RX_DOMAIN.exec(from || "");
  if (!m) return null;
  return m[1].toLowerCase().replace(/^\s*|\s*$/g, "");
}

function hasListUnsubscribe(headers: Record<string,string>) {
  return Object.keys(headers).some(h => h.toLowerCase() === "list-unsubscribe");
}

export type MetaGateResult =
  | { pass: true; reason: string; weight: number } // weight: 優先度（高いほど強い候補）
  | { pass: false; reason: string };

export function metaGate(meta: MetaLite): MetaGateResult {
  const domain = extractDomain(meta.from);
  const subj = meta.subject || "";
  const labels = meta.labelIds || [];
  const unsub = hasListUnsubscribe(meta.headers);

  // 1) まず、明確なNG
  if (domain && BLOCK_DOMAINS.has(domain)) {
    return { pass: false, reason: "block-domain" };
  }
  if (PROMO_SUBJECT.test(subj)) {
    // ただし領収/注文などのレシート語が併存する場合は後段で拾えるよう弱NG
    if (!RX_IS_RECEIPT_SUBJECT.test(subj)) return { pass: false, reason: "promo-subject" };
  }

  // 2) Gmailカテゴリで雑除外（Promotionsは原則除外）
  //   → ただし許可ドメインは通す（Amazon領収・Stripe等がPromotionsに入ることがある）
  const isPromotions = labels.includes("CATEGORY_PROMOTIONS");
  if (isPromotions && (!domain || !ALLOW_DOMAINS.has(domain))) {
    return { pass: false, reason: "promotions-category" };
  }

  // 3) 強いポジティブ
  if (domain && ALLOW_DOMAINS.has(domain)) {
    // 件名がレシート系なら最優先
    if (RX_IS_RECEIPT_SUBJECT.test(subj)) {
      return { pass: true, reason: "allow-domain+receipt-subject", weight: 100 };
    }
    // AllowドメインかつPromotionsでないなら本文判定へ回す
    return { pass: true, reason: "allow-domain", weight: 80 };
  }

  // 4) List-Unsubscribe が付いてたら広告寄り → 弱めに落とす
  if (unsub && !RX_IS_RECEIPT_SUBJECT.test(subj)) {
    return { pass: false, reason: "list-unsubscribe-nonreceipt" };
  }

  // 5) 件名にレシート語があれば本文判定へ
  if (RX_IS_RECEIPT_SUBJECT.test(subj)) {
    return { pass: true, reason: "receipt-subject", weight: 60 };
  }

  // 6) どれでもなければ保留（今回は落とす）
  return { pass: false, reason: "no-positive-signal" };
}