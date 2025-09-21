"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanGate } from "../../components/PlanGate";
import { UpgradeModal } from "../../components/UpgradeModal";
import { usePlan } from "../../context/PlanContext";
import { useAuth } from "../../context/AuthContext";
import { fetchWithPlan, getApiBase } from "../../lib/api";

const SAMPLE_EMAILS = `From: card@example.com\nSubject: カードご利用のお知らせ\n\nご利用先：Netflix\nご利用金額 1,320 円\nご利用日 2024/03/01\n---\nFrom: card@example.com\nSubject: カードご利用のお知らせ\n\nご利用先：Spotify\nご利用金額 980 円\nご利用日 2024/03/02`;

type RawImportResponse = {
  items: Array<{
    merchant: string;
    amount_cents: number;
    purchased_at: string;
  }>;
  meta: { locked_count: number; truncated: boolean };
};

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { plan } = usePlan();
  const { setHasData, isAuthenticated } = useAuth();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RawImportResponse | null>(null);
  const [isAnalyzing, setAnalyzing] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [retention, setRetention] = useState<boolean | null>(null);
  const [isUpgradeOpen, setUpgradeOpen] = useState(false);

  // Redirect to dashboard if user is authenticated (unless explicitly staying)
  useEffect(() => {
    const keepOnDemo = searchParams.get('keep') === 'true';
    if (isAuthenticated && !keepOnDemo) {
      router.push("/dashboard?tour=1");
      return;
    }
  }, [isAuthenticated, router, searchParams]);

  useEffect(() => {
    setUploadMessage(null);
    setUploadError(null);
    setResults(null);
    if (plan === "free") {
      setRetention(null);
      return;
    }
    fetchWithPlan<{ store_raw_messages: boolean }>("/api/settings/retention", plan)
      .then((data) => setRetention(data.store_raw_messages))
      .catch(() => setRetention(null));
  }, [plan]);

  const handleAnalyze = async () => {
    setError(null);
    setAnalyzing(true);
    try {
      // Call the actual API endpoint
      const response = await fetch("/api/import/raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: raw.split("\n---\n") }),
      });
      
      if (!response.ok) {
        throw new Error("解析に失敗しました");
      }
      
      const payload = await response.json();
      setResults(payload);
      
      // Update auth context to indicate user has data
      setHasData(true);
      
      // Store demo usage for middleware
      if (typeof window !== "undefined") {
        window.localStorage.setItem("subscan-demo-used", "true");
      }
    } catch (err) {
      setError((err as Error).message);
      setResults(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
    setUploadMessage(null);
    setUploadError(null);
  };

  const handleFileUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setUploadError("ファイルを選択してください");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach((file) => formData.append("files", file));
      const summary = await fetchWithPlan<{
        processed: number;
        transactions_created: number;
        duplicates: number;
        errors: string[];
      }>("/api/import/eml", plan, {
        method: "POST",
        body: formData,
      });
      setUploadMessage(
        `処理:${summary.processed}件 / 登録:${summary.transactions_created}件 / 重複:${summary.duplicates}件`
      );
      if (summary.errors?.length) {
        setUploadError(summary.errors.join("; "));
      }
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleRetention = async () => {
    if (plan === "free" || retention === null) {
      return;
    }
    try {
      const next = !retention;
      const response = await fetchWithPlan<{ store_raw_messages: boolean }>(
        "/api/settings/retention",
        plan,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store_raw_messages: next }),
        }
      );
      setRetention(response.store_raw_messages);
    } catch (err) {
      setUploadError((err as Error).message);
    }
  };

  const lockedCount = results?.meta.locked_count ?? 0;
  const visibleCount = results?.items.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <UpgradeModal open={isUpgradeOpen} onClose={() => setUpgradeOpen(false)} />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/20 via-primary/10 to-background py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-positive/10 border border-positive/20 text-positive text-sm font-medium mb-6">
              🎯 隠れたサブスクを発見
            </div>
            
            <h1 className="text-3xl sm:text-5xl font-bold text-text mb-6">
              メール明細を<span className="text-primary">貼り付けるだけ</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted mb-8 max-w-3xl mx-auto">
              クレジットカードのメール明細をコピー&ペーストするだけで、忘れがちなサブスクリプションを自動で発見。<br />
              <span className="text-primary font-semibold">完全無料で今すぐ体験できます</span>
            </p>
          </div>
        </div>
      </section>

      {/* Main Demo Section */}
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            
            {/* Step by Step Guide */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg mb-4 mx-auto">1</div>
                <h3 className="text-heading-sm text-text mb-2">メールをコピー</h3>
                <p className="text-body text-muted">クレジットカードの利用明細メールを開いて、本文をコピー</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg mb-4 mx-auto">2</div>
                <h3 className="text-heading-sm text-text mb-2">下に貼り付け</h3>
                <p className="text-body text-muted">コピーしたメール本文を下のボックスに貼り付け</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg mb-4 mx-auto">3</div>
                <h3 className="text-heading-sm text-text mb-2">結果を確認</h3>
                <p className="text-body text-muted">AIが自動でサブスクリプションを検出・分析</p>
              </div>
            </div>

            {/* Demo Input Area */}
            <div className="card p-6 sm:p-8 mb-8">
              <div className="text-center mb-6">
                <h2 className="text-heading-md text-text mb-3">📧 メール明細を貼り付けてください</h2>
                <p className="text-body-lg text-muted">
                  Netflix、Spotify、Adobe等のサブスクが含まれたメールをお試しください<br/>
                  複数通ある場合は「---」で区切って貼り付けできます
                </p>
              </div>
              
              <textarea
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                rows={10}
                className="w-full p-4 border border-line rounded-lg bg-input text-text font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="例：
From: card@rakuten.co.jp
件名: 【楽天カード】ご利用のお知らせ

ご利用先：Netflix
ご利用金額：1,320円
ご利用日：2024/03/01

---

From: card@rakuten.co.jp  
件名: 【楽天カード】ご利用のお知らせ

ご利用先：Spotify
ご利用金額：980円
ご利用日：2024/03/02"
              />
              
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <button 
                  onClick={handleAnalyze} 
                  disabled={isAnalyzing || !raw.trim()}
                  className="btn btn-primary text-lg px-8 py-3 flex-1 sm:flex-none disabled:opacity-50"
                >
                  {isAnalyzing ? "🔍 解析中..." : "🚀 サブスクを発見する"}
                </button>
                <button 
                  onClick={() => setRaw(SAMPLE_EMAILS)}
                  className="btn btn-outline px-6 py-3"
                >
                  📋 サンプルを試す
                </button>
              </div>
              
              {error && (
                <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <span className="text-destructive text-sm">❌ {error}</span>
                </div>
              )}
              
              <div className="mt-4 p-4 bg-positive/10 border border-positive/20 rounded-lg">
                <p className="text-positive text-sm">
                  🔒 <strong>プライバシー保護：</strong>入力されたメール内容は解析後に自動削除され、当社では保存されません
                </p>
              </div>
            </div>

            {/* Results Section */}
            {results ? (
              <div className="card p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-heading-md text-text">🎯 発見されたサブスクリプション</h3>
                  <div className="text-sm text-muted">
                    {visibleCount} 件検出
                    {lockedCount > 0 && (
                      <span className="ml-2 px-2 py-1 bg-primary/10 text-primary rounded">
                        +{lockedCount} 件は有料プランで表示
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid gap-4">
                  {results.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-card border border-line rounded-lg hover:border-primary/50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <span className="text-primary font-semibold">
                            {item.merchant.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-body-lg text-text font-semibold">{item.merchant}</h4>
                          <p className="text-body text-muted">
                            {new Date(item.purchased_at).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-heading-sm text-text font-bold">
                          ¥{(item.amount_cents / 100).toLocaleString()}
                        </div>
                        <div className="text-sm text-positive">月額サブスク</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Summary */}
                <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-body-lg text-text font-semibold">合計月額</span>
                    <span className="text-heading-md text-primary font-bold">
                      ¥{(results.items.reduce((sum, item) => sum + item.amount_cents, 0) / 100).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted mt-2">
                    年間では約¥{Math.round(results.items.reduce((sum, item) => sum + item.amount_cents, 0) / 100 * 12).toLocaleString()}の支出になります
                  </p>
                </div>

                {/* Next Steps */}
                <div className="mt-6 text-center">
                  <p className="text-body-lg text-muted mb-4">
                    さらに詳しい分析や自動監視をご希望ですか？
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button className="btn btn-primary px-6 py-3">
                      🚀 無料アカウント作成
                    </button>
                    <button className="btn btn-outline px-6 py-3">
                      📊 Proプランを見る
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              !isAnalyzing && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-heading-sm text-text mb-2">結果がここに表示されます</h3>
                  <p className="text-body text-muted">
                    上のボックスにメール本文を貼り付けて「サブスクを発見する」をクリックしてください
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Advanced Features Section */}
      <section className="py-12 sm:py-16 bg-card/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">
                さらに便利な機能
              </h2>
              <p className="text-body-lg text-muted">
                Lite・Proプランでは、より高度な分析機能をご利用いただけます
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* File Import */}
              <div className="card p-6">
                <div className="text-4xl mb-4 text-center">📁</div>
                <h3 className="text-heading-sm text-text mb-3 text-center">ファイル一括アップロード</h3>
                <p className="text-body text-muted mb-6 text-center">
                  .emlファイルや.csvファイルを一括でアップロードして、大量のメールを一度に解析
                </p>
                <PlanGate allowed={["lite", "pro"]} onUpgradeClick={() => setUpgradeOpen(true)}>
                  <div className="border-2 border-dashed border-line rounded-lg p-4 text-center">
                    <input 
                      type="file" 
                      multiple 
                      accept=".eml,.mbox,.csv" 
                      onChange={handleFileChange}
                      className="mb-3"
                    />
                    <button 
                      onClick={handleFileUpload} 
                      disabled={isUploading}
                      className="btn btn-primary w-full"
                    >
                      {isUploading ? "解析中..." : "📁 ファイルをアップロード"}
                    </button>
                    {uploadMessage && (
                      <div className="mt-3 text-positive text-sm">{uploadMessage}</div>
                    )}
                    {uploadError && (
                      <div className="mt-3 text-destructive text-sm">{uploadError}</div>
                    )}
                  </div>
                </PlanGate>
              </div>

              {/* Data Export */}
              <div className="card p-6">
                <div className="text-4xl mb-4 text-center">📊</div>
                <h3 className="text-heading-sm text-text mb-3 text-center">データエクスポート</h3>
                <p className="text-body text-muted mb-6 text-center">
                  解析結果をCSVやJSONファイルでダウンロードして、詳細分析が可能
                </p>
                <PlanGate allowed={["lite", "pro"]} onUpgradeClick={() => setUpgradeOpen(true)}>
                  <div className="space-y-3">
                    <a href={`${getApiBase()}/api/export/csv`} target="_blank" rel="noreferrer" className="block">
                      <button className="btn btn-outline w-full">📋 CSV ダウンロード</button>
                    </a>
                    <a href={`${getApiBase()}/api/export/json`} target="_blank" rel="noreferrer" className="block">
                      <button className="btn btn-outline w-full">🔗 JSON データ表示</button>
                    </a>
                  </div>
                </PlanGate>
              </div>

              {/* Privacy Settings */}
              <div className="card p-6">
                <div className="text-4xl mb-4 text-center">🔒</div>
                <h3 className="text-heading-sm text-text mb-3 text-center">プライバシー設定</h3>
                <p className="text-body text-muted mb-6 text-center">
                  原文メールの保存設定をコントロールして、データの管理を自由に調整
                </p>
                <PlanGate allowed={["lite", "pro"]} onUpgradeClick={() => setUpgradeOpen(true)}>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="text-center">
                      <p className="text-sm text-muted mb-2">原文メールの保存</p>
                      <button 
                        disabled={retention === null} 
                        onClick={handleToggleRetention}
                        className="btn btn-outline text-sm px-4 py-2"
                      >
                        {retention ? "ON → OFF" : "OFF → ON"}
                      </button>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-muted">
                        現在: {retention === null ? "取得中..." : retention ? "保存する" : "保存しない"}
                      </span>
                    </div>
                  </div>
                </PlanGate>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}