import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import SignalInputModal from '../signal-feed/SignalInputModal';

export default function AppLayout() {
  const [showSignalInput, setShowSignalInput] = useState(false);

  return (
    <div className="min-h-screen bg-brand-graphite text-white">
      <Sidebar onAddSignal={() => setShowSignalInput(true)} />
      <main className="ml-60 p-6 min-h-screen">
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
