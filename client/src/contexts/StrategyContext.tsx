import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { strategyAPI } from '../api/client';
import { useAuth } from './AuthContext';
import type { Strategy } from '../types';

interface StrategyContextType {
  strategy: Strategy | null;
  loading: boolean;
  isComplete: boolean;
  allInputsFilled: boolean;
  hasGeneratedContent: boolean;
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

  const allInputsFilled = !!(
    strategy?.rawInputs?.section1_businessContext &&
    strategy?.rawInputs?.section2_goalsMetrics &&
    strategy?.rawInputs?.section3_currentState &&
    strategy?.rawInputs?.section3a_platformMetrics &&
    strategy?.rawInputs?.section4_voicePositioning &&
    strategy?.rawInputs?.section5_campaigns
  );

  const hasGeneratedContent = !!(
    strategy?.northStar || strategy?.goal90Day || strategy?.positioningStatement
  );

  return (
    <StrategyContext.Provider
      value={{
        strategy,
        loading,
        isComplete: strategy?.isComplete ?? false,
        allInputsFilled,
        hasGeneratedContent,
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
