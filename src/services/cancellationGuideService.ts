/**
 * 解約ガイドサービス
 * サブスクリプションサービスの解約方法とリンクを提供
 */

import cancellationData from '../data/cancellationGuides.json';

export interface CancellationGuide {
  serviceName: string;
  category: string;
  officialUrl: string;
  cancellationUrl: string;
  steps: string[];
  notes?: string;
  estimatedTime?: string; // 手続きにかかる時間
  difficulty?: 'easy' | 'medium' | 'hard';
}

class CancellationGuideService {
  private guides: Map<string, CancellationGuide> = new Map();

  constructor() {
    this.loadGuides();
  }

  private loadGuides() {
    Object.entries(cancellationData).forEach(([categoryKey, category]: [string, any]) => {
      Object.entries(category).forEach(([serviceName, guideData]: [string, any]) => {
        const guide: CancellationGuide = {
          serviceName,
          category: this.getCategoryDisplayName(categoryKey),
          officialUrl: guideData.officialUrl,
          cancellationUrl: guideData.cancellationUrl,
          steps: guideData.steps,
          notes: guideData.notes,
          estimatedTime: this.estimateTime(guideData.steps),
          difficulty: this.estimateDifficulty(guideData.steps, guideData.notes)
        };
        
        this.guides.set(serviceName.toLowerCase(), guide);
      });
    });

    console.log(`Loaded ${this.guides.size} cancellation guides`);
  }

  private getCategoryDisplayName(categoryKey: string): string {
    const displayNames: { [key: string]: string } = {
      'streaming_video': '動画配信',
      'streaming_music': '音楽配信',
      'software_cloud': 'ソフトウェア・クラウド',
      'telecom_carriers': '通信・キャリア',
      'ai_tools': 'AI・業務ツール',
      'fitness_health': 'フィットネス・健康',
      'digital_content': 'デジタルコンテンツ',
      'public_services': '公共・基本サービス'
    };
    return displayNames[categoryKey] || categoryKey;
  }

  private estimateTime(steps: string[]): string {
    const stepCount = steps.length;
    if (stepCount <= 3) return '3分';
    if (stepCount <= 5) return '5分';
    if (stepCount <= 8) return '10分';
    return '15分以上';
  }

  private estimateDifficulty(steps: string[], notes?: string): 'easy' | 'medium' | 'hard' {
    let difficultyScore = 0;

    // ステップ数による判定
    if (steps.length > 5) difficultyScore += 1;
    if (steps.length > 8) difficultyScore += 1;

    // 店舗来店が必要な場合は難易度アップ
    if (steps.some(step => step.includes('来店') || step.includes('ショップ'))) {
      difficultyScore += 2;
    }

    // 解約手数料等の注記がある場合
    if (notes && (notes.includes('手数料') || notes.includes('事前通告') || notes.includes('違約金'))) {
      difficultyScore += 1;
    }

    if (difficultyScore >= 3) return 'hard';
    if (difficultyScore >= 1) return 'medium';
    return 'easy';
  }

  /**
   * サービス名から解約ガイドを取得
   */
  getGuide(serviceName: string): CancellationGuide | null {
    // 正規化して検索
    const normalizedName = serviceName.toLowerCase();
    
    // 完全一致を優先
    if (this.guides.has(normalizedName)) {
      return this.guides.get(normalizedName)!;
    }

    // 部分一致検索
    for (const [key, guide] of this.guides) {
      if (key.includes(normalizedName) || normalizedName.includes(key)) {
        return guide;
      }
    }

    // より柔軟なマッチング（キーワードベース）
    const keywords = this.extractKeywords(normalizedName);
    for (const [key, guide] of this.guides) {
      const guideKeywords = this.extractKeywords(key);
      if (this.hasCommonKeywords(keywords, guideKeywords)) {
        return guide;
      }
    }

    return null;
  }

  private extractKeywords(serviceName: string): string[] {
    return serviceName
      .replace(/[（）()]/g, '')
      .replace(/plus|premium|pro/gi, '')
      .split(/[\s\-_]+/)
      .filter(word => word.length > 1);
  }

  private hasCommonKeywords(keywords1: string[], keywords2: string[]): boolean {
    return keywords1.some(keyword => 
      keywords2.some(k => k.includes(keyword) || keyword.includes(k))
    );
  }

  /**
   * すべての解約ガイドを取得
   */
  getAllGuides(): CancellationGuide[] {
    return Array.from(this.guides.values());
  }

  /**
   * カテゴリ別の解約ガイドを取得
   */
  getGuidesByCategory(category: string): CancellationGuide[] {
    return Array.from(this.guides.values()).filter(guide => 
      guide.category === category
    );
  }

  /**
   * 難易度別の解約ガイドを取得
   */
  getGuidesByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): CancellationGuide[] {
    return Array.from(this.guides.values()).filter(guide => 
      guide.difficulty === difficulty
    );
  }

  /**
   * 解約が簡単なサービスを取得（おすすめ）
   */
  getEasyCancellationServices(): CancellationGuide[] {
    return this.getGuidesByDifficulty('easy').sort((a, b) => 
      (a.estimatedTime || '').localeCompare(b.estimatedTime || '')
    );
  }

  /**
   * 解約が困難なサービスを取得（注意喚起）
   */
  getDifficultCancellationServices(): CancellationGuide[] {
    return this.getGuidesByDifficulty('hard');
  }

  /**
   * 統計情報
   */
  getStatistics() {
    const guides = Array.from(this.guides.values());
    
    const byCategory = guides.reduce((acc, guide) => {
      acc[guide.category] = (acc[guide.category] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const byDifficulty = guides.reduce((acc, guide) => {
      acc[guide.difficulty || 'unknown'] = (acc[guide.difficulty || 'unknown'] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return {
      total: guides.length,
      byCategory,
      byDifficulty,
      averageSteps: guides.reduce((sum, guide) => sum + guide.steps.length, 0) / guides.length,
      servicesWithNotes: guides.filter(guide => guide.notes).length
    };
  }

  /**
   * サービス名の候補を検索（オートコンプリート用）
   */
  searchServices(query: string): string[] {
    const normalizedQuery = query.toLowerCase();
    const matches: string[] = [];

    for (const guide of this.guides.values()) {
      if (guide.serviceName.toLowerCase().includes(normalizedQuery)) {
        matches.push(guide.serviceName);
      }
    }

    return matches.slice(0, 10); // 上位10件まで
  }

  /**
   * ドメインから公式サイトを推定
   */
  getOfficialUrlByDomain(domain: string): string | null {
    const domainMappings: { [key: string]: string } = {
      'netflix.com': 'https://www.netflix.com/jp/',
      'amazon.co.jp': 'https://www.amazon.co.jp/prime/',
      'disneyplus.com': 'https://www.disneyplus.com/',
      'hulu.jp': 'https://www.hulu.jp/',
      'unext.jp': 'https://video.unext.jp/',
      'abema.tv': 'https://abema.tv/',
      'spotify.com': 'https://www.spotify.com/jp/',
      'apple.com': 'https://music.apple.com/jp/',
      'youtube.com': 'https://www.youtube.com/premium',
      'google.com': 'https://one.google.com/',
      'adobe.com': 'https://www.adobe.com/jp/',
      'microsoft.com': 'https://www.microsoft.com/ja-jp/microsoft-365',
      'dropbox.com': 'https://www.dropbox.com/',
      'openai.com': 'https://chat.openai.com/',
      'anthropic.com': 'https://claude.ai/',
      'github.com': 'https://github.com/features/copilot'
    };

    const normalizedDomain = domain.toLowerCase();
    
    // 完全一致
    if (domainMappings[normalizedDomain]) {
      return domainMappings[normalizedDomain];
    }

    // 部分一致（サブドメインに対応）
    for (const [mappedDomain, url] of Object.entries(domainMappings)) {
      if (normalizedDomain.includes(mappedDomain) || mappedDomain.includes(normalizedDomain)) {
        return url;
      }
    }

    return null;
  }
}

export const cancellationGuideService = new CancellationGuideService();