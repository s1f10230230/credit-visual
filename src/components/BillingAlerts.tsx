import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  AccountBalance as AccountBalanceIcon,
  Notifications as NotificationsIcon,
  Payment as PaymentIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { CreditTransaction } from '../services/analyticsService';
import { analyticsService } from '../services/analyticsService';
import { cardBillingService } from '../services/cardBillingService';

interface BillingPrediction {
  cardName: string;
  predictedAmount: number;
  paymentDate: Date;
  confidence: number;
  daysUntilPayment: number;
  isEstimate: boolean;
  transactions: CreditTransaction[];
}

interface BillingAlertsProps {
  transactions: CreditTransaction[];
}

const BillingAlerts: React.FC<BillingAlertsProps> = ({ transactions }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [predictions, setPredictions] = useState<BillingPrediction[]>([]);
  const [alertSettings, setAlertSettings] = useState({
    enableAlerts: true,
    alertDaysBefore: 3,
    enableHighAmountAlert: true,
    highAmountThreshold: 50000,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    calculateBillingPredictions();
  }, [transactions]);

  useEffect(() => {
    // アラート設定をローカルストレージから読み込み
    const saved = localStorage.getItem('billing_alert_settings');
    if (saved) {
      setAlertSettings(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    // アラート設定をローカルストレージに保存
    localStorage.setItem('billing_alert_settings', JSON.stringify(alertSettings));
  }, [alertSettings]);

  const calculateBillingPredictions = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // カード別にグループ化
    const cardGroups = analyticsService.groupByCard(transactions);
    
    const predictions: BillingPrediction[] = cardGroups.map(cardGroup => {
      const billingSettings = cardBillingService.getCardBillingSettings(cardGroup.cardType);
      
      // 今月の利用額を計算
      const currentMonthTransactions = cardGroup.transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      });
      
      const currentMonthAmount = currentMonthTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      
      // 支払日を計算
      const nextPaymentDate = getNextPaymentDate(billingSettings.paymentDate);
      const daysUntilPayment = Math.ceil((nextPaymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // 予測精度を計算（過去のデータ量に基づく）
      const confidence = Math.min(cardGroup.transactionCount / 10, 1) * 100;
      
      return {
        cardName: cardGroup.cardType,
        predictedAmount: currentMonthAmount,
        paymentDate: nextPaymentDate,
        confidence,
        daysUntilPayment,
        isEstimate: daysUntilPayment > 15, // 支払日まで15日以上ある場合は推定値
        transactions: currentMonthTransactions,
      };
    });
    
    setPredictions(predictions.sort((a, b) => a.daysUntilPayment - b.daysUntilPayment));
  };

  const getNextPaymentDate = (paymentDay: number): Date => {
    const now = new Date();
    let nextPayment = new Date(now.getFullYear(), now.getMonth() + 1, paymentDay);
    
    // 月末日を超える場合の調整
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
    if (paymentDay > lastDayOfMonth) {
      nextPayment.setDate(lastDayOfMonth);
    }
    
    return nextPayment;
  };

  const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;

  const getAlertLevel = (prediction: BillingPrediction): 'info' | 'warning' | 'error' => {
    if (prediction.daysUntilPayment <= 1) return 'error';
    if (prediction.daysUntilPayment <= alertSettings.alertDaysBefore) return 'warning';
    return 'info';
  };

  const getConfidenceColor = (confidence: number): 'primary' | 'secondary' | 'error' => {
    if (confidence >= 80) return 'primary';
    if (confidence >= 60) return 'secondary';
    return 'error';
  };

  const getUpcomingAlerts = () => {
    return predictions.filter(p => 
      p.daysUntilPayment <= alertSettings.alertDaysBefore ||
      (alertSettings.enableHighAmountAlert && p.predictedAmount >= alertSettings.highAmountThreshold)
    );
  };

  const getTotalUpcomingPayments = () => {
    return predictions
      .filter(p => p.daysUntilPayment <= 30)
      .reduce((sum, p) => sum + p.predictedAmount, 0);
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 2 }}>
      {/* サマリーカード */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <PaymentIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    今月請求予定
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(getTotalUpcomingPayments())}
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
                    アラート数
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {getUpcomingAlerts().length}件
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
                <CalendarIcon color="info" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    最短支払日
                  </Typography>
                  <Typography variant="h6">
                    {predictions.length > 0 ? `${predictions[0]?.daysUntilPayment}日後` : '-'}
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
                <AccountBalanceIcon color="success" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    カード数
                  </Typography>
                  <Typography variant="h6">
                    {predictions.length}枚
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* アラート通知 */}
      {getUpcomingAlerts().length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            🔔 支払いアラート
          </Typography>
          <Typography variant="body2">
            {getUpcomingAlerts().length}件の支払い予定があります。詳細を確認してください。
          </Typography>
        </Alert>
      )}

      {/* 設定ボタン */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">
          支払い予測・アラート
        </Typography>
        <Button
          variant="outlined"
          startIcon={<NotificationsIcon />}
          onClick={() => setSettingsOpen(true)}
          size={isMobile ? "small" : "medium"}
        >
          アラート設定
        </Button>
      </Stack>

      {/* 支払い予測リスト */}
      {predictions.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              支払い予測データがありません。取引データを確認してください。
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {predictions.map((prediction, index) => {
            const alertLevel = getAlertLevel(prediction);
            const confidenceColor = getConfidenceColor(prediction.confidence);

            return (
              <Grid item xs={12} md={6} key={index}>
                <Card 
                  sx={{ 
                    border: alertLevel === 'error' ? '2px solid' : '1px solid',
                    borderColor: alertLevel === 'error' ? 'error.main' : 
                                alertLevel === 'warning' ? 'warning.main' : 'grey.300'
                  }}
                >
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                      <Typography variant="h6">
                        {prediction.cardName}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={`${prediction.daysUntilPayment}日後`}
                          color={alertLevel}
                          size="small"
                        />
                        <Chip
                          label={`信頼度 ${Math.round(prediction.confidence)}%`}
                          color={confidenceColor}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>

                    <Typography variant="h5" color="primary" gutterBottom>
                      {formatCurrency(prediction.predictedAmount)}
                      {prediction.isEstimate && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          （推定）
                        </Typography>
                      )}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      支払日: {prediction.paymentDate.toLocaleDateString('ja-JP', { 
                        month: 'long', 
                        day: 'numeric',
                        weekday: 'short'
                      })}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      今月の利用回数: {prediction.transactions.length}回
                    </Typography>

                    {prediction.predictedAmount >= alertSettings.highAmountThreshold && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        <Typography variant="caption">
                          高額支払い警告: {formatCurrency(alertSettings.highAmountThreshold)}以上
                        </Typography>
                      </Alert>
                    )}

                    {prediction.daysUntilPayment <= 1 && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        <Typography variant="caption">
                          明日までに支払い予定です
                        </Typography>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* アラート設定ダイアログ */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>アラート設定</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={alertSettings.enableAlerts}
                  onChange={(e) => setAlertSettings(prev => ({
                    ...prev,
                    enableAlerts: e.target.checked
                  }))}
                />
              }
              label="支払いアラートを有効にする"
            />

            <Stack spacing={1}>
              <Typography variant="body2">
                支払日何日前にアラートを表示するか
              </Typography>
              <Stack direction="row" spacing={1}>
                {[1, 2, 3, 5, 7].map(days => (
                  <Button
                    key={days}
                    variant={alertSettings.alertDaysBefore === days ? "contained" : "outlined"}
                    size="small"
                    onClick={() => setAlertSettings(prev => ({
                      ...prev,
                      alertDaysBefore: days
                    }))}
                  >
                    {days}日前
                  </Button>
                ))}
              </Stack>
            </Stack>

            <Divider />

            <FormControlLabel
              control={
                <Switch
                  checked={alertSettings.enableHighAmountAlert}
                  onChange={(e) => setAlertSettings(prev => ({
                    ...prev,
                    enableHighAmountAlert: e.target.checked
                  }))}
                />
              }
              label="高額支払いアラートを有効にする"
            />

            <Stack spacing={1}>
              <Typography variant="body2">
                高額支払いの基準額
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {[30000, 50000, 100000, 150000].map(amount => (
                  <Button
                    key={amount}
                    variant={alertSettings.highAmountThreshold === amount ? "contained" : "outlined"}
                    size="small"
                    onClick={() => setAlertSettings(prev => ({
                      ...prev,
                      highAmountThreshold: amount
                    }))}
                    sx={{ mb: 1 }}
                  >
                    {formatCurrency(amount)}
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillingAlerts;