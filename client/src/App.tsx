import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StrategyProvider } from './contexts/StrategyContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import StrategyPage from './pages/StrategyPage';
import InsightsPage from './pages/InsightsPage';
import CalendarPage from './pages/CalendarPage';
import LeadsPage from './pages/LeadsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-cloud flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
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
        <Route path="insights" element={<InsightsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Redirects for old routes */}
        <Route path="signal-feed" element={<Navigate to="/insights" replace />} />
        <Route path="brain" element={<Navigate to="/calendar" replace />} />
        <Route path="pipeline" element={<Navigate to="/leads" replace />} />
        <Route path="automations" element={<Navigate to="/calendar" replace />} />
        <Route path="audit" element={<Navigate to="/analytics" replace />} />
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
