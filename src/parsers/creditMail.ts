// parsers/creditMail.ts
export type RawEmail = {
  subject: string;
  from?: string;
  body: string; // 既にデコード済みテキスト（HTMLはstripしてOK）
  receivedAt?: string; // ISO
};

export type Txn = {
  amount: number;              // 円
  date?: string;               // YYYY-MM-DD
  merchant?: string;           // 店舗名
  sourceCard?: string;         // 楽天/JCB/MUFG など
  source?: 'usage' | 'statement' | 'alert';
  notes?: string;
};

const JP_NUM = '[0-9０-９,，]+';           // 桁区切り・全角対応
const YEN = '(?:円|\\s*JPY)?';
const SP = '[ \\t　]*';

const rx = {
  // --- 除外（ステートメント/明細更新/利用不可） ---
  isStatement: new RegExp(
    [
      'ご請求額確定', 'ご請求額の?お知らせ', 'ご請求額', '明細更新', 'WEB明細',
      '請求金額', '請求が?確定', 'ご利用明細', 'News\\+Plus', '請求分',
      // 利用不可・エラー系メール
      'ご利用いただけなかった', '利用いただけなかった', 'ご利用できませんでした',
      '利用制限', '利用停止', 'エラー', '認証失敗'
    ].join('|')
  ),

  // --- "速報"メール（店舗名が後日 or 未記載） ---
  isSokuho: /速報情報|後日配信される「?カード利用お知らせメール|店舗名.*後日/,

  // --- 金額・店舗・日付のラベル行（各社対応） ---
  amountLine: new RegExp(
    [
      // JCB: 【】括弧形式
      '【ご利用金額】\\s*(' + JP_NUM + ')\\s*' + YEN,
      // 楽天カード: 合計行（最も確実）
      '合計\\s*(' + JP_NUM + ')\\s*' + YEN,
      // 楽天カード: テーブル内の数字+円パターン
      '(' + JP_NUM + ')\\s*円[\\s\\|｜]',
      // 三井住友カード: 単体の円表記
      '^(' + JP_NUM + ')\\s*円\\s*$',
      // 一般的なコロン形式（「ご利用額」等の表記ゆれ対応）
      '■?\\s*(?:利用金額|ご利用金額|ご利用額|お支払い金額|決済金額|課金金額|請求金額)\\s*[:：]\\s*(' + JP_NUM + ')\\s*' + YEN,
    ].join('|'), 'mi'
  ),

  merchantLine: new RegExp(
    [
      // JCB: 【】括弧形式 (最優先)
      '【ご利用先】\\s*(.+?)(?:\\s*$)',
      // 三井住友カード: 店舗名（買物）形式
      '^([A-Z0-9][A-Z0-9\\s\\-]*[A-Z0-9\\s])\\s*（.*?）',
      // 一般的なコロン形式
      '■?\\s*(?:利用先|ご利用店(?:舗名)?|ご利用先|加盟店名)\\s*[:：]\\s*(.+)',
      // 楽天カード: テーブル内の店舗名（日付の後） - 複数単語対応
      '[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}\\s+([^0-9]+?)\\s+[0-9,，]+円',
    ].join('|'), 'im'
  ),

  dateLine: new RegExp(
    [
      // 三井住友カード: ご利用日時形式
      'ご利用日時[：:]\\s*([0-9０-９]{4})/([0-9０-９]{1,2})/([0-9０-９]{1,2})',
      // JCB: 【】括弧形式（日時含む）
      '【ご利用日時[^】]*】\\s*([0-9０-９]{4})/([0-9０-９]{1,2})/([0-9０-９]{1,2})',
      // 楽天カード: テーブル形式（実際のパターンに合わせて修正）
      '([0-9０-９]{4})/([0-9０-９]{1,2})/([0-9０-９]{1,2})\\s+[^\\s]+\\s+[0-9,，]+円',
      // 一般的なコロン形式
      '■?\\s*(?:利用日|ご利用日)\\s*[:：]\\s*([0-9０-９]{4})/([0-9０-９]{1,2})/([0-9０-９]{1,2})',
      // 年月日漢字表記対応（イオンカード等）
      '([0-9０-９]{4})年([0-9０-９]{1,2})月([0-9０-９]{1,2})日',
      '■?\\s*(?:利用日|ご利用日)\\s*[:：]\\s*([0-9０-９]{4})年([0-9０-９]{1,2})月([0-9０-９]{1,2})日',
    ].join('|')
  ),

  // カード発行会社の手掛かり
  issuer: /(楽天カード|Rakuten Card|JCB|MUFG|NICOS|三井住友カード|SMBC|AMEX|American Express|VISA|Mastercard)/i,
};

const normalizeNum = (s: string | undefined) => {
  if (!s) return '';
  return s.replace(/[０-９]/g, (d) => String('０１２３４５６７８９'.indexOf(d)))
   .replace(/[，,]/g, '');
};

const clamp2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

function pickFirstMatch(re: RegExp, text: string): string | undefined {
  const m = re.exec(text);
  if (!m) return undefined;
  // 金額はキャプチャが複数オプションなので検索
  const g = m.slice(1).find(Boolean);
  return g?.trim() || undefined;
}

function detectIssuer(mail: RawEmail): string | undefined {
  const text = mail.subject + '\n' + mail.body;
  const m = rx.issuer.exec(text);
  return m?.[1]?.replace(/\s+/g, '').toUpperCase();
}

export function looksLikeStatement(mail: RawEmail): boolean {
  return rx.isStatement.test(mail.subject) || rx.isStatement.test(mail.body);
}

export function looksLikeSokuho(mail: RawEmail, hasMerchant: boolean): boolean {
  if (hasMerchant) return false;
  return rx.isSokuho.test(mail.body);
}

export function extractTxnFromUsageMail(mail: RawEmail): Txn | null {
  console.log('🔍 [CREDIT_MAIL] Extracting from email:', mail.subject?.substring(0, 50));
  console.log('📧 [CREDIT_MAIL] Body preview:', mail.body?.substring(0, 200));

  // 1) ラベル付き金額
  const amountRaw = pickFirstMatch(rx.amountLine, mail.body);
  console.log('💰 [CREDIT_MAIL] Amount raw:', amountRaw);
  
  if (!amountRaw) {
    console.log('❌ [CREDIT_MAIL] No amount found');
    return null;
  }

  const normalizedAmount = normalizeNum(amountRaw);
  console.log('🔢 [CREDIT_MAIL] Normalized amount:', normalizedAmount);
  
  const amount = parseInt(normalizedAmount, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    console.log('❌ [CREDIT_MAIL] Invalid amount:', amount);
    return null;
  }
  
  console.log('✅ [CREDIT_MAIL] Valid amount:', amount);

  // 2) 店舗
  let merchant = pickFirstMatch(rx.merchantLine, mail.body);
  if (merchant) {
    // 行末の余計な説明・URLは落とす
    merchant = merchant.replace(/https?:\/\/\S+.*/, '')
                       .replace(/[（(].*?[)）].*$/, '') // 括弧ごと以降カット（雑音除去）
                       .replace(/[　\s]+$/g, '')
                       .trim();
  }

  // 3) 日付（任意）
  let dateStr: string | undefined;
  const dLine = rx.dateLine.exec(mail.body);
  if (dLine) {
    // Find the first set of three consecutive valid date groups
    for (let i = 1; i < dLine.length - 2; i += 3) {
      const yyyy = dLine[i];
      const mm = dLine[i + 1]; 
      const dd = dLine[i + 2];
      if (yyyy && mm && dd) {
        const normalizedYear = normalizeNum(yyyy);
        const normalizedMonth = clamp2(parseInt(normalizeNum(mm), 10));
        const normalizedDay = clamp2(parseInt(normalizeNum(dd), 10));
        dateStr = `${normalizedYear}-${normalizedMonth}-${normalizedDay}`;
        break;
      }
    }
  }

  // 4) 速報メール処理（スキップせず記録する - 抜け漏れ防止）
  let isSokuho = false;
  if (looksLikeSokuho(mail, !!merchant)) {
    isSokuho = true;
    merchant = '未確定（速報）';
    console.log('🚨 [CREDIT_MAIL] 速報メール検出、未確定として記録');
  }

  // 5) 未来日除外（任意）
  if (dateStr) {
    const today = new Date();
    const dt = new Date(dateStr + 'T00:00:00+09:00');
    if (dt > today) {
      return null;
    }
  }

  return {
    amount,
    date: dateStr,
    merchant,
    sourceCard: detectIssuer(mail),
    source: 'usage',
    notes: isSokuho ? '速報メール（店舗名後日確定）' : undefined,
  };
}