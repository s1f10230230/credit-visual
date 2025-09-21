"use client";

import { Plan, usePlan } from "../context/PlanContext";

const PLAN_LABELS: Plan[] = ["free", "lite", "pro"];

export function PlanSwitcher() {
  const { plan, setPlan } = usePlan();
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      {PLAN_LABELS.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => setPlan(label)}
          style={{
            background: plan === label ? "#2b7" : "#eee",
            color: plan === label ? "#fff" : "#333",
            padding: "0.35rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #ccc",
          }}
        >
          {label.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
