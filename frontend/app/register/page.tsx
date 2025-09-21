"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { analytics } from "../../lib/analytics";
import { ErrorState } from "../../components/ErrorState";
import { useAuth } from "../../context/AuthContext";
import { usePlan } from "../../context/PlanContext";

interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  plan: string;
  firstName: string;
  lastName: string;
}

interface RegisterResponse {
  access_token: string;
  token_type: string;
  plan: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

async function register(data: RegisterData): Promise<RegisterResponse> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Registration failed");
  }

  return response.json();
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    plan: "free"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const { setPlan: setUserPlan } = usePlan();

  const handleGoogleRegister = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Simulate Google OAuth flow
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock Google user registration
      authLogin("google-user@gmail.com");
      setUserPlan("free");
      
      // Track successful registration
      analytics.trackLoginSuccess("google");
      
      // Redirect to dashboard
      router.push("/dashboard?tour=1");
      
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.firstName) {
      return "必須項目を入力してください";
    }
    
    if (formData.password.length < 8) {
      return "パスワードは8文字以上で入力してください";
    }
    
    if (formData.password !== formData.confirmPassword) {
      return "パスワードが一致しません";
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return "有効なメールアドレスを入力してください";
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setLoading(true);

    // Track registration start
    analytics.trackLoginStart(formData.plan);

    try {
      const response = await register(formData);
      
      // Update auth context
      authLogin(response.user.email);
      setUserPlan(formData.plan as any);
      
      // Track successful registration
      analytics.trackLoginSuccess(formData.plan);
      
      // Redirect to dashboard with tutorial
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
          <h1 className="text-heading-lg text-text mb-4">アカウント作成</h1>
          <p className="text-body text-muted">
            Subscanアカウントを作成して、サブスクリプション管理を始めましょう
          </p>
        </div>

        {/* Main Form Card */}
        <div className="card p-6 sm:p-8 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body text-text font-medium mb-2">
                  名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  placeholder="太郎"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-body text-text font-medium mb-2">
                  苗字
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="田中"
                  className="input"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-body text-text font-medium mb-2">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="your@example.com"
                className="input"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-body text-text font-medium mb-2">
                パスワード <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="8文字以上"
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
              <p className="text-sm text-muted mt-1">
                英数字を含む8文字以上で設定してください
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-body text-text font-medium mb-2">
                パスワード確認 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="パスワードを再入力"
                  className="input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-text"
                >
                  {showConfirmPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Plan Selection */}
            <div>
              <label className="block text-body text-text font-medium mb-2">
                プラン選択
              </label>
              <select
                name="plan"
                value={formData.plan}
                onChange={handleInputChange}
                className="input"
              >
                <option value="free">Free - ¥0/月（10通まで解析）</option>
                <option value="lite">Lite - ¥490/月（無制限解析）</option>
                <option value="pro">Pro - ¥990/月（完全自動化）</option>
              </select>
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
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? "アカウント作成中..." : "アカウントを作成"}
            </button>
          </form>

          {/* Terms */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted">
              アカウント作成により、
              <Link href="/terms" className="text-primary hover:underline">利用規約</Link>
              および
              <Link href="/privacy" className="text-primary hover:underline">プライバシーポリシー</Link>
              に同意したものとみなされます。
            </p>
          </div>
        </div>

        {/* Social Login Options */}
        <div className="card p-6 mb-6">
          <div className="text-center mb-4">
            <p className="text-body text-muted">または</p>
          </div>
          
          <div className="space-y-3">
            <button
              type="button"
              className="btn btn-outline w-full flex items-center justify-center space-x-3"
              onClick={handleGoogleRegister}
              disabled={loading}
            >
              <span>🔍</span>
              <span>Googleで登録</span>
            </button>
            
            <button
              type="button"
              className="btn btn-outline w-full flex items-center justify-center space-x-3"
              onClick={() => {
                // TODO: Implement GitHub OAuth
                alert("GitHub認証は準備中です");
              }}
            >
              <span>🐙</span>
              <span>GitHubで登録</span>
            </button>
          </div>
        </div>

        {/* Navigation Card */}
        <div className="card p-6 text-center">
          <p className="text-body text-muted mb-4">
            すでにアカウントをお持ちですか？
          </p>
          <Link href="/auth" className="btn btn-outline">
            ログインページへ
          </Link>
        </div>
      </div>
    </div>
  );
}