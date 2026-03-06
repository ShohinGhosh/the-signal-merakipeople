import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api/client';
import type { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    loading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem('signal_token');
    const userStr = localStorage.getItem('signal_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        setState({ user, token, isAuthenticated: true, loading: false });
      } catch {
        localStorage.removeItem('signal_token');
        localStorage.removeItem('signal_user');
        setState((s) => ({ ...s, loading: false }));
      }
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authAPI.login(email, password);
    const { token, user } = data;
    localStorage.setItem('signal_token', token);
    localStorage.setItem('signal_user', JSON.stringify(user));
    setState({ user, token, isAuthenticated: true, loading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('signal_token');
    localStorage.removeItem('signal_user');
    setState({ user: null, token: null, isAuthenticated: false, loading: false });
  }, []);

  const switchUser = useCallback(() => {
    logout();
  }, [logout]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
