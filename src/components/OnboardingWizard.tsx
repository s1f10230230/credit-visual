import React, { useState, useEffect } from "react";
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Email,
  CreditCard,
  AccountBalance,
  CheckCircle,
  RadioButtonUnchecked,
} from "@mui/icons-material";
import { gmailService } from "../services/gmailService";
import { featureGateService } from "../services/featureGateService";

interface OnboardingStep {
  label: string;
  description: string;
  icon: React.ReactElement;
}

const onboardingSteps: OnboardingStep[] = [
  {
    label: "Gmail連携",
    description: "メール連携でカード利用明細を自動取得しましょう",
    icon: <Email />,
  },
  {
    label: "カード選択",
    description: "お持ちのクレジットカードを選択してください",
    icon: <CreditCard />,
  },
  {
    label: "予算設定",
    description: "月間予算を設定しましょう",
    icon: <AccountBalance />,
  },
];

interface OnboardingWizardProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onComplete,
  onClose,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const popularCards = [
    {
      id: "rakuten",
      name: "楽天カード",
      benefits: ["楽天市場で3%還元", "年会費永年無料"],
    },
    {
      id: "amazon",
      name: "Amazon Prime Visa",
      benefits: ["Amazonで2%還元", "年会費無料"],
    },
    { id: "jcb", name: "JCB一般カード", benefits: ["全国対応", "年会費無料"] },
    {
      id: "visa",
      name: "VISA一般カード",
      benefits: ["国際ブランド", "年会費無料"],
    },
    {
      id: "mastercard",
      name: "Mastercard一般カード",
      benefits: ["国際ブランド", "年会費無料"],
    },
  ];

  const budgetOptions = [
    { value: 50000, label: "5万円" },
    { value: 100000, label: "10万円" },
    { value: 150000, label: "15万円" },
    { value: 200000, label: "20万円" },
    { value: 300000, label: "30万円" },
  ];

  useEffect(() => {
    if (!isOpen) {
      setActiveStep(0);
      setGmailConnected(false);
      setSelectedCards([]);
      setMonthlyBudget(0);
      setError(null);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (activeStep === onboardingSteps.length - 1) {
      completeOnboarding();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleGmailConnect = async () => {
    try {
      setLoading(true);
      setError(null);

      await gmailService.authenticate();
      setGmailConnected(true);

      // 自動で次のステップへ
      setTimeout(() => {
        setActiveStep(1);
      }, 1000);
    } catch (err) {
      setError("Gmail連携に失敗しました。再度お試しください。");
      console.error("Gmail connection failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCardToggle = (cardId: string) => {
    setSelectedCards((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleBudgetSelect = (budget: number) => {
    setMonthlyBudget(budget);
  };

  const completeOnboarding = async () => {
    try {
      setLoading(true);

      // 設定を保存
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem("selectedCards", JSON.stringify(selectedCards));
      localStorage.setItem("monthlyBudget", monthlyBudget.toString());

      // 機能制限を更新
      featureGateService.refreshFeatureGates();

      // 完了イベントを発火
      onComplete();
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      setError("設定の保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return gmailConnected;
      case 1:
        return selectedCards.length > 0;
      case 2:
        return monthlyBudget > 0;
      default:
        return false;
    }
  };

  if (!isOpen) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: "rgba(0,0,0,0.8)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 600,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            クレジット管理を始めましょう
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            align="center"
            sx={{ mb: 4 }}
          >
            3つの簡単なステップで設定が完了します
          </Typography>

          <Stepper activeStep={activeStep} orientation="vertical">
            {onboardingSteps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  StepIconComponent={() =>
                    activeStep >= index ? (
                      <CheckCircle color="primary" />
                    ) : (
                      <RadioButtonUnchecked />
                    )
                  }
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {step.icon}
                    <Typography variant="h6">{step.label}</Typography>
                  </Box>
                </StepLabel>
                <StepContent>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    {step.description}
                  </Typography>

                  {/* Step 1: Gmail連携 */}
                  {index === 0 && (
                    <Box>
                      {!gmailConnected ? (
                        <Button
                          variant="contained"
                          size="large"
                          onClick={handleGmailConnect}
                          disabled={loading}
                          startIcon={
                            loading ? <CircularProgress size={20} /> : <Email />
                          }
                          sx={{ mb: 2 }}
                        >
                          {loading ? "連携中..." : "Gmailと連携する"}
                        </Button>
                      ) : (
                        <Alert severity="success" sx={{ mb: 2 }}>
                          Gmail連携が完了しました！
                        </Alert>
                      )}

                      {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          {error}
                        </Alert>
                      )}
                    </Box>
                  )}

                  {/* Step 2: カード選択 */}
                  {index === 1 && (
                    <Box>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        利用中のカードを選択してください（複数選択可）
                      </Typography>

                      <List>
                        {popularCards.map((card) => (
                          <ListItem
                            key={card.id}
                            button
                            onClick={() => handleCardToggle(card.id)}
                            selected={selectedCards.includes(card.id)}
                            sx={{
                              border: "1px solid",
                              borderColor: selectedCards.includes(card.id)
                                ? "primary.main"
                                : "grey.300",
                              borderRadius: 1,
                              mb: 1,
                            }}
                          >
                            <ListItemIcon>
                              {selectedCards.includes(card.id) ? (
                                <CheckCircle color="primary" />
                              ) : (
                                <RadioButtonUnchecked />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={card.name}
                              secondary={
                                <Box sx={{ mt: 1 }}>
                                  {card.benefits.map((benefit, idx) => (
                                    <Chip
                                      key={idx}
                                      label={benefit}
                                      size="small"
                                      variant="outlined"
                                      sx={{ mr: 0.5, mb: 0.5 }}
                                    />
                                  ))}
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  {/* Step 3: 予算設定 */}
                  {index === 2 && (
                    <Box>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        月間の支出予算を設定してください
                      </Typography>

                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {budgetOptions.map((option) => (
                          <Button
                            key={option.value}
                            variant={
                              monthlyBudget === option.value
                                ? "contained"
                                : "outlined"
                            }
                            onClick={() => handleBudgetSelect(option.value)}
                            sx={{ minWidth: 100 }}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </Box>

                      {monthlyBudget > 0 && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          月間予算: ¥{monthlyBudget.toLocaleString()}{" "}
                          を設定しました
                        </Alert>
                      )}
                    </Box>
                  )}

                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      disabled={!canProceed() || loading}
                      sx={{ mr: 1 }}
                    >
                      {activeStep === onboardingSteps.length - 1
                        ? "完了"
                        : "次へ"}
                    </Button>
                    <Button
                      disabled={activeStep === 0}
                      onClick={handleBack}
                      sx={{ mr: 1 }}
                    >
                      戻る
                    </Button>
                    <Button onClick={onClose}>スキップ</Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>
    </Box>
  );
};

export default OnboardingWizard;
