import type { Plan } from "../context/PlanContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE}${path}`;
}

export async function fetchWithPlan<T>(
  path: string,
  plan: Plan,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  
  // Try to use JWT token first
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    // Fallback to plan header
    headers.set("X-Plan", plan);
  }
  
  const response = await fetch(resolveUrl(path), { ...options, headers });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchWithAuth<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  const response = await fetch(resolveUrl(path), { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid, redirect to login
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_plan");
        localStorage.removeItem("user_email");
        window.location.href = "/auth";
      }
    }
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function getApiBase(): string {
  return API_BASE;
}
