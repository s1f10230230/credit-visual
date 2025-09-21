"use client";

import { useEffect, useState } from "react";
import { PlanGate } from "../../components/PlanGate";
import { UpgradeModal } from "../../components/UpgradeModal";
import { OnboardingTour } from "../../components/OnboardingTour";
import { usePlan } from "../../context/PlanContext";
import { useAuth } from "../../context/AuthContext";
import { fetchWithPlan, getApiBase } from "../../lib/api";
import { analytics } from "../../lib/analytics";
import { NoCardsEmptyState, LoadingEmptyState } from "../../components/EmptyState";
import { ErrorState, NetworkErrorState } from "../../components/ErrorState";
import Link from "next/link";

// Type definitions
interface DashboardCard {
  card_label: string;
  total_cents: number;
  confirmed_cents: number;
  pending_cents: number;
  transaction_count: number;
}

interface ListMeta {
  locked_count: number;
  truncated: boolean;
}

interface CardSummaryItem {
  instrument_key: string;
  issuer: string;
  label: string;
  card_last4?: string | null;
  token_last4?: string | null;
  wallet_type?: string | null;
  total_amount_cents: number;
  transaction_count: number;
  subscription_count: number;
  top_merchants: Array<{
    name: string;
    amount_cents: number;
    transaction_count: number;
  }>;
}

interface CardSummaryResponse {
  items: CardSummaryItem[];
  meta: ListMeta;
}

interface CardTransactionsResponse {
  items: CardTransaction[];
  meta: ListMeta;
  total: number;
}

interface CardTransaction {
  id: string;
  merchant: string;
  amount_cents: number;
  currency: string;
  purchased_at: string;
  status: string;
  issuer?: string | null;
  merchant_norm?: string | null;
}

interface DashboardSummary {
  month: string;
  total_amount_cents: number;
  cards: DashboardCard[];
  meta?: ListMeta | null;
}

interface TransactionItem {
  id: string;
  merchant_raw: string;
  merchant_norm?: string | null;
  amount_cents: number;
  currency: string;
  purchased_at: string;
  status: string;
  issuer?: string | null;
}

interface TransactionMetadata {
  total_amount_cents?: number;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  metadata?: TransactionMetadata;
  meta: ListMeta;
}

// Utility functions
function formatCurrency(cents: number): string {
  return `¥${cents.toLocaleString()}`;
}

// Components
function HeroSection({ summary }: { summary: DashboardSummary | null }) {
  if (!summary) {
    return (
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl lg:rounded-3xl p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8">
        <div className="animate-pulse">
          <div className="h-6 sm:h-8 bg-line rounded-lg w-36 sm:w-48 mb-3 sm:mb-4"></div>
          <div className="h-12 sm:h-16 bg-line rounded-lg w-48 sm:w-64"></div>
        </div>
      </div>
    );
  }

  const totalSubscriptions = summary.cards.reduce((sum, card) => sum + card.transaction_count, 0);

  return (
    <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl lg:rounded-3xl p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8 stagger-item">
      <div className="max-w-4xl">
        <h1 className="text-lg sm:text-xl lg:text-heading-lg text-text mb-2 sm:mb-3">
          {summary.month} のサブスクリプション
        </h1>
        <div className="text-3xl sm:text-4xl lg:text-6xl font-bold text-primary mb-4 sm:mb-6 break-words">
          {formatCurrency(summary.total_amount_cents)}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 text-muted">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-positive rounded-full"></div>
            <span className="text-sm sm:text-body">{totalSubscriptions} 件のサブスクリプション</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-warn rounded-full"></div>
            <span className="text-sm sm:text-body">{summary.cards.length} 枚のカード</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SavingsOpportunityCard() {
  const savingsOpportunities = [
    { name: "Netflix", amount: 1490, reason: "3ヶ月未使用", severity: "high" },
    { name: "Adobe Creative Cloud", amount: 5680, reason: "代替案あり", severity: "medium" },
    { name: "Spotify Premium", amount: 980, reason: "家族プランが安い", severity: "low" },
  ];

  return (
    <div className="card p-4 sm:p-6 mb-6 lg:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-heading-md text-text">💡 節約のチャンス</h2>
        <span className="text-sm sm:text-body text-positive font-medium">月最大 ¥8,150 削減可能</span>
      </div>
      
      <div className="space-y-3 sm:space-y-4">
        {savingsOpportunities.map((opportunity, index) => (
          <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card border border-line hover:border-warn/50 transition-colors cursor-pointer">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                opportunity.severity === 'high' ? 'bg-destructive' :
                opportunity.severity === 'medium' ? 'bg-warn' : 'bg-positive'
              }`}></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm sm:text-body-lg text-text font-medium">{opportunity.name}</div>
                <div className="text-xs sm:text-body text-muted">{opportunity.reason}</div>
              </div>
            </div>
            <div className="flex flex-row sm:flex-col sm:text-right justify-between sm:justify-start items-center sm:items-end">
              <div className="text-sm sm:text-body-lg text-text font-semibold">{formatCurrency(opportunity.amount)}</div>
              <button className="text-xs sm:text-body text-primary hover:text-primary/80 transition-colors">
                詳細を見る
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSummaryTable({ cardSummaries, cardMeta, onCardClick }: {
  cardSummaries: CardSummaryItem[];
  cardMeta: ListMeta | null;
  onCardClick: (card: CardSummaryItem, subsOnly: boolean) => void;
}) {
  if (cardSummaries.length === 0) {
    return (
      <NoCardsEmptyState 
        onImport={() => {
          analytics.trackImportStart('manual');
          // TODO: Open import modal/flow
        }}
      />
    );
  }

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-heading-md text-text">カード別内訳</h2>
        <span className="text-sm sm:text-body text-muted">{cardSummaries.length} 枚のカード</span>
      </div>
      
      <div className="space-y-3 sm:space-y-4">
        {cardSummaries.map((card, index) => (
          <div 
            key={card.instrument_key} 
            className="p-3 sm:p-4 lg:p-5 rounded-xl bg-card border border-line hover:border-primary/50 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg stagger-item"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
              <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                <div className="w-10 h-7 sm:w-12 sm:h-8 bg-gradient-to-r from-primary to-primary/60 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-white font-bold">
                    {card.card_last4 || card.token_last4 || '****'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm sm:text-body-lg text-text font-semibold truncate">{card.label}</div>
                  <div className="text-xs sm:text-body text-muted truncate">{card.issuer}</div>
                </div>
              </div>
              <div className="flex justify-between sm:block sm:text-right">
                <div className="text-base sm:text-heading-sm text-text font-semibold">{formatCurrency(card.total_amount_cents)}</div>
                <div className="text-xs sm:text-body text-muted">{card.transaction_count} 件</div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-warn rounded-full"></div>
                  <span className="text-xs sm:text-body text-muted">{card.subscription_count} サブスク</span>
                </div>
                {card.top_merchants.length > 0 && (
                  <div className="text-xs sm:text-body text-muted truncate">
                    主要: {card.top_merchants[0].name}
                  </div>
                )}
              </div>
              <div className="flex space-x-2 justify-end sm:justify-start">
                <button
                  onClick={() => onCardClick(card, false)}
                  className="btn btn-outline text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  詳細
                </button>
                <button
                  onClick={() => onCardClick(card, true)}
                  className="btn btn-primary text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  サブスク管理
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {cardMeta?.truncated && (
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl bg-warn/10 border border-warn/20">
          <div className="text-xs sm:text-body text-warn">
            残り {cardMeta.locked_count} 件は Lite/Pro で表示されます。
          </div>
        </div>
      )}
    </div>
  );
}

function CardDetailModal({ 
  selectedCard, 
  cardTransactions, 
  cardLoading, 
  cardSubsOnly, 
  onClose 
}: {
  selectedCard: CardSummaryItem | null;
  cardTransactions: CardTransactionsResponse | null;
  cardLoading: boolean;
  cardSubsOnly: boolean;
  onClose: () => void;
}) {
  if (!selectedCard) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="card p-4 sm:p-6 w-full max-w-sm sm:max-w-2xl lg:max-w-4xl max-h-[90vh] sm:max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg lg:text-heading-md text-text leading-tight">
            {selectedCard.label}<br className="sm:hidden" />
            <span className="text-sm sm:text-base text-muted"> - {cardSubsOnly ? "サブスク取引" : "全取引"}</span>
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-line hover:bg-muted/20 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <span className="text-text">✕</span>
          </button>
        </div>

        {cardLoading && (
          <div className="text-center py-6 sm:py-8">
            <div className="text-sm sm:text-body text-muted">読み込み中...</div>
          </div>
        )}

        {cardTransactions && (
          <div>
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/20">
              <div className="text-sm sm:text-body text-text flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span>合計: {formatCurrency(cardTransactions.items.reduce((sum, tx) => sum + tx.amount_cents, 0))}</span>
                <span className="hidden sm:inline"> / </span>
                <span>件数: {cardTransactions.total}</span>
              </div>
            </div>
            
            {selectedCard.top_merchants.length > 0 && (
              <div className="mb-4 sm:mb-6">
                <h4 className="text-base sm:text-heading-sm text-text mb-3 sm:mb-4">主要加盟店</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {selectedCard.top_merchants.map((merchant, idx) => (
                    <div key={idx} className="p-3 sm:p-4 rounded-xl bg-card border border-line">
                      <div className="text-sm sm:text-body-lg text-text font-medium truncate">{merchant.name}</div>
                      <div className="text-xs sm:text-body text-muted">
                        {formatCurrency(merchant.amount_cents)} ({merchant.transaction_count}件)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 sm:space-y-3">
              {cardTransactions.items.map((tx) => (
                <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card border border-line">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm sm:text-body-lg text-text font-medium truncate">{tx.merchant}</div>
                    <div className="text-xs sm:text-body text-muted">
                      {new Date(tx.purchased_at).toLocaleDateString("ja-JP")} • {tx.status}
                    </div>
                  </div>
                  <div className="text-sm sm:text-body-lg text-text font-semibold self-end sm:self-auto">
                    {formatCurrency(tx.amount_cents)}
                  </div>
                </div>
              ))}
            </div>

            {cardTransactions.meta.truncated && (
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl bg-warn/10 border border-warn/20">
                <div className="text-xs sm:text-body text-warn">
                  残り {cardTransactions.meta.locked_count} 件は Lite/Pro で表示されます。
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Main Dashboard Component
export default function DashboardPage() {
  const { plan } = usePlan();
  const { isAuthenticated, hasData, updateDataState } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [transactions, setTransactions] = useState<PaginatedResponse<TransactionItem> | null>(null);
  const [cardSummaries, setCardSummaries] = useState<CardSummaryItem[]>([]);
  const [cardMeta, setCardMeta] = useState<ListMeta | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardSummaryItem | null>(null);
  const [cardTransactions, setCardTransactions] = useState<CardTransactionsResponse | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardSubsOnly, setCardSubsOnly] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isUpgradeOpen, setUpgradeOpen] = useState(false);
  const [monthString] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const handleOpenCardDetail = async (card: CardSummaryItem, subsOnly: boolean) => {
    // Track card detail view
    analytics.trackCardDetailView(card.label, subsOnly);
    
    setSelectedCard(card);
    setCardSubsOnly(subsOnly);
    setCardLoading(true);
    setCardTransactions(null);
    try {
      const encodedKey = encodeURIComponent(card.instrument_key);
      const response = await fetchWithPlan<CardTransactionsResponse>(
        `/api/cards/${encodedKey}/transactions?month=${monthString}&only_subs=${subsOnly}`,
        plan
      );
      setCardTransactions(response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCardLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [summaryRes, txRes, cardRes] = await Promise.all([
          fetchWithPlan<DashboardSummary>(`/api/dashboard/summary?month=${monthString}` as string, plan, {
            signal: controller.signal,
          }),
          fetchWithPlan<PaginatedResponse<TransactionItem>>(`/api/transactions?month=${monthString}`, plan, {
            signal: controller.signal,
          }),
          fetchWithPlan<CardSummaryResponse>(`/api/cards/summary?month=${monthString}`, plan, {
            signal: controller.signal,
          }),
        ]);
        setSummary(summaryRes);
        setTransactions(txRes);
        setCardSummaries(cardRes.items);
        setCardMeta(cardRes.meta);
        
        // Track dashboard view
        analytics.trackDashboardView(
          cardRes.items.length, 
          summaryRes.total_amount_cents
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [plan, monthString]);

  // Auth and data state checking
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-6">🔐</div>
          <h1 className="text-heading-lg text-text mb-4">ログインが必要です</h1>
          <p className="text-body-lg text-muted mb-8">
            ダッシュボードを利用するにはログインしてください
          </p>
          <Link href="/" className="btn btn-primary text-lg px-8 py-4">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!hasData && !isLoading && cardSummaries.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-6">📊</div>
          <h1 className="text-heading-lg text-text mb-4">データがありません</h1>
          <p className="text-body-lg text-muted mb-8">
            まずはメールデータをインポートして、サブスクリプションを分析しましょう
          </p>
          <div className="space-y-4">
            <Link href="/demo" className="btn btn-primary text-lg px-8 py-4 w-full">
              📋 メールを貼り付けて開始
            </Link>
            <Link href="/welcome" className="btn btn-outline px-6 py-3 w-full">
              ← オンボーディングに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <UpgradeModal open={isUpgradeOpen} onClose={() => setUpgradeOpen(false)} />
      
      {error && (
        <div className="mb-6">
          <NetworkErrorState onRetry={() => window.location.reload()} />
        </div>
      )}

      {isLoading && <LoadingEmptyState />}

      <HeroSection summary={summary} />
      
      <SavingsOpportunityCard />
      
      <CardSummaryTable 
        cardSummaries={cardSummaries} 
        cardMeta={cardMeta} 
        onCardClick={handleOpenCardDetail} 
      />

      <div className="mt-6 lg:mt-8">
        <div className="card p-4 sm:p-6">
          <h2 className="text-lg sm:text-heading-md text-text mb-4 sm:mb-6">CSV/JSON エクスポート</h2>
          <PlanGate allowed={["lite", "pro"]} onUpgradeClick={() => setUpgradeOpen(true)} feature="export">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <a href={`${getApiBase()}/api/export/csv`} target="_blank" rel="noreferrer" className="flex-1 sm:flex-none">
                <button 
                  className="btn btn-outline w-full sm:w-auto"
                  onClick={() => analytics.trackExportClick('csv', plan)}
                >
                  CSV ダウンロード
                </button>
              </a>
              <a href={`${getApiBase()}/api/export/json`} target="_blank" rel="noreferrer" className="flex-1 sm:flex-none">
                <button 
                  className="btn btn-primary w-full sm:w-auto"
                  onClick={() => analytics.trackExportClick('json', plan)}
                >
                  JSON 表示
                </button>
              </a>
            </div>
          </PlanGate>
        </div>
      </div>

      <CardDetailModal
        selectedCard={selectedCard}
        cardTransactions={cardTransactions}
        cardLoading={cardLoading}
        cardSubsOnly={cardSubsOnly}
        onClose={() => setSelectedCard(null)}
      />

      {/* Onboarding Tour */}
      <OnboardingTour 
        onComplete={() => {
          analytics.trackOnboardingComplete(plan);
        }}
        onSkip={() => {
          analytics.trackOnboardingSkip(plan);
        }}
      />
    </div>
  );
}