import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
            Profile
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-coral/20 flex items-center justify-center text-brand-coral text-2xl font-medium">
              {user?.name?.[0]}
            </div>
            <div>
              <p className="font-medium text-lg">{user?.name}</p>
              <p className="text-white/50 text-sm">{user?.email}</p>
              <p className="text-white/30 text-xs capitalize mt-1">Role: {user?.role}</p>
            </div>
          </div>
        </div>

        {/* API Keys info */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
            API Configuration
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Anthropic Claude</span>
              <span className="text-green-400 text-xs">Configured via .env</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">fal.ai Image Generation</span>
              <span className="text-green-400 text-xs">Configured via .env</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">MongoDB</span>
              <span className="text-green-400 text-xs">Configured via .env</span>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
            About
          </h3>
          <p className="text-sm text-white/50">
            The Signal v2.0 — MerakiPeople Growth OS
          </p>
          <p className="text-xs text-white/30 mt-1">
            Strategy-driven content at founder speed.
          </p>
        </div>
      </div>
    </div>
  );
}
