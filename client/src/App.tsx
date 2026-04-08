import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StrategyProvider } from './contexts/StrategyContext';
import AppLayout from './components/layout/AppLayout';
import StrategyPage from './pages/StrategyPage';
import JournalPage from './pages/JournalPage';
import CalendarPage from './pages/CalendarPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-brand-cloud flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <StrategyProvider>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/strategy" replace />} />
          <Route path="strategy" element={<StrategyPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* Redirects for old routes */}
          <Route path="signal-feed" element={<Navigate to="/journal" replace />} />
          <Route path="insights" element={<Navigate to="/journal" replace />} />
          <Route path="brain" element={<Navigate to="/calendar" replace />} />
          <Route path="pipeline" element={<Navigate to="/analytics" replace />} />
          <Route path="leads" element={<Navigate to="/analytics" replace />} />
          <Route path="automations" element={<Navigate to="/calendar" replace />} />
          <Route path="audit" element={<Navigate to="/analytics" replace />} />
          <Route path="login" element={<Navigate to="/strategy" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </StrategyProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
