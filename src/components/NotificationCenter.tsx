import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  Alert,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  Chip,
  Badge,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  useTheme,
  useMediaQuery,
  Divider,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationImportant as NotificationImportantIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  BugReport as TestIcon,
  AccountBalanceWallet as BudgetIcon,
  TrendingUp as ReportIcon,
  CreditCard as CardIcon,
  Warning as WarningIcon,
  Star as PremiumIcon,
} from '@mui/icons-material';
import { CreditTransaction } from '../services/analyticsService';
import { notificationService, NotificationSchedule, NotificationConfig } from '../services/notificationService';

interface NotificationCenterProps {
  transactions: CreditTransaction[];
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ transactions }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [scheduledNotifications, setScheduledNotifications] = useState<NotificationSchedule[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  
  // 新しい通知スケジュールの設定
  const [newNotification, setNewNotification] = useState({
    type: 'budget_alert' as 'budget_alert' | 'weekly_report' | 'card_optimization' | 'anomaly_alert',
    trigger: 'daily' as 'daily' | 'weekly' | 'monthly',
    time: '09:00',
    dayOfWeek: 1, // Monday
    dayOfMonth: 1,
  });

  // 通知設定
  const [settings, setSettings] = useState({
    enableBudgetAlerts: true,
    enableWeeklyReports: true,
    enableCardOptimization: true,
    enableAnomalyDetection: true,
    budgetThreshold: 80, // 予算の80%でアラート
  });

  useEffect(() => {
    initializeNotifications();
    loadSettings();
  }, []);

  const initializeNotifications = async () => {
    setPermissionGranted(notificationService.isPermissionGranted());
    setScheduledNotifications(notificationService.getScheduledNotifications());
    setNotificationCount(notificationService.getNotificationCount());
  };

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('notification_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  };

  const saveSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem('notification_settings', JSON.stringify(newSettings));
  };

  const requestPermission = async () => {
    const granted = await notificationService.requestPermission();
    setPermissionGranted(granted);
    
    if (granted) {
      setTestResult('通知権限が許可されました！');
      // 自動的にデフォルト通知を設定
      setupDefaultNotifications();
    } else {
      setTestResult('通知権限が拒否されました。ブラウザの設定で許可してください。');
    }
  };

  const setupDefaultNotifications = async () => {
    if (!permissionGranted) return;

    // 予算アラート（毎日朝9時）
    if (settings.enableBudgetAlerts) {
      const budgetSchedule: NotificationSchedule = {
        id: 'daily_budget_check',
        config: {
          id: 'budget_alert',
          title: '予算チェック',
          body: '今日の予算状況をチェックしました',
          tag: 'budget_alert',
        },
        trigger: 'daily',
        time: '09:00',
      };
      
      await notificationService.scheduleNotification(budgetSchedule);
    }

    // 週次レポート（月曜日朝9時）
    if (settings.enableWeeklyReports) {
      const weeklySchedule: NotificationSchedule = {
        id: 'weekly_report',
        config: {
          id: 'weekly_report',
          title: '週次レポート',
          body: '先週の支出分析レポートが準備できました',
          tag: 'weekly_report',
        },
        trigger: 'weekly',
        dayOfWeek: 1, // Monday
      };
      
      await notificationService.scheduleNotification(weeklySchedule);
    }

    setScheduledNotifications(notificationService.getScheduledNotifications());
  };

  const testNotification = async () => {
    const success = await notificationService.testNotification();
    if (success) {
      setTestResult('テスト通知が送信されました！');
      setNotificationCount(notificationService.getNotificationCount());
    } else {
      setTestResult('通知の送信に失敗しました。権限を確認してください。');
    }
  };

  const sendCustomAlert = async (type: string) => {
    let success = false;
    
    switch (type) {
      case 'budget':
        success = await notificationService.sendBudgetAlert(150000, 200000, 75);
        break;
      case 'weekly':
        success = await notificationService.sendWeeklyReport(25, 45000, 5000);
        break;
      case 'card_optimization':
        success = await notificationService.sendCardOptimizationSuggestion('楽天カード', 12000);
        break;
      case 'anomaly':
        success = await notificationService.sendAnomalyAlert(50000, 'Amazon', 'ショッピング');
        break;
      case 'premium':
        success = await notificationService.sendPremiumTrialOffer('高度な分析機能', 7);
        break;
    }

    if (success) {
      setTestResult(`${type}通知が送信されました！`);
      setNotificationCount(notificationService.getNotificationCount());
    } else {
      setTestResult('通知の送信に失敗しました。');
    }
  };

  const scheduleCustomNotification = async () => {
    const config: NotificationConfig = {
      id: `custom_${Date.now()}`,
      title: getNotificationTitle(newNotification.type),
      body: getNotificationBody(newNotification.type),
      tag: newNotification.type,
    };

    const schedule: NotificationSchedule = {
      id: `schedule_${Date.now()}`,
      config,
      trigger: newNotification.trigger,
      time: newNotification.trigger === 'daily' ? newNotification.time : undefined,
      dayOfWeek: newNotification.trigger === 'weekly' ? newNotification.dayOfWeek : undefined,
      dayOfMonth: newNotification.trigger === 'monthly' ? newNotification.dayOfMonth : undefined,
    };

    const success = await notificationService.scheduleNotification(schedule);
    if (success) {
      setScheduledNotifications(notificationService.getScheduledNotifications());
      setScheduleDialogOpen(false);
      setTestResult('通知がスケジュールされました！');
    }
  };

  const cancelScheduledNotification = async (id: string) => {
    const success = await notificationService.cancelScheduledNotification(id);
    if (success) {
      setScheduledNotifications(notificationService.getScheduledNotifications());
      setTestResult('スケジュールされた通知をキャンセルしました');
    }
  };

  const getNotificationTitle = (type: string): string => {
    switch (type) {
      case 'budget_alert': return '予算アラート';
      case 'weekly_report': return '週次レポート';
      case 'card_optimization': return 'カード最適化提案';
      case 'anomaly_alert': return '異常支出検知';
      default: return '通知';
    }
  };

  const getNotificationBody = (type: string): string => {
    switch (type) {
      case 'budget_alert': return '予算の使用状況をお知らせします';
      case 'weekly_report': return '週次の支出レポートをお届けします';
      case 'card_optimization': return 'より良いカード選択をご提案します';
      case 'anomaly_alert': return '通常と異なる支出パターンを検知しました';
      default: return '通知メッセージ';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'budget_alert': return <BudgetIcon />;
      case 'weekly_report': return <ReportIcon />;
      case 'card_optimization': return <CardIcon />;
      case 'anomaly_alert': return <WarningIcon />;
      case 'premium_trial': return <PremiumIcon />;
      default: return <NotificationsIcon />;
    }
  };

  const getTriggerText = (schedule: NotificationSchedule): string => {
    switch (schedule.trigger) {
      case 'daily':
        return `毎日 ${schedule.time}`;
      case 'weekly':
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        return `毎週${days[schedule.dayOfWeek || 0]}曜日`;
      case 'monthly':
        return `毎月${schedule.dayOfMonth}日`;
      default:
        return schedule.trigger;
    }
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 2 }}>
      {/* 通知ステータス */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Badge badgeContent={permissionGranted ? '' : '!'} color="error">
                  <NotificationsIcon color={permissionGranted ? "primary" : "disabled"} />
                </Badge>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    通知権限
                  </Typography>
                  <Typography variant="body1">
                    {permissionGranted ? '許可済み' : '未許可'}
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
                <ScheduleIcon color="info" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    スケジュール通知
                  </Typography>
                  <Typography variant="body1">
                    {scheduledNotifications.length}件
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
                <NotificationImportantIcon color="success" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    送信済み通知
                  </Typography>
                  <Typography variant="body1">
                    {notificationCount}件
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
                <SettingsIcon color="warning" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    アクティブ設定
                  </Typography>
                  <Typography variant="body1">
                    {Object.values(settings).filter(Boolean).length}件
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 権限リクエスト */}
      {!permissionGranted && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            通知権限が必要です
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            予算アラートや重要な通知を受け取るために、ブラウザの通知権限を許可してください。
          </Typography>
          <Button variant="contained" onClick={requestPermission}>
            通知権限を許可
          </Button>
        </Alert>
      )}

      {/* テスト結果 */}
      {testResult && (
        <Alert severity="info" sx={{ mb: 3 }} onClose={() => setTestResult('')}>
          {testResult}
        </Alert>
      )}

      {/* 通知設定 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            通知設定
          </Typography>
          
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableBudgetAlerts}
                  onChange={(e) => saveSettings({
                    ...settings,
                    enableBudgetAlerts: e.target.checked
                  })}
                />
              }
              label="予算アラート通知"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableWeeklyReports}
                  onChange={(e) => saveSettings({
                    ...settings,
                    enableWeeklyReports: e.target.checked
                  })}
                />
              }
              label="週次レポート通知"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableCardOptimization}
                  onChange={(e) => saveSettings({
                    ...settings,
                    enableCardOptimization: e.target.checked
                  })}
                />
              }
              label="カード最適化提案"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableAnomalyDetection}
                  onChange={(e) => saveSettings({
                    ...settings,
                    enableAnomalyDetection: e.target.checked
                  })}
                />
              }
              label="異常支出検知"
            />
          </Stack>
        </CardContent>
      </Card>

      {/* テスト通知 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            テスト通知
          </Typography>
          
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TestIcon />}
              onClick={testNotification}
              disabled={!permissionGranted}
            >
              基本テスト
            </Button>
            
            <Button
              variant="outlined"
              size="small"
              startIcon={<BudgetIcon />}
              onClick={() => sendCustomAlert('budget')}
              disabled={!permissionGranted}
            >
              予算アラート
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<ReportIcon />}
              onClick={() => sendCustomAlert('weekly')}
              disabled={!permissionGranted}
            >
              週次レポート
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<CardIcon />}
              onClick={() => sendCustomAlert('card_optimization')}
              disabled={!permissionGranted}
            >
              カード提案
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<WarningIcon />}
              onClick={() => sendCustomAlert('anomaly')}
              disabled={!permissionGranted}
            >
              異常検知
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<PremiumIcon />}
              onClick={() => sendCustomAlert('premium')}
              disabled={!permissionGranted}
            >
              プレミアム
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            ※ テスト通知は実際の通知システムを使用します
          </Typography>
        </CardContent>
      </Card>

      {/* スケジュール済み通知 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">
              スケジュール済み通知
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setScheduleDialogOpen(true)}
              disabled={!permissionGranted}
            >
              追加
            </Button>
          </Stack>

          {scheduledNotifications.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              スケジュールされた通知はありません
            </Typography>
          ) : (
            <List>
              {scheduledNotifications.map((schedule, index) => (
                <ListItem key={schedule.id} divider={index < scheduledNotifications.length - 1}>
                  <ListItemIcon>
                    {getNotificationIcon(schedule.config.tag || '')}
                  </ListItemIcon>
                  <ListItemText
                    primary={schedule.config.title}
                    secondary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={getTriggerText(schedule)}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Typography variant="caption">
                          {schedule.config.body}
                        </Typography>
                      </Stack>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => cancelScheduledNotification(schedule.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* スケジュール作成ダイアログ */}
      <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新しい通知をスケジュール</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>通知タイプ</InputLabel>
              <Select
                value={newNotification.type}
                label="通知タイプ"
                onChange={(e) => setNewNotification(prev => ({
                  ...prev,
                  type: e.target.value as any
                }))}
              >
                <MenuItem value="budget_alert">予算アラート</MenuItem>
                <MenuItem value="weekly_report">週次レポート</MenuItem>
                <MenuItem value="card_optimization">カード最適化</MenuItem>
                <MenuItem value="anomaly_alert">異常支出検知</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>頻度</InputLabel>
              <Select
                value={newNotification.trigger}
                label="頻度"
                onChange={(e) => setNewNotification(prev => ({
                  ...prev,
                  trigger: e.target.value as any
                }))}
              >
                <MenuItem value="daily">毎日</MenuItem>
                <MenuItem value="weekly">毎週</MenuItem>
                <MenuItem value="monthly">毎月</MenuItem>
              </Select>
            </FormControl>

            {newNotification.trigger === 'daily' && (
              <TextField
                label="時刻"
                type="time"
                value={newNotification.time}
                onChange={(e) => setNewNotification(prev => ({
                  ...prev,
                  time: e.target.value
                }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            )}

            {newNotification.trigger === 'weekly' && (
              <FormControl fullWidth>
                <InputLabel>曜日</InputLabel>
                <Select
                  value={newNotification.dayOfWeek}
                  label="曜日"
                  onChange={(e) => setNewNotification(prev => ({
                    ...prev,
                    dayOfWeek: Number(e.target.value)
                  }))}
                >
                  <MenuItem value={0}>日曜日</MenuItem>
                  <MenuItem value={1}>月曜日</MenuItem>
                  <MenuItem value={2}>火曜日</MenuItem>
                  <MenuItem value={3}>水曜日</MenuItem>
                  <MenuItem value={4}>木曜日</MenuItem>
                  <MenuItem value={5}>金曜日</MenuItem>
                  <MenuItem value={6}>土曜日</MenuItem>
                </Select>
              </FormControl>
            )}

            {newNotification.trigger === 'monthly' && (
              <TextField
                label="日付"
                type="number"
                value={newNotification.dayOfMonth}
                onChange={(e) => setNewNotification(prev => ({
                  ...prev,
                  dayOfMonth: Number(e.target.value)
                }))}
                inputProps={{ min: 1, max: 31 }}
                fullWidth
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>
            キャンセル
          </Button>
          <Button variant="contained" onClick={scheduleCustomNotification}>
            スケジュール
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotificationCenter;