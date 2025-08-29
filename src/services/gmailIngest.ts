// src/services/gmailIngest.ts
import { buildSafeGmailQuery, classifyMail, type MailMeta, type MailText } from "../lib/mailFilter";
import { metaGate, type MetaLite } from "../lib/mailMetaGate";

type GmailClient = any;

const decodeB64Url = (s: string) =>
  Buffer.from((s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function toHeaderMap(arr: any[]): Record<string,string> {
  const m: Record<string,string> = {};
  for (const h of arr || []) if (h?.name && h?.value) m[h.name] = h.value;
  return m;
}
function extractTextPart(payload: any): { mime: string; data: string } | null {
  if (!payload) return null;
  const stack: any[] = [payload];
  while (stack.length) {
    const p = stack.shift();
    if (p?.mimeType?.startsWith?.("text/") && p?.body?.data) return { mime: p.mimeType, data: p.body.data };
    if (Array.isArray(p?.parts)) stack.push(...p.parts);
  }
  return null;
}

export async function fetchAndFilter(gmail: GmailClient, days = 365) {
  const q = buildSafeGmailQuery(days);

  // 1) 全件IDを集める（ページネーション対応）
  let pageToken: string | undefined;
  const ids: string[] = [];
  
  try {
    do {
      console.debug(`Fetching page with token: ${pageToken || 'initial'}`);
      const list = await gmail.users.messages.list({ userId: "me", q, maxResults: 100, pageToken });
      
      if (!list) {
        console.error('Gmail API returned null/undefined response');
        break;
      }
      
      const messages = list?.data?.messages || list?.result?.messages || [];
      console.debug(`Page returned ${messages.length} messages`);
      
      if (messages.length === 0 && !pageToken) {
        console.debug('No messages found on first page');
        break;
      }
      
      messages.forEach((m: any) => {
        if (m?.id) ids.push(m.id);
      });
      
      pageToken = list?.data?.nextPageToken || list?.result?.nextPageToken || undefined;
    } while (pageToken);
  } catch (error) {
    console.error('Error fetching message list:', error);
    throw error;
  }
  
  console.debug(`[stage0] listed=${ids.length} q="${q}"`);

  // 2) まず metadata だけ（軽い）で前処理
  const candidates: { id: string; weight: number; metaLite: MetaLite }[] = [];
  const dropped: Record<string, number> = {};
  for (const id of ids) {
    try {
      const msg = await gmail.users.messages.get({ 
        userId: "me", 
        id, 
        format: "metadata", 
        metadataHeaders: ["From","Subject","List-Unsubscribe"] 
      });
      
      const msgData = msg?.data || msg?.result || {};
      if (!msgData.payload) {
        console.warn(`No payload for message ${id}`);
        dropped["no-payload"] = (dropped["no-payload"] || 0) + 1;
        continue;
      }
      
      const headers = toHeaderMap(msgData.payload?.headers || []);
      const metaLite: MetaLite = {
        id,
        from: headers["From"] || headers["from"] || "",
        subject: headers["Subject"] || headers["subject"] || "",
        labelIds: msgData.labelIds || [],
        headers,
      };
      
      const g = metaGate(metaLite);
      if (g.pass) {
        candidates.push({ id, weight: g.weight, metaLite });
      } else {
        dropped[g.reason] = (dropped[g.reason] || 0) + 1;
      }
    } catch (error) {
      console.warn(`Failed to get metadata for message ${id}:`, error);
      dropped["metadata-error"] = (dropped["metadata-error"] || 0) + 1;
    }
  }
  // 重み順に処理（優先度高いものから本文取得）
  candidates.sort((a, b) => b.weight - a.weight);
  console.debug(`[stage1] meta-pass=${candidates.length} dropped=${JSON.stringify(dropped)}`);

  // 3) 本文を取って最終判定
  const accepted: Array<{ meta: MailMeta; amount: number }> = [];
  const rejected: Array<{ meta: MailMeta; reasons: string[] }> = [];

  for (const c of candidates) {
    const msg = await gmail.users.messages.get({ userId: "me", id: c.id, format: "full" });
    const msgData = msg?.data || msg?.result || {};
    const headers = toHeaderMap(msgData.payload?.headers || []);
    const meta: MailMeta = {
      id: c.id,
      threadId: msgData.threadId,
      from: headers["From"] || headers["from"] || "",
      subject: headers["Subject"] || headers["subject"] || "",
      labelIds: msgData.labelIds || [],
      headers,
    };
    const part = extractTextPart(msgData.payload);
    const raw = part ? decodeB64Url(part.data) : (msgData.snippet || "");
    const body: MailText = part?.mime === "text/html" ? { html: raw } : { plain: raw };

    const cls = classifyMail(meta, body, `[${c.id}] `);
    if (cls.ok) accepted.push({ meta, amount: cls.amountYen });
    else rejected.push({ meta, reasons: cls.reasons });
  }

  const reasonsCount = rejected.reduce<Record<string, number>>((acc, r) => {
    r.reasons.forEach((k) => (acc[k] = (acc[k] || 0) + 1));
    return acc;
  }, {});
  console.debug(`[final] accepted=${accepted.length} rejected=${rejected.length} reasons=${JSON.stringify(reasonsCount)}`);

  return { accepted, rejected, reasonsCount, dropped };
}