import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  LinearProgress,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  IconButton,
  useTheme,
  useMediaQuery,
  Paper,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { CreditTransaction } from '../services/analyticsService';
import { analyticsService } from '../services/analyticsService';

interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  currentSpent: number;
  period: 'monthly' | 'weekly';
  color: string;
  createdAt: string;
}

interface BudgetManagerProps {
  transactions: CreditTransaction[];
}

const BudgetManager: React.FC<BudgetManagerProps> = ({ transactions }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newPeriod, setNewPeriod] = useState<'monthly' | 'weekly'>('monthly');

  // 利用可能なカテゴリを取得
  const availableCategories = analyticsService.groupByCategory(transactions)
    .map(cat => cat.category)
    .filter(category => !budgets.some(budget => budget.category === category));

  useEffect(() => {
    // ローカルストレージから予算設定を読み込み
    const savedBudgets = localStorage.getItem('credit_visual_budgets');
    if (savedBudgets) {
      setBudgets(JSON.parse(savedBudgets));
    }
  }, []);

  useEffect(() => {
    // 予算設定をローカルストレージに保存
    localStorage.setItem('credit_visual_budgets', JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    // 現在の支出額を計算して予算を更新
    const updatedBudgets = budgets.map(budget => {
      const currentMonthSpent = getCurrentMonthSpent(budget.category);
      return { ...budget, currentSpent: currentMonthSpent };
    });
    setBudgets(updatedBudgets);
  }, [transactions]);

  const getCurrentMonthSpent = (category: string): number => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return (
          tx.category === category &&
          txDate.getMonth() === currentMonth &&
          txDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  const getProgressPercentage = (budget: Budget): number => {
    return Math.min((budget.currentSpent / budget.monthlyLimit) * 100, 100);
  };

  const getProgressColor = (percentage: number): 'primary' | 'warning' | 'error' => {
    if (percentage >= 90) return 'error';
    if (percentage >= 75) return 'warning';
    return 'primary';
  };

  const getBudgetStatus = (budget: Budget): { status: string; color: string; icon: React.ReactNode } => {
    const percentage = getProgressPercentage(budget);
    
    if (percentage >= 100) {
      return {
        status: '予算超過',
        color: theme.palette.error.main,
        icon: <WarningIcon color="error" />
      };
    } else if (percentage >= 75) {
      return {
        status: '警告',
        color: theme.palette.warning.main,
        icon: <WarningIcon color="warning" />
      };
    } else {
      return {
        status: '順調',
        color: theme.palette.success.main,
        icon: <CheckCircleIcon color="success" />
      };
    }
  };

  const handleSaveBudget = () => {
    if (!newCategory || !newLimit) return;

    const budget: Budget = {
      id: editingBudget ? editingBudget.id : Date.now().toString(),
      category: newCategory,
      monthlyLimit: parseInt(newLimit),
      currentSpent: getCurrentMonthSpent(newCategory),
      period: newPeriod,
      color: theme.palette.primary.main,
      createdAt: editingBudget ? editingBudget.createdAt : new Date().toISOString(),
    };

    if (editingBudget) {
      setBudgets(prev => prev.map(b => b.id === editingBudget.id ? budget : b));
    } else {
      setBudgets(prev => [...prev, budget]);
    }

    setDialogOpen(false);
    setEditingBudget(null);
    setNewCategory('');
    setNewLimit('');
    setNewPeriod('monthly');
  };

  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setNewCategory(budget.category);
    setNewLimit(budget.monthlyLimit.toString());
    setNewPeriod(budget.period);
    setDialogOpen(true);
  };

  const handleDeleteBudget = (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;

  const getTotalBudget = () => budgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0);
  const getTotalSpent = () => budgets.reduce((sum, budget) => sum + budget.currentSpent, 0);
  const getRemainingBudget = () => getTotalBudget() - getTotalSpent();

  const getOverbudgetCategories = () => 
    budgets.filter(budget => getProgressPercentage(budget) >= 100);

  const getWarningCategories = () => 
    budgets.filter(budget => {
      const percentage = getProgressPercentage(budget);
      return percentage >= 75 && percentage < 100;
    });

  return (
    <Box sx={{ p: isMobile ? 1 : 2 }}>
      {/* 予算サマリー */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <TrendingUpIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    月間予算
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(getTotalBudget())}
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
                <TrendingDownIcon color="info" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    今月の支出
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(getTotalSpent())}
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
                <CheckCircleIcon color={getRemainingBudget() >= 0 ? "success" : "error"} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    残り予算
                  </Typography>
                  <Typography 
                    variant="h6" 
                    color={getRemainingBudget() >= 0 ? "success.main" : "error.main"}
                  >
                    {formatCurrency(getRemainingBudget())}
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
                    アラート
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {getOverbudgetCategories().length + getWarningCategories().length}件
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* アラート */}
      {getOverbudgetCategories().length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            🚨 予算超過警告
          </Typography>
          <Typography variant="body2">
            {getOverbudgetCategories().map(b => b.category).join(', ')}で予算を超過しています
          </Typography>
        </Alert>
      )}

      {getWarningCategories().length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            ⚠️ 予算注意
          </Typography>
          <Typography variant="body2">
            {getWarningCategories().map(b => b.category).join(', ')}が予算の75%を超えています
          </Typography>
        </Alert>
      )}

      {/* 予算設定ボタン */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">
          カテゴリ別予算管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          size={isMobile ? "small" : "medium"}
        >
          予算追加
        </Button>
      </Stack>

      {/* 予算一覧 */}
      {budgets.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              予算設定がありません。「予算追加」ボタンから設定してください。
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {budgets.map(budget => {
            const percentage = getProgressPercentage(budget);
            const status = getBudgetStatus(budget);

            return (
              <Grid item xs={12} sm={6} md={4} key={budget.id}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                      <Typography variant="h6">
                        {budget.category}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          size="small"
                          onClick={() => handleEditBudget(budget)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteBudget(budget.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                      {status.icon}
                      <Chip
                        label={status.status}
                        size="small"
                        sx={{ backgroundColor: status.color, color: 'white' }}
                      />
                    </Stack>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {formatCurrency(budget.currentSpent)} / {formatCurrency(budget.monthlyLimit)}
                    </Typography>
                    
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      color={getProgressColor(percentage)}
                      sx={{ height: 8, borderRadius: 4, mb: 1 }}
                    />
                    
                    <Typography variant="caption" color="text.secondary">
                      {percentage.toFixed(1)}% 使用済み
                    </Typography>

                    {percentage >= 100 && (
                      <Typography variant="caption" color="error" display="block">
                        {formatCurrency(budget.currentSpent - budget.monthlyLimit)} 超過
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* 予算設定ダイアログ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingBudget ? '予算編集' : '新規予算設定'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>カテゴリ</InputLabel>
              <Select
                value={newCategory}
                label="カテゴリ"
                onChange={(e) => setNewCategory(e.target.value)}
                disabled={!!editingBudget}
              >
                {editingBudget ? (
                  <MenuItem value={editingBudget.category}>
                    {editingBudget.category}
                  </MenuItem>
                ) : (
                  availableCategories.map(category => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <TextField
              label="月間予算額"
              type="number"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography>,
              }}
              helperText="月間の支出上限額を設定してください"
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>期間</InputLabel>
              <Select
                value={newPeriod}
                label="期間"
                onChange={(e) => setNewPeriod(e.target.value as 'monthly' | 'weekly')}
              >
                <MenuItem value="monthly">月間</MenuItem>
                <MenuItem value="weekly">週間（今後対応予定）</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveBudget}
            disabled={!newCategory || !newLimit}
          >
            {editingBudget ? '更新' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BudgetManager;