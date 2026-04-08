import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-brand-cloud text-slate-900 relative">
      {/* Classy gradient decoration */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-coral/[0.04] blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full bg-brand-indigo/[0.03] blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-brand-coral/[0.02] blur-3xl" />
      </div>

      <Sidebar />
      <main className="ml-60 p-8 min-h-screen relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
