import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, ArrowRight, AlertCircle,
  ChevronLeft, ChevronRight, RefreshCw, Calendar, Bot,
  CheckCircle2, XCircle, Clock, Loader2, Play,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { analyticsAPI, costsAPI, automationsAPI } from '../api/client';
import EmptyState from '../components/shared/EmptyState';
import type {
  AnalyticsWeekly, CostSummary, DailyCost, CostLog,
  PlatformBenchmarks, WeeklyPerformance, PendingPerformance,
} from '../types';

const FORMAT_LABELS: Record<string, string> = {
  text_post: 'Text Post',
  carousel: 'Carousel',
  poll: 'Poll',
  document: 'Document',
  video_caption: 'Video',
  reel: 'Reel',
  story: 'Story',
  unknown: 'Other',
};

const CHART_COLORS = ['#FF6F61', '#4F46E5', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
const CORAL = '#FF6F61';
const INDIGO = '#4F46E5';

function formatDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDateStr(d);
}
function todayStr(): string {
  return formatDateStr(new Date());
}

type Preset = 'today' | '7d' | '30d' | 'all';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsWeekly | null>(null);
  const [costs, setCosts] = useState<CostSummary | null>(null);
  const [platformBenchmarks, setPlatformBenchmarks] = useState<PlatformBenchmarks | null>(null);
  const [weeklyPerf, setWeeklyPerf] = useState<WeeklyPerformance | null>(null);
  const [pendingPerf, setPendingPerf] = useState<PendingPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'performance' | 'costs' | 'agents' | 'brief'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scoreRes, costRes, dashRes, perfRes, pendingRes] = await Promise.all([
        analyticsAPI.signalScore().catch(() => ({ data: null })),
        costsAPI.summary().catch(() => ({ data: null })),
        analyticsAPI.dashboard().catch(() => ({ data: null })),
        analyticsAPI.weeklyPerformance().catch(() => ({ data: null })),
        analyticsAPI.pendingPerformance().catch(() => ({ data: null })),
      ]);
      setAnalytics(scoreRes.data);
      setCosts(costRes.data);
      if (dashRes.data?.platformBenchmarks) {
        setPlatformBenchmarks(dashRes.data.platformBenchmarks);
      }
      setWeeklyPerf(perfRes.data);
      setPendingPerf(pendingRes.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const signalScore = analytics?.signalScore ?? 0;
  const scoreColor = signalScore >= 71 ? '#10B981' : signalScore >= 41 ? '#F59E0B' : '#EF4444';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-1 bg-slate-50 rounded-lg p-1">
          {(['overview', 'performance', 'costs', 'agents', 'brief'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-sm capitalize ${
                tab === t ? 'bg-brand-coral text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {t === 'brief' ? 'Monday Brief' : t === 'agents' ? 'Agent Runs' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Pending Performance Banner */}
      {pendingPerf && pendingPerf.count > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-amber-700 font-medium">
              {pendingPerf.count} published post{pendingPerf.count > 1 ? 's' : ''} need performance data
            </p>
            <p className="text-xs text-amber-500 mt-0.5">
              Submit engagement metrics to unlock the Monday Brief. It auto-generates once all data is in.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : tab === 'overview' ? (
        <div className="space-y-6">
          {/* Signal Score */}
          <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-6 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">The Signal Score</p>
            <div
              className="text-6xl font-bold font-mono mb-2"
              style={{ color: scoreColor }}
            >
              {signalScore}
            </div>
            <p className="text-sm text-slate-400">
              {signalScore >= 71 ? 'Strong signal' : signalScore >= 41 ? 'Needs attention' : 'Weak signal'}
            </p>

            {analytics?.scoreBreakdown && (
              <div className="grid grid-cols-4 gap-4 mt-6">
                {[
                  { label: 'Posting', value: analytics.scoreBreakdown.postingConsistency, weight: '35%' },
                  { label: 'Pipeline', value: analytics.scoreBreakdown.pipelineActivity, weight: '35%' },
                  { label: 'Strategy', value: analytics.scoreBreakdown.strategyAlignment, weight: '20%' },
                  { label: 'Engagement', value: analytics.scoreBreakdown.engagementHealth, weight: '10%' },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="text-lg font-bold font-mono text-slate-700">{Math.round(item.value)}</div>
                    <div className="text-xs text-slate-400">{item.label}</div>
                    <div className="text-xs text-slate-200">{item.weight}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Posts Published"
              value={
                analytics
                  ? (analytics.postsPublished?.linkedin?.shohini || 0) +
                    (analytics.postsPublished?.linkedin?.sanjoy || 0) +
                    (analytics.postsPublished?.instagram?.shohini || 0) +
                    (analytics.postsPublished?.instagram?.sanjoy || 0)
                  : 0
              }
            />
            <StatCard label="New Leads" value={analytics?.pipelineNewLeads ?? 0} />
            <StatCard label="Demos" value={analytics?.pipelineDemos ?? 0} />
            <StatCard label="Signed" value={analytics?.pipelineSigned ?? 0} />
          </div>

          {/* Platform Baselines */}
          {platformBenchmarks && (
            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
                Platform Baselines
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 border-l-2 border-blue-500">
                  <h4 className="text-sm font-medium text-blue-600 mb-3">LinkedIn</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Starting Followers</span>
                      <span className="font-mono">{platformBenchmarks.linkedin.current_followers ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Avg Impressions</span>
                      <span className="font-mono">{platformBenchmarks.linkedin.avg_impressions ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">90-Day Target</span>
                      <span className="font-mono text-green-600">{platformBenchmarks.linkedin.target_90d ?? '—'}</span>
                    </div>
                    {platformBenchmarks.linkedin.channel_purpose && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Purpose</span>
                        <span className="text-slate-600">{platformBenchmarks.linkedin.channel_purpose}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border-l-2 border-purple-500">
                  <h4 className="text-sm font-medium text-purple-400 mb-3">
                    Instagram {platformBenchmarks.instagram.is_active === false && <span className="text-slate-300 text-xs ml-1">(Secondary)</span>}
                  </h4>
                  {platformBenchmarks.instagram.is_active === false ? (
                    <p className="text-xs text-slate-400">1x/week — brand awareness only</p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Starting Followers</span>
                        <span className="font-mono">{platformBenchmarks.instagram.current_followers ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Avg Reach</span>
                        <span className="font-mono">{platformBenchmarks.instagram.avg_reach ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">90-Day Target</span>
                        <span className="font-mono text-green-600">{platformBenchmarks.instagram.target_90d ?? '—'}</span>
                      </div>
                      {platformBenchmarks.instagram.channel_purpose && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Purpose</span>
                          <span className="text-slate-600">{platformBenchmarks.instagram.channel_purpose}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pillar Performance */}
          {analytics?.pillarPerformance && analytics.pillarPerformance.length > 0 && (
            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
                Pillar Performance
              </h3>
              <div className="space-y-3">
                {analytics.pillarPerformance.map((p) => (
                  <div key={p.pillar} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-slate-600 truncate">{p.pillar}</div>
                    <div className="flex-1 h-4 bg-slate-50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-coral/60 rounded-full"
                        style={{ width: `${Math.min(100, p.actualPercent)}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 w-24 text-right">
                      {p.actualPercent}% / {p.targetPercent}%
                    </div>
                    <div className="text-xs text-slate-300 w-16 text-right">
                      {p.avgEngagement > 0 ? `${p.avgEngagement.toFixed(1)}% eng` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Recommendations */}
          {analytics?.aiRecommendations && analytics.aiRecommendations.length > 0 && (
            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
                Strategy Recommendations
              </h3>
              <div className="space-y-3">
                {analytics.aiRecommendations.map((rec, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-700 mb-2">{rec.recommendation}</p>
                    <p className="text-xs text-slate-400 mb-3">{rec.reasoning}</p>
                    {rec.evidence?.length > 0 && (
                      <p className="text-xs text-slate-300 mb-3">
                        Evidence: {rec.evidence.join(', ')}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-green-50 text-green-600 rounded text-xs">
                        Accept
                      </button>
                      <button className="px-3 py-1 bg-slate-50 text-slate-400 rounded text-xs">
                        Dismiss
                      </button>
                      <button className="px-3 py-1 bg-slate-50 text-slate-400 rounded text-xs">
                        Discuss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : tab === 'performance' ? (
        <WeeklyPerformancePanel data={weeklyPerf} />
      ) : tab === 'costs' ? (
        <CostsAuditPanel />
      ) : tab === 'agents' ? (
        <AgentRunsPanel />
      ) : (
        /* Monday Brief */
        <div className="max-w-2xl mx-auto">
          {pendingPerf && pendingPerf.count > 0 && !analytics?.mondayBriefContent && (
            <div className="mb-6 p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm text-center">
              <p className="text-sm text-slate-500">
                Monday Brief auto-generates once all performance data is submitted.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {pendingPerf.count} post{pendingPerf.count > 1 ? 's' : ''} still need metrics.
              </p>
            </div>
          )}
          {analytics?.mondayBriefContent ? (
            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Monday Brief</h3>
              <div className="prose prose-invert text-sm whitespace-pre-wrap">
                {analytics.mondayBriefContent}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 size={48} />}
              title="No Monday Brief yet"
              description="The weekly digest auto-generates when all published posts have performance data logged."
              action={{
                label: 'Generate Now',
                onClick: async () => {
                  await analyticsAPI.generateWeekly();
                  loadData();
                },
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============ Costs + Audit Panel (merged from AuditPage) ============
function CostsAuditPanel() {
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(todayStr());
  const [activePreset, setActivePreset] = useState<Preset>('30d');

  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [daily, setDaily] = useState<DailyCost[]>([]);
  const [logs, setLogs] = useState<CostLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (sd: string, ed: string, page: number) => {
    try {
      const [summaryRes, dailyRes, logsRes] = await Promise.all([
        costsAPI.summary({ startDate: sd, endDate: ed }).catch(() => ({ data: null })),
        costsAPI.daily({ startDate: sd, endDate: ed }).catch(() => ({ data: { daily: [] } })),
        costsAPI.list({ startDate: sd, endDate: ed, page, limit: 20 }).catch(() => ({
          data: { costs: [], pagination: { total: 0, totalPages: 1, page: 1 } },
        })),
      ]);
      setSummary(summaryRes.data);
      setDaily(dailyRes.data?.daily || []);
      setLogs(logsRes.data?.costs || []);
      setLogTotal(logsRes.data?.pagination?.total || 0);
      setLogTotalPages(logsRes.data?.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to load audit data:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setLogPage(1);
    loadData(startDate, endDate, 1).finally(() => setLoading(false));
  }, [startDate, endDate, loadData]);

  useEffect(() => {
    if (logPage === 1) return;
    costsAPI.list({ startDate, endDate, page: logPage, limit: 20 })
      .then((res) => {
        setLogs(res.data?.costs || []);
        setLogTotal(res.data?.pagination?.total || 0);
        setLogTotalPages(res.data?.pagination?.totalPages || 1);
      })
      .catch(() => {});
  }, [logPage, startDate, endDate]);

  const applyPreset = (p: Preset) => {
    setActivePreset(p);
    switch (p) {
      case 'today': setStartDate(todayStr()); setEndDate(todayStr()); break;
      case '7d': setStartDate(daysAgo(7)); setEndDate(todayStr()); break;
      case '30d': setStartDate(daysAgo(30)); setEndDate(todayStr()); break;
      case 'all': setStartDate('2024-01-01'); setEndDate(todayStr()); break;
    }
  };

  const totalCost = summary?.totalCostUsd ?? 0;
  const totalCalls = summary?.totalRequests ?? 0;
  const avgCost = summary?.averageCostPerRequest ?? 0;
  const totalTokens = (summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0);

  const modelData = (summary?.byModel || []).map((m, i) => ({
    name: m.model,
    value: Math.round(m.costUsd * 10000) / 10000,
    count: m.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const agentTypeData = summary?.byAgentType
    ? [
        { name: 'Generator', value: summary.byAgentType.generator.costUsd, count: summary.byAgentType.generator.count, fill: CORAL },
        { name: 'Critique', value: summary.byAgentType.critique.costUsd, count: summary.byAgentType.critique.count, fill: INDIGO },
      ].filter((d) => d.count > 0)
    : [];

  const operationData = (summary?.byOperation || [])
    .sort((a, b) => b.costUsd - a.costUsd)
    .map((op) => ({
      name: op.operation.replace(/_/g, ' '),
      cost: Math.round(op.costUsd * 10000) / 10000,
      calls: op.count,
    }));

  return (
    <div className="space-y-6">
      {/* Date Range Filters */}
      <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-1 bg-slate-50 rounded-lg p-1">
            {([
              { key: 'today' as Preset, label: 'Today' },
              { key: '7d' as Preset, label: '7 Days' },
              { key: '30d' as Preset, label: '30 Days' },
              { key: 'all' as Preset, label: 'All Time' },
            ]).map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  activePreset === p.key
                    ? 'bg-brand-coral text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActivePreset(undefined as any); }}
              className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700"
            />
            <span className="text-slate-300">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActivePreset(undefined as any); }}
              className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading cost data...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AuditSummaryCard label="Total Cost" value={`$${totalCost.toFixed(4)}`} sub="USD" />
            <AuditSummaryCard label="API Calls" value={totalCalls.toLocaleString()} sub="requests" />
            <AuditSummaryCard label="Avg Cost/Call" value={`$${avgCost.toFixed(4)}`} sub="per request" />
            <AuditSummaryCard label="Total Tokens" value={totalTokens.toLocaleString()} sub="in + out" />
          </div>

          {/* Charts Row 1: Time series */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
                Daily Cost Trend
              </h3>
              {daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={daily}>
                    <defs>
                      <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CORAL} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CORAL} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(51,65,85,0.7)', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} stroke="rgba(0,0,0,0.08)" />
                    <YAxis tick={{ fill: 'rgba(51,65,85,0.7)', fontSize: 11 }} tickFormatter={(v) => `$${v}`} stroke="rgba(0,0,0,0.08)" width={60} />
                    <Tooltip content={<CostTooltip />} />
                    <Area type="monotone" dataKey="costUsd" stroke={CORAL} fill="url(#costGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>

            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
                Daily API Calls
              </h3>
              {daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(51,65,85,0.7)', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} stroke="rgba(0,0,0,0.08)" />
                    <YAxis tick={{ fill: 'rgba(51,65,85,0.7)', fontSize: 11 }} stroke="rgba(0,0,0,0.08)" width={40} />
                    <Tooltip content={<CallsTooltip />} />
                    <Bar dataKey="calls" fill={INDIGO} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Charts Row 2: Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
                Cost by Operation
              </h3>
              {operationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={operationData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis type="number" tick={{ fill: 'rgba(51,65,85,0.7)', fontSize: 11 }} tickFormatter={(v) => `$${v}`} stroke="rgba(0,0,0,0.08)" />
                    <YAxis dataKey="name" type="category" tick={{ fill: 'rgba(51,65,85,0.7)', fontSize: 10 }} stroke="rgba(0,0,0,0.08)" width={120} />
                    <Tooltip content={<OpTooltip />} />
                    <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                      {operationData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>

            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
                Cost by Model
              </h3>
              {modelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={modelData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {modelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip content={<PieTooltipComp />} />
                    <Legend formatter={(value) => <span className="text-xs text-slate-500">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>

            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
                Generator vs Critique
              </h3>
              {agentTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={agentTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {agentTypeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip content={<PieTooltipComp />} />
                    <Legend formatter={(value) => <span className="text-xs text-slate-500">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Detailed Logs Table */}
          <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider">
                Detailed Logs
              </h3>
              <span className="text-xs text-slate-400">{logTotal} total entries</span>
            </div>

            {logs.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-200">
                        <th className="text-left py-2 px-3">Timestamp</th>
                        <th className="text-left py-2 px-3">Operation</th>
                        <th className="text-left py-2 px-3">Model</th>
                        <th className="text-left py-2 px-3">Type</th>
                        <th className="text-right py-2 px-3">Input</th>
                        <th className="text-right py-2 px-3">Output</th>
                        <th className="text-right py-2 px-3">Cost</th>
                        <th className="text-right py-2 px-3">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 text-slate-500 font-mono text-xs">
                            {new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{log.operation.replace(/_/g, ' ')}</td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-xs">{log.model}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                              log.agentType === 'generator' ? 'bg-brand-coral/10 text-brand-coral' : 'bg-indigo-50 text-indigo-600'
                            }`}>{log.agentType}</span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500 font-mono text-xs">{log.inputTokens.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-slate-500 font-mono text-xs">{log.outputTokens.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-slate-700 font-mono text-xs font-medium">${log.costUsd.toFixed(4)}</td>
                          <td className="py-2 px-3 text-right text-slate-400 font-mono text-xs">{log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {logTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                    <span className="text-xs text-slate-400">Page {logPage} of {logTotalPages}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLogPage(Math.max(1, logPage - 1))}
                        disabled={logPage <= 1}
                        className="p-1.5 bg-slate-50 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setLogPage(Math.min(logTotalPages, logPage + 1))}
                        disabled={logPage >= logTotalPages}
                        className="p-1.5 bg-slate-50 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-slate-300 text-sm">No AI calls recorded for this period.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============ Agent Runs Panel ============
function AgentRunsPanel() {
  const [agents, setAgents] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]); // agent run history
  const [runPage, setRunPage] = useState(1);
  const [runTotalPages, setRunTotalPages] = useState(1);
  const [runTotal, setRunTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);

  const loadData = useCallback(async (page: number) => {
    try {
      const [agentsRes, runsRes] = await Promise.all([
        automationsAPI.agents().catch(() => ({ data: { agents: [] } })),
        automationsAPI.runs({ page, limit: 15 }).catch(() => ({
          data: { runs: [], pagination: { total: 0, totalPages: 1, page: 1 } },
        })),
      ]);
      setAgents(agentsRes.data?.agents || []);
      setRuns(runsRes.data?.runs || []);
      setRunTotal(runsRes.data?.pagination?.total || 0);
      setRunTotalPages(runsRes.data?.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to load agent data:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData(1).finally(() => setLoading(false));
  }, [loadData]);

  useEffect(() => {
    if (runPage === 1) return;
    automationsAPI.runs({ page: runPage, limit: 15 })
      .then((res) => {
        setRuns(res.data?.runs || []);
        setRunTotal(res.data?.pagination?.total || 0);
        setRunTotalPages(res.data?.pagination?.totalPages || 1);
      })
      .catch(() => {});
  }, [runPage]);

  const handleRunAgent = async (agentId: string) => {
    setRunningAgent(agentId);
    try {
      await automationsAPI.run(agentId);
      // Reload after a short delay
      setTimeout(() => loadData(runPage), 2000);
    } catch (err) {
      console.error('Failed to run agent:', err);
    } finally {
      setTimeout(() => setRunningAgent(null), 3000);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={14} className="text-green-600" />;
      case 'failed': return <XCircle size={14} className="text-red-600" />;
      case 'running': return <Loader2 size={14} className="text-blue-600 animate-spin" />;
      default: return <Clock size={14} className="text-slate-300" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return { bg: 'bg-green-50', text: 'text-green-600' };
      case 'failed': return { bg: 'bg-red-50', text: 'text-red-600' };
      case 'running': return { bg: 'bg-blue-50', text: 'text-blue-600' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-400' };
    }
  };

  if (loading) {
    return <div className="text-center py-16 text-slate-400">Loading agent data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Agent Status Cards */}
      <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
          Agents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.filter((a: any) => a.agentId).map((agent: any) => (
            <div key={agent.agentId} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-brand-coral" />
                  <span className="text-sm font-medium capitalize">{(agent.agentId || '').replace(/-/g, ' ')}</span>
                </div>
                <button
                  onClick={() => handleRunAgent(agent.agentId)}
                  disabled={runningAgent === agent.agentId || agent.isRunning}
                  className="flex items-center gap-1 px-2 py-1 bg-brand-coral/5 text-brand-coral rounded text-xs hover:bg-brand-coral/10 disabled:opacity-40 transition-colors"
                >
                  {runningAgent === agent.agentId || agent.isRunning ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Play size={10} />
                  )}
                  Run
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{agent.eligibleCount ?? 0} eligible</span>
                {agent.lastRun && (
                  <span>
                    Last: {new Date(agent.lastRun.completedAt || agent.lastRun.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {agent.lastRun?.status && (
                  <span className="flex items-center gap-1">
                    {getStatusIcon(agent.lastRun.status)}
                    {agent.lastRun.status}
                  </span>
                )}
              </div>
            </div>
          ))}
          {agents.length === 0 && (
            <div className="col-span-full text-center py-8 text-slate-300 text-sm">
              No agents configured.
            </div>
          )}
        </div>
      </div>

      {/* Run History Table */}
      <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider">
            Run History
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{runTotal} total runs</span>
            <button
              onClick={() => { setRunPage(1); loadData(1); }}
              className="p-1.5 bg-slate-50 rounded hover:bg-slate-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={12} className="text-slate-400" />
            </button>
          </div>
        </div>

        {runs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-200">
                    <th className="text-left py-2 px-3">Agent</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Triggered By</th>
                    <th className="text-right py-2 px-3">Processed</th>
                    <th className="text-right py-2 px-3">Duration</th>
                    <th className="text-right py-2 px-3">Cost</th>
                    <th className="text-left py-2 px-3">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run: any) => {
                    const sc = getStatusColor(run.status);
                    const duration = run.completedAt && run.createdAt
                      ? Math.round((new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime()) / 1000)
                      : null;
                    return (
                      <tr key={run._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <Bot size={12} className="text-slate-300" />
                            <span className="text-slate-600 capitalize">{(run.agentId || '—').replace(/-/g, ' ')}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${sc.bg} ${sc.text}`}>
                            {getStatusIcon(run.status)}
                            {run.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-xs capitalize">{run.triggeredBy || '—'}</td>
                        <td className="py-2 px-3 text-right text-slate-500 font-mono text-xs">
                          {run.itemsProcessed ?? '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400 font-mono text-xs">
                          {duration !== null ? `${duration}s` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-500 font-mono text-xs">
                          {run.totalCost != null ? `$${run.totalCost.toFixed(4)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-xs">
                          {new Date(run.createdAt).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {runTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                <span className="text-xs text-slate-400">Page {runPage} of {runTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRunPage(Math.max(1, runPage - 1))}
                    disabled={runPage <= 1}
                    className="p-1.5 bg-slate-50 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setRunPage(Math.min(runTotalPages, runPage + 1))}
                    disabled={runPage >= runTotalPages}
                    className="p-1.5 bg-slate-50 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-slate-300 text-sm">No agent runs recorded yet.</div>
        )}
      </div>
    </div>
  );
}

// ============ Weekly Performance Panel ============
function WeeklyPerformancePanel({ data }: { data: WeeklyPerformance | null }) {
  if (!data) {
    return (
      <EmptyState
        icon={<BarChart3 size={48} />}
        title="No performance data yet"
        description="Publish posts and log their metrics to see weekly performance insights."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
          Week-over-Week Trends
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <WoWCard label="Avg Engagement" value={`${data.weekOverWeek.engagementRate.thisWeek}%`} change={data.weekOverWeek.engagementRate.change} prev={`${data.weekOverWeek.engagementRate.lastWeek}%`} />
          <WoWCard label="Posts Published" value={data.weekOverWeek.postsPublished.thisWeek} change={data.weekOverWeek.postsPublished.change} prev={data.weekOverWeek.postsPublished.lastWeek} />
          <WoWCard label="Total Reach" value={data.weekOverWeek.totalReach.thisWeek.toLocaleString()} change={data.weekOverWeek.totalReach.change} prev={data.weekOverWeek.totalReach.lastWeek.toLocaleString()} />
          <WoWCard label="Leads Generated" value={data.weekOverWeek.leadsGenerated.thisWeek} change={data.weekOverWeek.leadsGenerated.change} prev={data.weekOverWeek.leadsGenerated.lastWeek} />
        </div>
      </div>

      {data.topPosts.length > 0 && (
        <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
            Top Performing Posts
          </h3>
          <div className="space-y-3">
            {data.topPosts.map((post, i) => (
              <div key={post._id} className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg font-bold font-mono text-brand-coral/70 w-6">#{i + 1}</span>
                    <div className="flex gap-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${post.platform === 'linkedin' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {post.platform}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {FORMAT_LABELS[post.format] || post.format}
                      </span>
                      {post.contentPillar !== 'uncategorized' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-brand-coral/5 text-brand-coral/70">
                          {post.contentPillar}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold font-mono text-green-600">{post.performance.engagementRate}%</div>
                    <div className="text-xs text-slate-300">engagement</div>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{post.hookPreview}</p>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>{post.performance.likes} likes</span>
                  <span>{post.performance.comments} comments</span>
                  <span>{post.performance.shares} shares</span>
                  <span>{post.performance.reach.toLocaleString()} reach</span>
                  {post.performance.saves > 0 && <span>{post.performance.saves} saves</span>}
                  {post.performance.dms > 0 && <span>{post.performance.dms} DMs</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.formatBreakdown.length > 0 && (
        <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
            Format Performance
          </h3>
          <div className="space-y-3">
            {data.formatBreakdown.map((fmt) => {
              const maxEng = Math.max(...data.formatBreakdown.map((f) => f.avgEngagement), 1);
              return (
                <div key={fmt.format} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-slate-600">{FORMAT_LABELS[fmt.format] || fmt.format}</div>
                  <div className="flex-1 h-6 bg-slate-50 rounded-full overflow-hidden relative">
                    <div className="h-full bg-brand-coral/50 rounded-full" style={{ width: `${(fmt.avgEngagement / maxEng) * 100}%` }} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-slate-600">
                      {fmt.avgEngagement}% avg eng
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 w-20 text-right">{fmt.postsCount} post{fmt.postsCount !== 1 ? 's' : ''}</div>
                  <div className="text-xs text-slate-300 w-20 text-right">{fmt.totalReach.toLocaleString()} reach</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
          Platform Comparison
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlatformCompareCard platform="LinkedIn" color="blue" thisWeek={data.platformSummary.thisWeek.linkedin} lastWeek={data.platformSummary.lastWeek.linkedin} />
          <PlatformCompareCard platform="Instagram" color="purple" thisWeek={data.platformSummary.thisWeek.instagram} lastWeek={data.platformSummary.lastWeek.instagram} />
        </div>
      </div>

      {data.contentToLeads.length > 0 && (
        <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
            Content to Pipeline Attribution
          </h3>
          <div className="space-y-3">
            {data.contentToLeads.map((item, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 truncate">{item.hookPreview}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${item.platform === 'linkedin' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                      {item.platform}
                    </span>
                    <span className="text-xs text-slate-400">{FORMAT_LABELS[item.format] || item.format}</span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-200 shrink-0" />
                <div className="text-right shrink-0">
                  <div className="text-sm font-medium text-slate-700">{item.leadCompany}</div>
                  <div className="text-xs text-slate-400">{item.leadStage} {item.dealValue > 0 && `· $${item.dealValue.toLocaleString()}`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Sub-Components ============

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-xl font-bold font-mono">{value}</div>
    </div>
  );
}

function AuditSummaryCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-xs text-slate-300 mt-0.5">{sub}</div>
    </div>
  );
}

function WoWCard({ label, value, change, prev }: { label: string; value: string | number; change: number; prev: string | number }) {
  const isPositive = change > 0;
  const isNeutral = change === 0;
  return (
    <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-xl font-bold font-mono">{value}</div>
      <div className="flex items-center gap-1 mt-1">
        {!isNeutral && (
          isPositive
            ? <TrendingUp size={12} className="text-green-600" />
            : <TrendingDown size={12} className="text-red-600" />
        )}
        <span className={`text-xs font-mono ${isNeutral ? 'text-slate-300' : isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isNeutral ? 'No change' : `${isPositive ? '+' : ''}${change}%`}
        </span>
        <span className="text-xs text-slate-200 ml-1">vs {prev}</span>
      </div>
    </div>
  );
}

function PlatformCompareCard({ platform, color, thisWeek, lastWeek }: {
  platform: string;
  color: 'blue' | 'purple';
  thisWeek: { postsCount: number; avgEngagement: number; totalReach: number };
  lastWeek: { postsCount: number; avgEngagement: number; totalReach: number };
}) {
  const borderClass = color === 'blue' ? 'border-blue-500' : 'border-purple-500';
  const textClass = color === 'blue' ? 'text-blue-600' : 'text-purple-400';
  const delta = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '+100%' : '—';
    const pct = Math.round(((curr - prev) / prev) * 100);
    return pct > 0 ? `+${pct}%` : `${pct}%`;
  };
  const deltaColor = (curr: number, prev: number) => curr >= prev ? 'text-green-600' : 'text-red-600';

  return (
    <div className={`bg-slate-50 rounded-lg p-4 border-l-2 ${borderClass}`}>
      <h4 className={`text-sm font-medium ${textClass} mb-3`}>{platform}</h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Posts</span>
          <span className="font-mono">
            {thisWeek.postsCount}
            <span className={`text-xs ml-2 ${deltaColor(thisWeek.postsCount, lastWeek.postsCount)}`}>
              {delta(thisWeek.postsCount, lastWeek.postsCount)}
            </span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Avg Engagement</span>
          <span className="font-mono">
            {thisWeek.avgEngagement}%
            <span className={`text-xs ml-2 ${deltaColor(thisWeek.avgEngagement, lastWeek.avgEngagement)}`}>
              {delta(thisWeek.avgEngagement, lastWeek.avgEngagement)}
            </span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Total Reach</span>
          <span className="font-mono">
            {thisWeek.totalReach.toLocaleString()}
            <span className={`text-xs ml-2 ${deltaColor(thisWeek.totalReach, lastWeek.totalReach)}`}>
              {delta(thisWeek.totalReach, lastWeek.totalReach)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div className="h-[240px] flex items-center justify-center text-slate-200 text-sm">No data for this period</div>;
}

// ============ Chart Tooltips ============

function CostTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-mono font-medium text-brand-coral">${payload[0].value.toFixed(4)}</p>
    </div>
  );
}

function CallsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-mono font-medium text-indigo-400">{payload[0].value} calls</p>
    </div>
  );
}

function OpTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
      <p className="text-xs text-slate-600 mb-1">{d.name}</p>
      <p className="text-sm font-mono font-medium text-brand-coral">${d.cost.toFixed(4)}</p>
      <p className="text-xs text-slate-400">{d.calls} calls</p>
    </div>
  );
}

function PieTooltipComp({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
      <p className="text-xs text-slate-600 mb-1">{d.name}</p>
      <p className="text-sm font-mono font-medium text-brand-coral">${d.value.toFixed(4)}</p>
      <p className="text-xs text-slate-400">{d.count} calls</p>
    </div>
  );
}
