import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { analyticsAPI, costsAPI } from '../api/client';
import EmptyState from '../components/shared/EmptyState';
import type { AnalyticsWeekly, CostSummary } from '../types';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsWeekly | null>(null);
  const [costs, setCosts] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'costs' | 'brief'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scoreRes, costRes] = await Promise.all([
        analyticsAPI.signalScore().catch(() => ({ data: null })),
        costsAPI.summary().catch(() => ({ data: null })),
      ]);
      setAnalytics(scoreRes.data);
      setCosts(costRes.data);
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
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['overview', 'costs', 'brief'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-sm capitalize ${
                tab === t ? 'bg-brand-coral text-white' : 'text-white/50'
              }`}
            >
              {t === 'brief' ? 'Monday Brief' : t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Loading...</div>
      ) : tab === 'overview' ? (
        <div className="space-y-6">
          {/* Signal Score */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">The Signal Score</p>
            <div
              className="text-6xl font-bold font-mono mb-2"
              style={{ color: scoreColor }}
            >
              {signalScore}
            </div>
            <p className="text-sm text-white/40">
              {signalScore >= 71 ? 'Strong signal' : signalScore >= 41 ? 'Needs attention' : 'Weak signal'}
            </p>

            {/* Score breakdown */}
            {analytics?.scoreBreakdown && (
              <div className="grid grid-cols-4 gap-4 mt-6">
                {[
                  { label: 'Posting', value: analytics.scoreBreakdown.postingConsistency, weight: '35%' },
                  { label: 'Pipeline', value: analytics.scoreBreakdown.pipelineActivity, weight: '35%' },
                  { label: 'Strategy', value: analytics.scoreBreakdown.strategyAlignment, weight: '20%' },
                  { label: 'Engagement', value: analytics.scoreBreakdown.engagementHealth, weight: '10%' },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="text-lg font-bold font-mono text-white/80">{Math.round(item.value)}</div>
                    <div className="text-xs text-white/40">{item.label}</div>
                    <div className="text-xs text-white/20">{item.weight}</div>
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

          {/* Pillar Performance */}
          {analytics?.pillarPerformance && analytics.pillarPerformance.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
                Pillar Performance
              </h3>
              <div className="space-y-3">
                {analytics.pillarPerformance.map((p) => (
                  <div key={p.pillar} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-white/70 truncate">{p.pillar}</div>
                    <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-coral/60 rounded-full"
                        style={{ width: `${Math.min(100, p.actualPercent)}%` }}
                      />
                    </div>
                    <div className="text-xs text-white/40 w-24 text-right">
                      {p.actualPercent}% / {p.targetPercent}%
                    </div>
                    <div className="text-xs text-white/30 w-16 text-right">
                      {p.avgEngagement > 0 ? `${p.avgEngagement.toFixed(1)}% eng` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Recommendations */}
          {analytics?.aiRecommendations && analytics.aiRecommendations.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
                Strategy Recommendations
              </h3>
              <div className="space-y-3">
                {analytics.aiRecommendations.map((rec, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-4">
                    <p className="text-sm text-white/80 mb-2">{rec.recommendation}</p>
                    <p className="text-xs text-white/40 mb-3">{rec.reasoning}</p>
                    {rec.evidence?.length > 0 && (
                      <p className="text-xs text-white/30 mb-3">
                        Evidence: {rec.evidence.join(', ')}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                        Accept
                      </button>
                      <button className="px-3 py-1 bg-white/5 text-white/40 rounded text-xs">
                        Dismiss
                      </button>
                      <button className="px-3 py-1 bg-white/5 text-white/40 rounded text-xs">
                        Discuss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : tab === 'costs' ? (
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">
              AI Cost Tracking
            </h3>
            {costs ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Cost" value={`$${costs.totalCost.toFixed(4)}`} />
                <StatCard label="API Calls" value={costs.totalCalls} />
                <StatCard label="Input Tokens" value={costs.totalInputTokens.toLocaleString()} />
                <StatCard label="Output Tokens" value={costs.totalOutputTokens.toLocaleString()} />
              </div>
            ) : (
              <p className="text-white/40 text-sm">No cost data available yet.</p>
            )}

            {costs?.byOperation && Object.keys(costs.byOperation).length > 0 && (
              <div>
                <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">By Operation</h4>
                <div className="space-y-2">
                  {Object.entries(costs.byOperation).map(([op, data]) => (
                    <div key={op} className="flex items-center justify-between bg-white/5 rounded p-2">
                      <span className="text-sm text-white/70">{op}</span>
                      <div className="flex gap-4 text-xs text-white/40">
                        <span>{data.calls} calls</span>
                        <span className="font-mono">${data.cost.toFixed(4)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Monday Brief */
        <div className="max-w-2xl mx-auto">
          {analytics?.mondayBriefContent ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Monday Brief</h3>
              <div className="prose prose-invert text-sm whitespace-pre-wrap">
                {analytics.mondayBriefContent}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 size={48} />}
              title="No Monday Brief yet"
              description="The weekly digest is generated every Monday based on the past week's activity."
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className="text-xl font-bold font-mono">{value}</div>
    </div>
  );
}
