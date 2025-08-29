import { EmailData } from './gmailService';

export type Classification =
  | { ok: true; lane: "issuer" | "merchant"; reasons: string[]; amountYen: number; confidence: number }
  | { ok: false; lane?: "issuer" | "merchant"; reasons: string[]; confidence: number };

export type FilterStageStats = {
  stage0_gmail_list: number;
  stage1_initial_filter: number;
  stage2_body_parse: number;
  stage3_amount_context: number;
  final_accepted: number;
};

/**
 * 2レーン方式の高精度メールフィルター
 * レーンA: カード発行会社の利用通知
 * レーンB: 加盟店のレシート/購入通知
 */
export class TwoLaneEmailFilter {
  // 強化された正規表現（"抜け漏れゼロ寄り"対応）
  private static readonly AMOUNT_RE = /(?<!第)(?<![0-9])([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{1,6})(?:\s*|　*)(?:円|JPY|￥)(?!以上)/;
  private static readonly CONTEXT_RE = /(利用|請求|明細|注文|領収|購入|決済|支払|支払い|charged|amount)/i;
  private static readonly PROMO_RE = /(クーポン|キャンペーン|セール|割引コード|タイムセール|今だけ|ポイント還元|メルマガ)/i;

  private static readonly MIN_YEN = 50;
  private static readonly MAX_YEN = 1_000_000;

  // レーンA: 発行会社ドメイン（必要最小限）
  private static readonly ISSUER_DOMAINS = [
    "@rakuten-card.co.jp",
    "@smbc-card.com", 
    "@jcb.co.jp",
    "@aeon.co.jp",
    "@visa.co.jp",
    "@mastercard.com",
    "@mail.rakuten-card.co.jp",
    "@mail.smbc-card.com",
    "@mail.jcb.co.jp",
    "@cr.mufg.jp",
    "@nicos.co.jp",
    "@dccard.co.jp",
    "@saisoncard.co.jp",
    "@eposcard.co.jp",
  ];

  /**
   * 安全な暫定版Gmailクエリ（広めの入口→後段で厳しく絞る方式）
   */
  static buildSafeGmailQuery(days = 180): string {
    return [
      `newer_than:${days}d`,
      // 件名は広め（レシート系も拾う）
      `(subject:(ご利用 OR 利用 OR 請求 OR 明細 OR 注文 OR 領収 OR 購入 OR 決済) OR "ご利用金額" OR "円" OR "領収書" OR "receipt")`,
      // 明確に広告っぽい件名は除外
      `-subject:(クーポン OR キャンペーン OR セール OR 開催 OR イベント OR 倍率)`,
    ].join(" ");
  }

  /**
   * テキスト正規化
   */
  private static normalizeText(s: string): string {
    return s
      .replace(/\r/g, "\n")
      .replace(/\u00A0/g, " ") // non-breaking space
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  /**
   * HTML → テキスト変換（最小版）
   */
  private static htmlToText(html: string): string {
    const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, "");
    const text = withoutStyles
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
    return this.normalizeText(text);
  }

  /**
   * メール本文を取得（plain優先、HTMLフォールバック）
   */
  private static pickBodyText(email: EmailData): string {
    // まずplainテキストがあるかチェック（既存の実装と連携）
    if (email.body && email.body.trim().length > 0) {
      return this.normalizeText(email.body);
    }
    
    // HTMLの場合はテキスト化
    // 注：既存のEmailDataはbodyのみなので、必要に応じて拡張
    return "";
  }

  /**
   * 発行会社ドメインかチェック
   */
  private static hasIssuerDomain(from: string): boolean {
    const f = (from || "").toLowerCase();
    return this.ISSUER_DOMAINS.some(d => f.includes(d));
  }

  /**
   * List-Unsubscribeヘッダーがあるかチェック（広告メール検出用）
   */
  private static hasListUnsub(headers?: Record<string, string>): boolean {
    if (!headers) return false;
    const k = Object.keys(headers).find(h => h.toLowerCase() === "list-unsubscribe");
    return Boolean(k);
  }

  /**
   * 金額を抽出（妥当範囲チェック付き）
   */
  private static extractAmountYen(text: string): number | null {
    const m = this.AMOUNT_RE.exec(text);
    if (!m) return null;
    
    const yen = parseInt(m[1].replace(/,/g, ""), 10);
    if (Number.isNaN(yen)) return null;
    if (yen < this.MIN_YEN || yen > this.MAX_YEN) return null;
    
    return yen;
  }

  /**
   * 金額の近傍に周辺語があるかチェック（拡張半径）
   */
  private static contextNearAmount(text: string, radius = 120): boolean {
    const m = this.AMOUNT_RE.exec(text);
    if (!m) return false;
    
    const idx = m.index;
    const left = Math.max(0, idx - radius);
    const right = Math.min(text.length, idx + m[0].length + radius);
    const window = text.slice(left, right);
    
    return this.CONTEXT_RE.test(window);
  }

  /**
   * メール分類（2レーン + 最終ゲート）
   */
  static classifyMail(email: EmailData, logPrefix = "", headers?: Record<string, string>): Classification {
    const reasons: string[] = [];
    const subject = (email.subject || "").trim();
    const from = (email.from || "").trim();
    const text = this.pickBodyText(email);

    // ログ（デバッグ用）
    if (logPrefix) {
      console.debug(`${logPrefix}[classify] from=${from} subject="${subject.substring(0, 50)}..." textLen=${text.length}`);
    }

    let confidence = 0;

    if (!text || text.length < 10) {
      return { ok: false, reasons: [...reasons, "no-text-or-too-short"], confidence: 0 };
    }

    // レーン判定
    let lane: "issuer" | "merchant";
    if (this.hasIssuerDomain(from)) {
      lane = "issuer";
      reasons.push("issuer-domain");
      confidence += 0.3; // 発行会社ドメインは信頼度高
    } else {
      lane = "merchant";
      reasons.push("merchant-lane");
      confidence += 0.1; // 加盟店は慎重に
    }

    // 件名の一次フィルタ
    const subjectOk = /(ご利用|利用|請求|明細|注文|領収|購入|決済)/.test(subject);
    if (!subjectOk && lane === "issuer") {
      // 発行会社レーンは件名の定型性が高いので少し厳しめ
      return { ok: false, lane, reasons: [...reasons, "issuer-subject-ng"], confidence };
    }
    
    if (this.PROMO_RE.test(subject)) {
      return { ok: false, lane, reasons: [...reasons, "promo-subject"], confidence };
    }

    // プロモヘッダがあり かつ 件名が広告寄り → 除外
    if (this.hasListUnsub(headers) && /(お得|セール|キャンペーン|クーポン)/.test(subject)) {
      return { ok: false, lane, reasons: [...reasons, "list-unsub-promo"], confidence };
    }

    if (subjectOk) {
      confidence += 0.2;
      reasons.push("subject-ok");
    }

    // 最終ゲート：金額 + 周辺語
    const amount = this.extractAmountYen(text);
    if (amount == null) {
      return { ok: false, lane, reasons: [...reasons, "no-valid-amount"], confidence };
    }

    confidence += 0.3; // 金額検出
    reasons.push(`amount-${amount}`);

    if (!this.contextNearAmount(text, 120)) {
      return { ok: false, lane, reasons: [...reasons, "no-context-near-amount"], confidence };
    }

    confidence += 0.3; // 文脈検出
    reasons.push("context-near-amount");

    if (this.PROMO_RE.test(text)) {
      // 本文が広告語だらけなら除外
      return { ok: false, lane, reasons: [...reasons, "promo-body"], confidence };
    }

    // 成功
    confidence = Math.min(confidence, 1.0);
    return { 
      ok: true, 
      lane, 
      reasons: [...reasons, "final-pass"], 
      amountYen: amount,
      confidence 
    };
  }

  /**
   * 複数メールの一括フィルタリング（段階統計付き）
   */
  static filterEmails(emails: EmailData[], logPrefix = ""): {
    validEmails: Array<{
      email: EmailData;
      classification: Extract<Classification, { ok: true }>;
    }>;
    rejectedEmails: Array<{
      email: EmailData;
      classification: Extract<Classification, { ok: false }>;
    }>;
    stats: FilterStageStats & {
      byLane: {
        issuer: number;
        merchant: number;
      };
      byReason: Record<string, number>;
    };
  } {
    const validEmails: Array<{
      email: EmailData;
      classification: Extract<Classification, { ok: true }>;
    }> = [];
    
    const rejectedEmails: Array<{
      email: EmailData;
      classification: Extract<Classification, { ok: false }>;
    }> = [];

    let issuerCount = 0;
    let merchantCount = 0;
    const reasonCounts: Record<string, number> = {};

    console.log(`${logPrefix}[stage0] Gmail list取得件数=${emails.length}`);

    let stage1Count = 0; // 初期フィルタ通過
    let stage2Count = 0; // 本文パース成功
    let stage3Count = 0; // 金額+周辺語通過

    for (const email of emails) {
      stage1Count++; // 今回は全部stage1通過とみなす

      if (email.body && email.body.length > 10) {
        stage2Count++; // 本文あり
      }

      const classification = this.classifyMail(email, logPrefix);

      // 理由統計
      for (const reason of classification.reasons) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }

      if (classification.ok) {
        stage3Count++; // 最終ゲート通過
        validEmails.push({
          email,
          classification
        });

        if (classification.lane === "issuer") issuerCount++;
        else merchantCount++;
      } else {
        rejectedEmails.push({
          email,
          classification
        });
      }
    }

    const stats = {
      stage0_gmail_list: emails.length,
      stage1_initial_filter: stage1Count,
      stage2_body_parse: stage2Count,
      stage3_amount_context: stage3Count,
      final_accepted: validEmails.length,
      byLane: {
        issuer: issuerCount,
        merchant: merchantCount
      },
      byReason: reasonCounts
    };

    console.log(`${logPrefix}[stage1] 初期フィルタ通過=${stage1Count}`);
    console.log(`${logPrefix}[stage2] 本文パース成功=${stage2Count}`);
    console.log(`${logPrefix}[stage3] 金額+周辺語通過=${stage3Count}`);
    console.log(`${logPrefix}[final] 採択=${validEmails.length}`);
    console.log(`${logPrefix}レーン別: issuer=${issuerCount}, merchant=${merchantCount}`);
    console.log(`${logPrefix}除外理由トップ5:`, 
      Object.entries(reasonCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
    );

    return {
      validEmails,
      rejectedEmails,
      stats
    };
  }

  /**
   * デバッグ用：どの段階でゼロになったか診断
   */
  static diagnoseZeroResults(stats: FilterStageStats): string {
    if (stats.stage0_gmail_list === 0) {
      return "Gmail検索クエリが厳しすぎます。newer_than日数を増やすか、検索語を緩めてください。";
    }
    
    if (stats.stage1_initial_filter === 0) {
      return "件名・送信元フィルタが厳しすぎます。件名キーワードを緩めてください。";
    }
    
    if (stats.stage2_body_parse === 0) {
      return "メール本文の抽出に失敗しています。HTML→テキスト変換を確認してください。";
    }
    
    if (stats.stage3_amount_context === 0) {
      return "金額+周辺語の検出に失敗しています。金額正規表現や周辺語パターンを確認してください。";
    }
    
    if (stats.final_accepted === 0) {
      return "最終的な除外条件（プロモーション検出等）が厳しすぎます。";
    }
    
    return "フィルタリングは正常に動作しています。";
  }
}