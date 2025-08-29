// === simple classifier 改良版 ===
// 「数値＋広いトリガ語」から「金額の厳密な文脈」に変更
type MailMeta = { id: string; subject: string; from: string };
type MailText = { plain?: string; html?: string };

// RX_AMOUNT removed - now using extractAmountJp() for better year-date filtering

// 「取引っぽい"金額ラベル"」← これを近傍に要求
const RX_AMOUNT_LABEL = /(ご利用金額|利用金額|請求額|ご請求額|合計|お支払い金額|決済金額|税込|小計|領収金額)/i;

// "完了/明細/レシート"系の強トリガ（広い「利用/注文」ではなく）
const RX_STRONG_CONTEXT =
  /(決済が完了|支払いが完了|受領|領収書|レシート|ご利用明細|ご利用内容|ご請求|請求明細|statement|receipt|invoice|charged|payment)/i;

// プロモ語（これが金額の近くにあると弾く）
const RX_PROMO_NEAR = /(クーポン|OFF|％OFF|%OFF|割引|セール|キャンペーン|ポイント|還元|抽選|プレゼント|特別価格|限定)/i;

// 日付（近傍に1つでもあれば加点）
const RX_DATE_NEAR =
  /(20[0-9]{2}[\/\-年\.](?:0?[1-9]|1[0-2])[\/\-月\.](?:0?[1-9]|[12][0-9]|3[01])日?|\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12][0-9]|3[01])\b)/;

const MIN_YEN = 50;
const MAX_YEN = 1_000_000;

export function buildSimpleGmailQuery(days = 365): string {
  // 超シンプル版：まず期間を短くしてテスト
  console.log(`🔍 Building Gmail query for ${days} days`);
  
  // デバッグ用：非常に広いクエリから開始
  const queries = [
    `newer_than:7d`,           // まず1週間
    `newer_than:30d`,          // 1ヶ月
    `newer_than:${days}d`,     // 指定期間
  ];
  
  // 最初は短い期間でテスト
  const query = `newer_than:30d`;
  console.log(`📧 Using query: "${query}"`);
  return query;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function pickText(body: MailText): string {
  if (body.plain?.trim()) return body.plain.trim();
  if (body.html?.trim()) return htmlToText(body.html);
  return "";
}

function classifyWindow(win: string) {
  // 金額ラベル or 強トリガ が近傍にあるか
  const hasLabel = RX_AMOUNT_LABEL.test(win);
  const hasStrong = RX_STRONG_CONTEXT.test(win);
  // プロモ語が近傍にあるか
  const promoNear = RX_PROMO_NEAR.test(win);
  // 日付も近傍にあれば強い
  const hasDate = RX_DATE_NEAR.test(win);
  return { hasLabel, hasStrong, promoNear, hasDate };
}

// 金額抽出（日本語メール向け）
export function extractAmountJp(text: string): number | null {
  const t = text.replace(/\s+/g, ' ').trim();

  // 1) キーワード近傍を最優先（利用金額/ご請求額/お支払い金額/決済金額/合計）
  const keyword =
    /(利用金額|ご請求額|請求金額|お支払い金額|支払金額|決済金額|合計)[：:\s]*([¥￥]?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?:\s*円)?/i;
  const kw = t.match(keyword);
  if (kw) return normalizeYen(kw[2]);

  // 2) 通貨表記つき（円/￥/JPY）。年・日付を誤検出しない
  const moneyPatterns: RegExp[] = [
    /([¥￥]\s*\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g,         // ￥12,345
    /(\d{1,3}(?:,\d{3})+(?:\.\d+)?\s*円)/g,            // 12,345 円
    /(\d+(?:\.\d+)?\s*JPY)/gi,                         // 123 JPY
    // 数字だけ+円は拾うが「年/月/日」の直前直後は除外する
    /(?<![年月日/:-])(\d{1,3}(?:,\d{3})+|\d{3,})(?:\s*円)(?!\s*[年月日/:-])/g
  ];

  for (const re of moneyPatterns) {
    const all = [...t.matchAll(re)];
    if (all.length) {
      // 一番それっぽい（最大）を採用
      const nums = all.map(m => normalizeYen(m[1]));
      const best = Math.max(...nums.filter(n => !Number.isNaN(n)));
      if (isFinite(best)) return best;
    }
  }

  // 3) 最後の保険：行単位で「金額」ワードの行を探す
  const line = text.split(/\r?\n/).find(l => /金額|請求|支払|決済/.test(l));
  if (line) {
    const m = line.match(/([¥￥]?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?:\s*円)?/);
    if (m) return normalizeYen(m[1]);
  }

  return null;
}

function normalizeYen(s: string): number {
  return Number(
    s.replace(/[^\d.,]/g, '')      // 記号除去
     .replace(/,(?=\d{3}\b)/g, '') // 3桁カンマを外す
     .replace(/\.00?$/, '')        // .0/.00 を消す
  );
}

function isTransactionLike(text: string, radius = 90): number | null {
  // 新しい厳密な金額抽出を使用
  const amount = extractAmountJp(text);
  
  if (!amount || !Number.isFinite(amount) || amount < MIN_YEN || amount > MAX_YEN) {
    return null;
  }

  // プロモ語チェック：金額周辺にプロモ語があると除外
  const promoNear = RX_PROMO_NEAR.test(text);
  if (promoNear) {
    console.debug(`❌ Promo detected in text for amount ${amount}`);
    return null;
  }

  // 文脈チェック：金額ラベルか強トリガが必要
  const hasLabel = RX_AMOUNT_LABEL.test(text);
  const hasStrong = RX_STRONG_CONTEXT.test(text);
  const hasDate = RX_DATE_NEAR.test(text);

  // ✅ パス条件：金額ラベル or 強トリガ が必要
  if (hasLabel || hasStrong) {
    console.debug(`✅ Found transaction: ${amount}円 - label:${hasLabel} strong:${hasStrong} date:${hasDate}`);
    return amount;
  }
  
  console.debug(`❌ Context insufficient for ${amount}円: label:${hasLabel} strong:${hasStrong} date:${hasDate}`);
  return null;
}

export type SimpleClassification = 
  | { ok: true; amountYen: number }
  | { ok: false; reason: string };

export function classifySimple(meta: MailMeta, body: MailText): SimpleClassification {
  const text = pickText(body);
  
  if (!text) return { ok: false, reason: "no-text" };
  
  const yen = isTransactionLike(text, 90);
  
  if (yen != null) {
    return { ok: true, amountYen: yen };
  } else {
    return { ok: false, reason: "no-amount-context" };
  }
}

export { type MailMeta, type MailText };