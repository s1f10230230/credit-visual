"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type Plan = "free" | "lite" | "pro";

type PlanContextValue = {
  plan: Plan;
  setPlan: (plan: Plan) => void;
};

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

const STORAGE_KEY = "subscan-plan";

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlanState] = useState<Plan>("free");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as Plan | null;
    if (saved === "free" || saved === "lite" || saved === "pro") {
      setPlanState(saved);
    }
  }, []);

  const setPlan = (next: Plan) => {
    setPlanState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const value = useMemo(() => ({ plan, setPlan }), [plan]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    throw new Error("usePlan must be used within PlanProvider");
  }
  return ctx;
}
