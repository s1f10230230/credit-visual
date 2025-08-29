// src/lib/mailFilter.ts
export type MailMeta = {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  labelIds?: string[];
  headers?: Record<string, string>;
};
export type MailText = { plain?: string; html?: string };
export type Classification =
  | { ok: true; lane: "issuer" | "merchant"; amountYen: number; reasons: string[] }
  | { ok: false; lane?: "issuer" | "merchant"; reasons: string[] };

// --- 正規表現 & 語彙を拡張（円/¥なし合計も拾う、英語件名も拾う）
const AMOUNT_YEN_RE =
  /(?<!第)(?<![0-9])([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,6})(?:\s*|　*)(?:円|JPY|￥)?(?!以上)/;
const CONTEXT_RE =
  /(利用|請求|請求額|ご請求金額|明細|注文|ご注文|領収|領収書|購入|決済|支払|支払い|課金|subscription|charged|charge|amount|invoice|receipt|order)/i;
const PROMO_RE =
  /(クーポン|キャンペーン|セール|割引コード|タイムセール|今だけ|ポイント還元|ポイントアップ|メルマガ)/i;

const MIN_YEN = 50;
const MAX_YEN = 1_000_000;

const ISSUER_DOMAINS = [
  "@rakuten-card.co.jp",
  "@smbc-card.com",
  "@jcb.co.jp",
  "@aeon.co.jp",
  "@visa.co.jp",
  "@mastercard.com",
];

export function buildSafeGmailQuery(days = 365) {
  // 入口を広めに（英語件名も含める）。広告っぽい除外は最小限に。
  return [
    `newer_than:${days}d`,
    '(' +
      [
        'subject:(ご利用 OR 利用 OR 請求 OR 請求額 OR 明細 OR 注文 OR 領収 OR 購入 OR 決済)',
        'subject:(receipt OR order OR invoice OR statement OR payment)',
        '"ご利用金額"',
        '"領収書"',
        '"円"',
        '"¥"',
      ].join(' OR ') +
      ')',
    // ※ 強い除外はここではしない（本文で捌く）
  ].join(' ');
}

function normalize(s: string) {
  return s.replace(/\r/g, "\n").replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").trim();
}
function htmlToText(html: string) {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const noStyle = noScript.replace(/<style[\s\S]*?<\/style>/gi, "");
  return normalize(
    noStyle.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ")
  );
}
function pickBodyText(body: MailText) {
  if (body.plain && body.plain.trim()) return normalize(body.plain);
  if (body.html && body.html.trim()) return htmlToText(body.html);
  return "";
}
function hasIssuerDomain(from: string) {
  const f = (from || "").toLowerCase();
  return ISSUER_DOMAINS.some((d) => f.includes(d));
}
function hasListUnsub(headers?: Record<string, string>) {
  if (!headers) return false;
  const k = Object.keys(headers).find((h) => h.toLowerCase() === "list-unsubscribe");
  return Boolean(k);
}

// --- 金額検出：複数箇所を走査し、どれか1つでもコンテキスト近傍を満たせばOK
function* iterAmountMatches(text: string) {
  const re = new RegExp(AMOUNT_YEN_RE, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) yield m;
}
function parseYen(s: string) {
  const n = parseInt(s.replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : NaN;
}
function hasContextAround(text: string, index: number, length: number, radius = 180) {
  const left = Math.max(0, index - radius);
  const right = Math.min(text.length, index + length + radius);
  return CONTEXT_RE.test(text.slice(left, right));
}

export function classifyMail(
  meta: MailMeta,
  body: MailText,
  logPrefix = ""
): Classification {
  const reasons: string[] = [];
  const subject = meta.subject || "";
  const from = meta.from || "";
  const text = pickBodyText(body);

  const lane: "issuer" | "merchant" = hasIssuerDomain(from) ? "issuer" : "merchant";
  reasons.push(lane === "issuer" ? "issuer-domain" : "merchant-lane");

  if (!text) return { ok: false, lane, reasons: [...reasons, "no-text"] };

  // 件名一次フィルタ：issuerはやや厳しめ、merchantは緩い
  const subjOk = /(ご利用|利用|請求|請求額|明細|注文|領収|購入|決済|receipt|order|invoice|payment|statement)/i.test(
    subject
  );
  if (lane === "issuer" && !subjOk) return { ok: false, lane, reasons: [...reasons, "issuer-subject-ng"] };

  // ★ 見逃し優先：プロモ語は「強い除外」ではなく減点扱い（後段の金額+文脈が勝つ）
  const promoish =
    PROMO_RE.test(subject) ||
    (hasListUnsub(meta.headers) && PROMO_RE.test(text.slice(0, 300)));

  // 最終ゲート：金額+周辺語（複数マッチのどれかでOK）
  let bestAmount: number | null = null;
  for (const m of iterAmountMatches(text)) {
    const yen = parseYen(m[1]);
    if (!Number.isFinite(yen)) continue;
    if (yen < MIN_YEN || yen > MAX_YEN) continue;

    // 「円/¥が無い場合」は近傍に「合計/請求額/ご請求金額」などがあるかも見る
    const hasCurrencyMark = /円|JPY|￥/.test(m[0]);
    const nearHasContext = hasContextAround(text, m.index, m[0].length, 180);
    if (nearHasContext && (hasCurrencyMark || /合計|請求額|ご請求金額/i.test(text))) {
      bestAmount = yen;
      break;
    }
  }

  if (bestAmount == null) return { ok: false, lane, reasons: [...reasons, "no-amount+context"] };

  // プロモっぽさがあっても、金額+文脈を満たしたら通す（見逃し優先）
  if (promoish) reasons.push("promoish");

  return { ok: true, lane, amountYen: bestAmount, reasons: [...reasons, "amount+context"] };
}