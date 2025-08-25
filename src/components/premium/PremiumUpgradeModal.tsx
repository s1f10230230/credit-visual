import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NotificationsIcon from '@mui/icons-material/Notifications';

interface PremiumUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  featureTitle?: string;
  featureDescription?: string;
}

const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  open,
  onClose,
  onUpgrade,
  featureTitle,
  featureDescription
}) => {
  const premiumFeatures = [
    {
      icon: <CheckCircleIcon color="primary" />,
      title: '解約候補の自動検出',
      description: '使っていないサブスクを AI が自動で発見'
    },
    {
      icon: <TrendingUpIcon color="primary" />,
      title: '12ヶ月間の支出推移',
      description: '年間トレンドで支出パターンを把握'
    },
    {
      icon: <NotificationsIcon color="primary" />,
      title: '課金リマインダー通知',
      description: '次回請求日の3日前にお知らせ'
    },
    {
      icon: <StarIcon color="primary" />,
      title: '重複サービス検出',
      description: '同じカテゴリの複数契約を発見'
    }
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box textAlign="center">
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            🚀 プレミアムプランへアップグレード
          </Typography>
          {featureTitle && (
            <Typography variant="body2" color="text.secondary">
              「{featureTitle}」を利用するには
            </Typography>
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        {featureDescription && (
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {featureDescription}
            </Typography>
          </Box>
        )}

        {/* 料金表示 */}
        <Box textAlign="center" sx={{ mb: 3 }}>
          <Chip 
            label="30日間無料トライアル" 
            color="secondary" 
            sx={{ mb: 1 }} 
          />
          <Typography variant="h4" fontWeight="bold">
            ¥500
            <Typography component="span" variant="body1" color="text.secondary">
              /月
            </Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            いつでもキャンセル可能
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* プレミアム機能一覧 */}
        <Typography variant="h6" gutterBottom fontWeight="bold">
          プレミアム機能
        </Typography>
        
        <List dense>
          {premiumFeatures.map((feature, index) => (
            <ListItem key={index} sx={{ px: 0 }}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                {feature.icon}
              </ListItemIcon>
              <ListItemText
                primary={feature.title}
                secondary={feature.description}
                primaryTypographyProps={{ fontWeight: 500 }}
              />
            </ListItem>
          ))}
        </List>

        {/* 無料版との比較 */}
        <Box sx={{ mt: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            無料版との違い
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • 無料版: 直近3ヶ月の支出データのみ<br/>
            • プレミアム: 12ヶ月の詳細分析 + AI解約提案
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button 
          onClick={onClose} 
          color="inherit"
          size="large"
        >
          後で
        </Button>
        <Button 
          onClick={onUpgrade} 
          variant="contained" 
          size="large"
          sx={{ minWidth: 140 }}
        >
          無料トライアル開始
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PremiumUpgradeModal;