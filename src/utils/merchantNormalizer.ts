/**
 * 加盟店名の正規化ユーティリティ
 * 同一サービスを統一した表示名でグループ化するための機能
 */

export interface NormalizedMerchant {
  normalized: string; // 正規化後の名前
  displayName: string; // UI表示用の名前
  original: string; // 元の名前
}

/**
 * 加盟店名を正規化して同一サービスをグループ化
 */
export function normalizeMerchant(raw: string): string {
  if (!raw) return '';
  
  let normalized = raw.toLowerCase();
  
  // 全角文字を半角に変換
  normalized = normalized.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (s) => 
    String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  );
  
  // 記号・区切り文字を空白に統一
  normalized = normalized.replace(/[＊*・\-\u30FC＿_\|\/@#$%&+=]/g, ' ');
  
  // 長いID/数字列を除去（3桁以上の数字）
  normalized = normalized.replace(/\b\d{3,}\b/g, '');
  
  // 短いID/数字も除去（末尾の1-2桁の数字）
  normalized = normalized.replace(/\s+\d{1,2}$/, '');
  
  // 複数の空白を1つに
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // よく使われる接頭辞・接尾辞を除去
  normalized = normalized.replace(/^(stripe|sq|paypal|apple|google)\s*[\*\s]*/i, '');
  normalized = normalized.replace(/\s*(inc|ltd|llc|corp|co|jp|com)\.?$/i, '');
  
  return normalized;
}

/**
 * より厳密な正規化（表示名生成用）
 */
export function normalizeForDisplay(merchants: string[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  
  // 正規化してグループ化
  merchants.forEach(merchant => {
    const normalized = normalizeMerchant(merchant);
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push(merchant);
  });
  
  // 各グループで最適な表示名を選択
  const displayNames = new Map<string, string>();
  
  groups.forEach((merchantList, normalized) => {
    // 最も短く、かつ意味のある名前を選択
    const bestName = merchantList.reduce((best, current) => {
      // 数字が少ない方を優先
      const currentNumbers = (current.match(/\d/g) || []).length;
      const bestNumbers = (best.match(/\d/g) || []).length;
      
      if (currentNumbers < bestNumbers) return current;
      if (currentNumbers > bestNumbers) return best;
      
      // 数字が同じなら短い方を優先
      if (current.length < best.length) return current;
      return best;
    });
    
    // 元の名前を正規化された名前にマッピング
    merchantList.forEach(merchant => {
      displayNames.set(merchant, bestName);
    });
  });
  
  return displayNames;
}

/**
 * 特定のサービス名パターンを認識して統一名に変換
 */
export function getCanonicalServiceName(merchant: string): string {
  const normalized = normalizeMerchant(merchant);
  
  // 主要サービスの統一名マッピング
  const serviceMap: { [key: string]: string } = {
    // Spotify variations
    'spotify': 'Spotify',
    'spot': 'Spotify',
    
    // Netflix variations  
    'netflix': 'Netflix',
    'nf': 'Netflix',
    
    // Apple variations
    'apple': 'Apple',
    'app store': 'Apple',
    'itunes': 'Apple',
    
    // Google variations
    'google': 'Google',
    'google play': 'Google Play',
    'youtube': 'YouTube',
    
    // Amazon variations
    'amazon': 'Amazon',
    'amzn': 'Amazon',
    'prime': 'Amazon Prime',
    
    // Adobe variations
    'adobe': 'Adobe',
    
    // Microsoft variations
    'microsoft': 'Microsoft',
    'msft': 'Microsoft',
    
    // Dropbox variations
    'dropbox': 'Dropbox',
    'dbx': 'Dropbox',
  };
  
  // 完全一致を最初にチェック
  if (serviceMap[normalized]) {
    return serviceMap[normalized];
  }
  
  // 部分一致をチェック
  for (const [pattern, serviceName] of Object.entries(serviceMap)) {
    if (normalized.includes(pattern)) {
      return serviceName;
    }
  }
  
  // マッチしない場合は正規化された名前を返す
  return normalized.replace(/^\w/, c => c.toUpperCase());
}

/**
 * サブスクサービス同士の類似度を計算
 */
export function calculateSimilarity(merchant1: string, merchant2: string): number {
  const norm1 = normalizeMerchant(merchant1);
  const norm2 = normalizeMerchant(merchant2);
  
  if (norm1 === norm2) return 1.0;
  
  // トークンベースの類似度計算
  const tokens1 = norm1.split(' ').filter(t => t.length > 0);
  const tokens2 = norm2.split(' ').filter(t => t.length > 0);
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  // 共通トークンの割合
  const commonTokens = tokens1.filter(token => 
    tokens2.some(t2 => t2.includes(token) || token.includes(t2))
  );
  
  return commonTokens.length / Math.max(tokens1.length, tokens2.length);
}

/**
 * デバッグ用：正規化プロセスを可視化
 */
export function debugNormalization(merchant: string): {
  original: string;
  steps: { step: string; result: string }[];
  final: string;
} {
  const steps: { step: string; result: string }[] = [];
  let current = merchant;
  
  steps.push({ step: 'Original', result: current });
  
  current = current.toLowerCase();
  steps.push({ step: 'Lowercase', result: current });
  
  current = current.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (s) => 
    String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  );
  steps.push({ step: 'Zenkaku->Hankaku', result: current });
  
  current = current.replace(/[＊*・\-\u30FC＿_\|\/@#$%&+=]/g, ' ');
  steps.push({ step: 'Symbol normalization', result: current });
  
  current = current.replace(/\b\d{3,}\b/g, '');
  steps.push({ step: 'Remove long numbers', result: current });
  
  current = current.replace(/\s+\d{1,2}$/, '');
  steps.push({ step: 'Remove trailing short numbers', result: current });
  
  current = current.replace(/\s+/g, ' ').trim();
  steps.push({ step: 'Normalize whitespace', result: current });
  
  return {
    original: merchant,
    steps,
    final: current
  };
}