import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  useTheme,
  useMediaQuery,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  GetApp as GetAppIcon,
  Assessment as AssessmentIcon,
  Description as DescriptionIcon,
  TableChart as TableChartIcon,
  PictureAsPdf as PictureAsPdfIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { CreditTransaction, analyticsService } from '../services/analyticsService';
import { exportService, ExportOptions } from '../services/exportService';

interface ExportManagerProps {
  transactions: CreditTransaction[];
}

const ExportManager: React.FC<ExportManagerProps> = ({ transactions }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [loading, setLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'pdf' | 'excel'>('csv');
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    dateRange: {
      start: getDefaultStartDate(),
      end: getDefaultEndDate(),
    },
    includeAnalytics: true,
    includeCharts: false,
    template: 'detailed',
  });

  // 利用可能なカテゴリとマーチャント
  const categories = analyticsService.groupByCategory(transactions).map(c => c.category);
  const merchants = analyticsService.groupByMerchant(transactions).map(m => m.merchant).slice(0, 20);

  useEffect(() => {
    // エクスポート履歴を読み込み
    const history = localStorage.getItem('exportHistory') || '[]';
    setExportHistory(JSON.parse(history));
  }, []);

  function getDefaultStartDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); // 3か月前
    return date.toISOString().split('T')[0];
  }

  function getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  const handleExport = async () => {
    setLoading(true);
    
    try {
      const exportOptions: ExportOptions = {
        ...options,
        format: selectedFormat,
      };

      const result = await exportService.exportTransactions(transactions, exportOptions);
      
      if (result.success && result.data && result.filename) {
        exportService.downloadFile(result.data as Blob, result.filename);
        
        // 履歴に追加
        const newHistory = [
          new Date().toISOString(),
          ...exportHistory.slice(0, 9)
        ];
        setExportHistory(newHistory);
        localStorage.setItem('exportHistory', JSON.stringify(newHistory));
        
      } else {
        alert(result.error || 'エクスポートに失敗しました');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポート中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyticsExport = async () => {
    setLoading(true);
    
    try {
      const insights = analyticsService.generateSpendingInsights(transactions);
      const result = await exportService.exportAnalyticsReport(
        transactions,
        {
          categories: insights.topCategories,
          merchants: insights.topMerchants,
          trends: insights.trends,
        },
        selectedFormat === 'csv' ? 'pdf' : selectedFormat as 'pdf' | 'excel'
      );
      
      if (result.success && result.data && result.filename) {
        exportService.downloadFile(result.data as Blob, result.filename);
      } else {
        alert(result.error || 'エクスポートに失敗しました');
      }
    } catch (error) {
      console.error('Analytics export error:', error);
      alert('分析レポートのエクスポート中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTransactionsCount = () => {
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      const startDate = new Date(options.dateRange.start);
      const endDate = new Date(options.dateRange.end);
      
      if (txDate < startDate || txDate > endDate) return false;
      
      if (options.categories && options.categories.length > 0) {
        if (!options.categories.includes(tx.category)) return false;
      }
      
      if (options.merchants && options.merchants.length > 0) {
        if (!options.merchants.includes(tx.merchant)) return false;
      }
      
      return true;
    }).length;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'csv': return <TableChartIcon />;
      case 'pdf': return <PictureAsPdfIcon />;
      case 'excel': return <DescriptionIcon />;
      default: return <DownloadIcon />;
    }
  };

  const getFormatDescription = (format: string) => {
    switch (format) {
      case 'csv': return 'Excel等で開ける表形式ファイル';
      case 'pdf': return 'レポート形式の印刷可能ファイル';
      case 'excel': return 'Microsoft Excel形式ファイル';
      default: return '';
    }
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 2 }}>
      {/* エクスポート概要 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <GetAppIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    対象取引数
                  </Typography>
                  <Typography variant="h6">
                    {getFilteredTransactionsCount()}件
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <HistoryIcon color="info" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    今日のエクスポート
                  </Typography>
                  <Typography variant="h6">
                    {exportHistory.filter(h => 
                      new Date(h).toDateString() === new Date().toDateString()
                    ).length}/5回
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AssessmentIcon color="success" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    期間
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(options.dateRange.start)} -
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(options.dateRange.end)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <FilterListIcon color="warning" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    フィルター
                  </Typography>
                  <Typography variant="body2">
                    {(options.categories?.length || 0) + (options.merchants?.length || 0)}件
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* クイックエクスポート */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            クイックエクスポート
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {['csv', 'pdf', 'excel'].map(format => (
              <Grid item xs={12} sm={4} key={format}>
                <Button
                  variant={selectedFormat === format ? "contained" : "outlined"}
                  fullWidth
                  startIcon={getFormatIcon(format)}
                  onClick={() => setSelectedFormat(format as 'csv' | 'pdf' | 'excel')}
                  sx={{ 
                    height: 80,
                    flexDirection: 'column',
                    textTransform: 'uppercase'
                  }}
                >
                  <Typography variant="button" sx={{ mb: 0.5 }}>
                    {format}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {getFormatDescription(format)}
                  </Typography>
                </Button>
              </Grid>
            ))}
          </Grid>

          <Stack direction={isMobile ? "column" : "row"} spacing={2}>
            <Button
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              onClick={handleExport}
              disabled={loading}
              sx={{ flex: 1 }}
            >
              {loading ? 'エクスポート中...' : '取引データをエクスポート'}
            </Button>

            <Button
              variant="outlined"
              size="large"
              startIcon={<AssessmentIcon />}
              onClick={handleAnalyticsExport}
              disabled={loading}
              sx={{ flex: 1 }}
            >
              分析レポートをエクスポート
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* 詳細設定 */}
      <Card sx={{ mb: 3 }}>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SettingsIcon />
              <Typography variant="h6">
                詳細設定
              </Typography>
            </Stack>
          </AccordionSummary>
          
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* 期間設定 */}
              <Grid item xs={12} sm={6}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">期間設定</Typography>
                  
                  <TextField
                    label="開始日"
                    type="date"
                    value={options.dateRange.start}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  
                  <TextField
                    label="終了日"
                    type="date"
                    value={options.dateRange.end}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date();
                        start.setMonth(start.getMonth() - 1);
                        setOptions(prev => ({
                          ...prev,
                          dateRange: {
                            start: start.toISOString().split('T')[0],
                            end: end.toISOString().split('T')[0]
                          }
                        }));
                      }}
                    >
                      直近1ヶ月
                    </Button>
                    
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date();
                        start.setMonth(start.getMonth() - 3);
                        setOptions(prev => ({
                          ...prev,
                          dateRange: {
                            start: start.toISOString().split('T')[0],
                            end: end.toISOString().split('T')[0]
                          }
                        }));
                      }}
                    >
                      直近3ヶ月
                    </Button>
                  </Stack>
                </Stack>
              </Grid>

              {/* フィルター設定 */}
              <Grid item xs={12} sm={6}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">フィルター</Typography>
                  
                  <FormControl fullWidth>
                    <InputLabel>カテゴリ（複数選択可）</InputLabel>
                    <Select
                      multiple
                      value={options.categories || []}
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        categories: e.target.value as string[]
                      }))}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {categories.map(category => (
                        <MenuItem key={category} value={category}>
                          {category}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel>店舗（複数選択可）</InputLabel>
                    <Select
                      multiple
                      value={options.merchants || []}
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        merchants: e.target.value as string[]
                      }))}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).slice(0, 3).map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                          {(selected as string[]).length > 3 && (
                            <Chip label={`+${(selected as string[]).length - 3}`} size="small" />
                          )}
                        </Box>
                      )}
                    >
                      {merchants.map(merchant => (
                        <MenuItem key={merchant} value={merchant}>
                          {merchant}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Grid>

              {/* 出力オプション */}
              <Grid item xs={12}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">出力オプション</Typography>
                  
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.includeAnalytics}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            includeAnalytics: e.target.checked
                          }))}
                        />
                      }
                      label="分析結果を含める"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.includeCharts}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            includeCharts: e.target.checked
                          }))}
                        />
                      }
                      label="グラフを含める（PDF/Excel）"
                    />
                  </Stack>

                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>テンプレート</InputLabel>
                    <Select
                      value={options.template}
                      label="テンプレート"
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        template: e.target.value as 'detailed' | 'summary' | 'custom'
                      }))}
                    >
                      <MenuItem value="detailed">詳細レポート</MenuItem>
                      <MenuItem value="summary">サマリーレポート</MenuItem>
                      <MenuItem value="custom">カスタム</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Card>

      {/* エクスポート履歴 */}
      {exportHistory.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              最近のエクスポート
            </Typography>
            
            <List>
              {exportHistory.slice(0, 5).map((timestamp, index) => (
                <ListItem key={index} divider>
                  <ListItemIcon>
                    <DownloadIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={new Date(timestamp).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    secondary="エクスポート完了"
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* プレビューダイアログ */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>エクスポートプレビュー</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            対象: {getFilteredTransactionsCount()}件の取引
          </Typography>
          <Typography variant="body2">
            期間: {formatDate(options.dateRange.start)} - {formatDate(options.dateRange.end)}
          </Typography>
          <Typography variant="body2">
            形式: {selectedFormat.toUpperCase()}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>
            閉じる
          </Button>
          <Button variant="contained" onClick={handleExport} disabled={loading}>
            エクスポート実行
          </Button>
        </DialogActions>
      </Dialog>

      {/* レート制限アラート */}
      {exportHistory.filter(h => 
        new Date().getTime() - new Date(h).getTime() < 60 * 60 * 1000
      ).length >= 5 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          エクスポート回数の制限に近づいています。1時間あたり5回まで利用可能です。
        </Alert>
      )}
    </Box>
  );
};

export default ExportManager;