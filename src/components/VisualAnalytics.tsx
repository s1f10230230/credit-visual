import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Stack,
  Chip,
  useTheme,
  useMediaQuery,
  Alert,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { CreditTransaction } from '../services/analyticsService';
import { analyticsService } from '../services/analyticsService';

interface VisualAnalyticsProps {
  transactions: CreditTransaction[];
}

const VisualAnalytics: React.FC<VisualAnalyticsProps> = ({ transactions }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [chartType, setChartType] = useState<'category' | 'merchant' | 'trend' | 'subscription'>('category');
  const [insights, setInsights] = useState<any>(null);

  useEffect(() => {
    const spendingInsights = analyticsService.generateSpendingInsights(transactions);
    setInsights(spendingInsights);
  }, [transactions]);

  const handleChartTypeChange = (event: React.MouseEvent<HTMLElement>, newType: string) => {
    if (newType !== null) {
      setChartType(newType as 'category' | 'merchant' | 'trend' | 'subscription');
    }
  };

  const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

  // カラーパレット
  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.error.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.success.main,
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
  ];

  if (!insights) {
    return <Typography>読み込み中...</Typography>;
  }

  // カテゴリ別データ
  const categoryData = insights.topCategories.map((cat: any, index: number) => ({
    name: cat.category,
    value: cat.totalAmount,
    percentage: cat.percentage,
    count: cat.transactionCount,
    color: COLORS[index % COLORS.length],
  }));

  // 加盟店別データ
  const merchantData = insights.topMerchants.slice(0, 10).map((merchant: any, index: number) => ({
    name: merchant.merchant.length > 10 ? merchant.merchant.substring(0, 10) + '...' : merchant.merchant,
    fullName: merchant.merchant,
    value: merchant.totalAmount,
    frequency: merchant.frequency,
    color: COLORS[index % COLORS.length],
  }));

  // 月別トレンドデータ（簡易版）
  const getTrendData = () => {
    const monthlyData = new Map<string, number>();
    transactions.forEach(tx => {
      const month = new Date(tx.date).toISOString().substring(0, 7);
      monthlyData.set(month, (monthlyData.get(month) || 0) + tx.amount);
    });

    return Array.from(monthlyData.entries()).map(([month, amount]) => ({
      month: month.substring(5) + '月',
      amount: amount,
    })).sort((a, b) => a.month.localeCompare(b.month));
  };

  const trendData = getTrendData();

  // サブスクリプション分析データ
  const subscriptionData = insights.subscriptionAnalysis.subscriptions.slice(0, 8).map((sub: any, index: number) => ({
    name: sub.merchant.length > 8 ? sub.merchant.substring(0, 8) + '...' : sub.merchant,
    fullName: sub.merchant,
    monthly: sub.averageAmount,
    frequency: sub.frequency,
    color: COLORS[index % COLORS.length],
  }));

  // Custom tooltip components
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 1 }}>
          <Typography variant="body2">{data.name}</Typography>
          <Typography variant="body2" color="primary">
            {formatCurrency(data.value)} ({data.percentage.toFixed(1)}%)
          </Typography>
          <Typography variant="caption">
            {data.count}件の取引
          </Typography>
        </Paper>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 1 }}>
          <Typography variant="body2">{data.fullName || label}</Typography>
          <Typography variant="body2" color="primary">
            {formatCurrency(payload[0].value)}
          </Typography>
          {data.frequency && (
            <Typography variant="caption">
              {data.frequency}回利用
            </Typography>
          )}
        </Paper>
      );
    }
    return null;
  };

  const renderChart = () => {
    const chartHeight = isMobile ? 250 : 300;
    
    switch (chartType) {
      case 'category':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={isMobile ? 30 : 60}
                outerRadius={isMobile ? 70 : 100}
                paddingAngle={2}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value, entry) => (
                  <span style={{ color: entry.color, fontSize: '12px' }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'merchant':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={merchantData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: isMobile ? 10 : 12 }}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 60 : 30}
              />
              <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar dataKey="value" fill={theme.palette.primary.main} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'trend':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart
              data={trendData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: isMobile ? 10 : 12 }} />
              <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), '支出額']}
                labelFormatter={(label) => `${label}`}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke={theme.palette.primary.main}
                fill={theme.palette.primary.light}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'subscription':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={subscriptionData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: isMobile ? 10 : 12 }}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 60 : 30}
              />
              <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar dataKey="monthly" fill={theme.palette.secondary.main} />
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  const getChartTitle = () => {
    switch (chartType) {
      case 'category': return 'カテゴリ別支出分析';
      case 'merchant': return 'よく利用する店舗 TOP10';
      case 'trend': return '月別支出トレンド';
      case 'subscription': return 'サブスクリプション支出';
      default: return '';
    }
  };

  const getChartDescription = () => {
    switch (chartType) {
      case 'category': return '支出をカテゴリごとに分析し、どの分野にお金を使っているかを可視化します';
      case 'merchant': return 'よく利用する店舗を支出額順に表示し、利用パターンを把握できます';
      case 'trend': return '月ごとの支出推移を表示し、支出トレンドを確認できます';
      case 'subscription': return 'サブスクリプションサービスの月額費用を一覧表示します';
      default: return '';
    }
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 2 }}>
      {/* サマリーカード */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                総支出額
              </Typography>
              <Typography variant="h6">
                {formatCurrency(insights.totalSpending)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                今月の支出
              </Typography>
              <Typography variant="h6">
                {formatCurrency(insights.monthlySpending)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                サブスク月額
              </Typography>
              <Typography variant="h6" color="secondary">
                {formatCurrency(insights.subscriptionAnalysis.totalMonthlyAmount)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                取引数
              </Typography>
              <Typography variant="h6">
                {transactions.length}件
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* アラート */}
      {insights.alerts.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            💡 支出アラート
          </Typography>
          {insights.alerts.slice(0, 2).map((alert: any, index: number) => (
            <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
              • {alert.message}
            </Typography>
          ))}
        </Alert>
      )}

      {/* チャート選択 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2}>
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={handleChartTypeChange}
            size={isMobile ? "small" : "medium"}
            sx={{ 
              display: 'flex',
              flexWrap: 'wrap',
              '& .MuiToggleButton-root': {
                flex: isMobile ? '1 1 45%' : '1',
                fontSize: isMobile ? '0.75rem' : '0.875rem',
              }
            }}
          >
            <ToggleButton value="category">カテゴリ別</ToggleButton>
            <ToggleButton value="merchant">店舗別</ToggleButton>
            <ToggleButton value="trend">トレンド</ToggleButton>
            <ToggleButton value="subscription">サブスク</ToggleButton>
          </ToggleButtonGroup>

          <Box>
            <Typography variant="h6" gutterBottom>
              {getChartTitle()}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {getChartDescription()}
            </Typography>
            
            {renderChart()}
          </Box>
        </Stack>
      </Paper>

      {/* インサイト */}
      {insights.trends.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              支出トレンド分析
            </Typography>
            
            <Stack spacing={1}>
              {insights.trends.slice(0, 5).map((trend: any, index: number) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {trend.category}
                  </Typography>
                  <Chip
                    label={`${trend.change > 0 ? '+' : ''}${trend.change}%`}
                    color={
                      trend.direction === 'increase' ? 'error' : 
                      trend.direction === 'decrease' ? 'success' : 
                      'default'
                    }
                    size="small"
                  />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default VisualAnalytics;