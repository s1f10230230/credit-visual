import { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UpgradeModal({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "2rem",
          borderRadius: "0.75rem",
          maxWidth: "520px",
          width: "90%",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
      >
        <h2>アップグレードでできること</h2>
        <ul style={{ lineHeight: 1.6 }}>
          <li><strong>Lite（買い切り¥500）</strong>：ファイル一括解析、CSV/JSON出力、カード×月別ダッシュボード</li>
          <li><strong>Pro（月額）</strong>：Gmail/Outlook/IMAP自動同期、無料期間終了・価格改定アラート、Sheets/Notion連携</li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          実装中のアップグレード導線では Stripe Checkout を想定しています。テスト環境ではダミーリンクをご利用ください。
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button type="button" onClick={onClose}>
            閉じる
          </button>
          <a href="https://dashboard.stripe.com/test" target="_blank" rel="noreferrer">
            <button type="button">Stripeテスト決済へ</button>
          </a>
        </div>
      </div>
    </div>
  );
}
