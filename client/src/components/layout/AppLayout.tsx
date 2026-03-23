import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import SignalInputModal from '../signal-feed/SignalInputModal';

export default function AppLayout() {
  const [showSignalInput, setShowSignalInput] = useState(false);

  return (
    <div className="min-h-screen bg-brand-cloud text-slate-900 relative">
      {/* Classy gradient decoration */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-coral/[0.04] blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full bg-brand-indigo/[0.03] blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-brand-coral/[0.02] blur-3xl" />
      </div>

      <Sidebar onAddSignal={() => setShowSignalInput(true)} />
      <main className="ml-60 p-8 min-h-screen relative z-10">
        <Outlet />
      </main>

      {/* Floating Add Signal button (mobile + always visible) */}
      <button
        onClick={() => setShowSignalInput(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-coral rounded-full shadow-lg flex items-center justify-center text-white hover:bg-brand-coral/90 transition-colors z-40 md:hidden"
        title="Add Signal"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Signal Input Modal */}
      {showSignalInput && <SignalInputModal onClose={() => setShowSignalInput(false)} />}
    </div>
  );
}
