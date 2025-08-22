import { CreditTransaction, CategorySummary, MerchantSummary } from './analyticsService';
import { securityService } from './securityService';

export interface ExportOptions {
  format: 'csv' | 'pdf' | 'excel';
  dateRange: {
    start: string;
    end: string;
  };
  categories?: string[];
  merchants?: string[];
  includeAnalytics?: boolean;
  includeCharts?: boolean;
  template?: 'detailed' | 'summary' | 'custom';
}

export interface ExportResult {
  success: boolean;
  data?: Blob | string;
  filename?: string;
  error?: string;
}

export interface PDFTemplateData {
  title: string;
  dateRange: string;
  summary: {
    totalAmount: number;
    transactionCount: number;
    averageTransaction: number;
    topCategory: string;
    topMerchant: string;
  };
  transactions: CreditTransaction[];
  categoryBreakdown: CategorySummary[];
  merchantBreakdown: MerchantSummary[];
  charts?: {
    categoryChart: string; // base64 encoded chart image
    trendChart: string;
    monthlyChart: string;
  };
}

class ExportService {
  private readonly MAX_EXPORT_RECORDS = 10000;
  private readonly EXPORT_RATE_LIMIT = 5; // per hour

  async exportTransactions(
    transactions: CreditTransaction[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Check rate limiting
      if (!(await this.checkRateLimit())) {
        return {
          success: false,
          error: 'エクスポート回数の制限に達しました。1時間後に再試行してください。'
        };
      }

      // Security check - require authentication for exports
      const authResult = await securityService.secureExport(transactions, options.format);
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || '認証が必要です'
        };
      }

      // Filter transactions based on options
      const filteredTransactions = this.filterTransactions(transactions, options);

      // Check record limit
      if (filteredTransactions.length > this.MAX_EXPORT_RECORDS) {
        return {
          success: false,
          error: `エクスポート可能な最大件数（${this.MAX_EXPORT_RECORDS}件）を超えています。`
        };
      }

      // Generate export based on format
      let result: ExportResult;
      
      switch (options.format) {
        case 'csv':
          result = await this.exportToCSV(filteredTransactions, options);
          break;
        case 'pdf':
          result = await this.exportToPDF(filteredTransactions, options);
          break;
        case 'excel':
          result = await this.exportToExcel(filteredTransactions, options);
          break;
        default:
          return {
            success: false,
            error: 'サポートされていない形式です'
          };
      }

      // Track export for rate limiting
      if (result.success) {
        this.trackExport();
      }

      return result;

    } catch (error) {
      console.error('Export failed:', error);
      return {
        success: false,
        error: 'エクスポート中にエラーが発生しました'
      };
    }
  }

  async exportToCSV(
    transactions: CreditTransaction[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const headers = [
        '日付',
        '利用先',
        'カテゴリ',
        '金額',
        '通貨',
        'カード',
        'サブスク',
        '信頼度',
        '備考'
      ];

      const rows = transactions.map(tx => [
        this.formatDate(tx.date),
        this.escapeCsvField(tx.merchant),
        this.escapeCsvField(tx.category),
        tx.amount.toString(),
        tx.currency,
        this.escapeCsvField(tx.platform),
        tx.is_subscription ? 'はい' : 'いいえ',
        (tx.confidence * 100).toFixed(1) + '%',
        this.escapeCsvField(tx.notes)
      ]);

      // Add analytics if requested
      if (options.includeAnalytics) {
        rows.push([], ['=== 分析結果 ===']);
        const analytics = this.generateAnalytics(transactions);
        rows.push(...analytics);
      }

      const csvContent = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');

      // Add BOM for Excel compatibility
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { 
        type: 'text/csv;charset=utf-8' 
      });

      const filename = this.generateFilename('csv', options.dateRange);

      return {
        success: true,
        data: blob,
        filename
      };

    } catch (error) {
      console.error('CSV export failed:', error);
      return {
        success: false,
        error: 'CSV出力に失敗しました'
      };
    }
  }

  async exportToPDF(
    transactions: CreditTransaction[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Generate PDF template data
      const templateData = this.generatePDFTemplateData(transactions, options);
      
      // Create PDF content
      const pdfContent = await this.generatePDFContent(templateData, options);
      
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      const filename = this.generateFilename('pdf', options.dateRange);

      return {
        success: true,
        data: blob,
        filename
      };

    } catch (error) {
      console.error('PDF export failed:', error);
      return {
        success: false,
        error: 'PDF出力に失敗しました'
      };
    }
  }

  async exportToExcel(
    transactions: CreditTransaction[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Create Excel workbook
      const workbook = this.createExcelWorkbook(transactions, options);
      
      // Convert to blob
      const blob = await this.workbookToBlob(workbook);
      const filename = this.generateFilename('xlsx', options.dateRange);

      return {
        success: true,
        data: blob,
        filename
      };

    } catch (error) {
      console.error('Excel export failed:', error);
      return {
        success: false,
        error: 'Excel出力に失敗しました'
      };
    }
  }

  async exportAnalyticsReport(
    transactions: CreditTransaction[],
    analytics: {
      categories: CategorySummary[];
      merchants: MerchantSummary[];
      trends: any[];
    },
    format: 'pdf' | 'excel' = 'pdf'
  ): Promise<ExportResult> {
    const options: ExportOptions = {
      format,
      dateRange: {
        start: this.getDateRangeStart(transactions),
        end: this.getDateRangeEnd(transactions)
      },
      includeAnalytics: true,
      includeCharts: true,
      template: 'detailed'
    };

    if (format === 'pdf') {
      return this.exportAnalyticsPDF(transactions, analytics, options);
    } else {
      return this.exportAnalyticsExcel(transactions, analytics, options);
    }
  }

  downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  private filterTransactions(
    transactions: CreditTransaction[],
    options: ExportOptions
  ): CreditTransaction[] {
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      const startDate = new Date(options.dateRange.start);
      const endDate = new Date(options.dateRange.end);

      // Date range filter
      if (txDate < startDate || txDate > endDate) {
        return false;
      }

      // Category filter
      if (options.categories && options.categories.length > 0) {
        if (!options.categories.includes(tx.category)) {
          return false;
        }
      }

      // Merchant filter
      if (options.merchants && options.merchants.length > 0) {
        if (!options.merchants.includes(tx.merchant)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private generateAnalytics(transactions: CreditTransaction[]): string[][] {
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const avgAmount = totalAmount / transactions.length;
    
    const categoryTotals = new Map<string, number>();
    transactions.forEach(tx => {
      categoryTotals.set(tx.category, (categoryTotals.get(tx.category) || 0) + tx.amount);
    });
    
    const topCategory = Array.from(categoryTotals.entries())
      .sort(([,a], [,b]) => b - a)[0];

    return [
      ['総額', `¥${totalAmount.toLocaleString()}`],
      ['取引件数', transactions.length.toString()],
      ['平均金額', `¥${Math.round(avgAmount).toLocaleString()}`],
      ['トップカテゴリ', `${topCategory[0]} (¥${topCategory[1].toLocaleString()})`],
      []
    ];
  }

  private generatePDFTemplateData(
    transactions: CreditTransaction[],
    options: ExportOptions
  ): PDFTemplateData {
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const categoryMap = new Map<string, {total: number, count: number}>();
    const merchantMap = new Map<string, {total: number, count: number}>();

    transactions.forEach(tx => {
      // Category breakdown
      const catData = categoryMap.get(tx.category) || {total: 0, count: 0};
      catData.total += tx.amount;
      catData.count += 1;
      categoryMap.set(tx.category, catData);

      // Merchant breakdown
      const merchData = merchantMap.get(tx.merchant) || {total: 0, count: 0};
      merchData.total += tx.amount;
      merchData.count += 1;
      merchantMap.set(tx.merchant, merchData);
    });

    const categoryBreakdown: CategorySummary[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        totalAmount: data.total,
        transactionCount: data.count,
        percentage: (data.total / totalAmount) * 100,
        averageAmount: Math.round(data.total / data.count),
        merchants: transactions
          .filter(tx => tx.category === category)
          .map(tx => tx.merchant)
          .filter((merchant, index, arr) => arr.indexOf(merchant) === index)
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const merchantBreakdown: MerchantSummary[] = Array.from(merchantMap.entries())
      .map(([merchant, data]) => ({
        merchant,
        totalAmount: data.total,
        frequency: data.count,
        category: transactions.find(tx => tx.merchant === merchant)?.category || '',
        averageAmount: Math.round(data.total / data.count),
        percentageOfTotal: (data.total / totalAmount) * 100,
        isSubscription: transactions.some(tx => tx.merchant === merchant && tx.is_subscription),
        transactions: transactions.filter(tx => tx.merchant === merchant)
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10); // Top 10

    return {
      title: 'クレジットカード支出レポート',
      dateRange: `${this.formatDate(options.dateRange.start)} - ${this.formatDate(options.dateRange.end)}`,
      summary: {
        totalAmount,
        transactionCount: transactions.length,
        averageTransaction: Math.round(totalAmount / transactions.length),
        topCategory: categoryBreakdown[0]?.category || 'N/A',
        topMerchant: merchantBreakdown[0]?.merchant || 'N/A'
      },
      transactions,
      categoryBreakdown,
      merchantBreakdown
    };
  }

  private async generatePDFContent(
    templateData: PDFTemplateData,
    options: ExportOptions
  ): Promise<ArrayBuffer> {
    // This is a simplified PDF generation
    // In a real implementation, you would use a library like jsPDF or PDFKit
    
    const content = this.generateHTMLReport(templateData);
    
    // Convert HTML to PDF (this would need a proper PDF library)
    // For now, we'll return a mock PDF
    const encoder = new TextEncoder();
    return encoder.encode(content).buffer;
  }

  private generateHTMLReport(templateData: PDFTemplateData): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${templateData.title}</title>
    <style>
        body { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .amount { text-align: right; }
        .page-break { page-break-before: always; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${templateData.title}</h1>
        <p>期間: ${templateData.dateRange}</p>
    </div>
    
    <div class="summary">
        <h2>サマリー</h2>
        <p>総額: ¥${templateData.summary.totalAmount.toLocaleString()}</p>
        <p>取引件数: ${templateData.summary.transactionCount}件</p>
        <p>平均金額: ¥${templateData.summary.averageTransaction.toLocaleString()}</p>
        <p>トップカテゴリ: ${templateData.summary.topCategory}</p>
    </div>
    
    <div class="section">
        <h2>カテゴリ別内訳</h2>
        <table>
            <tr>
                <th>カテゴリ</th>
                <th>金額</th>
                <th>件数</th>
                <th>割合</th>
            </tr>
            ${templateData.categoryBreakdown.map(cat => `
                <tr>
                    <td>${cat.category}</td>
                    <td class="amount">¥${cat.totalAmount.toLocaleString()}</td>
                    <td>${cat.transactionCount}</td>
                    <td>${cat.percentage.toFixed(1)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>
    
    <div class="section page-break">
        <h2>取引明細</h2>
        <table>
            <tr>
                <th>日付</th>
                <th>利用先</th>
                <th>カテゴリ</th>
                <th>金額</th>
            </tr>
            ${templateData.transactions.slice(0, 100).map(tx => `
                <tr>
                    <td>${this.formatDate(tx.date)}</td>
                    <td>${tx.merchant}</td>
                    <td>${tx.category}</td>
                    <td class="amount">¥${tx.amount.toLocaleString()}</td>
                </tr>
            `).join('')}
        </table>
    </div>
</body>
</html>`;
  }

  private createExcelWorkbook(
    transactions: CreditTransaction[],
    options: ExportOptions
  ): any {
    // This would create an actual Excel workbook using a library like xlsx
    // For now, we'll return a mock structure
    return {
      sheets: {
        '取引明細': this.createTransactionsSheet(transactions),
        '分析': this.createAnalyticsSheet(transactions)
      }
    };
  }

  private createTransactionsSheet(transactions: CreditTransaction[]): any[][] {
    const headers = ['日付', '利用先', 'カテゴリ', '金額', '通貨', 'カード', 'サブスク'];
    const rows = transactions.map(tx => [
      this.formatDate(tx.date),
      tx.merchant,
      tx.category,
      tx.amount,
      tx.currency,
      tx.platform,
      tx.is_subscription ? 'はい' : 'いいえ'
    ]);
    
    return [headers, ...rows];
  }

  private createAnalyticsSheet(transactions: CreditTransaction[]): any[][] {
    const analytics = this.generateAnalytics(transactions);
    return [
      ['項目', '値'],
      ...analytics
    ];
  }

  private async workbookToBlob(workbook: any): Promise<Blob> {
    // Convert workbook to blob
    // This would use a proper Excel library
    const content = JSON.stringify(workbook);
    return new Blob([content], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  }

  private async exportAnalyticsPDF(
    transactions: CreditTransaction[],
    analytics: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Implementation for analytics PDF export
    return this.exportToPDF(transactions, options);
  }

  private async exportAnalyticsExcel(
    transactions: CreditTransaction[],
    analytics: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Implementation for analytics Excel export
    return this.exportToExcel(transactions, options);
  }

  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  private generateFilename(extension: string, dateRange: {start: string, end: string}): string {
    const start = this.formatDate(dateRange.start).replace(/\//g, '');
    const end = this.formatDate(dateRange.end).replace(/\//g, '');
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '');
    
    return `credit_transactions_${start}_${end}_${timestamp}.${extension}`;
  }

  private getDateRangeStart(transactions: CreditTransaction[]): string {
    const dates = transactions.map(tx => new Date(tx.date));
    return new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().split('T')[0];
  }

  private getDateRangeEnd(transactions: CreditTransaction[]): string {
    const dates = transactions.map(tx => new Date(tx.date));
    return new Date(Math.max(...dates.map(d => d.getTime()))).toISOString().split('T')[0];
  }

  private async checkRateLimit(): Promise<boolean> {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const exports = JSON.parse(localStorage.getItem('exportHistory') || '[]');
    
    // Remove exports older than 1 hour
    const recentExports = exports.filter((timestamp: number) => now - timestamp < hour);
    
    localStorage.setItem('exportHistory', JSON.stringify(recentExports));
    
    return recentExports.length < this.EXPORT_RATE_LIMIT;
  }

  private trackExport(): void {
    const now = Date.now();
    const exports = JSON.parse(localStorage.getItem('exportHistory') || '[]');
    exports.push(now);
    localStorage.setItem('exportHistory', JSON.stringify(exports));
  }
}

export const exportService = new ExportService();