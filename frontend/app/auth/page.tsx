"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { analytics } from "../../lib/analytics";
import { ErrorState } from "../../components/ErrorState";
import { useAuth } from "../../context/AuthContext";
import { usePlan } from "../../context/PlanContext";

interface LoginData {
  email: string;
  password?: string;
  plan?: string;
  rememberMe?: boolean;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  plan: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

async function login(data: LoginData): Promise<LoginResponse> {
  const endpoint = data.password ? "/api/auth/login" : "/api/auth/mock-login";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Login failed");
  }

  return response.json();
}

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginMode, setLoginMode] = useState<"demo" | "password">("password");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const { setPlan: setUserPlan } = usePlan();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Get Google auth URL from backend
      const response = await fetch("/api/auth/google", {
        method: "GET",
      });
      
      if (!response.ok) {
        throw new Error("Google認証の準備に失敗しました");
      }
      
      const data = await response.json();
      
      // For demo purposes, simulate successful Google login
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate auth flow
      
      // Mock Google user data
      authLogin("google-user@gmail.com");
      setUserPlan("free");
      
      // Track successful login
      analytics.trackLoginSuccess("google");
      
      // Redirect to dashboard
      router.push("/dashboard?tour=1");
      
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Track login start
    analytics.trackLoginStart(loginMode === "demo" ? plan : "password");

    try {
      if (loginMode === "demo") {
        // Demo mode - no password required
        const response = await login({ email, plan });
        authLogin(email);
        setUserPlan(plan as any);
      } else {
        // Password mode - authenticate with backend
        if (!password) {
          throw new Error("パスワードを入力してください");
        }
        const response = await login({ email, password, rememberMe });
        authLogin(response.user?.email || email);
        if (response.plan) {
          setUserPlan(response.plan as any);
        }
      }
      
      // Track successful login
      analytics.trackLoginSuccess(loginMode === "demo" ? plan : "password");
      
      // Redirect to dashboard (new flow)
      router.push("/dashboard?tour=1");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-heading-lg text-text mb-4">ログイン</h1>
          <p className="text-body text-muted">
            開発環境用のログインページです。実際のプロダクションでは本格的な認証を実装します。
          </p>
        </div>

        {/* Login Mode Toggle */}
        <div className="card p-4 mb-6">
          <div className="flex rounded-lg bg-muted/20 p-1">
            <button
              type="button"
              onClick={() => setLoginMode("password")}
              className={`flex-1 text-center py-2 px-4 rounded-md transition-all ${
                loginMode === "password" 
                  ? "bg-primary text-white shadow-sm" 
                  : "text-muted hover:text-text"
              }`}
            >
              🔐 パスワードログイン
            </button>
            <button
              type="button"
              onClick={() => setLoginMode("demo")}
              className={`flex-1 text-center py-2 px-4 rounded-md transition-all ${
                loginMode === "demo" 
                  ? "bg-primary text-white shadow-sm" 
                  : "text-muted hover:text-text"
              }`}
            >
              🔧 デモログイン
            </button>
          </div>
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
              />
            </div>

            {loginMode === "password" && (
              <div>
                <label className="block text-body text-text font-medium mb-2">
                  パスワード
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={loginMode === "password"}
                    placeholder="パスワードを入力"
                    className="input pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <Link 
                    href="/auth/reset-password" 
                    className="text-sm text-primary hover:underline"
                  >
                    パスワードを忘れた方
                  </Link>
                </div>
              </div>
            )}

            {loginMode === "demo" && (
              <div>
                <label className="block text-body text-text font-medium mb-2">
                  プラン
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="input"
                >
                  <option value="free">Free - ¥0/月</option>
                  <option value="lite">Lite - ¥490/月</option>
                  <option value="pro">Pro - ¥990/月</option>
                </select>
              </div>
            )}

            {/* Remember Me */}
            {loginMode === "password" && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-primary bg-input border-line rounded focus:ring-primary"
                />
                <label htmlFor="rememberMe" className="text-body text-text cursor-pointer">
                  ログイン状態を30日間保持する
                </label>
              </div>
            )}

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
              disabled={loading || !email || (loginMode === "password" && !password)}
              className="btn btn-primary w-full"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          {/* Social Login */}
          {loginMode === "password" && (
            <div className="mt-6">
              <div className="text-center mb-4">
                <p className="text-body text-muted">または</p>
              </div>
              
              <div className="space-y-3">
                <button
                  type="button"
                  className="btn btn-outline w-full flex items-center justify-center space-x-3"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  <span>🔍</span>
                  <span>Googleでログイン</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Card */}
        <div className="card p-6 text-center mb-6">
          <p className="text-body text-muted mb-4">
            アカウントをお持ちでない場合は、
          </p>
          <div className="space-y-3">
            <Link href="/register" className="btn btn-primary w-full">
              新規アカウント作成
            </Link>
            <Link href="/billing" className="btn btn-outline w-full">
              プラン選択ページから始める
            </Link>
          </div>
        </div>

        {/* Demo Info Card */}
        <div className="card p-6 bg-primary/5 border-primary/20">
          <h3 className="text-heading-sm text-text mb-3">🔧 デモ用情報</h3>
          <p className="text-body text-muted">
            任意のメールアドレスでログイン可能です。実際のパスワード認証は実装されていません。
          </p>
        </div>
      </div>
    </div>
  );
}