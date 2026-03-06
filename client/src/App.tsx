import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StrategyProvider } from './contexts/StrategyContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import StrategyPage from './pages/StrategyPage';
import SignalFeedPage from './pages/SignalFeedPage';
import CalendarPage from './pages/CalendarPage';
import BrainPage from './pages/BrainPage';
import PipelinePage from './pages/PipelinePage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-graphite flex items-center justify-center">
        <div className="text-white/40">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/strategy" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <StrategyProvider>
              <AppLayout />
            </StrategyProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/strategy" replace />} />
        <Route path="strategy" element={<StrategyPage />} />
        <Route path="signal-feed" element={<SignalFeedPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="brain" element={<BrainPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
