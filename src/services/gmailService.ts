import { merchantClassifier, ExtractedInfo } from "./merchantClassifier";
import Encoding from "encoding-japanese";
import * as qp from "quoted-printable";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export interface EmailData {
  id: string;
  subject: string;
  body: string;
  date: string;
  from: string;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  merchant: string;
  date: string;
  category: string;
  status: "confirmed" | "pending" | "unknown";
  cardName?: string;
  isSubscription?: boolean; // Classifier判定結果を保持
  confidence?: number; // 分類の信頼度
}

class GmailService {
  private isGapiLoaded = false;
  private accessToken: string | null = null;
  private CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  private DISCOVERY_DOC =
    "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest";
  private SCOPES = "https://www.googleapis.com/auth/gmail.readonly";

  constructor() {
    // 初期化は遅延実行
  }

  // base64urlをバイト列に変換
  private b64urlToBytes(b64url: string): Uint8Array {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // ヘッダー値を取得
  private getHeader(headers: any[], name: string): string {
    return (
      headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value ?? ""
    );
  }

  // メール本文の正しいデコード
  private decodeBodyPart(part: any): string {
    if (!part?.body?.data) return "";

    console.log("Decoding body part, mimeType:", part.mimeType);
    let bytes = this.b64urlToBytes(part.body.data);

    // Content-Transfer-Encoding が quoted-printable の場合は先にQP解除
    const cte = this.getHeader(part.headers || [], "Content-Transfer-Encoding");
    if (/quoted-printable/i.test(cte)) {
      console.log("Applying quoted-printable decoding");
      const qpDecoded = qp.decode(new TextDecoder("latin1").decode(bytes));
      // ブラウザ環境用：TextEncoderを使用してUint8Arrayに変換
      const encoder = new TextEncoder();
      bytes = encoder.encode(qpDecoded);
    }

    // Content-Type から charset 取得
    const ct = (
      this.getHeader(part.headers || [], "Content-Type") ||
      part.mimeType ||
      ""
    ).toLowerCase();
    const m = /charset="?([^";\s]+)"?/.exec(ct);
    let charset = (m?.[1] || "utf-8").toLowerCase();

    console.log("Detected charset:", charset);

    // 誤検出・未指定時の保険：典型的な"ã"パターンがあればUTF-8化の失敗
    if (!m && /(?:ã|â|ê|î|ô|û)/.test(new TextDecoder("utf-8").decode(bytes))) {
      console.log("Detecting charset from content...");
      // 日本のカード会社メールは iso-2022-jp / shift_jis が多い
      const guess = Encoding.detect(bytes) as string;
      charset = guess?.toLowerCase() || charset;
      console.log("Auto-detected charset:", charset);
    }


    // 文字コード変換 → Unicode文字列
    try {
      const encodingName = this.mapCharsetToEncoding(charset);
      const text = Encoding.convert(bytes, {
        from: encodingName,
        to: "UNICODE",
        type: "string",
      }) as string;

      return this.normalizeJa(text);
    } catch (error) {
      console.error("Encoding conversion failed:", error);
      // フォールバック: UTF-8として解釈
      return this.normalizeJa(new TextDecoder("utf-8").decode(bytes));
    }
  }

  // charset名をencoding-japanese用に変換
  private mapCharsetToEncoding(charset: string): any {
    const mapping: { [key: string]: any } = {
      "utf-8": "UTF8",
      shift_jis: "SJIS",
      "shift-jis": "SJIS",
      "iso-2022-jp": "JIS",
      "euc-jp": "EUCJP",
      "windows-1252": "UTF8", // フォールバック
      ascii: "UTF8",
    };
    return mapping[charset] || "UTF8";
  }

  // 日本語テキストの正規化
  private normalizeJa(s: string): string {
    return s
      .replace(/\r\n/g, "\n")
      .replace(/\u00A0/g, " ") // NBSP
      .replace(/\u3000/g, " ") // 全角スペース
      .normalize("NFKC"); // 全角→半角など正規化
  }

  // 再帰的にテキスト抽出（text/plain優先、無ければ text/html をプレーン化）
  private extractTextRecursive(payload: any): string {
    if (!payload) return "";

    if (payload.mimeType?.startsWith("text/") && payload.body?.data) {
      const raw = this.decodeBodyPart(payload);
      if (payload.mimeType === "text/html") {
        try {
          const doc = new DOMParser().parseFromString(raw, "text/html");
          return this.normalizeJa(
            doc.body?.innerText || doc.documentElement?.textContent || ""
          );
        } catch {
          // HTMLパース失敗時はHTMLタグを除去
          return this.normalizeJa(
            raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")
          );
        }
      }
      return raw;
    }

    if (payload.parts?.length) {
      // text/plainを優先して探す
      for (const p of payload.parts) {
        if (p.mimeType === "text/plain") {
          const text = this.extractTextRecursive(p);
          if (text) return text;
        }
      }
      // text/plainがない場合は任意のテキストを取得
      for (const p of payload.parts) {
        const text = this.extractTextRecursive(p);
        if (text) return text;
      }
    }
    return "";
  }

  async initializeGapi(): Promise<void> {
    if (this.isGapiLoaded) return;

    return new Promise((resolve, reject) => {
      const checkLibraries = () => {
        if (typeof window !== "undefined" && window.gapi && window.google) {
          window.gapi.load("client", async () => {
            try {
              await window.gapi.client.init({
                discoveryDocs: [this.DISCOVERY_DOC],
              });

              this.isGapiLoaded = true;
              resolve();
            } catch (error) {
              console.error("GAPI client initialization failed:", error);
              reject(error);
            }
          });
        } else {
          setTimeout(checkLibraries, 100);
        }
      };
      checkLibraries();
    });
  }

  async authenticate(): Promise<void> {
    await this.initializeGapi();

    return new Promise((resolve, reject) => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: (response: any) => {
          if (response.error) {
            reject(response);
            return;
          }
          this.accessToken = response.access_token;

          // Set the access token for gapi client
          window.gapi.client.setToken({
            access_token: response.access_token,
          });

          resolve();
        },
      });

      tokenClient.requestAccessToken();
    });
  }

  async signOut(): Promise<void> {
    if (this.accessToken && window.google) {
      window.google.accounts.oauth2.revoke(this.accessToken);
      this.accessToken = null;
      window.gapi.client.setToken(null);
    }
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  async getEmails(
    query: string = 'subject:(ご利用 OR カード OR クレジット OR 利用明細 OR お支払い) OR from:(card OR credit)',
    maxResults: number = 50
  ): Promise<EmailData[]> {
    await this.initializeGapi();

    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      console.log("Searching emails with query:", query);
      const response = await window.gapi.client.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: maxResults,
      });

      console.log("Gmail API response:", response);
      
      // デバッグ：より基本的なクエリも試してみる
      if (!response.result.messages || response.result.messages.length === 0) {
        console.log("No messages found with query:", query);
        console.log("Trying simpler queries...");
        
        const testQueries = [
          'JCB',
          '楽天',
          'カード', 
          'in:inbox',
          ''
        ];
        
        for (const testQuery of testQueries) {
          try {
            console.log("Testing query:", testQuery);
            const testResponse = await window.gapi.client.gmail.users.messages.list({
              userId: "me",
              q: testQuery,
              maxResults: 5,
            });
            console.log(`Query "${testQuery}" returned:`, testResponse.result.messages?.length || 0, "messages");
            
            if (testResponse.result.messages && testResponse.result.messages.length > 0) {
              console.log("Found emails with simpler query, there might be an issue with the original query");
              break;
            }
          } catch (testError) {
            console.log("Test query failed:", testQuery, testError);
          }
        }
      }
      
      if (!response.result.messages) {
        console.log("No messages found");
        return [];
      }
      console.log("Found", response.result.messages.length, "messages");

      const emails: EmailData[] = [];

      for (const message of response.result.messages) {
        try {
          const emailDetail = await window.gapi.client.gmail.users.messages.get(
            {
              userId: "me",
              id: message.id,
            }
          );

          const headers = emailDetail.result.payload.headers;
          const subject =
            headers.find((h: any) => h.name === "Subject")?.value || "";
          const from = headers.find((h: any) => h.name === "From")?.value || "";
          const date = headers.find((h: any) => h.name === "Date")?.value || "";

          // 新しい正しいデコード機能を使用
          console.log("Processing email:", subject);
          const body = this.extractTextRecursive(emailDetail.result.payload);
          console.log("Decoded body preview:", body.substring(0, 200));

          emails.push({
            id: message.id,
            subject,
            body,
            date,
            from,
          });
        } catch (error) {
          console.error(`Error getting email ${message.id}:`, error);
        }
      }

      return emails;
    } catch (error) {
      console.error("Error fetching emails:", error);
      throw error;
    }
  }

  async parseCreditNotification(
    email: EmailData
  ): Promise<CreditTransaction | null> {
    try {
      const { subject, body, date, id, from } = email;

      // クレジットカード関連の判定
      const creditKeywords = [
        "カードご利用",
        "ご利用通知",
        "決済完了",
        "お支払い",
        "クレジットカード",
        "VISA",
        "MasterCard",
        "JCB",
      ];

      const isCreditRelated = creditKeywords.some(
        (keyword) => subject.includes(keyword) || body.includes(keyword)
      );

      if (!isCreditRelated) {
        return null; // クレジット関連でなければスキップ
      }

      // 新しいハイブリッド分類システムを使用
      const snippet = merchantClassifier.extractSnippet(body);

      // ExtractedInfo構造体を作成
      const extractedInfo: ExtractedInfo = {
        amount: 0,
        currency: "JPY",
        snippet,
        fromDomain: from.split("@")[1] || from,
        subject,
        rawBody: body,
      };

      // より精密な金額抽出
      let amount = 0;
      const amountPatterns = [
        // JCB特有のパターン（実際のメール形式に基づく）
        /【ご利用金額】\s*([¥￥]?[\d,]+)\s*円/,
        /【金額】[^\d]*([¥￥]?[\d,]+)\s*円/,
        /ご利用金額[：:\s]*([¥￥]?[\d,]+)\s*円/,
        /利用額[：:\s]*([¥￥]?[\d,]+)\s*円/,

        // 楽天カード特有のパターン（シンプルに）
        /\d{4}\/\d{2}\/\d{2}\s+(.+?)\s+([\d,]+)\s*円/g, // 日付 店舗名 金額のパターン

        // 一般的なパターン
        /お支払い金額[：:\s]*([¥￥]?[\d,]+)\s*円/,
        /決済金額[：:\s]*([¥￥]?[\d,]+)\s*円/,
        /金額[：:\s]*([¥￥]?[\d,]+)\s*円/,
        /([¥￥]?[\d,]+)\s*円.*ご利用/,
        /([¥￥]?[\d,]+)\s*円.*利用/,
        /利用.*([¥￥]?[\d,]+)\s*円/,
        /[¥￥]([\d,]+)/,
        /([\d,]+)円(?!.*年)/, // 年数を除外
      ];

      for (const pattern of amountPatterns) {
        if (pattern.global) {
          // 楽天カードの複数取引パターン
          const matches = [...body.matchAll(pattern)];
          if (matches.length > 0) {
            console.log(
              "Rakuten pattern matches:",
              matches.length,
              "transactions found"
            );
            // 最初の取引の金額を使用（後で複数取引対応も可能）
            const cleanAmount = matches[0][2].replace(/[¥￥,]/g, "");
            const parsedAmount = parseInt(cleanAmount);

            if (
              parsedAmount >= 1 &&
              parsedAmount <= 1000000 &&
              parsedAmount !== 2025
            ) {
              amount = parsedAmount;
              console.log("Found valid amount from multi-transaction:", amount);
              console.log("Full match:", matches[0]);
              break;
            }
          }
        } else {
          const match = body.match(pattern);
          if (match) {
            const cleanAmount = match[1].replace(/[¥￥,]/g, "");
            const parsedAmount = parseInt(cleanAmount);

            // 2025などの年号を除外し、妥当な金額範囲のみ受け入れ
            if (
              parsedAmount >= 1 &&
              parsedAmount <= 1000000 &&
              parsedAmount !== 2025
            ) {
              amount = parsedAmount;
              console.log(
                "Found valid amount:",
                amount,
                "using pattern:",
                pattern
              );
              break;
            }
          }
        }
      }

      // より積極的な金額検索（上記で見つからない場合）
      if (amount === 0) {
        // より厳密なパターンで金額候補を検索
        const fallbackPatterns = [
          /(\d{1,3}(?:,\d{3})*)\s*円/g,
          /¥\s*(\d{1,3}(?:,\d{3})*)/g,
          /￥\s*(\d{1,3}(?:,\d{3})*)/g,
          /(\d{1,6})\s*円(?![^\d]*年)/g // 年を除外
        ];
        
        console.log("Trying fallback amount detection with strict patterns");

        const candidateAmounts = [];

        for (const pattern of fallbackPatterns) {
          const matches = [...body.matchAll(pattern)];
          for (const match of matches) {
            const cleanNum = match[1].replace(/,/g, "");
            const num = parseInt(cleanNum);

            // 妥当な金額範囲のみ
            if (num >= 50 && num <= 500000 && num !== 2025 && num !== 2024) {
              candidateAmounts.push({ amount: num, original: match[1] });
            }
          }
        }

        if (candidateAmounts.length > 0) {
          // 最も妥当な金額を選択（中間値を優先）
          candidateAmounts.sort((a, b) => a.amount - b.amount);
          const medianIndex = Math.floor(candidateAmounts.length / 2);
          amount = candidateAmounts[medianIndex].amount;
          console.log(
            "Fallback: found amount",
            amount,
            "from",
            candidateAmounts[medianIndex].original
          );
          console.log("All candidates were:", candidateAmounts);
        }
      }

      if (amount === 0) {
        console.log("No valid amount found for:", subject);
        console.log("Email body preview:", body.substring(0, 500));
        console.log("Checking all number patterns in body...");

        // デバッグ用：すべての数字パターンを表示
        const allNumbers = body.match(/[\d,]+/g);
        console.log("All numbers found:", allNumbers);

        return null;
      }

      // 金額情報を ExtractedInfo に設定
      extractedInfo.amount = amount;

      // ハイブリッド分類システムで店舗・カテゴリを判定
      const classifiedMerchant = await merchantClassifier.classify(
        extractedInfo
      );

      // 分類結果を使用（古いパターンマッチングをスキップ）
      let merchant = classifiedMerchant.merchant;
      let category = classifiedMerchant.category;

      console.log("Merchant classification result:", classifiedMerchant);

      // フォールバック：分類器で見つからない場合のみ従来のパターンマッチングを使用
      // ただし、速報版メールの場合はスキップ
      if (merchant === "不明な店舗" && !classifiedMerchant.pending) {
        console.log(
          "Searching for merchant in body snippet:",
          body.substring(0, 1000)
        );
        const merchantPatterns = [
          // JCB特有のパターン（実際のフォーマットに基づく）
          /ãã.*?ã\s*([^ã\n\r]{1,50})/, // 文字化け対応：「ãã」で始まる行から店舗名抽出（50文字以内）
          /ãã.*?ãã\s*([^ã\n\r]{1,50})/, // 別パターン（50文字以内）

          // より直接的なパターン（適切な長さ制限と終了条件を追加）
          /【ご利用先】\s*([^\n\r【】]{1,50})(?:\s|$|\n|\r|【)/,
          /ご利用先[：:\s]*([^\n\r：【】]{1,50})(?:\s*$|\n|\r|【)/,
          /利用先[：:\s]*([^\n\r：【】]{1,50})(?:\s*$|\n|\r|【)/,

          // 一般的なパターン（適切な長さ制限を追加）
          /ご利用店舗[：:\s]*([^\n\r：【】]{1,50})(?:\s*$|\n|\r|【)/,
          /利用店舗[：:\s]*([^\n\r：【】]{1,50})(?:\s*$|\n|\r|【)/,
          /加盟店[：:\s]*([^\n\r：【】]{1,50})(?:\s*$|\n|\r|【)/,
          /店舗名[：:\s]*([^\n\r：【】]{1,50})(?:\s*$|\n|\r|【)/,
          /加盟店名[：:\s]*([^\n\r：【】]{1,50})(?:\s*$|\n|\r|【)/,
          /お支払先[：:\s]*([^\n\r：【】]{1,50})(?:\s*$|\n|\r|【)/,
        ];

        for (const pattern of merchantPatterns) {
          const match = body.match(pattern);
          console.log("Pattern:", pattern, "Match:", match);
          if (match) {
            merchant = match[1]
              .trim()
              .split(/[\n\r]/)[0]
              .trim();
            
            // 不要な文字や記号を除去
            merchant = merchant.replace(/[※*＊]/g, "").trim();
            
            // 明らかに店舗名でないテキストをフィルタリング
            const invalidPatterns = [
              /^名やお支払い方法/,
              /詳細な情報は/,
              /後日配信/,
              /カード利用お知らせメール/,
              /ご確認をお願い/,
              /^\s*$/,
              /^.{60,}$/, // 60文字以上は無効とする
            ];
            
            const isInvalid = invalidPatterns.some(pattern => pattern.test(merchant));
            if (isInvalid) {
              merchant = ""; // 無効なパターンの場合は空文字にして次のパターンを試行
              continue;
            }

            // 文字化けした店舗名の変換テーブル
            const merchantMapping: { [key: string]: string } = {
              "ããªã¤ããºã¤ã±ãã¯ã­ãã·ã°ããã³": "ユナイテッドシネマクロシオ",
              "ã¢ããã«ãããã³ã": "アップル",
              "ã¢ãããªã¼ã«": "アマゾン",
              "JCBã¯ã¬ã¸ããããå©ç¨å": "JCBクレジットご利用分（海外利用分）",
            };

            // 文字化け変換を試行
            for (const [corrupted, correct] of Object.entries(
              merchantMapping
            )) {
              if (merchant.includes(corrupted)) {
                merchant = correct;
                break;
              }
            }

            console.log("Extracted merchant:", merchant);
            if (merchant.length > 0) {
              break;
            }
          }
        }
      }

      // カテゴリの最終処理（分類器でも不明な場合のみ従来方式を使用）
      if (category === "その他") {
        const categoryMapping: { [key: string]: string } = {
          // 実際のメールで見つかった店舗名パターン
          "APPLE COM BILL": "サブスク",
          apple: "サブスク",
          ﾓﾊﾞｲﾙﾊﾟｽﾓﾁﾔ: "交通費",
          "JCBクレジットご利用分（海外利用分）": "その他",

          // 一般的なパターン
          amazon: "ショッピング",
          netflix: "サブスク",
          spotify: "サブスク",
          starbucks: "食費",
          mcdonald: "食費",
          コンビニ: "食費",
          ガソリン: "交通費",
          JR: "交通費",
          電車: "交通費",
          モバイル: "交通費",
          パスモ: "交通費",
        };

        for (const [keyword, cat] of Object.entries(categoryMapping)) {
          if (
            merchant.toLowerCase().includes(keyword.toLowerCase()) ||
            subject.toLowerCase().includes(keyword.toLowerCase())
          ) {
            category = cat;
            break;
          }
        }
      }

      // 利用日の抽出
      const dateMatch = body.match(/(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})/);
      let transactionDate = new Date(date).toISOString().split("T")[0];

      if (dateMatch) {
        const year = dateMatch[1];
        const month = dateMatch[2].padStart(2, "0");
        const day = dateMatch[3].padStart(2, "0");
        transactionDate = `${year}-${month}-${day}`;
      }

      return {
        id,
        amount,
        merchant,
        date: transactionDate,
        category,
        status: amount > 0 ? "confirmed" : "unknown",
        isSubscription: classifiedMerchant.is_subscription, // Classifierの判定結果を保存
        confidence: classifiedMerchant.confidence,
      };
    } catch (error) {
      console.error("Error parsing credit notification:", error);
      return null;
    }
  }

  async getCreditTransactions(): Promise<CreditTransaction[]> {
    try {
      const emails = await this.getEmails();
      console.log(
        "Processing",
        emails.length,
        "emails for credit transactions"
      );

      const transactions: CreditTransaction[] = [];

      for (const email of emails) {
        const transaction = await this.parseCreditNotification(email);
        if (transaction && transaction.amount > 0) {
          console.log("Valid credit transaction found:", transaction);
          transactions.push(transaction);
        }
      }

      // 未来日付の取引を除外
      const today = new Date();
      today.setHours(23, 59, 59, 999); // 今日の終わりまで許可
      
      const validTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        const isValidDate = transactionDate <= today;
        
        if (!isValidDate) {
          console.log(`Filtering out future transaction: ${transaction.merchant} on ${transaction.date}`);
        }
        
        return isValidDate;
      });

      console.log("Final transactions (after future date filter):", validTransactions);
      return validTransactions.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error) {
      console.error("Error getting credit transactions:", error);
      throw error;
    }
  }
}

export const gmailService = new GmailService();
