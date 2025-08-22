import React, { useState } from 'react'
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Box, 
  Card, 
  CardContent, 
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material'
import { CreditCard, Analytics, Settings, Email } from '@mui/icons-material'
import { gmailService, CreditTransaction } from './services/gmailService'

type Transaction = CreditTransaction;

const sampleTransactions: Transaction[] = [
  { id: '1', amount: 1200, merchant: 'Amazon.co.jp', date: '2024-08-20', category: 'ショッピング', status: 'confirmed' },
  { id: '2', amount: 980, merchant: 'Netflix', date: '2024-08-19', category: 'サブスク', status: 'confirmed' },
  { id: '3', amount: 2500, merchant: '*UNKNOWN*', date: '2024-08-18', category: '不明', status: 'unknown' },
  { id: '4', amount: 680, merchant: 'Starbucks', date: '2024-08-17', category: '食費', status: 'confirmed' },
]

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(sampleTransactions)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success'
      case 'pending': return 'warning'
      case 'unknown': return 'error'
      default: return 'default'
    }
  }

  const handleGmailConnect = async () => {
    try {
      setLoading(true)
      setError('')
      
      console.log('Starting Gmail authentication...')
      await gmailService.authenticate()
      console.log('Authentication successful!')
      
      console.log('Fetching credit transactions...')
      const creditTransactions = await gmailService.getCreditTransactions()
      console.log('Found transactions:', creditTransactions)
      
      if (creditTransactions.length > 0) {
        setTransactions(creditTransactions)
        setError(`${creditTransactions.length}件のクレジット取引を取得しました`)
      } else {
        setError('クレジット関連のメールが見つかりませんでした。サンプルデータを表示します。')
        setTransactions(sampleTransactions)
      }
      setGmailConnected(true)
    } catch (err) {
      setError('Gmail認証またはデータ取得に失敗しました: ' + JSON.stringify(err))
      console.error('Gmail error:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshTransactions = async () => {
    if (!gmailConnected) {
      return
    }

    try {
      setLoading(true)
      const creditTransactions = await gmailService.getCreditTransactions()
      setTransactions(creditTransactions.length > 0 ? creditTransactions : sampleTransactions)
    } catch (err) {
      setError('取引の更新に失敗しました')
      console.error('Refresh transactions error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ bgcolor: '#1976d2' }}>
        <Toolbar>
          <CreditCard sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Credit Visual
          </Typography>
          <Button color="inherit" startIcon={<Analytics />}>
            分析
          </Button>
          <Button color="inherit" startIcon={<Settings />}>
            設定
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" component="div">
                クレジット利用履歴
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {gmailConnected && (
                  <Button 
                    variant="outlined" 
                    onClick={refreshTransactions}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <Email />}
                  >
                    更新
                  </Button>
                )}
                <Button 
                  variant="contained" 
                  color={gmailConnected ? "success" : "primary"}
                  onClick={handleGmailConnect}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <Email />}
                >
                  {gmailConnected ? 'Gmail連携済み' : 'Gmail連携'}
                </Button>
              </Box>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {gmailConnected 
                ? 'Gmailから自動で抽出されたクレジットカード利用履歴です' 
                : 'サンプルデータです。Gmail連携でリアルなデータを取得できます'}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <List>
              {transactions.map((transaction, index) => (
                <React.Fragment key={transaction.id}>
                  <ListItem sx={{ px: 0, flexDirection: 'column', alignItems: 'stretch' }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1">
                            {transaction.merchant}
                          </Typography>
                          <Typography variant="h6" color="primary">
                            ¥{transaction.amount.toLocaleString()}
                          </Typography>
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {transaction.date}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip 
                          label={transaction.category} 
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={transaction.status === 'confirmed' ? '確認済み' : 
                                 transaction.status === 'pending' ? '確認中' : '要確認'} 
                          size="small" 
                          color={getStatusColor(transaction.status) as any}
                          variant="filled"
                        />
                      </Box>
                    </Box>
                  </ListItem>
                  {index < transactions.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      </Container>

    </Box>
  )
}

export default App