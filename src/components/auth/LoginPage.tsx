import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Container,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Login error:', error);
      setError('ログインに失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            width: '100%',
            textAlign: 'center'
          }}
        >
          {/* アプリロゴとタイトル */}
          <Box sx={{ mb: 4 }}>
            <CreditCardIcon 
              sx={{ 
                fontSize: 64, 
                color: 'primary.main',
                mb: 2 
              }} 
            />
            <Typography variant="h4" gutterBottom fontWeight="bold">
              Credit Visual
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              クレジットカード横断サブスク管理
            </Typography>
          </Box>

          {/* 機能説明 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="body1" color="text.secondary" paragraph>
              複数のクレジットカードから自動でサブスクリプションを検出し、
              使っていないサービスをお知らせします。
            </Typography>
            <Typography variant="body2" color="text.secondary">
              💳 複数クレカ対応　🔍 自動検出　📊 支出分析
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* エラー表示 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Googleログインボタン */}
          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
            onClick={handleGoogleSignIn}
            disabled={loading}
            sx={{
              width: '100%',
              height: 56,
              mb: 2,
              backgroundColor: '#4285f4',
              '&:hover': {
                backgroundColor: '#3367d6',
              }
            }}
          >
            {loading ? 'ログイン中...' : 'Googleでログイン'}
          </Button>

          <Typography variant="caption" color="text.secondary" display="block">
            ログインすることで、
            <Typography component="span" color="primary">利用規約</Typography>
            および
            <Typography component="span" color="primary">プライバシーポリシー</Typography>
            に同意したものとみなされます。
          </Typography>

          {/* プレミアム機能のプレビュー */}
          <Box sx={{ mt: 4, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              🚀 プレミアム機能（月額500円）
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • 解約候補の自動検出<br/>
              • 12ヶ月間の支出推移<br/>
              • 課金リマインダー通知
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;