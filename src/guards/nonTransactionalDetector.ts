/**
 * 独立ガード：例・案内メールを超限定条件で除外
 * 
 * 既存の抽出ロジックに一切触れず、保存直前に安全除外するためのモジュール
 * 3段階の厳格条件で、Oliveの「契約案内＋お支払い例」等のみをピンポイント除外
 */

export type MailLike = { 
  from: string; 
  subject: string; 
  text: string; 
};

// 案内系キーワード（件名・本文）
const ANNOUNCEMENT_HINT = /(重要なお知らせ|ご案内|契約内容|設定手続|フレキシブルペイ|ご契約内容|お手続き|サービス開始)/i;

// 例示・シミュレーション系キーワード（金額近傍用）
const EXAMPLE_HINT_NEAR = /(お支払い例|支払例|シミュレーション|サンプル|参考|例として|ご利用例|お支払いイメージ)/i;

// 金額パターン（既存と同様）
const AMOUNT_ANY = /[¥￥]?\s*[0-9０-９,，]+\s*円/ig;

// 送信元の"案内専用"っぽい厳格ドメイン/アドレス（必要に応じて増やす）
const ANNOUNCEMENT_SENDERS = [
  'mail@contact.vpass.ne.jp', // 三井住友 Olive 案内
  'info@vpass.ne.jp',         // 三井住友 案内系
  'noreply@smbc-card.com',    // SMBC 案内系
  // 必要に応じて追加
];

/**
 * 非取引メール（例・案内）判定
 * 
 * @param mail メール情報
 * @returns true = 取引じゃない（例・案内）/ false = 通常処理
 */
export function isNonTransactionalAnnouncement(mail: MailLike): boolean {
  const from = (mail.from || '').toLowerCase();
  const subj = mail.subject || '';
  const text = mail.text || '';

  // 1) 送信元が案内系（強条件）
  const fromHit = ANNOUNCEMENT_SENDERS.some(dom => from.includes(dom.toLowerCase()));
  if (!fromHit) return false;

  // 2) 件名/本文に「案内・契約・設定」（強条件）
  if (!ANNOUNCEMENT_HINT.test(subj + ' ' + text)) return false;

  // 3) 金額の"近傍 ±30文字"に例示ワード（強条件）
  const normalizedText = text.replace(/\s+/g, ' ');
  let match: RegExpExecArray | null;
  AMOUNT_ANY.lastIndex = 0;
  
  while ((match = AMOUNT_ANY.exec(normalizedText)) !== null) {
    const matchIndex = match.index;
    const windowStart = Math.max(0, matchIndex - 30);
    const windowEnd = Math.min(normalizedText.length, matchIndex + match[0].length + 30);
    const contextWindow = normalizedText.slice(windowStart, windowEnd);
    
    if (EXAMPLE_HINT_NEAR.test(contextWindow)) {
      console.log('🛡️ Example amount detected in context:', {
        amount: match[0],
        context: contextWindow,
        from: mail.from
      });
      return true; // 例示金額なので非取引扱い
    }
  }

  return false;
}

/**
 * デバッグ用：判定理由の詳細
 */
export function analyzeNonTransactional(mail: MailLike): {
  isNonTransactional: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const from = (mail.from || '').toLowerCase();
  const subj = mail.subject || '';
  const text = mail.text || '';

  // 送信元チェック
  const fromHit = ANNOUNCEMENT_SENDERS.some(dom => {
    const hit = from.includes(dom.toLowerCase());
    if (hit) reasons.push(`Sender match: ${dom}`);
    return hit;
  });

  if (!fromHit) {
    reasons.push('No announcement sender match');
    return { isNonTransactional: false, reasons };
  }

  // 案内キーワードチェック
  const announcementHit = ANNOUNCEMENT_HINT.test(subj + ' ' + text);
  if (!announcementHit) {
    reasons.push('No announcement keywords found');
    return { isNonTransactional: false, reasons };
  }
  reasons.push('Announcement keywords found');

  // 例示金額チェック
  const normalizedText = text.replace(/\s+/g, ' ');
  let match: RegExpExecArray | null;
  AMOUNT_ANY.lastIndex = 0;
  
  while ((match = AMOUNT_ANY.exec(normalizedText)) !== null) {
    const matchIndex = match.index;
    const contextWindow = normalizedText.slice(
      Math.max(0, matchIndex - 30), 
      Math.min(normalizedText.length, matchIndex + match[0].length + 30)
    );
    
    if (EXAMPLE_HINT_NEAR.test(contextWindow)) {
      reasons.push(`Example amount found: ${match[0]} in context "${contextWindow}"`);
      return { isNonTransactional: true, reasons };
    }
  }

  reasons.push('No example amounts in context');
  return { isNonTransactional: false, reasons };
}