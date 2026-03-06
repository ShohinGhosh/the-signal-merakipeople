import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { strategyAPI } from '../api/client';
import { useAuth } from './AuthContext';
import type { Strategy } from '../types';

interface StrategyContextType {
  strategy: Strategy | null;
  loading: boolean;
  isComplete: boolean;
  refresh: () => Promise<void>;
}

const StrategyContext = createContext<StrategyContextType | null>(null);

export function StrategyProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await strategyAPI.getCurrent();
      setStrategy(data);
    } catch {
      setStrategy(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    } else {
      setStrategy(null);
      setLoading(false);
    }
  }, [isAuthenticated, refresh]);

  return (
    <StrategyContext.Provider
      value={{
        strategy,
        loading,
        isComplete: strategy?.isComplete ?? false,
        refresh,
      }}
    >
      {children}
    </StrategyContext.Provider>
  );
}

export function useStrategy(): StrategyContextType {
  const ctx = useContext(StrategyContext);
  if (!ctx) throw new Error('useStrategy must be used within StrategyProvider');
  return ctx;
}
