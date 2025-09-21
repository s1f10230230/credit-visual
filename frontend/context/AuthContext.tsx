"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type AuthState = {
  isAuthenticated: boolean;
  hasData: boolean;
  userId?: string;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  hasData: boolean;
  userId?: string;
  login: (userId: string) => void;
  logout: () => void;
  setHasData: (hasData: boolean) => void;
  updateDataState: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = "subscan-auth";
const DATA_STORAGE_KEY = "subscan-has-data";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    hasData: false,
    userId: undefined
  });

  // Load auth state from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const savedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const savedHasData = window.localStorage.getItem(DATA_STORAGE_KEY);
    
    if (savedAuth) {
      try {
        const { isAuthenticated, userId } = JSON.parse(savedAuth);
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: Boolean(isAuthenticated),
          userId,
          hasData: savedHasData === "true"
        }));
      } catch (e) {
        // Invalid stored data, clear it
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem(DATA_STORAGE_KEY);
      }
    }
  }, []);

  // Update document cookies when auth state changes (for middleware)
  useEffect(() => {
    if (typeof document === "undefined") return;
    
    if (authState.isAuthenticated) {
      document.cookie = `auth-token=true; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days
    } else {
      document.cookie = `auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
    }
    
    if (authState.hasData) {
      document.cookie = `has-transaction-data=true; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days
    } else {
      document.cookie = `has-transaction-data=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
    }
  }, [authState.isAuthenticated, authState.hasData]);

  const login = (userId: string) => {
    const newState = {
      isAuthenticated: true,
      hasData: authState.hasData, // Preserve hasData state
      userId
    };
    setAuthState(newState);
    
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        isAuthenticated: true,
        userId
      }));
    }
  };

  const logout = () => {
    const newState = {
      isAuthenticated: false,
      hasData: false,
      userId: undefined
    };
    setAuthState(newState);
    
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      window.localStorage.removeItem(DATA_STORAGE_KEY);
    }
  };

  const setHasData = (hasData: boolean) => {
    setAuthState(prev => ({ ...prev, hasData }));
    
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DATA_STORAGE_KEY, hasData.toString());
    }
  };

  const updateDataState = async () => {
    // In production, this would check the user's transaction count via API
    // For now, simulate checking if user has any transaction data
    try {
      // Simulate API call to check user data
      // const response = await fetch('/api/user/data-status');
      // const { hasTransactions } = await response.json();
      
      // For demo purposes, check localStorage for any import activity
      const hasImportActivity = typeof window !== "undefined" && 
        (window.localStorage.getItem("subscan-demo-used") === "true" ||
         window.localStorage.getItem("subscan-imports") !== null);
      
      setHasData(hasImportActivity);
    } catch (error) {
      console.error("Failed to update data state:", error);
    }
  };

  const value = useMemo(() => ({
    isAuthenticated: authState.isAuthenticated,
    hasData: authState.hasData,
    userId: authState.userId,
    login,
    logout,
    setHasData,
    updateDataState
  }), [authState]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}