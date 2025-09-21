"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new dashboard with tutorial
    router.push("/dashboard?tour=1");
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-6">🚀</div>
        <h1 className="text-heading-lg text-text mb-4">ダッシュボードに移動中...</h1>
        <p className="text-body text-muted">
          新しいユーザー体験に移動しています
        </p>
        <div className="mt-6">
          <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-primary rounded-full" role="status" aria-label="loading">
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      </div>
    </div>
  );
}