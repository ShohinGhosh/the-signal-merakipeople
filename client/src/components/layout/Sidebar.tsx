import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  BookOpen,
  Calendar,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useStrategy } from '../../contexts/StrategyContext';

const NAV_ITEMS = [
  { path: '/strategy', label: 'Strategy', icon: Compass, requiresStrategy: false },
  { path: '/journal', label: 'Journal', icon: BookOpen, requiresStrategy: true },
  { path: '/calendar', label: 'Calendar', icon: Calendar, requiresStrategy: true },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, requiresStrategy: true },
  { path: '/settings', label: 'Settings', icon: Settings, requiresStrategy: false },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { isComplete } = useStrategy();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-brand-indigo text-white flex flex-col transition-all duration-300 z-50 shadow-xl ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        {!collapsed && (
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-brand-coral">MerakiPeople</h1>
            <h2 className="text-lg font-bold">Growth OS</h2>
          </div>
        )}
        {collapsed && <div className="text-brand-coral font-bold text-xl text-center">S</div>}
      </div>

      {/* Signal Score */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className={`text-xs uppercase tracking-wider text-white/50 ${collapsed ? 'text-center' : ''}`}>
          {!collapsed && 'Signal Score'}
        </div>
        <div className={`text-2xl font-bold font-mono text-brand-coral ${collapsed ? 'text-center' : ''}`}>
          --
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const locked = item.requiresStrategy && !isComplete;
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={locked ? '#' : item.path}
              onClick={(e) => locked && e.preventDefault()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  locked
                    ? 'text-white/20 cursor-not-allowed'
                    : isActive
                      ? 'bg-white/10 text-brand-coral border-r-2 border-brand-coral'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                }`
              }
              title={locked ? 'Complete your strategy first' : item.label}
            >
              <Icon size={18} />
              {!collapsed && <span>{item.label}</span>}
              {locked && !collapsed && <span className="ml-auto text-xs text-white/30">🔒</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 w-6 h-6 bg-brand-indigo border border-slate-300 rounded-full flex items-center justify-center text-white/50 hover:text-white shadow-md"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
