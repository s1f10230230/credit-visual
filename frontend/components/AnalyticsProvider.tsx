"use client";

import { useEffect } from "react";
import { analytics } from "../lib/analytics";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize analytics with GA4 measurement ID if available
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (measurementId) {
      analytics.init(measurementId);
    }
  }, []);

  return <>{children}</>;
}