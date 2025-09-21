"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { PlanSwitcher } from "./PlanSwitcher";
import { UserStatusBadge } from "./UserStatusBadge";

export function NavigationBar() {
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    // Force reload to clear any cached state
    window.location.href = "/";
  };

  return (
    <header className="border-b border-line bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-heading-md font-bold text-primary">
              Subscan
            </Link>
            
            {isAuthenticated ? (
              // Authenticated navigation
              <nav className="hidden md:flex items-center space-x-6">
                <Link 
                  href="/dashboard" 
                  className="text-body text-muted hover:text-text transition-colors"
                >
                  ダッシュボード
                </Link>
                <Link 
                  href="/demo?keep=true" 
                  className="text-body text-muted hover:text-text transition-colors"
                >
                  使い方ガイド
                </Link>
                <Link 
                  href="/billing" 
                  className="text-body text-muted hover:text-text transition-colors"
                >
                  プラン
                </Link>
              </nav>
            ) : (
              // Non-authenticated navigation
              <nav className="hidden md:flex items-center space-x-6">
                <Link 
                  href="/demo" 
                  className="text-body text-muted hover:text-text transition-colors"
                >
                  デモを試す
                </Link>
                <Link 
                  href="#pricing" 
                  className="text-body text-muted hover:text-text transition-colors"
                >
                  料金
                </Link>
              </nav>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <UserStatusBadge />
                <button
                  onClick={handleLogout}
                  className="btn btn-outline text-sm px-3 py-1.5"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link 
                  href="/auth" 
                  className="btn btn-outline text-sm px-4 py-2"
                >
                  ログイン
                </Link>
                <Link 
                  href="/register" 
                  className="btn btn-primary text-sm px-4 py-2"
                >
                  登録
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}