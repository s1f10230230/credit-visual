"use client";

import { useState } from "react";
import Link from "next/link";
import { ErrorState } from "../../../components/ErrorState";

interface ResetPasswordData {
  email: string;
}

interface ResetPasswordResponse {
  message: string;
}

async function requestPasswordReset(data: ResetPasswordData): Promise<ResetPasswordResponse> {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Password reset request failed");
  }

  return response.json();
}

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await requestPasswordReset({ email });
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-md mx-auto">
          {/* Success Message */}
          <div className="card p-6 sm:p-8 text-center">
            <div className="text-6xl mb-6">📧</div>
            <h1 className="text-heading-lg text-text mb-4">メールを送信しました</h1>
            <p className="text-body text-muted mb-6">
              <strong>{email}</strong> にパスワードリセット用のリンクを送信しました。
              メールボックスをご確認ください。
            </p>
            
            <div className="space-y-4">
              <Link href="/auth" className="btn btn-primary w-full">
                ログインページに戻る
              </Link>
              
              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                }}
                className="btn btn-outline w-full"
              >
                別のメールアドレスで試す
              </button>
            </div>
          </div>

          {/* Help Card */}
          <div className="card p-6 mt-6">
            <h3 className="text-heading-sm text-text mb-3">メールが届かない場合</h3>
            <ul className="space-y-2 text-body text-muted">
              <li>• 迷惑メールフォルダをご確認ください</li>
              <li>• メールアドレスのスペルをご確認ください</li>
              <li>• 5分ほどお待ちください</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-heading-lg text-text mb-4">パスワードリセット</h1>
          <p className="text-body text-muted">
            登録されているメールアドレスを入力してください。
            パスワードリセット用のリンクをお送りします。
          </p>
        </div>

        {/* Main Form Card */}
        <div className="card p-6 sm:p-8 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-body text-text font-medium mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@example.com"
                className="input"
                autoFocus
              />
              <p className="text-sm text-muted mt-1">
                このメールアドレスでアカウントが登録されている必要があります
              </p>
            </div>

            {error && (
              <ErrorState
                message={error}
                variant="error"
                dismissible
                onDismiss={() => setError("")}
              />
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="btn btn-primary w-full"
            >
              {loading ? "送信中..." : "リセットリンクを送信"}
            </button>
          </form>
        </div>

        {/* Navigation Card */}
        <div className="card p-6 text-center">
          <p className="text-body text-muted mb-4">
            パスワードを思い出した場合は、
          </p>
          <Link href="/auth" className="btn btn-outline">
            ログインページに戻る
          </Link>
        </div>

        {/* Demo Info Card */}
        <div className="card p-6 bg-primary/5 border-primary/20 mt-6">
          <h3 className="text-heading-sm text-text mb-3">🔧 デモ用情報</h3>
          <p className="text-body text-muted">
            デモ環境では実際にメールは送信されません。
            テスト用アカウント: <strong>demo@example.com</strong> / <strong>password123</strong>
          </p>
        </div>
      </div>
    </div>
  );
}