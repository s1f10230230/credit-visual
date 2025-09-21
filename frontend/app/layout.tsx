import Link from "next/link";
import type { ReactNode } from "react";

import { PlanProvider } from "../context/PlanContext";
import { AuthProvider } from "../context/AuthContext";
import { PlanSwitcher } from "../components/PlanSwitcher";
import { AnalyticsProvider } from "../components/AnalyticsProvider";
import { NavigationBar } from "../components/NavigationBar";
import "./globals.css";

export const metadata = {
  title: "Subscan",
  description: "Smart subscription management for your credit cards",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-bg text-text antialiased">
        <AnalyticsProvider>
          <AuthProvider>
            <PlanProvider>
              <NavigationBar />
              <main className="min-h-[calc(100vh-73px)]">{children}</main>
            </PlanProvider>
          </AuthProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
