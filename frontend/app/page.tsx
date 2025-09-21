"use client";

import Link from "next/link";
import { useState } from "react";

export default function LandingPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const faqs = [
    {
      q: "無料でどこまで使えますか？",
      a: "無料プランでは最大10通のメール解析が可能です。基本的なサブスクリプション検出と月次サマリーをご利用いただけます。"
    },
    {
      q: "データの安全性は大丈夫ですか？",
      a: "すべてのデータは暗号化され、金融グレードのセキュリティ基準を満たしています。無料プランでは解析後に原文は即座に削除されます。"
    },
    {
      q: "どのくらい節約できますか？",
      a: "ユーザー平均で月3,000円の無駄なサブスクを発見しています。年間で36,000円の節約効果が期待できます。"
    },
    {
      q: "いつでもキャンセルできますか？",
      a: "はい、いつでもキャンセル可能です。キャンセル料は一切かかりません。"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-background">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Announcement Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
              🎉 月平均3,000円の節約を実現
            </div>
            
            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl font-bold text-text mb-6">
              <span className="text-primary">隠れたサブスク</span>を
              <br />
              1分で発見
            </h1>
            
            {/* Subheadline */}
            <p className="text-xl sm:text-2xl text-muted mb-8 max-w-3xl mx-auto">
              クレジットカードの明細から、忘れがちなサブスクリプションを自動検出。
              <span className="text-primary font-semibold">無料で今すぐ体験</span>
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/auth" className="btn btn-primary text-lg px-8 py-4 shadow-lg hover:shadow-xl transition-all">
                🚀 無料体験で始める
              </Link>
              <Link href="#pricing" className="btn btn-outline text-lg px-8 py-4">
                料金を見る
              </Link>
            </div>
            
            {/* Social Proof */}
            <div className="text-muted text-sm">
              ✨ すでに1,000人以上が利用中 / 平均節約額 ¥3,000/月
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">
              なぜSubscanなのか？
            </h2>
            <p className="text-body-lg text-muted max-w-2xl mx-auto">
              複雑な設定不要。メールを貼り付けるだけで、忘れがちなサブスクを即座に可視化
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="card p-8 text-center hover:scale-105 transition-transform">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-heading-sm text-text mb-4">1分で完了</h3>
              <p className="text-body text-muted">
                メール明細をコピペするだけ。複雑な設定や連携は不要です。
              </p>
            </div>
            
            <div className="card p-8 text-center hover:scale-105 transition-transform">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-heading-sm text-text mb-4">AI自動検出</h3>
              <p className="text-body text-muted">
                高精度のAIが自動でサブスクを判定。手動チェックの手間を削減。
              </p>
            </div>
            
            <div className="card p-8 text-center hover:scale-105 transition-transform">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-heading-sm text-text mb-4">節約提案</h3>
              <p className="text-body text-muted">
                使用頻度と金額を分析し、具体的な節約機会をお知らせ。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 bg-card/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">
              料金プラン
            </h2>
            <p className="text-body-lg text-muted">
              まずは無料で体験。必要に応じてアップグレード
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="pricing-card-free p-8 hover:scale-105 transition-all">
              <div className="text-center mb-6">
                <div className="inline-flex items-center px-3 py-1 rounded-full" style={{backgroundColor: '#374151', color: '#d1d5db'}}>
                  ベーシック
                </div>
                <h3 style={{color: 'white', fontWeight: 'bold', fontSize: '1.5rem', margin: '1rem 0 0.5rem 0'}}>Free</h3>
                <div className="price" style={{color: 'white', fontWeight: 'bold', fontSize: '2.5rem', margin: '0.5rem 0'}}>¥0</div>
                <p style={{color: '#9ca3af'}}>無料でお試し</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">10通まで解析</span>
                </li>
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">基本分析レポート</span>
                </li>
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">サブスク検出</span>
                </li>
                <li className="flex items-center">
                  <span className="cross-icon mr-3">✗</span>
                  <span className="feature-disabled">無制限解析</span>
                </li>
                <li className="flex items-center">
                  <span className="cross-icon mr-3">✗</span>
                  <span className="feature-disabled">詳細レポート</span>
                </li>
              </ul>
              <Link href="/auth" className="btn w-full" style={{border: '1px solid white', color: 'white', backgroundColor: 'transparent', padding: '0.75rem 1rem', borderRadius: '0.5rem', textAlign: 'center', display: 'block', textDecoration: 'none'}}>
                無料で始める
              </Link>
            </div>
            
            {/* Lite Plan */}
            <div className="pricing-card-lite p-8 hover:scale-105 transition-all relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div style={{background: 'linear-gradient(to right, #3b82f6, #2563eb)', color: 'white', padding: '0.25rem 1rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}>
                  人気No.1 おすすめ
                </div>
              </div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center px-3 py-1 rounded-full" style={{backgroundColor: '#2563eb', color: 'white'}}>
                  本格運用
                </div>
                <h3 style={{color: 'white', fontWeight: 'bold', fontSize: '1.5rem', margin: '1rem 0 0.5rem 0'}}>Lite</h3>
                <div className="price" style={{color: '#93c5fd', fontWeight: 'bold', fontSize: '2.5rem', margin: '0.5rem 0'}}>¥490</div>
                <p style={{color: '#bfdbfe'}}>月額・詳細分析</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">無制限解析</span>
                </li>
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">詳細レポート</span>
                </li>
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">CSV/JSONエクスポート</span>
                </li>
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">12ヶ月履歴</span>
                </li>
                <li className="flex items-center">
                  <span style={{color: '#60a5fa'}} className="mr-3">✗</span>
                  <span className="feature-disabled">Gmail自動連携</span>
                </li>
              </ul>
              <Link href="/auth" className="btn w-full" style={{backgroundColor: '#3b82f6', color: 'white', padding: '0.75rem 1rem', borderRadius: '0.5rem', textAlign: 'center', display: 'block', textDecoration: 'none', fontWeight: 'bold', border: 'none'}}>
                Liteを試す
              </Link>
            </div>
            
            {/* Pro Plan */}
            <div className="pricing-card-pro p-8 hover:scale-105 transition-all">
              <div className="text-center mb-6">
                <div className="inline-flex items-center px-3 py-1 rounded-full" style={{backgroundColor: '#7c3aed', color: 'white'}}>
                  完全自動化
                </div>
                <h3 style={{color: 'white', fontWeight: 'bold', fontSize: '1.5rem', margin: '1rem 0 0.5rem 0'}}>Pro</h3>
                <div className="price" style={{color: '#c4b5fd', fontWeight: 'bold', fontSize: '2.5rem', margin: '0.5rem 0'}}>¥990</div>
                <p style={{color: '#ddd6fe'}}>月額・全機能</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">Gmail自動連携</span>
                </li>
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">リアルタイム通知</span>
                </li>
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">高度フィルター</span>
                </li>
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">優先サポート</span>
                </li>
                <li className="flex items-center">
                  <span className="check-icon mr-3">✓</span>
                  <span className="feature">すべてのLite機能</span>
                </li>
              </ul>
              <Link href="/auth" className="btn w-full" style={{backgroundColor: '#8b5cf6', color: 'white', padding: '0.75rem 1rem', borderRadius: '0.5rem', textAlign: 'center', display: 'block', textDecoration: 'none', fontWeight: 'bold', border: 'none'}}>
                Proを試す
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">
              よくある質問
            </h2>
          </div>
          
          <div className="max-w-3xl mx-auto">
            {faqs.map((faq, index) => (
              <div key={index} className="card p-6 mb-4">
                <button
                  className="flex justify-between items-center w-full text-left"
                  onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                >
                  <h3 className="text-body-lg text-text font-semibold">{faq.q}</h3>
                  <span className="text-primary text-xl">
                    {faqOpen === index ? '−' : '+'}
                  </span>
                </button>
                {faqOpen === index && (
                  <div className="mt-4 text-body text-muted">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">
            今すぐ無料で体験
          </h2>
          <p className="text-body-lg text-muted mb-8 max-w-2xl mx-auto">
            たった1分で、あなたの隠れたサブスクリプションを発見しませんか？
          </p>
          <Link href="/auth" className="btn btn-primary text-lg px-8 py-4 shadow-lg hover:shadow-xl transition-all">
            🚀 無料体験を始める
          </Link>
        </div>
      </section>
    </div>
  );
}