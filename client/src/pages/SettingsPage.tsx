import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Instagram, Linkedin, ExternalLink, CheckCircle2, AlertCircle,
  Key, Database, Brain, Globe, Unplug, Link2,
} from 'lucide-react';

interface MetaConnection {
  connected: boolean;
  pageName?: string;
  igUsername?: string;
  connectedAt?: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaConnection, setMetaConnection] = useState<MetaConnection>({ connected: false });
  const [connecting, setConnecting] = useState(false);

  const handleMetaConnect = () => {
    if (!metaAppId) {
      alert('Please enter your Meta App ID first');
      return;
    }

    const redirectUri = `${window.location.origin}/settings`;
    const scope = [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_read_engagement',
      'business_management',
    ].join(',');

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;

    window.open(authUrl, '_blank', 'width=600,height=700');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {/* Profile */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
          Profile
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-coral/10 flex items-center justify-center text-brand-coral text-2xl font-medium">
            {user?.name?.[0]}
          </div>
          <div>
            <p className="font-medium text-lg text-slate-900">{user?.name}</p>
            <p className="text-slate-500 text-sm">{user?.email}</p>
            <p className="text-slate-400 text-xs capitalize mt-1">Role: {user?.role}</p>
          </div>
        </div>
      </div>

      {/* Meta Business Account Integration */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Instagram size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Meta Business Account
            </h3>
            <p className="text-xs text-slate-400">Connect Instagram for publishing and analytics</p>
          </div>
          {metaConnection.connected ? (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={12} />
              Connected
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              <Unplug size={12} />
              Not connected
            </span>
          )}
        </div>

        {metaConnection.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <Instagram size={16} className="text-pink-500" />
              <div className="flex-1">
                <p className="text-sm text-slate-900 font-medium">@{metaConnection.igUsername}</p>
                <p className="text-xs text-slate-400">Page: {metaConnection.pageName}</p>
              </div>
              <span className="text-xs text-slate-300">
                Connected {metaConnection.connectedAt}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Publish</p>
                <p className="text-green-600 text-sm font-medium mt-1">Ready</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Analytics</p>
                <p className="text-green-600 text-sm font-medium mt-1">Active</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Content</p>
                <p className="text-green-600 text-sm font-medium mt-1">Synced</p>
              </div>
            </div>

            <button
              className="text-xs text-red-600 hover:text-red-500 transition-colors"
              onClick={() => setMetaConnection({ connected: false })}
            >
              Disconnect Account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-sm text-slate-900 font-medium mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-coral/10 text-brand-coral text-xs flex items-center justify-center font-bold">1</span>
                Create a Meta App
              </h4>
              <p className="text-xs text-slate-400 mb-2">
                Go to Meta for Developers, create an app, and add Instagram Graph API product.
              </p>
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-coral hover:underline"
              >
                <ExternalLink size={10} />
                Open Meta Developer Portal
              </a>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-sm text-slate-900 font-medium mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-coral/10 text-brand-coral text-xs flex items-center justify-center font-bold">2</span>
                Enter App Credentials
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Meta App ID</label>
                  <input
                    type="text"
                    value={metaAppId}
                    onChange={(e) => setMetaAppId(e.target.value)}
                    placeholder="Enter your Meta App ID"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-brand-coral/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Meta App Secret</label>
                  <input
                    type="password"
                    value={metaAppSecret}
                    onChange={(e) => setMetaAppSecret(e.target.value)}
                    placeholder="Enter your Meta App Secret"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-brand-coral/50"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-sm text-slate-900 font-medium mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-coral/10 text-brand-coral text-xs flex items-center justify-center font-bold">3</span>
                Connect Your Account
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                Authorize The Signal to manage your Instagram Business Account via Meta login.
              </p>
              <button
                onClick={handleMetaConnect}
                disabled={connecting || !metaAppId}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  metaAppId
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-sm'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                <Instagram size={16} />
                Connect with Meta
              </button>
            </div>

            <div className="border border-slate-100 rounded-lg p-3">
              <p className="text-xs text-slate-400 font-medium mb-2">Required Permissions:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'instagram_basic',
                  'instagram_content_publish',
                  'instagram_manage_insights',
                  'pages_show_list',
                  'pages_read_engagement',
                  'business_management',
                ].map((perm) => (
                  <span key={perm} className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded">
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LinkedIn Integration (Future) */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm opacity-60">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Linkedin size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              LinkedIn
            </h3>
            <p className="text-xs text-slate-400">Auto-publish and track LinkedIn posts</p>
          </div>
          <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            Coming Soon
          </span>
        </div>
      </div>

      {/* API Configuration */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4 flex items-center gap-2">
          <Key size={14} />
          API Configuration
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 flex items-center gap-2">
              <Brain size={14} className="text-slate-300" />
              Anthropic Claude
            </span>
            <span className="text-green-600 text-xs flex items-center gap-1">
              <CheckCircle2 size={10} />
              Configured via .env
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 flex items-center gap-2">
              <Globe size={14} className="text-slate-300" />
              Google Gemini
            </span>
            <span className="text-green-600 text-xs flex items-center gap-1">
              <CheckCircle2 size={10} />
              Configured via .env
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 flex items-center gap-2">
              <Link2 size={14} className="text-slate-300" />
              fal.ai Image Generation
            </span>
            <span className="text-yellow-600 text-xs flex items-center gap-1">
              <AlertCircle size={10} />
              Pending integration
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 flex items-center gap-2">
              <Database size={14} className="text-slate-300" />
              MongoDB
            </span>
            <span className="text-green-600 text-xs flex items-center gap-1">
              <CheckCircle2 size={10} />
              Configured via .env
            </span>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
          About
        </h3>
        <p className="text-sm text-slate-500">The Signal v2.0 — MerakiPeople Growth OS</p>
        <p className="text-xs text-slate-400 mt-1">Strategy-driven content at founder speed.</p>
      </div>
    </div>
  );
}
