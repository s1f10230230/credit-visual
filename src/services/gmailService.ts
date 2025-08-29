import { merchantClassifier, ExtractedInfo, classifyCreditMailToTxn } from "./merchantClassifier";
import { classifyMailFlexibly } from "../lib/flexibleMailFilter";
import { TwoLaneEmailFilter } from "./twoLaneEmailFilter";
import { buildSimpleGmailQuery, classifySimple, type MailMeta, type MailText } from "../lib/simpleMailFilter";
import { buildFlexibleGmailQuery } from "../lib/flexibleMailFilter";
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
  // メール情報
  emailSubject?: string; // メール件名
  emailSender?: string; // 送信者
  messageId?: string; // Gmail Message ID
  rawEmailBody?: string; // 元のメール本文
  source?: string; // データソース
  notes?: string; // 追加メモ
}

class GmailService {
  private isGapiLoaded = false;
  private accessToken: string | null = null;
  private CLIENT_ID = (import.meta.env as any)?.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';
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

  /**
   * Enhanced fetch and filter function with two-stage meta-filtering
   */
  async fetchAndFilterTwoStage(days = 365): Promise<{
    accepted: Array<{ meta: MailMeta; amount: number }>;
    rejected: Array<{ meta: MailMeta; reasons: string[] }>;
    reasonsCount: Record<string, number>;
    dropped: Record<string, number>;
  }> {
    await this.initializeGapi();
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    // Use the new two-stage filtering approach
    return await fetchAndFilter(window.gapi.client.gmail, days);
  }

  async getEmails(
    query?: string,
    maxResults: number = 2000
  ): Promise<EmailData[]> {
    // 柔軟版：ゼロ漏れ指向で最大Recall（365日）
    if (!query) {
      query = buildFlexibleGmailQuery(365); // Flexible query - optimized for zero leakage
    }
    await this.initializeGapi();

    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      console.log("🔍 [SIMPLE] Gmail Query:", query);
      console.log("🎯 Target: Up to", maxResults, "messages with full pagination");
      console.log("🔑 Auth status:", this.isAuthenticated() ? "✅ Authenticated" : "❌ Not authenticated");
      
      // ★ 必ずwhile (pageToken)で全ページ回すように強化
      let pageToken: string | undefined = undefined;
      const allMessages: any[] = [];
      let pageCount = 0;
      
      do {
        pageCount++;
        console.log(`📄 [SIMPLE] Page ${pageCount}${pageToken ? ` (token: ${pageToken.substring(0, 10)}...)` : ''} | Target: ${maxResults} messages`);
        
        let response;
        try {
          response = await window.gapi.client.gmail.users.messages.list({
            userId: "me",
            q: query,
            maxResults: 100, // Gmail API max per page (APIの制限で100が最大)
            pageToken,
          });
          console.log(`📡 [SIMPLE] API Response status:`, response.status);
        } catch (apiError) {
          console.error(`❌ [SIMPLE] Gmail API error on page ${pageCount}:`, apiError);
          throw new Error(`Gmail API request failed: ${apiError.message || apiError}`);
        }
        
        if (response.result.messages) {
          allMessages.push(...response.result.messages);
          console.log(`📧 [SIMPLE] Page ${pageCount}: ${response.result.messages.length} messages | Running total: ${allMessages.length}/${maxResults}`);
        } else {
          console.log(`📧 [SIMPLE] Page ${pageCount}: No messages found`);
        }
        
        pageToken = response.result.nextPageToken;
        
        // maxResults制限に達したかチェック
        if (allMessages.length >= maxResults) {
          console.log(`🎯 [SIMPLE] Reached target of ${maxResults} messages, stopping pagination`);
          break;
        }
        
        // 必ず全ページ回す（pageTokenがある限り続行）
      } while (pageToken);

      if (allMessages.length === 0) {
        console.warn("⚠️ No messages found with recall-first query");
        console.log("🧪 Testing fallback queries...");
        
        const testQueries = [
          'JCB',
          '楽天', 
          'subject:円',
          'subject:利用',
          'in:inbox newer_than:30d'
        ];
        
        for (const testQuery of testQueries) {
          try {
            const testResponse = await window.gapi.client.gmail.users.messages.list({
              userId: "me",
              q: testQuery,
              maxResults: 5,
            });
            console.log(`🔍 "${testQuery}": ${testResponse.result.messages?.length || 0} messages`);
          } catch (testError) {
            console.log(`❌ Query "${testQuery}" failed:`, testError);
          }
        }
        return [];
      }
      
      console.log(`✅ Total messages found across all pages: ${allMessages.length}`);

      const emails: EmailData[] = [];

      for (const message of allMessages) {
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

      // 🎯 SIMPLE: 金額+文脈のみで判定
      console.log(`[SIMPLE] [stage0] Gmail取得完了: ${emails.length}件のメール`);
      
      let textOkCount = 0;
      const classifiedEmails: EmailData[] = [];
      const rejectedReasons: Record<string, number> = {};

      for (const email of emails) {
        // Text extraction check
        if (email.body && email.body.trim().length > 10) {
          textOkCount++;
        }

        const meta: MailMeta = {
          id: email.id,
          from: email.from,
          subject: email.subject,
        };
        const body: MailText = { plain: email.body };
        
        // 改良された柔軟フィルターを使用（抜け漏れ防止）
        const classification = classifyMailFlexibly(meta, body);
        if (classification.ok) {
          classifiedEmails.push(email);
          console.log(`✅ [FLEXIBLE] 採択: ${email.subject.substring(0, 40)}... ${classification.amountYen}円 | Trust: ${classification.trustLevel} | Confidence: ${classification.confidence}%`);
        } else {
          rejectedReasons['no-amount-or-low-confidence'] = (rejectedReasons['no-amount-or-low-confidence'] || 0) + 1;
          console.debug(`❌ [FLEXIBLE] 除外: ${email.subject.substring(0, 25)}... 理由: no amount or low confidence`);
        }
      }

      console.log('🎯 === FLEXIBLE FILTERING RESULTS ===');
      console.log(`[stage0] Gmail listed: ${emails.length}`);
      console.log(`[stage1] Text available: ${textOkCount}`);
      console.log(`[final] Accepted: ${classifiedEmails.length}`);
      console.log(`Rejected reasons:`, rejectedReasons);
      
      if (classifiedEmails.length === 0) {
        console.error('🚨 [SIMPLE] ZERO RESULTS!');
        console.error('📊 Rejection reasons:', Object.entries(rejectedReasons).sort(([,a], [,b]) => b - a));
        
        if (rejectedReasons['no-text'] > emails.length * 0.5) {
          console.error('💡 Many emails have no text - check HTML parsing');
        }
        if (rejectedReasons['no-amount-context'] > emails.length * 0.3) {
          console.error('💡 Try expanding context radius or adding more trigger words');
        }
      } else {
        console.log('🎉 [SIMPLE] 採択成功:', classifiedEmails.map(email => ({
          subject: email.subject.substring(0, 30) + '...',
          from: email.from.split('@')[1] || email.from.split('<')[0]
        })));
      }

      return classifiedEmails;
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

      console.log(`🔍 [Parse] Processing: ${subject.substring(0, 50)}... from ${from}`);
      
      // 新しい柔軟フィルターを最初に試行（抜け漏れ防止）
      const flexibleResult = classifyMailFlexibly(
        { id, from, subject },
        { plain: body }
      );

      if (flexibleResult.ok) {
        // 柔軟フィルターで成功した場合
        console.log(`✅ [FLEXIBLE] Success: ${flexibleResult.amountYen}円 | Trust: ${flexibleResult.trustLevel} | Confidence: ${flexibleResult.confidence}%`);
        
        const txnData = {
          amount: flexibleResult.amountYen!,
          merchant: flexibleResult.extractedData.merchant || '不明な店舗',
          date: flexibleResult.extractedData.date || new Date().toISOString().split('T')[0],
          category: 'unknown' as const,
          trustLevel: flexibleResult.trustLevel,
          confidence: flexibleResult.confidence
        };

        // 高度な分類処理は従来通り
        let finalMerchant = txnData.merchant;
        let finalCategory = txnData.category;

        if (finalMerchant && finalMerchant !== '不明な店舗') {
          // ExtractedInfo構造体を作成してハイブリッド分類システムを使用
          const snippet = merchantClassifier.extractSnippet(body);
          const extractedInfo: ExtractedInfo = {
            amount: txnData.amount,
            currency: "JPY",
            snippet,
            fromDomain: from.split("@")[1] || from,
            subject,
            rawBody: body,
          };

          const classifiedMerchant = await merchantClassifier.classify(extractedInfo);
          
          if (classifiedMerchant.confidence > 0.7) {
            finalMerchant = classifiedMerchant.merchant;
            finalCategory = classifiedMerchant.category;
            console.log(`🎯 [FLEXIBLE] Enhanced classification: ${finalMerchant} (${finalCategory})`);
          }
        }

        // 利用日の抽出（メール本文から優先、無ければフォールバック）
        let transactionDate = txnData.date || new Date(date).toISOString().split("T")[0];

        return {
          id,
          amount: txnData.amount,
          merchant: finalMerchant,
          date: transactionDate,
          category: finalCategory,
          status: "confirmed",
          isSubscription: finalMerchant.toLowerCase().includes('subscription') || 
                         finalMerchant.toLowerCase().includes('サブスク'),
          confidence: (txnData.confidence || 100) / 100,
          // メール情報を追加
          emailSubject: subject,
          emailSender: from,
          messageId: id,
          rawEmailBody: body,
          source: 'gmail',
          notes: `柔軟フィルター: ${flexibleResult.trustLevel} | Confidence: ${flexibleResult.confidence}%`,
        };
      }

      // フォールバック: 柔軟フィルターで失敗した場合は従来の厳格フィルター
      console.log(`⚠️ [FLEXIBLE] Failed, trying legacy filter...`);
      
      const classificationResult = classifyCreditMailToTxn({
        subject,
        from,
        rawEmailBody: body
      });

      // スキップ対象の場合は早期リターン
      if (classificationResult.type === 'skip') {
        console.log(`❌ [LEGACY] Also skipped: ${classificationResult.reason}`);
        return null;
      }

      // 従来の処理を継続...
      const legacyTxnData = classificationResult.data;
      console.log(`✅ [LEGACY] Valid transaction: ${legacyTxnData.amount}円 | ${legacyTxnData.merchant}`);

      // 利用日の抽出（メール本文から優先、無ければフォールバック）
      let transactionDate = legacyTxnData.date || new Date(date).toISOString().split("T")[0];

      return {
        id,
        amount: legacyTxnData.amount,
        merchant: legacyTxnData.merchant,
        date: transactionDate,
        category: legacyTxnData.category,
        status: "confirmed",
        isSubscription: legacyTxnData.merchant.toLowerCase().includes('subscription') || 
                       legacyTxnData.merchant.toLowerCase().includes('サブスク'),
        confidence: 0.8, // 従来フィルターは少し低い confidence
        // メール情報を追加
        emailSubject: subject,
        emailSender: from,
        messageId: id,
        rawEmailBody: body,
        source: 'gmail',
        notes: legacyTxnData.notes || '従来フィルター | 信頼度: 80%',
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
        "filtered emails for credit transactions"
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
