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
  Switch,
  FormControlLabel,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Savings as SavingsIcon,
  Schedule as ScheduleIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Cancel as CancelIcon,
  Launch as LaunchIcon,
  Star as StarIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { CreditTransaction } from '../services/analyticsService';
import { analyticsService } from '../services/analyticsService';
import { cancellationGuideService } from '../services/cancellationGuideService';
import { duplicateServiceDetector } from '../services/duplicateServiceDetector';
import { useAuth } from '../contexts/AuthContext';
import { useFreemiumRestrictions } from '../hooks/useFreemiumRestrictions';
import { applyFreemiumRestrictions } from '../utils/dateFilters';

interface SubscriptionDashboardProps {
  transactions: CreditTransaction[];
}

const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({ transactions }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isPremium } = useAuth();
  
  // フリーミアム制限フック
  const duplicateRestrictions = useFreemiumRestrictions({
    featureTitle: '重複サービス検出',
    featureDescription: '同じカテゴリの複数サブスクリプションを自動検出し、解約候補を提案します。'
  });
  
  const [subscriptionAnalysis, setSubscriptionAnalysis] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | false>(false);
  // ユーザー補正データのstate
  const [userCorrections, setUserCorrections] = useState<Map<string, boolean>>(new Map());
  // 解約ガイドモーダルのstate
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  // 重複サービス検出のstate
  const [duplicateAnalysis, setDuplicateAnalysis] = useState<any>(null);

  useEffect(() => {
    // フリーミアム制限を適用したトランザクション
    const filteredTransactions = applyFreemiumRestrictions(transactions, isPremium);
    
    const analysis = analyticsService.analyzeSubscriptions(filteredTransactions);
    setSubscriptionAnalysis(analysis);
    
    // 重複サービス分析（プレミアム機能）
    if (isPremium) {
      const duplicationAnalysis = duplicateServiceDetector.analyzeSubscriptions(filteredTransactions);
      setDuplicateAnalysis(duplicationAnalysis);
    } else {
      setDuplicateAnalysis(null);
    }
    
    // ローカルストレージからユーザー補正データを読み込み
    const storedCorrections = localStorage.getItem('subscriptionCorrections');
    if (storedCorrections) {
      try {
        const parsed = JSON.parse(storedCorrections);
        setUserCorrections(new Map(Object.entries(parsed)));
      } catch (error) {
        console.error('Failed to load user corrections:', error);
      }
    }
  }, [transactions, isPremium]);

  // ユーザー補正を処理する関数
  const handleSubscriptionToggle = (merchantName: string, isSubscription: boolean) => {
    const newCorrections = new Map(userCorrections);
    newCorrections.set(merchantName, isSubscription);
    setUserCorrections(newCorrections);
    
    // ローカルストレージに保存
    const correctionsObj = Object.fromEntries(newCorrections);
    localStorage.setItem('subscriptionCorrections', JSON.stringify(correctionsObj));
    
    // 即座に分析を再実行して画面を更新
    const updatedAnalysis = analyticsService.analyzeSubscriptions(transactions, newCorrections);
    setSubscriptionAnalysis(updatedAnalysis);
  };

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

  // 推定周期を取得
  const getEstimatedPeriod = (subscription: any): string => {
    if (subscription.transactions && subscription.transactions.length >= 2) {
      const dates = subscription.transactions.map((tx: any) => new Date(tx.date)).sort((a, b) => a.getTime() - b.getTime());
      const intervals = [];
      
      for (let i = 1; i < dates.length; i++) {
        const days = Math.round((dates[i].getTime() - dates[i-1].getTime()) / (1000 * 60 * 60 * 24));
        intervals.push(days);
      }
      
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      
      if (avgInterval >= 25 && avgInterval <= 35) return `月次 (平均${Math.round(avgInterval)}日)`;
      if (avgInterval >= 85 && avgInterval <= 95) return `四半期 (平均${Math.round(avgInterval)}日)`;
      if (avgInterval >= 350 && avgInterval <= 380) return `年次 (平均${Math.round(avgInterval)}日)`;
      return `不定期 (平均${Math.round(avgInterval)}日)`;
    }
    
    // 頻度から推定
    if (subscription.frequency >= 10) return '月次 (推定)';
    if (subscription.frequency >= 3) return '四半期 (推定)';
    return '不定期';
  };

  // 年間支出見込みを計算
  const calculateYearlyEstimate = (subscription: any): number => {
    const period = getEstimatedPeriod(subscription);
    let multiplier = 12; // デフォルト月次
    
    if (period.includes('四半期')) multiplier = 4;
    if (period.includes('年次')) multiplier = 1;
    if (period.includes('不定期')) multiplier = subscription.frequency; // 実績ベース
    
    return Math.round(subscription.averageAmount * multiplier);
  };

  // 次回課金予定日を計算
  const getNextBillingDate = (subscription: any): string | null => {
    if (!subscription.transactions || subscription.transactions.length < 2) return null;
    
    const lastTransaction = subscription.transactions[subscription.transactions.length - 1];
    const lastDate = new Date(lastTransaction.date);
    const period = getEstimatedPeriod(subscription);
    
    let nextDate: Date;
    if (period.includes('月次')) {
      nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (period.includes('四半期')) {
      nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + 3);
    } else if (period.includes('年次')) {
      nextDate = new Date(lastDate);
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else {
      return null; // 不定期は予測しない
    }
    
    return nextDate.toLocaleDateString('ja-JP');
  };

  // 次回課金まで日数を計算
  const getDaysUntilNext = (subscription: any): number => {
    const nextBillingStr = getNextBillingDate(subscription);
    if (!nextBillingStr) return 0;
    
    const nextBilling = new Date(nextBillingStr.replace(/\//g, '-'));
    const today = new Date();
    const diffTime = nextBilling.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  // 解約ガイドを表示
  const showCancellationGuide = (subscription: any) => {
    setSelectedService(subscription);
    setGuideModalOpen(true);
  };

  // 解約ガイド情報を取得
  const getCancellationGuide = (serviceName: string) => {
    return cancellationGuideService.getGuide(serviceName);
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
                <Tooltip title="これはサブスクですか？">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={userCorrections.get(subscription.merchant) ?? subscription.isSubscription}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSubscriptionToggle(subscription.merchant, e.target.checked);
                        }}
                        color="primary"
                      />
                    }
                    label=""
                    onClick={(e) => e.stopPropagation()}
                    sx={{ m: 0 }}
                  />
                </Tooltip>
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
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    推定周期
                  </Typography>
                  <Typography variant="h6">
                    {getEstimatedPeriod(subscription)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    年間支出見込み
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {formatCurrency(calculateYearlyEstimate(subscription))}
                  </Typography>
                </Grid>
                {getNextBillingDate(subscription) && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      次回課金予定日
                    </Typography>
                    <Typography variant="body1" color="primary.main">
                      📅 {getNextBillingDate(subscription)} ({getDaysUntilNext(subscription)}日後)
                    </Typography>
                  </Grid>
                )}
              </Grid>

              {/* 解約ガイド */}
              <Box sx={{ mt: 2, mb: 2 }}>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  startIcon={<CancelIcon />}
                  endIcon={<LaunchIcon />}
                  onClick={() => showCancellationGuide(subscription)}
                  sx={{ mr: 1 }}
                >
                  解約ガイド
                </Button>
                {getCancellationGuide(subscription.merchant) && (
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<LaunchIcon />}
                    onClick={() => {
                      const guide = getCancellationGuide(subscription.merchant);
                      if (guide) window.open(guide.officialUrl, '_blank');
                    }}
                  >
                    公式サイト
                  </Button>
                )}
              </Box>

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

      {/* 重複サービス検出（プレミアム機能） */}
      {isPremium && duplicateAnalysis && duplicateAnalysis.duplicateGroups.length > 0 && (
        <Card sx={{ mb: 3, border: '2px solid', borderColor: 'info.light' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <WarningIcon color="info" />
              <Typography variant="h6">
                重複サービスの検出
              </Typography>
              <Chip
                label={`月額${formatCurrency(duplicateAnalysis.totalWastedAmount)}の節約可能`}
                color="info"
                size="small"
              />
            </Stack>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              同じカテゴリのサービスを複数契約しています。不要なサービスの解約をご検討ください。
            </Typography>

            {duplicateAnalysis.duplicateGroups.map((group: any, index: number) => (
              <Accordion key={index} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1">{group.categoryDisplayName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {group.services.length}つのサービス • 合計{formatCurrency(group.totalMonthlyCost)}/月
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={group.priority === 'high' ? '高優先' : group.priority === 'medium' ? '中優先' : '低優先'}
                        color={group.priority === 'high' ? 'error' : group.priority === 'medium' ? 'warning' : 'default'}
                        size="small"
                      />
                      <Chip
                        label={`${formatCurrency(group.potentialSavings)}節約可能`}
                        color="success"
                        size="small"
                      />
                    </Stack>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {group.recommendedAction}
                  </Typography>
                  
                  <List dense>
                    {group.services.map((service: any, serviceIndex: number) => (
                      <ListItem key={serviceIndex}>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body1">{service.merchantName}</Typography>
                              <Chip
                                label={service.isRecommendedToKeep ? '推奨保持' : '解約検討'}
                                color={service.isRecommendedToKeep ? 'success' : 'warning'}
                                size="small"
                              />
                            </Box>
                          }
                          secondary={`${formatCurrency(service.monthlyCost)}/月 • 使用頻度: ${service.usage === 'high' ? '高' : service.usage === 'medium' ? '中' : '低'} • ${service.reason}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      )}

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

      {/* 解約ガイドモーダル */}
      <Dialog
        open={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedService && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center">
                <CancelIcon sx={{ mr: 1 }} />
                {selectedService.merchant} の解約ガイド
              </Box>
            </DialogTitle>
            <DialogContent>
              {(() => {
                const guide = getCancellationGuide(selectedService.merchant);
                if (guide) {
                  return (
                    <Box>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            カテゴリ
                          </Typography>
                          <Typography variant="body1">{guide.category}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            推定所要時間
                          </Typography>
                          <Typography variant="body1">{guide.estimatedTime}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            難易度
                          </Typography>
                          <Chip 
                            label={guide.difficulty === 'easy' ? '簡単' : guide.difficulty === 'medium' ? '普通' : '困難'}
                            color={guide.difficulty === 'easy' ? 'success' : guide.difficulty === 'medium' ? 'warning' : 'error'}
                            size="small"
                          />
                        </Grid>
                      </Grid>

                      <Typography variant="h6" gutterBottom>
                        解約手順
                      </Typography>
                      <List>
                        {guide.steps.map((step, index) => (
                          <ListItem key={index}>
                            <ListItemText
                              primary={`${index + 1}. ${step}`}
                            />
                          </ListItem>
                        ))}
                      </List>

                      {guide.notes && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            <strong>注意事項：</strong> {guide.notes}
                          </Typography>
                        </Alert>
                      )}

                      <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<LaunchIcon />}
                          href={guide.cancellationUrl}
                          target="_blank"
                        >
                          解約ページを開く
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<LaunchIcon />}
                          href={guide.officialUrl}
                          target="_blank"
                        >
                          公式サイト
                        </Button>
                      </Box>
                    </Box>
                  );
                } else {
                  return (
                    <Box textAlign="center" py={3}>
                      <Typography variant="h6" gutterBottom>
                        解約ガイドが見つかりません
                      </Typography>
                      <Typography variant="body1" color="text.secondary" gutterBottom>
                        {selectedService.merchant} の解約方法については、サービスの公式サイトをご確認ください。
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<LaunchIcon />}
                        onClick={() => {
                          const searchQuery = encodeURIComponent(`${selectedService.merchant} 解約方法`);
                          window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
                        }}
                        sx={{ mt: 2 }}
                      >
                        Googleで検索
                      </Button>
                    </Box>
                  );
                }
              })()}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setGuideModalOpen(false)}>
                閉じる
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* 無料ユーザー向けプレミアム機能プロモーション */}
      {!isPremium && (
        <Paper 
          elevation={2} 
          sx={{ 
            p: 3, 
            mt: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <StarIcon sx={{ fontSize: 40, color: 'gold' }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                🚀 プレミアム機能でさらに節約
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                • 重複サービスの自動検出<br/>
                • 12ヶ月間の支出トレンド分析<br/>
                • 課金リマインダー通知
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<StarIcon />}
              onClick={duplicateRestrictions.showUpgradePrompt}
              sx={{
                backgroundColor: 'gold',
                color: 'black',
                fontWeight: 'bold',
                '&:hover': {
                  backgroundColor: '#ffd700',
                }
              }}
            >
              無料トライアル
            </Button>
          </Stack>
        </Paper>
      )}

      {/* プレミアムアップグレードモーダル */}
      <duplicateRestrictions.UpgradeModal />
    </Box>
  );
};

export default SubscriptionDashboard;