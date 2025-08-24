import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Stack,
  Divider,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Savings as SavingsIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { CreditTransaction } from '../services/analyticsService';
import { analyticsService } from '../services/analyticsService';

interface SubscriptionDashboardProps {
  transactions: CreditTransaction[];
}

const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({ transactions }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [subscriptionAnalysis, setSubscriptionAnalysis] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | false>(false);

  useEffect(() => {
    const analysis = analyticsService.analyzeSubscriptions(transactions);
    setSubscriptionAnalysis(analysis);
  }, [transactions]);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  if (!subscriptionAnalysis) {
    return <LinearProgress />;
  }

  const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;

  const getSeverityColor = (monthlyCost: number) => {
    if (monthlyCost > 3000) return 'error';
    if (monthlyCost > 1000) return 'warning';
    return 'success';
  };

  const totalPotentialSavings = subscriptionAnalysis.savingOpportunities.reduce(
    (sum: number, opp: any) => sum + opp.monthlyCost, 0
  );

  return (
    <Box sx={{ p: isMobile ? 1 : 2 }}>
      {/* サマリーカード */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <ScheduleIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    月額合計
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(subscriptionAnalysis.totalMonthlyAmount)}
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
                <TrendingUpIcon color="info" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    サブスク数
                  </Typography>
                  <Typography variant="h6">
                    {subscriptionAnalysis.subscriptionCount}件
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
                <SavingsIcon color="success" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    節約可能額
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {formatCurrency(totalPotentialSavings)}
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
                <WarningIcon color="warning" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    要見直し
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {subscriptionAnalysis.savingOpportunities.length}件
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 節約アラート */}
      {subscriptionAnalysis.savingOpportunities.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            💡 節約のチャンス！
          </Typography>
          <Typography variant="body2">
            {subscriptionAnalysis.savingOpportunities.length}件の未使用サブスクで
            月{formatCurrency(totalPotentialSavings)}の節約が可能です
          </Typography>
        </Alert>
      )}

      {/* サブスクリプション一覧 */}
      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
        アクティブなサブスクリプション
      </Typography>
      
      {subscriptionAnalysis.subscriptions.map((subscription: any, index: number) => (
        <Accordion
          key={subscription.merchant}
          expanded={expanded === `panel${index}`}
          onChange={handleChange(`panel${index}`)}
          sx={{ mb: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mr: 2 }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1">{subscription.merchant}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {subscription.category} • 月{subscription.frequency}回利用
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={formatCurrency(subscription.averageAmount)}
                  color={getSeverityColor(subscription.averageAmount)}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  {subscription.percentageOfTotal.toFixed(1)}%
                </Typography>
              </Stack>
            </Box>
          </AccordionSummary>
          
          <AccordionDetails>
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    月間合計
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(subscription.totalAmount)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    平均単価
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(subscription.averageAmount)}
                  </Typography>
                </Grid>
              </Grid>

              {/* 最近の取引 */}
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                最近の取引履歴
              </Typography>
              <List dense>
                {subscription.transactions.slice(0, 3).map((tx: CreditTransaction, txIndex: number) => (
                  <ListItem key={txIndex} divider>
                    <ListItemText
                      primary={new Date(tx.date).toLocaleDateString('ja-JP')}
                      secondary={tx.notes || tx.evidence}
                    />
                    <ListItemSecondaryAction>
                      <Typography variant="body2">
                        {formatCurrency(tx.amount)}
                      </Typography>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* 節約提案 */}
      {subscriptionAnalysis.savingOpportunities.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>
            節約提案
          </Typography>
          
          {subscriptionAnalysis.savingOpportunities.map((opportunity: any, index: number) => (
            <Card key={index} sx={{ mb: 2, border: '1px solid', borderColor: 'warning.light' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <WarningIcon color="warning" />
                  <Typography variant="subtitle1">{opportunity.merchant}</Typography>
                  <Chip
                    label={`-${formatCurrency(opportunity.monthlyCost)}/月`}
                    color="warning"
                    size="small"
                  />
                </Stack>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  最終利用: {new Date(opportunity.lastUsed).toLocaleDateString('ja-JP')}
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {opportunity.suggestion}
                </Typography>
                
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => {
                    // ここに解約リンクや詳細情報を表示する機能を追加可能
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(opportunity.merchant)}+解約+方法`, '_blank');
                  }}
                >
                  解約方法を調べる
                </Button>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {/* 月額予算との比較 */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            サブスク支出分析
          </Typography>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              月額サブスク支出: {formatCurrency(subscriptionAnalysis.totalMonthlyAmount)}
            </Typography>
            
            {subscriptionAnalysis.totalMonthlyAmount > 15000 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                サブスク支出が月15,000円を超えています。不要なサービスがないか見直してみましょう。
              </Alert>
            )}
            
            {subscriptionAnalysis.totalMonthlyAmount > 30000 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                サブスク支出が月30,000円を超えています。積極的な見直しをお勧めします。
              </Alert>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SubscriptionDashboard;