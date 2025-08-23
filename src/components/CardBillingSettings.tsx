import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Chip,
  Stack,
  Divider,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
} from '@mui/material';
import { cardBillingService, CardBillingSettings } from '../services/cardBillingService';

interface CardBillingSettingsProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const CardBillingSettingsDialog: React.FC<CardBillingSettingsProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [selectedCard, setSelectedCard] = useState<string>('');
  const [customClosingDate, setCustomClosingDate] = useState<number>(15);
  const [customPaymentDate, setCustomPaymentDate] = useState<number>(10);
  const [isCustom, setIsCustom] = useState<boolean>(false);

  // 利用可能なカード一覧
  const availableCards = cardBillingService.getAvailableCards();

  useEffect(() => {
    if (selectedCard) {
      const settings = cardBillingService.getCardBillingSettings(selectedCard);
      setCustomClosingDate(settings.closingDate);
      setCustomPaymentDate(settings.paymentDate);
      setIsCustom(settings.isCustom);
    }
  }, [selectedCard]);

  const handleSave = () => {
    if (!selectedCard) return;

    const settings: CardBillingSettings = {
      cardName: selectedCard,
      closingDate: customClosingDate,
      paymentDate: customPaymentDate,
      isCustom: true,
    };

    cardBillingService.setCustomBillingSettings(settings);
    onSave();
    onClose();
  };

  const handleReset = () => {
    cardBillingService.resetAllCustomSettings();
    setIsCustom(false);
    onSave();
    onClose();
  };

  const getDefaultSettings = (cardName: string) => {
    const defaultCycle = cardBillingService.getDefaultBillingCycle(cardName);
    if (defaultCycle && typeof defaultCycle.closingDate === 'number') {
      return `${defaultCycle.closingDate}日締め、${defaultCycle.paymentDate}日払い`;
    }
    return 'デフォルト設定なし';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>カード別締め日・支払日設定</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* カード選択 */}
          <FormControl fullWidth>
            <InputLabel>カードを選択</InputLabel>
            <Select
              value={selectedCard}
              label="カードを選択"
              onChange={(e) => setSelectedCard(e.target.value)}
            >
              {availableCards.map((card) => (
                <MenuItem key={card} value={card}>
                  {card}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedCard && (
            <>
              <Divider />
              
              {/* 現在の設定表示 */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {selectedCard}の設定
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      デフォルト設定: {getDefaultSettings(selectedCard)}
                    </Typography>
                    {isCustom && (
                      <Chip 
                        label="カスタム設定中" 
                        color="primary" 
                        size="small" 
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>

                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="締め日"
                      type="number"
                      value={customClosingDate}
                      onChange={(e) => setCustomClosingDate(parseInt(e.target.value) || 1)}
                      inputProps={{ min: 1, max: 31 }}
                      helperText="毎月この日に締め切り"
                      size="small"
                    />
                    <TextField
                      label="支払日"
                      type="number"
                      value={customPaymentDate}
                      onChange={(e) => setCustomPaymentDate(parseInt(e.target.value) || 1)}
                      inputProps={{ min: 1, max: 31 }}
                      helperText="翌月のこの日に支払い"
                      size="small"
                    />
                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    プレビュー: 毎月{customClosingDate}日締め、翌月{customPaymentDate}日払い
                  </Typography>
                </CardContent>
              </Card>

              {/* 説明 */}
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>設定について:</strong>
                  <br />• 締め日: カード利用額が確定する日
                  <br />• 支払日: 口座から引き落とされる日
                  <br />• 月末締めの場合は31日を指定してください
                </Typography>
              </Alert>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleReset} color="warning">
          全設定リセット
        </Button>
        <Button onClick={onClose}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!selectedCard}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CardBillingSettingsDialog;