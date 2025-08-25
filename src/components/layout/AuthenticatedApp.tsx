import React from 'react';
import { Box, AppBar, Toolbar, Typography, Button, Avatar, IconButton, Menu, MenuItem, Alert } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import StarIcon from '@mui/icons-material/Star';
import { useAuth } from '../../contexts/AuthContext';
import { useTransactionData } from '../../hooks/useTransactionData';
import SyncStatusCard from '../sync/SyncStatusCard';
import App from '../../App';

const AuthenticatedApp: React.FC = () => {
  const { currentUser, userData, signOut, isPremium } = useAuth();
  const { 
    transactions, 
    loading, 
    error, 
    syncProgress, 
    lastSyncAt, 
    refresh 
  } = useTransactionData();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
    handleMenuClose();
  };

  return (
    <Box>
      {/* 認証済みユーザー向けのヘッダー */}
      <AppBar 
        position="sticky" 
        sx={{ 
          backgroundColor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1
        }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Credit Visual
            {isPremium && (
              <StarIcon 
                sx={{ 
                  ml: 1, 
                  color: 'gold', 
                  verticalAlign: 'middle',
                  fontSize: 20 
                }} 
              />
            )}
          </Typography>

          {/* プレミアム表示 */}
          {isPremium && (
            <Typography 
              variant="caption" 
              sx={{ 
                mr: 2, 
                px: 1, 
                py: 0.5, 
                backgroundColor: 'gold',
                color: 'black',
                borderRadius: 1,
                fontWeight: 'bold'
              }}
            >
              PREMIUM
            </Typography>
          )}

          {/* ユーザーメニュー */}
          <IconButton onClick={handleMenuClick} size="small">
            {currentUser?.photoURL ? (
              <Avatar 
                src={currentUser.photoURL} 
                sx={{ width: 32, height: 32 }}
              />
            ) : (
              <AccountCircleIcon />
            )}
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            PaperProps={{
              sx: { mt: 1, minWidth: 200 }
            }}
          >
            <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {currentUser?.displayName || 'ユーザー'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {currentUser?.email}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                プラン: {isPremium ? 'プレミアム' : '無料'}
              </Typography>
            </Box>
            
            {!isPremium && (
              <MenuItem onClick={handleMenuClose}>
                <StarIcon sx={{ mr: 1, color: 'gold' }} />
                プレミアムにアップグレード
              </MenuItem>
            )}
            
            <MenuItem onClick={handleSignOut}>
              <LogoutIcon sx={{ mr: 1 }} />
              ログアウト
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* 同期ステータス表示 */}
      <Box sx={{ p: 2 }}>
        <SyncStatusCard
          syncProgress={syncProgress}
          lastSyncAt={lastSyncAt}
          loading={loading}
          error={error}
          onRefresh={refresh}
        />
      </Box>

      {/* メインアプリケーション */}
      <App transactions={transactions} loading={loading} />
    </Box>
  );
};

export default AuthenticatedApp;