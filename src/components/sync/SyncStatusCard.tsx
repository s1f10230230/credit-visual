import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Box,
  Chip,
  Stack,
  Alert,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { SyncProgress } from '../../services/syncService';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface SyncStatusCardProps {
  syncProgress: SyncProgress | null;
  lastSyncAt: Date | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const SyncStatusCard: React.FC<SyncStatusCardProps> = ({
  syncProgress,
  lastSyncAt,
  loading,
  error,
  onRefresh
}) => {
  const getSyncStatusColor = () => {
    if (error) return 'error';
    if (syncProgress && syncProgress.progress < 100) return 'info';
    return 'success';
  };

  const getSyncStatusText = () => {
    if (error) return 'エラー';
    if (syncProgress && syncProgress.progress < 100) return '同期中';
    return '最新';
  };

  const formatLastSync = (date: Date) => {
    return formatDistanceToNow(date, { 
      addSuffix: true, 
      locale: ja 
    });
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <SyncIcon color="primary" />
              <Typography variant="h6">
                データ同期
              </Typography>
              <Chip 
                label={getSyncStatusText()} 
                color={getSyncStatusColor()}
                size="small"
                icon={
                  error ? <ErrorIcon /> : 
                  (syncProgress && syncProgress.progress < 100) ? <SyncIcon /> :
                  <CheckCircleIcon />
                }
              />
            </Stack>

            {lastSyncAt && (
              <Typography variant="body2" color="text.secondary">
                <ScheduleIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                最終更新: {formatLastSync(lastSyncAt)}
              </Typography>
            )}
          </Box>

          <Box>
            <Tooltip title="手動更新">
              <IconButton 
                onClick={onRefresh} 
                disabled={loading || (syncProgress && syncProgress.progress < 100)}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Stack>

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2">
              {error}
            </Typography>
          </Alert>
        )}

        {/* 同期プログレス */}
        {syncProgress && syncProgress.progress < 100 && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {syncProgress.message}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {syncProgress.progress}%
              </Typography>
            </Box>
            
            <LinearProgress 
              variant="determinate" 
              value={syncProgress.progress} 
              sx={{ mb: 1 }}
            />

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip 
                label={syncProgress.phase === 'initial' ? '初回' : 
                      syncProgress.phase === 'background' ? '詳細' : '更新'}
                size="small"
                variant="outlined"
              />
              
              {syncProgress.totalTransactions > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {syncProgress.newTransactions > 0 && `新規${syncProgress.newTransactions}件 / `}
                  合計{syncProgress.totalTransactions}件
                </Typography>
              )}
            </Stack>

            {syncProgress.errors.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                <Typography variant="body2">
                  警告: {syncProgress.errors.join(', ')}
                </Typography>
              </Alert>
            )}
          </Box>
        )}

        {/* 同期完了時の統計表示 */}
        {!syncProgress && lastSyncAt && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              💡 データは自動的に同期されます。新しいクレジットカード利用があると、
              数分以内に反映されます。
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default SyncStatusCard;