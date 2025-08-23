import React, { useState, useEffect } from "react";
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
  CircularProgress,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Fab,
  Grid,
  Avatar,
  Stack,
  useTheme,
  useMediaQuery,
  Slide,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  CreditCard,
  Analytics,
  Settings,
  Email,
  Home,
  Assessment,
  ExpandMore,
  ExpandLess,
  TrendingUp,
  AccountBalanceWallet,
  TouchApp,
} from "@mui/icons-material";
import { gmailService, CreditTransaction } from "./services/gmailService";
import AdBanner from "./components/AdBanner";
import OnboardingWizard from "./components/OnboardingWizard";
import { notificationService } from "./services/notificationService";
import { cardBillingService } from "./services/cardBillingService";
import CardBillingSettingsDialog from "./components/CardBillingSettings";

type Transaction = CreditTransaction;

// 価格フォーマット関数
const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const sampleTransactions: Transaction[] = [
  {
    id: "1",
    amount: 1200,
    merchant: "Amazon.co.jp",
    date: "2024-08-20",
    category: "ショッピング",
    status: "confirmed",
    cardName: "楽天カード",
  },
  {
    id: "2",
    amount: 980,
    merchant: "Netflix",
    date: "2024-08-19",
    category: "サブスク",
    status: "confirmed",
    cardName: "三井住友カード",
  },
  {
    id: "3",
    amount: 2500,
    merchant: "*UNKNOWN*",
    date: "2024-08-18",
    category: "不明",
    status: "unknown",
    cardName: "楽天カード",
  },
  {
    id: "4",
    amount: 680,
    merchant: "Starbucks",
    date: "2024-08-17",
    category: "食費",
    status: "confirmed",
    cardName: "三井住友カード",
  },
];

const App: React.FC = () => {
  const [transactions, setTransactions] =
    useState<Transaction[]>(sampleTransactions);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentView, setCurrentView] = useState(0); // 0: Home, 1: Analysis, 2: Settings
  const [groupBy, setGroupBy] = useState("none");
  const [viewMode, setViewMode] = useState<"all" | "monthly">("monthly"); // 月ごと表示がデフォルト
  const [selectedMonth, setSelectedMonth] = useState<string>(""); // YYYY-MM形式
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showCardSettings, setShowCardSettings] = useState(false);

  // Swipe gesture handling for mobile
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentView < 2) {
      setCurrentView(currentView + 1);
    }
    if (isRightSwipe && currentView > 0) {
      setCurrentView(currentView - 1);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  // 月ごとのトランザクション取得
  const getFilteredTransactions = (): Transaction[] => {
    if (viewMode === "all") return transactions;

    // 選択された月でフィルタリング
    if (selectedMonth) {
      return transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        const transactionMonth = `${transactionDate.getFullYear()}-${(transactionDate.getMonth() + 1).toString().padStart(2, '0')}`;
        return transactionMonth === selectedMonth;
      });
    }

    // デフォルトは今月
    const currentMonth = new Date();
    const currentMonthStr = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`;
    
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      const transactionMonth = `${transactionDate.getFullYear()}-${(transactionDate.getMonth() + 1).toString().padStart(2, '0')}`;
      return transactionMonth === currentMonthStr;
    });
  };

  // 利用可能な月のリスト取得
  const getAvailableMonths = (): string[] => {
    const months = new Set<string>();
    
    transactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const monthStr = `${transactionDate.getFullYear()}-${(transactionDate.getMonth() + 1).toString().padStart(2, '0')}`;
      months.add(monthStr);
    });

    return Array.from(months).sort().reverse(); // 新しい月が上に
  };

  // 初期選択月の設定
  React.useEffect(() => {
    if (!selectedMonth && transactions.length > 0) {
      const availableMonths = getAvailableMonths();
      if (availableMonths.length > 0) {
        setSelectedMonth(availableMonths[0]); // 最新月を選択
      }
    }
  }, [transactions, selectedMonth]);

  useEffect(() => {
    // オンボーディング完了状態をチェック
    const completed = localStorage.getItem("onboardingCompleted") === "true";

    // 初回訪問の場合はオンボーディングを表示
    if (!completed) {
      setShowOnboarding(true);
    }

    // 通知サービスを初期化
    notificationService.requestPermission();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "success";
      case "pending":
        return "warning";
      case "unknown":
        return "error";
      default:
        return "default";
    }
  };

  const handleGmailConnect = async () => {
    try {
      setLoading(true);
      setError("");

      console.log("Starting Gmail authentication...");
      await gmailService.authenticate();
      console.log("Authentication successful!");

      console.log("Fetching credit transactions...");
      const creditTransactions = await gmailService.getCreditTransactions();
      console.log("Found transactions:", creditTransactions);

      if (creditTransactions.length > 0) {
        setTransactions(creditTransactions);
        setError(
          `${creditTransactions.length}件のクレジット取引を取得しました`
        );
      } else {
        setError(
          "クレジット関連のメールが見つかりませんでした。サンプルデータを表示します。"
        );
        setTransactions(sampleTransactions);
      }
      setGmailConnected(true);
    } catch (err) {
      setError(
        "Gmail認証またはデータ取得に失敗しました: " + JSON.stringify(err)
      );
      console.error("Gmail error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // onboarding completed

    // 完了通知を送信
    notificationService.sendFeatureIntroduction(
      "オンボーディング完了",
      "クレジット管理の準備が整いました！"
    );
  };

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
  };

  const renderGroupedTransactions = () => {
    if (groupBy === "none") {
      return (
        <List>
          {transactions.map((transaction, index) => (
            <React.Fragment key={transaction.id}>
              {renderTransactionItem(transaction)}
              {index < transactions.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      );
    }

    const grouped = transactions.reduce((acc, transaction) => {
      const key =
        groupBy === "merchant"
          ? transaction.merchant
          : groupBy === "category"
          ? transaction.category
          : transaction.cardName || "カード不明";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(transaction);
      return acc;
    }, {} as Record<string, Transaction[]>);

    return (
      <Box>
        {Object.entries(grouped).map(([groupName, groupTransactions]) => {
          const totalAmount = groupTransactions.reduce(
            (sum, t) => sum + t.amount,
            0
          );
          return (
            <Box key={groupName} sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1, color: "primary.main" }}>
                {groupName} (¥{formatPrice(totalAmount)})
              </Typography>
              <List sx={{ bgcolor: "grey.50", borderRadius: 1 }}>
                {groupTransactions.map((transaction, index) => (
                  <React.Fragment key={transaction.id}>
                    {renderTransactionItem(transaction)}
                    {index < groupTransactions.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderTransactionItem = (transaction: Transaction) => (
    <ListItem
      sx={{
        px: 0,
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <ListItemText
        primary={
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="subtitle1">{transaction.merchant}</Typography>
            <Typography variant="h6" color="primary">
              ¥{formatPrice(transaction.amount)}
            </Typography>
          </Box>
        }
      />
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mt: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {transaction.date}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Chip label={transaction.category} size="small" variant="outlined" />
          <Chip
            label={
              transaction.status === "confirmed"
                ? "確認済み"
                : transaction.status === "pending"
                ? "確認中"
                : "要確認"
            }
            size="small"
            color={getStatusColor(transaction.status) as any}
            variant="filled"
          />
        </Box>
      </Box>
    </ListItem>
  );

  const refreshTransactions = async () => {
    if (!gmailConnected) {
      return;
    }

    try {
      setLoading(true);
      const creditTransactions = await gmailService.getCreditTransactions();
      setTransactions(
        creditTransactions.length > 0 ? creditTransactions : sampleTransactions
      );
    } catch (err) {
      setError("取引の更新に失敗しました");
      console.error("Refresh transactions error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar
        position="static"
        sx={{
          bgcolor: "#1976d2",
          ...(isMobile && {
            boxShadow: "none",
            borderBottom: "1px solid",
            borderColor: "divider",
          }),
        }}
      >
        <Toolbar sx={{ minHeight: isMobile ? 56 : 64 }}>
          <CreditCard sx={{ mr: 2 }} />
          <Typography
            variant={isMobile ? "h6" : "h6"}
            component="div"
            sx={{
              flexGrow: 1,
              fontSize: isMobile ? "1.1rem" : "1.25rem",
              fontWeight: "bold",
            }}
          >
            {isMobile ? "Credit Visual" : "Credit Visual"}
          </Typography>

          {isMobile && currentView === 0 && (
            <Typography variant="caption" sx={{ mr: 2, opacity: 0.8 }}>
              ¥{formatPrice(transactions.reduce((sum, tx) => sum + tx.amount, 0))}
            </Typography>
          )}

          {!isMobile && (
            <>
              <Button
                color="inherit"
                startIcon={<Analytics />}
                onClick={() => setCurrentView(1)}
              >
                分析
              </Button>
              <Button
                color="inherit"
                startIcon={<Settings />}
                onClick={() => setCurrentView(2)}
              >
                設定
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="md"
        sx={{ mt: isMobile ? 1 : 4, pb: isMobile ? 10 : 2 }}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        {/* Mobile Summary Cards */}
        {isMobile && currentView === 0 && (
          <Stack spacing={2} sx={{ mb: 2 }}>
            <Card elevation={2}>
              <CardContent sx={{ py: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid>
                    <Avatar sx={{ bgcolor: "primary.main" }}>
                      <AccountBalanceWallet />
                    </Avatar>
                  </Grid>
                  <Grid xs>
                    <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                      今月の支出
                    </Typography>
                    <Typography
                      variant="h4"
                      color="primary"
                      sx={{ fontWeight: "bold" }}
                    >
                      ¥{formatPrice(transactions.reduce((sum, tx) => sum + tx.amount, 0))}
                    </Typography>
                  </Grid>
                  <Grid>
                    <Chip
                      label={`${transactions.length}件`}
                      color="primary"
                      variant="outlined"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Stack spacing={1}>
              <Card>
                <CardContent sx={{ py: 2, textAlign: "center" }}>
                  <TrendingUp color="success" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    最高還元率
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    5.5%
                  </Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ py: 2, textAlign: "center" }}>
                  <TouchApp color="info" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    最適化可能
                  </Typography>
                  <Typography variant="h6" color="info.main">
                    ¥{formatPrice(Math.round(transactions.reduce((sum, tx) => sum + tx.amount, 0) * 0.02))}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          </Stack>
        )}

        <Slide
          direction="left"
          in={currentView === 0}
          mountOnEnter
          unmountOnExit={false}
        >
          <div style={{ display: currentView === 0 ? "block" : "none" }}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Typography variant="h5" component="div">
                    クレジット利用履歴
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {gmailConnected && (
                      <Button
                        variant="outlined"
                        onClick={refreshTransactions}
                        disabled={loading}
                        startIcon={
                          loading ? <CircularProgress size={16} /> : <Email />
                        }
                      >
                        更新
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      color={gmailConnected ? "success" : "primary"}
                      onClick={handleGmailConnect}
                      disabled={loading}
                      startIcon={
                        loading ? <CircularProgress size={16} /> : <Email />
                      }
                    >
                      {gmailConnected ? "Gmail連携済み" : "Gmail連携"}
                    </Button>
                  </Box>
                </Box>

{/* コメントアウト: ビューモードと月選択 */}
                {/*
                <Box sx={{ mb: 2 }}>
                  <Stack 
                    direction={isMobile ? "column" : "row"} 
                    spacing={2} 
                    alignItems={isMobile ? "stretch" : "center"}
                  >
                    <ToggleButtonGroup
                      value={viewMode}
                      exclusive
                      onChange={(_, newMode) => newMode && setViewMode(newMode)}
                      size="small"
                    >
                      <ToggleButton value="monthly">月ごと</ToggleButton>
                      <ToggleButton value="all">全期間</ToggleButton>
                    </ToggleButtonGroup>

                    {viewMode === "monthly" && (
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel>表示月</InputLabel>
                        <Select
                          value={selectedMonth}
                          label="表示月"
                          onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                          {getAvailableMonths().map((month) => {
                            const [year, monthNum] = month.split('-');
                            const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
                            const displayName = `${year}年${monthNames[parseInt(monthNum) - 1]}`;
                            return (
                              <MenuItem key={month} value={month}>
                                {displayName}
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>
                    )}
                  </Stack>
                </Box>
                */}

{/* コメントアウト: 請求期間詳細表示 */}
                {/*
                {viewMode === "monthly" && selectedMonth && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>表示期間:</strong> {selectedMonth.split('-')[0]}年{parseInt(selectedMonth.split('-')[1])}月
                      <br />
                      <strong>取引件数:</strong> {transactions.length}件
                      <br />
                      <strong>合計金額:</strong> ¥{formatPrice(transactions.reduce((sum, tx) => sum + tx.amount, 0))}
                    </Typography>
                  </Alert>
                )}
                */}

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {gmailConnected
                    ? "Gmailから自動で抽出されたクレジットカード利用履歴です"
                    : "サンプルデータです。Gmail連携でリアルなデータを取得できます"}
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                {isMobile ? (
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="h6">最近の取引</Typography>
                      <Button
                        size="small"
                        onClick={() =>
                          setShowAllTransactions(!showAllTransactions)
                        }
                        endIcon={
                          showAllTransactions ? <ExpandLess /> : <ExpandMore />
                        }
                      >
                        {showAllTransactions ? "閉じる" : "すべて見る"}
                      </Button>
                    </Box>

                    <Stack spacing={2}>
                      {(showAllTransactions
                        ? transactions
                        : transactions.slice(0, 4)
                      ).map((transaction) => (
                          <Card
                            elevation={1}
                            sx={{
                              cursor: "pointer",
                              "&:hover": { elevation: 3 },
                              borderRadius: 2,
                            }}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  mb: 1,
                                }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: "bold" }}
                                >
                                  {transaction.merchant.length > 12
                                    ? transaction.merchant.substring(0, 12) +
                                      "..."
                                    : transaction.merchant}
                                </Typography>
                                <Typography
                                  variant="h6"
                                  color="primary"
                                  sx={{ fontWeight: "bold" }}
                                >
                                  ¥{formatPrice(transaction.amount)}
                                </Typography>
                              </Box>

                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {new Date(transaction.date).getMonth() + 1}/
                                  {new Date(transaction.date).getDate()}
                                </Typography>
                                <Box
                                  sx={{
                                    display: "flex",
                                    gap: 0.5,
                                    alignItems: "center",
                                  }}
                                >
                                  <Chip
                                    label={transaction.category}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: "0.7rem" }}
                                  />
                                  <Chip
                                    label={
                                      transaction.status === "confirmed"
                                        ? "✓"
                                        : transaction.status === "pending"
                                        ? "○"
                                        : "?"
                                    }
                                    size="small"
                                    color={
                                      getStatusColor(transaction.status) as any
                                    }
                                    sx={{ minWidth: 24, fontSize: "0.7rem" }}
                                  />
                                </Box>
                              </Box>

                              {transaction.cardName && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ mt: 1, display: "block" }}
                                >
                                  {transaction.cardName}
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                      ))}
                    </Stack>
                  </Stack>
                ) : (
                  <List>
                    {transactions.map((transaction, index) => (
                      <React.Fragment key={transaction.id}>
                        {renderTransactionItem(transaction)}
                        {index < transactions.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </div>
        </Slide>

        <Slide
          direction="left"
          in={currentView === 1}
          mountOnEnter
          unmountOnExit={false}
        >
          <div style={{ display: currentView === 1 ? "block" : "none" }}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="div" sx={{ mb: 2 }}>
                  取引分析
                </Typography>
                <Box sx={{ mb: 2 }}>
                  {isMobile ? (
                    <Grid container spacing={1}>
                      {[
                        { key: "merchant", label: "利用先別" },
                        { key: "category", label: "カテゴリ別" },
                        { key: "card", label: "カード別" },
                        { key: "none", label: "まとめなし" },
                      ].map(({ key, label }) => (
                        <Grid item xs={6} sm={3} key={key}>
                          <Button
                            fullWidth
                            size="small"
                            variant={groupBy === key ? "contained" : "outlined"}
                            onClick={() => setGroupBy(key)}
                            sx={{
                              minHeight: 40,
                              fontSize: "0.8rem",
                              borderRadius: 2,
                            }}
                          >
                            {label}
                          </Button>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <>
                      <Button
                        variant={
                          groupBy === "merchant" ? "contained" : "outlined"
                        }
                        onClick={() => setGroupBy("merchant")}
                        sx={{ mr: 1 }}
                      >
                        利用先別
                      </Button>
                      <Button
                        variant={
                          groupBy === "category" ? "contained" : "outlined"
                        }
                        onClick={() => setGroupBy("category")}
                        sx={{ mr: 1 }}
                      >
                        カテゴリ別
                      </Button>
                      <Button
                        variant={groupBy === "card" ? "contained" : "outlined"}
                        onClick={() => setGroupBy("card")}
                        sx={{ mr: 1 }}
                      >
                        カード別
                      </Button>
                      <Button
                        variant={groupBy === "none" ? "contained" : "outlined"}
                        onClick={() => setGroupBy("none")}
                      >
                        グループなし
                      </Button>
                    </>
                  )}
                </Box>
                {renderGroupedTransactions()}
              </CardContent>
            </Card>
          </div>
        </Slide>

        <Slide
          direction="left"
          in={currentView === 2}
          mountOnEnter
          unmountOnExit={false}
        >
          <div style={{ display: currentView === 2 ? "block" : "none" }}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="div" sx={{ mb: 2 }}>
                  設定
                </Typography>
                
{/* コメントアウト: カード設定ボタン */}
                {/*
                <Stack spacing={2} sx={{ mb: 3 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setShowCardSettings(true)}
                    startIcon={<CreditCard />}
                  >
                    カード別締め日・支払日設定
                  </Button>
                </Stack>
                */}

                {!isMobile && (
                  <Button
                    variant="outlined"
                    onClick={() => setCurrentView(0)}
                    sx={{ mb: 2 }}
                  >
                    取引履歴に戻る
                  </Button>
                )}
                {isMobile ? (
                  <Stack spacing={2}>
                    <Card variant="outlined">
                      <CardContent sx={{ py: 2 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Email sx={{ mr: 2, color: "text.secondary" }} />
                            <Box>
                              <Typography variant="subtitle2">
                                Gmail連携
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {gmailConnected ? "連携済み" : "未連携"}
                              </Typography>
                            </Box>
                          </Box>
                          <Button
                            variant={gmailConnected ? "outlined" : "contained"}
                            size="small"
                            onClick={handleGmailConnect}
                            disabled={loading}
                          >
                            {gmailConnected ? "再連携" : "連携"}
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>

                    <Card variant="outlined">
                      <CardContent sx={{ py: 2 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <CreditCard
                              sx={{ mr: 2, color: "text.secondary" }}
                            />
                            <Box>
                              <Typography variant="subtitle2">
                                マイカード
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                使用中のカードを管理
                              </Typography>
                            </Box>
                          </Box>
                          <IconButton size="small">
                            <ExpandMore />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>

                    <Card variant="outlined">
                      <CardContent sx={{ py: 2 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Analytics
                              sx={{ mr: 2, color: "text.secondary" }}
                            />
                            <Box>
                              <Typography variant="subtitle2">
                                データベース情報
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                v1.0 • 最終更新: 2024-08-23
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Stack>
                ) : (
                  <Typography variant="body1">
                    設定項目をここに追加予定
                  </Typography>
                )}
              </CardContent>
            </Card>
          </div>
        </Slide>
      </Container>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Paper
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            borderRadius: "20px 20px 0 0",
          }}
          elevation={8}
        >
          <BottomNavigation
            value={currentView}
            onChange={(event, newValue) => setCurrentView(newValue)}
            sx={{
              borderRadius: "20px 20px 0 0",
              "& .MuiBottomNavigationAction-root": {
                minWidth: 80,
                "&.Mui-selected": {
                  color: theme.palette.primary.main,
                },
              },
            }}
          >
            <BottomNavigationAction label="ホーム" icon={<Home />} />
            <BottomNavigationAction label="分析" icon={<Assessment />} />
            <BottomNavigationAction label="設定" icon={<Settings />} />
          </BottomNavigation>
        </Paper>
      )}

      {/* Floating Action Button for Mobile */}
      {isMobile && currentView === 0 && (
        <Fab
          color="primary"
          aria-label="add transaction"
          sx={{
            position: "fixed",
            bottom: 100,
            right: 16,
            zIndex: 1001,
          }}
          onClick={handleGmailConnect}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : <Email />}
        </Fab>
      )}

      {/* Desktop Ad Banner */}
      {!isMobile && <AdBanner placementId="main_banner" />}

      {/* オンボーディングウィザード */}
      <OnboardingWizard
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        onClose={handleOnboardingClose}
      />

{/* コメントアウト: カード設定ダイアログ */}
      {/*
      <CardBillingSettingsDialog
        open={showCardSettings}
        onClose={() => setShowCardSettings(false)}
        onSave={() => {
          // 設定保存後の処理（必要に応じて追加）
        }}
      />
      */}
    </Box>
  );
};

export default App;
