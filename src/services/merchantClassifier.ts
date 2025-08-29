// LLM + ルールベースのハイブリッド店舗名分類器
import { subscriptionDictionaryService } from "./subscriptionDictionaryService";
import { RawEmail, extractTxnFromUsageMail, looksLikeStatement } from "../parsers/creditMail";

export interface ExtractedInfo {
  amount: number;
  currency: "JPY" | "USD";
  snippet: string; // ご利用先周辺のテキスト抜粋
  fromDomain: string;
  subject: string;
  rawBody: string;
}

// 楽天カード速報版判定
function isRakutenRealtimeNotice(subject: string, body: string): boolean {
  // 件名または本文に「速報版」と「カード利用お知らせメール」が含まれているかチェック
  const text = (subject + " " + body).replace(/\s+/g, " ");
  console.log(
    "Checking for Rakuten realtime notice in text:",
    text.substring(0, 200)
  );

  // より柔軟な判定：速報版 + カード利用関連のキーワード
  const isRealtime = /速報版|【速報版】/.test(text);
  const isCardUsage = /カード利用|ご利用|利用お知らせ/.test(text);

  const result = isRealtime && isCardUsage;
  console.log(
    "Rakuten realtime check - isRealtime:",
    isRealtime,
    "isCardUsage:",
    isCardUsage,
    "result:",
    result
  );

  return result;
}

// 楽天カード利用先抽出（確定メールのみ）
export function extractRakutenMerchant(text: string): string | null {
  const t = text.replace(/\r\n/g, "\n").normalize("NFKC");

  // 速報版メールの場合は確実にnullを返す
  if (
    t.includes("速報版") ||
    t.includes("ご利用店舗名やお支払い方法などの詳細な情報は")
  ) {
    return null;
  }

  // 通常テンプレ：改行区切りの見出し行のみ
  const candidates = [
    /^[■□]\s*利用先\s*[:：]\s*(.+)$/m, // 例: ■利用先: モバイルパスモチャージ
    /^ご利用先\s*[:：]?\s*(.+)$/m, // 例: ご利用先  APPLE COM BILL（行頭のみ）
  ];

  for (const re of candidates) {
    const m = t.match(re);
    if (m?.[1]) {
      const merchant = m[1].split("\n")[0].trim();
      // ノイズ文（説明文）は除外
      if (
        merchant.includes("名やお支払い方法などの詳細な情報は") ||
        merchant.includes("後日配信される")
      ) {
        return null;
      }
      return merchant;
    }
  }
  return null;
}

// JCB利用先抽出（見出し行のみ）
export function extractJcbMerchant(text: string): string | null {
  const t = text.replace(/\r\n/g, "\n").normalize("NFKC");
  const m = t.match(/^[〔【\[]?\s*ご利用先\s*[】\]]?\s*[:：]?\s*(.+)$/m); // 行頭に限定
  return m?.[1]?.split("\n")[0].trim() ?? null;
}

// 総合利用先抽出（送信元ドメインで分岐）
function extractMerchantSmart(
  fromDomain: string,
  subject: string,
  body: string
): string | null {
  // 楽天系
  if (/rakuten-card\.co\.jp$/.test(fromDomain)) {
    // 速報版メールの場合は確実にnullを返す
    if (isRakutenRealtimeNotice(subject, body)) {
      return null;
    }
    const m = extractRakutenMerchant(body);
    return m && !/後日配信される/.test(m) ? m : null;
  }
  // JCB系
  if (/(?:qa\.)?jcb\.co\.jp$/.test(fromDomain)) {
    return extractJcbMerchant(body);
  }
  // 汎用フォールバック（行頭の見出しのみ）
  const t = body.replace(/\r\n/g, "\n").normalize("NFKC");
  const m = t.match(
    /^(?:ご利用先|利用先|ご利用店|加盟店(?:名)?|店舗名)\s*[:：]?\s*(.+)$/m
  );
  return m?.[1]?.split("\n")[0].trim() ?? null;
}

export interface ClassifiedMerchant {
  merchant: string;
  category: string;
  platform: string;
  is_subscription: boolean;
  confidence: number;
  evidence: string;
  notes: string;
  needsReview?: boolean;
  pending?: boolean; // 速報版等の未確定情報
  source?: string; // データソース識別用
}

// 既知辞書（最優先で適用）
const KNOWN_MERCHANTS: { [key: string]: Partial<ClassifiedMerchant> } = {
  "APPLE COM BILL": {
    merchant: "Apple（代行決済）",
    category: "デジタル",
    is_subscription: true,
    confidence: 0.95,
    notes: "Apple課金の集約表記",
  },
  "GOOGLE*GOOGLE PLAY": {
    merchant: "Google Play（代行決済）",
    category: "デジタル",
    is_subscription: true,
    confidence: 0.95,
    notes: "Google Play課金",
  },
  "STRIPE *OPENAI": {
    merchant: "OpenAI / ChatGPT",
    category: "サブスク",
    is_subscription: true,
    confidence: 0.95,
    notes: "ChatGPT Plus等",
  },
  NETFLIX: {
    merchant: "Netflix",
    category: "サブスク",
    is_subscription: true,
    confidence: 0.95,
    notes: "動画配信サービス",
  },
  SPOTIFY: {
    merchant: "Spotify",
    category: "サブスク",
    is_subscription: true,
    confidence: 0.95,
    notes: "音楽配信サービス",
  },
  // コンビニ
  "セブン-イレブン": {
    merchant: "セブン-イレブン",
    category: "コンビニ",
    confidence: 0.95,
  },
  "Seven-Eleven": {
    merchant: "セブン-イレブン",
    category: "コンビニ",
    confidence: 0.95,
  },
  ファミリーマート: {
    merchant: "ファミリーマート",
    category: "コンビニ",
    confidence: 0.95,
  },
  ローソン: { merchant: "ローソン", category: "コンビニ", confidence: 0.95 },

  // JCB海外利用分
  "JCBクレジットご利用分（海外利用分）": {
    merchant: "JCB海外利用分",
    category: "海外利用",
    confidence: 0.95,
    notes: "JCB海外取引",
  },

  // 文字化け対応 - 実際のメールから抽出されたパターン
  "ã¢ããã«ãããã³ã": {
    merchant: "Apple（代行決済）",
    category: "デジタル",
    confidence: 0.9,
    notes: "文字化け修正済み",
  },
  "ããªã¤ããºã¤ã±ãã¯ã­ãã·ã°ããã³": {
    merchant: "ユナイテッド・シネマ 豊洲",
    category: "エンタメ/映画",
    confidence: 0.9,
    notes: "文字化け修正済み",
  },

  // より多くの文字化けパターンを追加
  "APPLE.COM/BILL": {
    merchant: "Apple（代行決済）",
    category: "デジタル",
    is_subscription: true,
    confidence: 0.95,
    notes: "Apple課金",
  },
  "GOOGLE PLAY": {
    merchant: "Google Play",
    category: "デジタル",
    is_subscription: true,
    confidence: 0.95,
    notes: "Google Play課金",
  },
};

// LLM用プロンプトテンプレート
const SYSTEM_PROMPT = `あなたは決済通知メールの情報抽出アシスタントです。
与えられた短い抜粋テキストから「利用先（店名）」と「カテゴリ」を推定し、
下記JSONスキーマに厳密に従って出力してください。余計な文字は出力しないこと。

カテゴリは {サブスク, ゲーム課金, エンタメ/映画, 音楽, 映画/動画, 飲食, コンビニ, 交通, 通販, デジタル, その他} から最も近いもの1つだけ。

出力形式:
{
  "merchant": "店舗名（正規化済み）",
  "category": "カテゴリ", 
  "platform": "決済プラットフォーム",
  "is_subscription": boolean,
  "confidence": 0.0-1.0,
  "evidence": "抽出根拠となったテキスト",
  "notes": "補足情報"
}`;

class MerchantClassifier {
  // ステップ1: ルールベース分類（高速・確実）
  classifyByRules(info: ExtractedInfo): ClassifiedMerchant | null {
    const { snippet, fromDomain } = info;

    // 1. 既知辞書での完全マッチ
    for (const [key, value] of Object.entries(KNOWN_MERCHANTS)) {
      if (
        snippet.includes(key) ||
        snippet.toLowerCase().includes(key.toLowerCase())
      ) {
        return {
          merchant: value.merchant || key,
          category: value.category || "その他",
          platform: this.extractPlatform(fromDomain),
          is_subscription: value.is_subscription || false,
          confidence: value.confidence || 0.95,
          evidence: key,
          notes: value.notes || "既知辞書マッチ",
        };
      }
    }

    // 2. ドメインベース推定
    if (fromDomain.includes("jcb.co.jp")) {
      // JCB特有の処理は既存のgmailService.tsに委譲
      return null;
    }

    return null;
  }

  // ステップ2: LLM分類（柔軟・高精度）
  async classifyByLLM(info: ExtractedInfo): Promise<ClassifiedMerchant> {
    const prompt = this.buildPrompt(info);

    try {
      // TODO: 実際のLLM API呼び出し（OpenAI, Anthropic, etc.）
      const response = await this.callLLM(prompt);
      const result = this.safeParseJSON(response);

      return this.postProcess(result);
    } catch (error) {
      console.error("LLM classification failed:", error);

      // フォールバック：基本的な推定
      return {
        merchant: "不明な店舗",
        category: "その他",
        platform: this.extractPlatform(info.fromDomain),
        is_subscription: false,
        confidence: 0.1,
        evidence: info.snippet.substring(0, 50),
        notes: "LLM分類失敗、フォールバック結果",
      };
    }
  }

  // メイン分類関数
  async classify(info: ExtractedInfo): Promise<ClassifiedMerchant> {
    // 楽天速報版チェック（最優先）
    console.log(
      "Checking domain:",
      info.fromDomain,
      "for Rakuten realtime notice"
    );
    if (info.fromDomain.includes("rakuten-card.co.jp")) {
      const isRealtime = isRakutenRealtimeNotice(info.subject, info.rawBody);
      console.log("Rakuten domain detected, isRealtime:", isRealtime);

      if (isRealtime) {
        console.log(
          "Rakuten realtime notice detected, returning pending transaction"
        );
        return {
          merchant: "未確定（速報）",
          category: "その他",
          platform: "楽天カード",
          is_subscription: false,
          confidence: 0.9,
          evidence: "速報版メール検出",
          notes: "後日確定メールで上書き予定",
          pending: true,
          source: "RakutenRealtime",
        };
      }
    }

    // 辞書検索を優先（新機能 - 高精度）
    const dictionaryResult = this.classifyByDictionary(info);
    if (dictionaryResult && dictionaryResult.confidence > 0.7) {
      return dictionaryResult;
    }
    
    // ルールベースを試行
    const ruleResult = this.classifyByRules(info);
    if (ruleResult) {
      return ruleResult;
    }
    
    // 辞書結果が低信頼度でもルールベースより優先
    if (dictionaryResult && dictionaryResult.confidence > 0.3) {
      return dictionaryResult;
    }

    // CORS問題のため、一時的にLLMを無効化し、強化されたルールベース分類を使用
    return this.enhancedRuleClassification(info);
  }

  // スニペットから加盟店名を抽出
  private extractMerchantFromSnippet(snippet: string): string | null {
    // 利用先パターンの抽出
    const patterns = [
      /■利用先[：:\s]*([^\n■]+)/,
      /利用先[：:\s]*([^\n]+)/,
      /ご利用店舗[：:\s]*([^\n]+)/,
      /加盟店[：:\s]*([^\n]+)/
    ];
    
    for (const pattern of patterns) {
      const match = snippet.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  // 辞書ベース分類（新機能）
  private classifyByDictionary(info: ExtractedInfo): ClassifiedMerchant | null {
    // スニペットからの直接抽出
    const extractedMerchant = this.extractMerchantFromSnippet(info.snippet);
    
    if (extractedMerchant) {
      const match = subscriptionDictionaryService.detectService(extractedMerchant, info.amount);
      
      if (match) {
        return {
          merchant: match.serviceName,
          category: match.category,
          platform: this.extractPlatform(info.fromDomain),
          is_subscription: true,
          confidence: match.confidence,
          evidence: `Dictionary match: ${match.matchedPattern}`,
          notes: `Detected by subscription dictionary: ${match.description}`,
          source: "SubscriptionDictionary"
        };
      }
    }
    
    // サブジェクトや生ボディからの検索も試行
    const subjectMatch = subscriptionDictionaryService.detectService(info.subject, info.amount);
    if (subjectMatch && subjectMatch.confidence > 0.5) {
      return {
        merchant: subjectMatch.serviceName,
        category: subjectMatch.category,
        platform: this.extractPlatform(info.fromDomain),
        is_subscription: true,
        confidence: subjectMatch.confidence,
        evidence: `Subject match: ${subjectMatch.matchedPattern}`,
        notes: `Detected from subject: ${subjectMatch.description}`,
        source: "SubscriptionDictionary"
      };
    }
    
    return null;
  }

  // 強化されたルールベース分類（LLM代替）
  private enhancedRuleClassification(info: ExtractedInfo): ClassifiedMerchant {
    const { snippet, fromDomain } = info;

    console.log(
      "Enhanced classification - snippet:",
      snippet.substring(0, 200)
    );

    // 最優先：直接的な店舗名抽出を試行
    console.log("Attempting direct merchant extraction from domain:", fromDomain);
    console.log("Snippet preview:", snippet.substring(0, 300));
    
    const extractedMerchant = this.extractMerchantFromText(snippet, info.rawBody);
    console.log("Direct extraction result:", extractedMerchant);
    
    if (extractedMerchant && extractedMerchant !== "不明な店舗") {
      console.log("Direct merchant extraction successful:", extractedMerchant);
      return {
        merchant: extractedMerchant,
        category: this.guessCategory(extractedMerchant),
        platform: this.extractPlatform(fromDomain),
        is_subscription: this.isLikelySubscription(extractedMerchant),
        confidence: 0.8,
        evidence: extractedMerchant,
        notes: "直接抽出（最優先）",
      };
    }
    console.log("Direct extraction failed, continuing to pattern matching...");

    // 特別チェック：Appleの文字化けパターン
    if (snippet.includes("ã¢ããã«ãããã³ã")) {
      console.log("Found Apple corrupted text: ã¢ããã«ãããã³ã");
      return {
        merchant: "Apple",
        category: "デジタル",
        platform: this.extractPlatform(fromDomain),
        is_subscription: true,
        confidence: 0.95,
        evidence: "ã¢ããã«ãããã³ã",
        notes: "Apple文字化け検出",
      };
    }

    // より積極的なパターンマッチング
    const patterns = [
      // Apple系（実際のメールの文字化けパターンを含む）
      {
        pattern: /apple|ã¢ããã«ãããã³ã|ã¢ããã«|APPLE\.COM|apple\.com/i,
        merchant: "Apple",
        category: "デジタル",
        subscription: true,
      },
      // Google系
      {
        pattern: /google|play|GOOGLE\*GOOGLE PLAY/i,
        merchant: "Google Play",
        category: "デジタル",
        subscription: true,
      },
      // Netflix
      {
        pattern: /netflix/i,
        merchant: "Netflix",
        category: "サブスク",
        subscription: true,
      },
      // Spotify
      {
        pattern: /spotify/i,
        merchant: "Spotify",
        category: "サブスク",
        subscription: true,
      },
      // コンビニ
      {
        pattern: /セブン|seven|711|7-eleven|セブン-イレブン/i,
        merchant: "セブン-イレブン",
        category: "コンビニ",
      },
      {
        pattern: /ファミリー|family|ファミリーマート/i,
        merchant: "ファミリーマート",
        category: "コンビニ",
      },
      {
        pattern: /ローソン|lawson/i,
        merchant: "ローソン",
        category: "コンビニ",
      },
      // 交通系（より具体的なパターン）
      {
        pattern: /suica|pasmo|モバイル.*パス|モバイルパスモ|パスモ|スイカ/i,
        merchant: "交通系IC",
        category: "交通",
      },
      // Amazon
      {
        pattern: /amazon|アマゾン|amzn|AMAZON/i,
        merchant: "Amazon",
        category: "通販",
      },
      // レストラン・飲食
      {
        pattern: /マクドナルド|mcdonald|スタバ|starbucks|スターバックス/i,
        merchant: "飲食店",
        category: "飲食",
      },
      // ガソリンスタンド
      {
        pattern: /エッソ|エネオス|esso|eneos|昭和シェル|shell|ガソリン/i,
        merchant: "ガソリンスタンド",
        category: "交通",
      },
      // 楽天カードの特定パターン（実際のメールベース）
      {
        pattern: /楽天|rakuten|らくてん/i,
        merchant: "楽天関連サービス",
        category: "通販",
      },
      // JCBカードの特定パターンは削除（過度に一般的すぎるため）
      // JCBの実際の店舗名は直接抽出で処理
      // 映画館
      {
        pattern: /シネマ|cinema|映画|theater|TOHOシネマ|イオンシネマ/i,
        merchant: "映画館",
        category: "エンタメ",
      },
    ];

    for (const {
      pattern,
      merchant,
      category,
      subscription = false,
    } of patterns) {
      console.log(
        "Testing pattern:",
        pattern,
        "against snippet length:",
        snippet.length
      );
      if (pattern.test(snippet)) {
        console.log("Pattern matched!", pattern, "for merchant:", merchant);
        return {
          merchant,
          category,
          platform: this.extractPlatform(fromDomain),
          is_subscription: subscription,
          confidence: 0.8,
          evidence: snippet.substring(0, 100),
          notes: "強化ルールベース分類",
        };
      }
    }

    // 最終フォールバック：文字化けがひどいJCBメールの場合の特別処理
    if (fromDomain.includes("jcb.co.jp") && this.isGarbledText(snippet)) {
      console.log("Severely garbled JCB email detected, using generic JCB overseas classification");
      
      // 金額が大きければ海外利用の可能性が高い
      const isLikelyOverseas = info.amount > 1000;
      
      return {
        merchant: isLikelyOverseas ? "JCB海外利用分" : "JCB国内利用分",
        category: isLikelyOverseas ? "海外利用" : "その他",
        platform: this.extractPlatform(fromDomain),
        is_subscription: false,
        confidence: 0.6,
        evidence: "文字化けメール検出",
        notes: "文字化けのため推定分類",
        needsReview: true,
      };
    }

    // デフォルトフォールバック
    return {
      merchant: "不明な店舗",
      category: "その他",
      platform: this.extractPlatform(fromDomain),
      is_subscription: false,
      confidence: 0.3,
      evidence: snippet.substring(0, 50),
      notes: "ルールマッチなし",
      needsReview: true,
    };
  }

  // ヘルパーメソッド
  private extractPlatform(fromDomain: string): string {
    if (fromDomain.includes("jcb.co.jp")) return "JCB";
    if (fromDomain.includes("rakuten-card.co.jp")) return "Visa/楽天";
    if (fromDomain.includes("smbc-card.com")) return "SMBC";
    if (fromDomain.includes("saison-card.co.jp")) return "セゾン";
    return "不明";
  }

  private extractMerchantFromText(snippet: string, fullBody: string): string | null {
    console.log("Extracting merchant from text, snippet length:", snippet.length);
    console.log("Full body length:", fullBody.length);
    
    // より具体的な店舗名抽出パターン
    const merchantPatterns = [
      // 【】で囲まれた利用先
      /【ご利用先】\s*([^\n\r【】]{1,100})/,
      /【利用先】\s*([^\n\r【】]{1,100})/,
      /【店舗名】\s*([^\n\r【】]{1,100})/,
      
      // コロン区切りの利用先
      /ご利用先\s*[：:]\s*([^\n\r]{1,100})/,
      /利用先\s*[：:]\s*([^\n\r]{1,100})/,
      /ご利用店舗\s*[：:]\s*([^\n\r]{1,100})/,
      
      // 楽天カード特有パターン
      /^ご利用先\s+(.+)$/m,
      /^■\s*利用先\s*[:：]\s*(.+)$/m,
      
      // JCB特有パターン（より包括的に）
      /〔ご利用先〕\s*([^\n\r〔〕]{1,100})/,
      /【ご利用先】\s*([^\n\r【】]{1,100})/,
      /ご利用先[：:\s]*([^\n\r【】]{1,100})(?:\s|$)/,
      // JCBの文字化け対応
      /ãã.*?ã\s*([^\n\rã]{1,100})/,
      
      // 一般的なパターン
      /加盟店名?\s*[：:]\s*([^\n\r]{1,100})/,
      /店舗名\s*[：:]\s*([^\n\r]{1,100})/,
    ];

    for (const pattern of merchantPatterns) {
      console.log("Testing pattern:", pattern.source);
      const snippetMatch = snippet.match(pattern);
      const fullBodyMatch = fullBody.match(pattern);
      
      console.log("Snippet match:", snippetMatch ? snippetMatch[1] : null);
      console.log("Full body match:", fullBodyMatch ? fullBodyMatch[1] : null);
      
      const match = snippetMatch || fullBodyMatch;
      if (match && match[1]) {
        const merchant = match[1].trim();
        console.log("Raw merchant extracted:", merchant);
        
        // 無効なパターンをフィルタリング
        const isValid = this.isValidMerchantName(merchant);
        console.log("Is valid merchant name:", isValid);
        
        if (isValid) {
          console.log("✓ Extracted merchant from text:", merchant, "using pattern:", pattern.source);
          return merchant;
        } else {
          console.log("✗ Invalid merchant name, skipping:", merchant);
        }
      }
    }
    
    console.log("No valid merchant found in text extraction");
    return null;
  }

  private isValidMerchantName(merchant: string): boolean {
    console.log("Validating merchant name:", merchant, "length:", merchant.length);
    
    // JCB海外利用分は有効な店舗名として扱う
    if (merchant.includes("JCBクレジットご利用分")) {
      console.log("✓ JCB overseas transaction detected");
      return true;
    }
    
    // 明らかに店舗名でないパターンを除外
    const invalidPatterns = [
      /^名やお支払い方法/,
      /詳細な情報は/,
      /後日配信/,
      /カード利用お知らせメール/,
      /ご確認をお願い/,
      /^\s*$/,
      /^.{150,}$/, // 150文字以上は無効（80から緩和）
      /^[0-9\s\-\/]+$/, // 数字と記号のみは無効
      /メールにて/,
      /お知らせ/,
    ];
    
    for (const pattern of invalidPatterns) {
      if (pattern.test(merchant)) {
        console.log("✗ Invalid pattern matched:", pattern.source);
        return false;
      }
    }
    
    console.log("✓ Valid merchant name");
    return true;
  }

  private guessCategory(merchant: string): string {
    // JCB海外利用分の特別処理
    if (merchant.includes("JCBクレジットご利用分") && merchant.includes("海外利用分")) {
      return "海外利用";
    }
    
    const categoryMapping: { [key: string]: string } = {
      // デジタル・サブスク
      apple: "デジタル",
      google: "デジタル", 
      netflix: "サブスク",
      spotify: "サブスク",
      
      // コンビニ
      セブン: "コンビニ",
      ファミリー: "コンビニ",
      ローソン: "コンビニ",
      
      // 交通
      パスモ: "交通",
      スイカ: "交通",
      モバイル: "交通",
      
      // 通販
      amazon: "通販",
      アマゾン: "通販",
      楽天: "通販",
      
      // 飲食
      マクドナルド: "飲食",
      スターバックス: "飲食",
      
      // エンタメ
      シネマ: "エンタメ",
      映画: "エンタメ",
      
      // JCB関連
      "JCBクレジット": "海外利用",
      "海外利用": "海外利用",
    };

    const lowerMerchant = merchant.toLowerCase();
    for (const [keyword, category] of Object.entries(categoryMapping)) {
      if (lowerMerchant.includes(keyword.toLowerCase())) {
        return category;
      }
    }
    
    return "その他";
  }

  private isLikelySubscription(merchant: string): boolean {
    // より具体的なサブスクサービス名のホワイトリスト方式
    const subscriptionServices = [
      // Apple services
      "apple music", "apple tv", "apple one", "icloud", "app store",
      // Google services  
      "google one", "youtube premium", "youtube music", "google play",
      // Streaming
      "netflix", "spotify", "amazon prime", "prime video", "kindle unlimited",
      "disney+", "hulu", "u-next", "abema", "dazn",
      // Software/Cloud
      "adobe", "microsoft 365", "office 365", "dropbox", "notion",
      "figma", "slack", "zoom", "github", "chatgpt",
      // Japanese services
      "ドコモ", "au", "softbank", "楽天モバイル", "mineo", "povo",
      // Keywords (more specific)
      "subscription", "サブスク", "月額", "定額", "プレミアム", "premium"
    ];
    
    const lowerMerchant = merchant.toLowerCase();
    return subscriptionServices.some(service => 
      lowerMerchant.includes(service.toLowerCase())
    );
  }

  private isGarbledText(text: string): boolean {
    // 文字化けの特徴を検出
    const garbledPatterns = [
      /[ãâêîôû]{3,}/, // 連続した文字化け文字
      /[1⁄4®™μ]{2,}/, // 特殊記号の連続
      /ï[0-9⁄]{2,}/, // ï + 数字/分数記号
      /â\s*TM/, // â + TM記号
    ];
    
    const garbledCount = garbledPatterns.reduce((count, pattern) => {
      return count + (pattern.test(text) ? 1 : 0);
    }, 0);
    
    // 文字化けパターンが2個以上、または日本語が全く含まれていない場合
    const hasJapanese = /[ひらがなカタカナ漢字]/.test(text);
    const isGarbled = garbledCount >= 2 || (!hasJapanese && /[ãâêîôû]/.test(text));
    
    console.log("Garbled text check:", {
      garbledCount,
      hasJapanese,
      isGarbled,
      sample: text.substring(0, 100)
    });
    
    return isGarbled;
  }

  private buildPrompt(info: ExtractedInfo): string {
    return `本文抜粋:
${info.snippet}

金額: ${info.amount}${info.currency}
送信元: ${info.fromDomain}
件名: ${info.subject}`;
  }

  private async callLLM(prompt: string): Promise<string> {
    try {
      // サーバーサイドのAPIエンドポイントを呼び出し
      const response = await fetch("/api/classify-merchant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          systemPrompt: SYSTEM_PROMPT,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Server API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error("Server API call failed:", error);
      throw error;
    }
  }

  private safeParseJSON(text: string): any {
    try {
      // JSON部分を抽出（```json で囲まれている場合など）
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid JSON response: ${text}`);
    }
  }

  private postProcess(result: any): ClassifiedMerchant {
    // 正規化
    result.merchant = this.normalizeMerchant(result.merchant || "不明な店舗");
    result.category = result.category || "その他";
    result.confidence = Math.min(Math.max(result.confidence || 0.5, 0), 1);

    // 低信頼度の場合はレビューが必要
    if (result.confidence < 0.6) {
      result.needsReview = true;
    }

    return result as ClassifiedMerchant;
  }

  private normalizeMerchant(merchant: string): string {
    // 全角/半角正規化、連続空白処理など
    return merchant.normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  // スマート利用先抽出（楽天・JCB対応）
  extractMerchantName(
    fromDomain: string,
    subject: string,
    body: string
  ): string | null {
    return extractMerchantSmart(fromDomain, subject, body);
  }

  // 楽天速報版判定
  isRakutenRealtime(subject: string, body: string): boolean {
    return isRakutenRealtimeNotice(subject, body);
  }

  // 確定メールで速報版を上書きするためのマッチングロジック
  findPendingTransaction(
    amount: number,
    date: Date,
    transactions: any[]
  ): any | null {
    const targetTime = date.getTime();
    const timeWindow = 2 * 24 * 60 * 60 * 1000; // 2日以内

    return (
      transactions.find(
        (tx) =>
          tx.pending === true &&
          tx.source === "RakutenRealtime" &&
          Math.abs(tx.amount - amount) < 1 && // 金額がほぼ同じ
          Math.abs(new Date(tx.date).getTime() - targetTime) < timeWindow
      ) || null
    );
  }

  // 近傍テキスト抽出（コスト削減）
  extractSnippet(
    body: string,
    keywords = [
      "ご利用先", "利用先", "ご利用店", "利用店", "加盟店", "店舗名",
      "ãå©ç¨å", "ご利用額", "Merchant", "Store",
      "【ご利用先】", "【利用先】", "【店舗名】",
      // 楽天カード特有のパターン
      "ご利用店舗", "ご利用加盟店",
      // JCB特有のパターン
      "〔ご利用先〕", "[ご利用先]"
    ]
  ): string {
    // まず正確なキーワードマッチを試行
    for (const keyword of keywords) {
      const index = body.indexOf(keyword);
      if (index !== -1) {
        // キーワード前後のより大きな範囲を抽出（店舗名を確実に含むため）
        const start = Math.max(0, index - 100);
        const end = Math.min(body.length, index + 500);
        const snippet = body.substring(start, end);
        console.log(`Found keyword "${keyword}" at index ${index}, extracted snippet:`, snippet.substring(0, 200));
        return snippet;
      }
    }

    // キーワードが見つからない場合、より大きな範囲を返して店舗名検出の可能性を高める
    console.log("No keywords found, using first 1500 characters");
    return body.substring(0, 1500);
  }
}

export const merchantClassifier = new MerchantClassifier();

// 新しいクレジットメール分類関数（ステートメント除外付き）
export function classifyCreditMailToTxn(
  email: { subject: string; from?: string; rawEmailBody: string }
) {
  // ★ ここでは rawEmailBody は既に文字コードデコード済み・HTML→テキスト済みである前提
  const mail: RawEmail = {
    subject: email.subject ?? '',
    from: email.from,
    body: email.rawEmailBody ?? '',
  };

  console.log('🔍 [CREDIT_MAIL] Processing email:', email.subject?.substring(0, 50));

  // 1) ステートメント/明細更新はスキップ
  if (looksLikeStatement(mail)) {
    console.log('❌ [CREDIT_MAIL] Statement email detected, skipping');
    return { type: 'skip', reason: 'statement_mail' as const };
  }

  // 2) 取引メール抽出
  const txn = extractTxnFromUsageMail(mail);
  if (!txn) {
    console.log('❌ [CREDIT_MAIL] No valid transaction fields found');
    return { type: 'skip', reason: 'no_usage_fields' as const };
  }

  console.log('✅ [CREDIT_MAIL] Valid transaction extracted:', {
    amount: txn.amount,
    merchant: txn.merchant?.substring(0, 30),
    date: txn.date,
    sourceCard: txn.sourceCard
  });

  // 3) 正常系：アプリ用オブジェクトに整形
  return {
    type: 'txn' as const,
    data: {
      amount: txn.amount,
      date: txn.date,                     // 無ければ後段で受信日フォールバックしてもOK
      merchant: txn.merchant ?? '不明な店舗',
      category: 'その他',
      status: 'confirmed',
      source: 'gmail',
      notes: `信頼度: 95% | ラベル抽出 | ${txn.sourceCard ?? '不明カード'}`,
      sourceCard: txn.sourceCard,
    },
  };
}

// ユーティリティ関数をエクスポート
export { isRakutenRealtimeNotice, extractMerchantSmart };
