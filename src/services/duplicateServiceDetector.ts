/**
 * 重複サービス検出器
 * 同じカテゴリのサブスクリプションサービスが複数ある場合を検出・提案
 */

import { CreditTransaction } from './analyticsService';
import { subscriptionDictionaryService } from './subscriptionDictionaryService';

export interface DuplicateServiceGroup {
  category: string;
  categoryDisplayName: string;
  services: DuplicateService[];
  totalMonthlyCost: number;
  potentialSavings: number;
  recommendedAction: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DuplicateService {
  merchantName: string;
  monthlyCost: number;
  usage: 'high' | 'medium' | 'low';
  lastUsed: string;
  confidence: number;
  isRecommendedToKeep: boolean;
  reason: string;
}

export interface DuplicationAnalysis {
  duplicateGroups: DuplicateServiceGroup[];
  totalWastedAmount: number;
  topSuggestions: string[];
  summary: {
    totalDuplicates: number;
    highPriorityCount: number;
    estimatedMonthlySavings: number;
  };
}

class DuplicateServiceDetector {
  // 重複を検出するカテゴリマッピング
  private readonly DUPLICATE_CATEGORIES = {
    'streaming_video': {
      displayName: '動画配信サービス',
      keywords: ['動画配信', 'ストリーミング', 'video'],
      maxRecommended: 2, // 推奨最大数
      commonUseCase: '映画・ドラマ視聴'
    },
    'streaming_music': {
      displayName: '音楽配信サービス',
      keywords: ['音楽配信', 'music', '音楽'],
      maxRecommended: 1,
      commonUseCase: '音楽鑑賞'
    },
    'cloud_storage': {
      displayName: 'クラウドストレージ',
      keywords: ['クラウドストレージ', 'storage', 'ストレージ', 'dropbox', 'google one', 'icloud'],
      maxRecommended: 2,
      commonUseCase: 'ファイル保存・同期'
    },
    'ai_chat': {
      displayName: 'AI チャットサービス',
      keywords: ['chatgpt', 'claude', 'ai', 'chat'],
      maxRecommended: 1,
      commonUseCase: 'AI アシスタント'
    },
    'news_media': {
      displayName: 'ニュース・メディア',
      keywords: ['newspicks', 'ニュース', 'news', '新聞'],
      maxRecommended: 2,
      commonUseCase: '情報収集'
    },
    'fitness': {
      displayName: 'フィットネス・ジム',
      keywords: ['ジム', 'フィットネス', 'fitness', 'スポーツ'],
      maxRecommended: 1,
      commonUseCase: '運動・健康管理'
    },
    'language_learning': {
      displayName: '語学学習',
      keywords: ['英会話', 'duolingo', '語学', 'language'],
      maxRecommended: 2,
      commonUseCase: '語学習得'
    }
  };

  /**
   * 重複サービスを分析
   */
  analyzeSubscriptions(transactions: CreditTransaction[]): DuplicationAnalysis {
    // サブスクリプションのみを抽出
    const subscriptions = transactions.filter(tx => tx.is_subscription);
    
    // 加盟店ごとにグループ化
    const merchantGroups = this.groupByMerchant(subscriptions);
    
    // カテゴリごとに分類
    const categoryGroups = this.categorizeMerchants(merchantGroups);
    
    // 重複グループを検出
    const duplicateGroups = this.detectDuplicateGroups(categoryGroups);
    
    // 分析結果をまとめる
    return this.summarizeAnalysis(duplicateGroups);
  }

  private groupByMerchant(transactions: CreditTransaction[]): Map<string, CreditTransaction[]> {
    const groups = new Map<string, CreditTransaction[]>();
    
    transactions.forEach(tx => {
      const key = tx.merchant.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(tx);
    });
    
    return groups;
  }

  private categorizeMerchants(merchantGroups: Map<string, CreditTransaction[]>): Map<string, DuplicateService[]> {
    const categories = new Map<string, DuplicateService[]>();
    
    merchantGroups.forEach((transactions, merchantName) => {
      const category = this.detectServiceCategory(merchantName, transactions);
      
      if (category) {
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        
        const service = this.createDuplicateService(merchantName, transactions);
        categories.get(category)!.push(service);
      }
    });
    
    return categories;
  }

  private detectServiceCategory(merchantName: string, transactions: CreditTransaction[]): string | null {
    const normalizedName = merchantName.toLowerCase();
    
    // 辞書サービスから検出
    const match = subscriptionDictionaryService.detectService(merchantName);
    if (match) {
      // カテゴリをマッピング
      if (match.category.includes('動画') || match.category.includes('配信')) return 'streaming_video';
      if (match.category.includes('音楽')) return 'streaming_music';
      if (match.category.includes('クラウド') || match.category.includes('ストレージ')) return 'cloud_storage';
      if (match.category.includes('AI')) return 'ai_chat';
      if (match.category.includes('ニュース') || match.category.includes('メディア')) return 'news_media';
      if (match.category.includes('フィットネス') || match.category.includes('ジム')) return 'fitness';
      if (match.category.includes('語学') || match.category.includes('学習')) return 'language_learning';
    }
    
    // キーワードベースの検出
    for (const [categoryKey, categoryInfo] of Object.entries(this.DUPLICATE_CATEGORIES)) {
      if (categoryInfo.keywords.some(keyword => normalizedName.includes(keyword.toLowerCase()))) {
        return categoryKey;
      }
    }
    
    return null;
  }

  private createDuplicateService(merchantName: string, transactions: CreditTransaction[]): DuplicateService {
    const sortedTx = transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastTransaction = sortedTx[0];
    const monthlyCost = this.estimateMonthlyCost(transactions);
    
    // 使用頻度を推定
    const usage = this.estimateUsage(transactions);
    
    // 保持推奨度を判定
    const isRecommended = this.shouldKeepService(merchantName, transactions);
    
    return {
      merchantName,
      monthlyCost,
      usage,
      lastUsed: lastTransaction.date,
      confidence: lastTransaction.confidence || 0.8,
      isRecommendedToKeep: isRecommended.recommended,
      reason: isRecommended.reason
    };
  }

  private estimateMonthlyCost(transactions: CreditTransaction[]): number {
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalMonths = this.calculatePeriodInMonths(transactions);
    return Math.round(totalAmount / totalMonths);
  }

  private calculatePeriodInMonths(transactions: CreditTransaction[]): number {
    if (transactions.length <= 1) return 1;
    
    const dates = transactions.map(tx => new Date(tx.date)).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    
    const monthsDiff = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                      (lastDate.getMonth() - firstDate.getMonth()) + 1;
    
    return Math.max(1, monthsDiff);
  }

  private estimateUsage(transactions: CreditTransaction[]): 'high' | 'medium' | 'low' {
    const now = new Date();
    const lastTransaction = new Date(transactions[transactions.length - 1].date);
    const daysSinceLastUse = (now.getTime() - lastTransaction.getTime()) / (1000 * 60 * 60 * 24);
    
    // 頻度と最終使用日から判定
    const frequency = transactions.length;
    
    if (daysSinceLastUse <= 30 && frequency >= 3) return 'high';
    if (daysSinceLastUse <= 60 && frequency >= 2) return 'medium';
    return 'low';
  }

  private shouldKeepService(merchantName: string, transactions: CreditTransaction[]): { recommended: boolean; reason: string } {
    const usage = this.estimateUsage(transactions);
    const monthlyCost = this.estimateMonthlyCost(transactions);
    
    // 高使用頻度は保持推奨
    if (usage === 'high') {
      return { recommended: true, reason: '使用頻度が高い' };
    }
    
    // 低コストサービスは保持してもよい
    if (monthlyCost <= 500) {
      return { recommended: true, reason: 'コストが低い' };
    }
    
    // メジャーサービスは機能性で判定
    const lowerName = merchantName.toLowerCase();
    if (lowerName.includes('netflix') || lowerName.includes('spotify') || lowerName.includes('apple')) {
      return { recommended: true, reason: '機能・コンテンツが充実' };
    }
    
    return { recommended: false, reason: '使用頻度・コスト効率の改善余地あり' };
  }

  private detectDuplicateGroups(categoryGroups: Map<string, DuplicateService[]>): DuplicateServiceGroup[] {
    const duplicateGroups: DuplicateServiceGroup[] = [];
    
    categoryGroups.forEach((services, categoryKey) => {
      const categoryInfo = this.DUPLICATE_CATEGORIES[categoryKey as keyof typeof this.DUPLICATE_CATEGORIES];
      
      if (!categoryInfo) return;
      
      // 2つ以上のサービスがある場合のみ重複とみなす
      if (services.length >= 2) {
        const totalMonthlyCost = services.reduce((sum, service) => sum + service.monthlyCost, 0);
        
        // 保持推奨でないサービスの合計コストを潜在的節約として計算
        const potentialSavings = services
          .filter(service => !service.isRecommendedToKeep)
          .reduce((sum, service) => sum + service.monthlyCost, 0);
        
        // 推奨アクション生成
        const recommendedAction = this.generateRecommendedAction(services, categoryInfo);
        
        // 優先度判定
        const priority = this.calculatePriority(services, potentialSavings);
        
        duplicateGroups.push({
          category: categoryKey,
          categoryDisplayName: categoryInfo.displayName,
          services: services.sort((a, b) => b.monthlyCost - a.monthlyCost), // コスト順
          totalMonthlyCost,
          potentialSavings,
          recommendedAction,
          priority
        });
      }
    });
    
    return duplicateGroups.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  private generateRecommendedAction(services: DuplicateService[], categoryInfo: any): string {
    const recommendedToKeep = services.filter(s => s.isRecommendedToKeep);
    const notRecommended = services.filter(s => !s.isRecommendedToKeep);
    
    if (notRecommended.length === 0) {
      return `${categoryInfo.displayName}を${services.length}つ利用中。用途が重複していないか確認することをお勧めします。`;
    }
    
    if (notRecommended.length === 1) {
      return `${notRecommended[0].merchantName}の解約を検討してください。${recommendedToKeep[0]?.merchantName || '他のサービス'}で代替可能です。`;
    }
    
    return `${notRecommended.length}つのサービスの解約を検討してください。月額${notRecommended.reduce((sum, s) => sum + s.monthlyCost, 0).toLocaleString()}円の節約が可能です。`;
  }

  private calculatePriority(services: DuplicateService[], potentialSavings: number): 'high' | 'medium' | 'low' {
    // 節約額ベース
    if (potentialSavings >= 2000) return 'high';
    if (potentialSavings >= 1000) return 'medium';
    
    // 低使用頻度サービスが多い場合
    const lowUsageCount = services.filter(s => s.usage === 'low').length;
    if (lowUsageCount >= 2) return 'high';
    if (lowUsageCount >= 1) return 'medium';
    
    return 'low';
  }

  private summarizeAnalysis(duplicateGroups: DuplicateServiceGroup[]): DuplicationAnalysis {
    const totalWastedAmount = duplicateGroups.reduce((sum, group) => sum + group.potentialSavings, 0);
    const highPriorityGroups = duplicateGroups.filter(group => group.priority === 'high');
    
    // トップ提案を生成
    const topSuggestions = duplicateGroups
      .slice(0, 3)
      .map(group => group.recommendedAction);
    
    return {
      duplicateGroups,
      totalWastedAmount,
      topSuggestions,
      summary: {
        totalDuplicates: duplicateGroups.length,
        highPriorityCount: highPriorityGroups.length,
        estimatedMonthlySavings: totalWastedAmount
      }
    };
  }
}

export const duplicateServiceDetector = new DuplicateServiceDetector();