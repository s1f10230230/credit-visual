import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Stack,
  Switch,
  FormControlLabel,
  Autocomplete,
  Chip,
  Typography,
  Alert,
  Box,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ja } from 'date-fns/locale';
import { CreditTransaction } from '../services/gmailService';

interface TransactionEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (transaction: CreditTransaction) => void;
  onDelete?: () => void;
  transaction?: CreditTransaction | null;
  mode: 'add' | 'edit';
}

// 通貨リスト
const CURRENCIES = [
  { code: 'JPY', symbol: '¥', name: '日本円' },
  { code: 'USD', symbol: '$', name: 'アメリカドル' },
  { code: 'EUR', symbol: '€', name: 'ユーロ' },
  { code: 'GBP', symbol: '£', name: 'イギリスポンド' },
  { code: 'KRW', symbol: '₩', name: '韓国ウォン' },
  { code: 'CNY', symbol: '¥', name: '中国元' },
];

// カテゴリリスト
const CATEGORIES = [
  'サブスク',
  'ショッピング', 
  '食費',
  'コンビニ',
  '交通費',
  '家電',
  '医療費',
  '書籍',
  '娯楽',
  'ガソリン',
  '公共料金',
  '保険',
  '教育',
  '美容',
  'その他',
  '不明'
];

// ステータスリスト  
const STATUSES = [
  { value: 'confirmed', label: '確認済み' },
  { value: 'pending', label: '確認中' },
  { value: 'unknown', label: '要確認' },
];

// よくある海外サブスクサービス
const OVERSEAS_SUBSCRIPTIONS = [
  { name: 'ChatGPT Plus', amount: 20, currency: 'USD', category: 'サブスク' },
  { name: 'Claude Pro', amount: 20, currency: 'USD', category: 'サブスク' },
  { name: 'Midjourney', amount: 10, currency: 'USD', category: 'サブスク' },
  { name: 'GitHub Copilot', amount: 10, currency: 'USD', category: 'サブスク' },
  { name: 'Netflix', amount: 15.99, currency: 'USD', category: 'サブスク' },
  { name: 'Spotify Premium', amount: 9.99, currency: 'USD', category: 'サブスク' },
  { name: 'Adobe Creative Cloud', amount: 29.99, currency: 'USD', category: 'サブスク' },
  { name: 'Dropbox Plus', amount: 11.99, currency: 'USD', category: 'サブスク' },
  { name: 'Notion Pro', amount: 10, currency: 'USD', category: 'サブスク' },
  { name: 'Figma Professional', amount: 15, currency: 'USD', category: 'サブスク' },
];

const TransactionEditor: React.FC<TransactionEditorProps> = ({
  open,
  onClose,
  onSave,
  onDelete,
  transaction,
  mode
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // フォーム状態
  const [formData, setFormData] = useState<CreditTransaction>(() => ({
    id: transaction?.id || `manual_${Date.now()}`,
    amount: transaction?.amount || 0,
    merchant: transaction?.merchant || '',
    date: transaction?.date || new Date().toISOString().split('T')[0],
    category: transaction?.category || 'その他',
    status: transaction?.status || 'confirmed',
    cardName: transaction?.cardName || '',
    // 外貨対応フィールド
    originalCurrency: (transaction as any)?.originalCurrency || 'JPY',
    originalAmount: (transaction as any)?.originalAmount || 0,
    exchangeRate: (transaction as any)?.exchangeRate || 1,
    isOverseas: (transaction as any)?.isOverseas || false,
  }));

  const [selectedDate, setSelectedDate] = useState<Date | null>(
    transaction?.date ? new Date(transaction.date) : new Date()
  );
  const [isSubscription, setIsSubscription] = useState<boolean>(
    transaction?.category === 'サブスク' || false
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // エラークリア
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    if (date) {
      handleInputChange('date', date.toISOString().split('T')[0]);
    }
  };

  const handleSubscriptionToggle = (checked: boolean) => {
    setIsSubscription(checked);
    if (checked) {
      handleInputChange('category', 'サブスク');
    }
  };

  // 海外サブスク選択時の自動入力
  const handleOverseasServiceSelect = (service: typeof OVERSEAS_SUBSCRIPTIONS[0] | null) => {
    if (service) {
      setFormData(prev => ({
        ...prev,
        merchant: service.name,
        originalAmount: service.amount,
        originalCurrency: service.currency,
        category: service.category,
        isOverseas: true,
        // 現在の為替レートで日本円換算（簡易版）
        amount: Math.round(service.amount * (service.currency === 'USD' ? 150 : 1)),
        exchangeRate: service.currency === 'USD' ? 150 : 1,
      }));
      setIsSubscription(true);
    }
  };

  // 外貨計算の更新
  const updateCurrencyCalculation = () => {
    if (formData.originalCurrency !== 'JPY' && formData.exchangeRate > 0) {
      const jpyAmount = Math.round(formData.originalAmount * formData.exchangeRate);
      handleInputChange('amount', jpyAmount);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.merchant.trim()) {
      newErrors.merchant = '店舗名は必須です';
    }

    if (formData.amount <= 0) {
      newErrors.amount = '金額は0より大きい値を入力してください';
    }

    if (formData.originalAmount <= 0) {
      newErrors.originalAmount = '元通貨金額は0より大きい値を入力してください';
    }

    if (!formData.date) {
      newErrors.date = '日付は必須です';
    }

    if (formData.isOverseas && formData.exchangeRate <= 0) {
      newErrors.exchangeRate = '為替レートは0より大きい値を入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    // 外貨情報を含む拡張トランザクション
    const transactionToSave: CreditTransaction & {
      originalCurrency?: string;
      originalAmount?: number;
      exchangeRate?: number;
      isOverseas?: boolean;
    } = {
      ...formData,
      // 外貨でない場合は元通貨情報をクリア
      ...(formData.originalCurrency === 'JPY' ? {
        originalCurrency: 'JPY',
        originalAmount: formData.amount,
        exchangeRate: 1,
        isOverseas: false,
      } : {}),
    };

    onSave(transactionToSave as CreditTransaction);
    onClose();
  };

  const getCurrencySymbol = (currencyCode: string): string => {
    return CURRENCIES.find(c => c.code === currencyCode)?.symbol || currencyCode;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {mode === 'add' ? '新規取引追加' : '取引編集'}
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* 海外サブスクテンプレート */}
            {mode === 'add' && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  よくある海外サブスクから選択
                </Typography>
                <Autocomplete
                  options={OVERSEAS_SUBSCRIPTIONS}
                  getOptionLabel={(option) => `${option.name} (${getCurrencySymbol(option.currency)}${option.amount})`}
                  onChange={(event, value) => handleOverseasServiceSelect(value)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="サービス名で検索..." size="small" />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{option.name}</Typography>
                        <Chip 
                          label={`${getCurrencySymbol(option.currency)}${option.amount}`} 
                          size="small" 
                          color="primary" 
                        />
                      </Stack>
                    </li>
                  )}
                />
              </Box>
            )}

            <Grid container spacing={2}>
              {/* 基本情報 */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="店舗名"
                  value={formData.merchant}
                  onChange={(e) => handleInputChange('merchant', e.target.value)}
                  error={!!errors.merchant}
                  helperText={errors.merchant}
                  fullWidth
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="利用日"
                  value={selectedDate}
                  onChange={handleDateChange}
                  slotProps={{
                    textField: { 
                      fullWidth: true,
                      error: !!errors.date,
                      helperText: errors.date
                    }
                  }}
                />
              </Grid>

              {/* 通貨・金額情報 */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isOverseas}
                      onChange={(e) => handleInputChange('isOverseas', e.target.checked)}
                    />
                  }
                  label="海外利用（外貨建て）"
                />
              </Grid>

              {formData.isOverseas ? (
                <>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth>
                      <InputLabel>元通貨</InputLabel>
                      <Select
                        value={formData.originalCurrency}
                        label="元通貨"
                        onChange={(e) => handleInputChange('originalCurrency', e.target.value)}
                      >
                        {CURRENCIES.map(currency => (
                          <MenuItem key={currency.code} value={currency.code}>
                            {currency.symbol} {currency.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label={`元通貨金額 (${getCurrencySymbol(formData.originalCurrency)})`}
                      type="number"
                      value={formData.originalAmount}
                      onChange={(e) => handleInputChange('originalAmount', parseFloat(e.target.value) || 0)}
                      error={!!errors.originalAmount}
                      helperText={errors.originalAmount}
                      onBlur={updateCurrencyCalculation}
                      fullWidth
                      required
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="為替レート"
                      type="number"
                      value={formData.exchangeRate}
                      onChange={(e) => handleInputChange('exchangeRate', parseFloat(e.target.value) || 0)}
                      error={!!errors.exchangeRate}
                      helperText={errors.exchangeRate || `1${getCurrencySymbol(formData.originalCurrency)} = ${formData.exchangeRate}円`}
                      onBlur={updateCurrencyCalculation}
                      fullWidth
                      required
                    />
                  </Grid>
                </>
              ) : null}

              <Grid item xs={12} sm={formData.isOverseas ? 12 : 6}>
                <TextField
                  label="日本円金額"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', parseInt(e.target.value) || 0)}
                  error={!!errors.amount}
                  helperText={errors.amount || (formData.isOverseas ? '為替計算で自動更新されます' : '')}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography>,
                    readOnly: formData.isOverseas,
                  }}
                  fullWidth
                  required
                />
              </Grid>

              {/* カテゴリとステータス */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>カテゴリ</InputLabel>
                  <Select
                    value={formData.category}
                    label="カテゴリ"
                    onChange={(e) => handleInputChange('category', e.target.value)}
                  >
                    {CATEGORIES.map(category => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>ステータス</InputLabel>
                  <Select
                    value={formData.status}
                    label="ステータス"
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    {STATUSES.map(status => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="カード名"
                  value={formData.cardName}
                  onChange={(e) => handleInputChange('cardName', e.target.value)}
                  fullWidth
                  placeholder="楽天カード、三井住友カード など"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isSubscription}
                      onChange={(e) => handleSubscriptionToggle(e.target.checked)}
                    />
                  }
                  label="サブスクリプション"
                />
              </Grid>
            </Grid>

            {/* プレビュー */}
            {formData.isOverseas && (
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>外貨取引プレビュー:</strong><br/>
                  {formData.merchant} - {getCurrencySymbol(formData.originalCurrency)}{formData.originalAmount} 
                  → ¥{formData.amount.toLocaleString()} (レート: {formData.exchangeRate})
                </Typography>
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          {mode === 'edit' && onDelete && (
            <Button onClick={onDelete} color="error">
              削除
            </Button>
          )}
          <Button onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} variant="contained">
            {mode === 'add' ? '追加' : '更新'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default TransactionEditor;