import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Chip,
  Paper,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Close as CloseIcon,
  Email as EmailIcon,
  ExpandMore as ExpandMoreIcon,
  CreditCard as CreditCardIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { CreditTransaction } from '../services/gmailService';

interface TransactionDetailDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: CreditTransaction | null;
}

const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(amount);
};

const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = ({
  open,
  onClose,
  transaction,
}) => {
  if (!transaction) return null;

  const statusColor = transaction.status === 'confirmed' 
    ? 'success' 
    : transaction.status === 'pending' 
    ? 'warning' 
    : 'default';

  const statusLabel = transaction.status === 'confirmed' 
    ? '確認済み' 
    : transaction.status === 'pending' 
    ? '保留中' 
    : '不明';

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">取引詳細</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers sx={{ pb: 3 }}>
        {/* 基本情報 */}
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <CreditCardIcon color="primary" />
            <Typography variant="h6" color="primary">
              ¥{formatPrice(transaction.amount)}
            </Typography>
          </Box>
          
          <Typography variant="body1" fontWeight="medium" gutterBottom>
            {transaction.merchant}
          </Typography>
          
          <Box display="flex" gap={1} mb={2}>
            <Chip 
              label={transaction.category} 
              size="small" 
              variant="outlined" 
            />
            <Chip 
              label={statusLabel} 
              size="small" 
              color={statusColor} 
            />
            {transaction.isSubscription && (
              <Chip 
                label="サブスク" 
                size="small" 
                color="secondary" 
              />
            )}
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            日付: {new Date(transaction.date).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short'
            })}
          </Typography>
          
          {transaction.cardName && (
            <Typography variant="body2" color="text.secondary">
              カード: {transaction.cardName}
            </Typography>
          )}
        </Paper>

        {/* メール情報 */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <EmailIcon />
              <Typography variant="subtitle1">メール情報</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ pl: 1 }}>
              {transaction.emailSubject && (
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    件名
                  </Typography>
                  <Typography variant="body2">
                    {transaction.emailSubject}
                  </Typography>
                </Box>
              )}
              
              {transaction.emailSender && (
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    送信者
                  </Typography>
                  <Typography variant="body2">
                    {transaction.emailSender}
                  </Typography>
                </Box>
              )}
              
              {transaction.messageId && (
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    メッセージID
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '0.7rem' }}>
                    {transaction.messageId}
                  </Typography>
                </Box>
              )}

              {transaction.rawEmailBody && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2">元のメール内容</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        backgroundColor: 'grey.50',
                        maxHeight: 200,
                        overflow: 'auto'
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        component="pre" 
                        sx={{ 
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontSize: '0.7rem'
                        }}
                      >
                        {transaction.rawEmailBody}
                      </Typography>
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* 解析情報 */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <AssessmentIcon />
              <Typography variant="subtitle1">解析情報</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ pl: 1 }}>
              {transaction.confidence && (
                <Box mb={1}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    信頼度
                  </Typography>
                  <Typography variant="body2">
                    {Math.round(transaction.confidence * 100)}%
                  </Typography>
                </Box>
              )}
              
              <Box mb={1}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  検出方法
                </Typography>
                <Typography variant="body2">
                  {transaction.source || 'Gmail解析'}
                </Typography>
              </Box>

              {transaction.notes && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    メモ
                  </Typography>
                  <Typography variant="body2">
                    {transaction.notes}
                  </Typography>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionDetailDialog;