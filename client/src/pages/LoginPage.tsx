import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/strategy');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (role: 'shohini' | 'sanjoy') => {
    const emails = {
      shohini: 'shohini@merakipeople.com',
      sanjoy: 'sanjoy@merakipeople.com',
    };
    const passwords = { shohini: 'shohini123', sanjoy: 'sanjoy123' };
    setEmail(emails[role]);
    setPassword(passwords[role]);

    setLoading(true);
    try {
      await login(emails[role], passwords[role]);
      navigate('/strategy');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cloud flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gradient decoration */}
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-brand-coral/[0.06] blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-brand-indigo/[0.04] blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-brand-coral text-sm font-semibold tracking-wider uppercase mb-1">
            MerakiPeople
          </h1>
          <h2 className="text-3xl font-bold text-slate-900">The Signal</h2>
          <p className="text-slate-400 text-sm mt-2">Strategy-driven content at founder speed</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20 shadow-sm"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20 shadow-sm"
            required
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-coral text-white rounded-lg font-medium hover:bg-brand-coral/90 disabled:opacity-40 transition-colors shadow-sm"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Quick login buttons for dev */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-300 text-center mb-3">Quick login (dev only)</p>
          <div className="flex gap-3">
            <button
              onClick={() => quickLogin('shohini')}
              className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition-colors"
            >
              Shohini
            </button>
            <button
              onClick={() => quickLogin('sanjoy')}
              className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition-colors"
            >
              Sanjoy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
