import React, { useState, useEffect } from 'react';
import { useStrategy } from '../contexts/StrategyContext';
import { strategyAPI } from '../api/client';
import EmptyState from '../components/shared/EmptyState';
import { Compass, ChevronRight, Check } from 'lucide-react';

const SECTIONS = [
  { id: 1, title: 'Business Context', description: 'What MerakiPeople does and who it serves' },
  { id: 2, title: 'Goals & Metrics', description: 'Success targets and revenue goals' },
  { id: 3, title: 'Current State', description: 'Current platforms, content, and campaigns' },
  { id: 4, title: 'Voice & Positioning', description: 'How you communicate and what you stand for' },
  { id: 5, title: 'Campaigns', description: 'Upcoming launches, events, and priorities' },
];

export default function StrategyPage() {
  const { strategy, isComplete, refresh } = useStrategy();
  const [onboarding, setOnboarding] = useState(false);
  const [currentSection, setCurrentSection] = useState(1);
  const [answers, setAnswers] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completedSections, setCompletedSections] = useState<number[]>([]);

  useEffect(() => {
    if (!isComplete) setOnboarding(true);
    if (strategy?.onboardingProgress?.completedSections) {
      setCompletedSections(
        strategy.onboardingProgress.completedSections
          .map((s) => parseInt(s.replace('section_', ''), 10))
          .filter((n) => !isNaN(n))
      );
      setCurrentSection(strategy.onboardingProgress.currentSection || 1);
    }
  }, [isComplete, strategy]);

  const handleSubmitSection = async () => {
    if (!answers.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await strategyAPI.submitOnboarding(currentSection, { response: answers });
      setCompletedSections((prev) => [...prev, currentSection]);
      if (currentSection < 5) {
        setCurrentSection(currentSection + 1);
        setAiQuestion(data.nextQuestion || '');
      } else {
        setOnboarding(false);
        await refresh();
      }
      setAnswers('');
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Onboarding interview view
  if (onboarding && !isComplete) {
    const section = SECTIONS.find((s) => s.id === currentSection);
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Build Your Strategy</h1>
          <p className="text-white/50">
            This takes about 15 minutes. It will drive everything the system does for you.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {SECTIONS.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  completedSections.includes(s.id)
                    ? 'bg-green-500 text-white'
                    : s.id === currentSection
                      ? 'bg-brand-coral text-white'
                      : 'bg-white/10 text-white/40'
                }`}
              >
                {completedSections.includes(s.id) ? <Check size={14} /> : s.id}
              </div>
              {s.id < 5 && <ChevronRight size={14} className="text-white/20" />}
            </div>
          ))}
        </div>

        {/* Current section */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-1">
            Section {currentSection}: {section?.title}
          </h2>
          <p className="text-white/40 text-sm mb-6">{section?.description}</p>

          {aiQuestion && (
            <div className="bg-brand-indigo/30 rounded-lg p-4 mb-4 text-sm text-white/80">
              {aiQuestion}
            </div>
          )}

          <textarea
            value={answers}
            onChange={(e) => setAnswers(e.target.value)}
            placeholder="Type your response naturally — the AI will extract what it needs..."
            className="w-full h-48 bg-white/5 border border-white/10 rounded-lg p-4 text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-coral/50"
          />

          <div className="flex justify-end mt-4">
            <button
              onClick={handleSubmitSection}
              disabled={!answers.trim() || submitting}
              className="px-6 py-2.5 bg-brand-coral text-white rounded-lg font-medium hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
            >
              {submitting
                ? 'Processing...'
                : currentSection === 5
                  ? 'Complete Strategy'
                  : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Living Strategy Document view
  if (!strategy) {
    return (
      <EmptyState
        icon={<Compass size={48} />}
        title="The Signal is dark"
        description="Build your strategy to turn it on."
        action={{ label: 'Start Strategy Interview', onClick: () => setOnboarding(true) }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Marketing Strategy</h1>
          <p className="text-white/40 text-sm">
            Version {strategy.version} | Updated{' '}
            {new Date(strategy.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* North Star */}
        <StrategySection title="North Star" content={strategy.northStar} />

        {/* 90-Day Goal */}
        <StrategySection title="90-Day Goal" content={strategy.goal90Day} />

        {/* ICP */}
        <StrategySection
          title="Ideal Customer Profile"
          content={
            <div className="space-y-3">
              {strategy.icpPrimary && Object.keys(strategy.icpPrimary).length > 0 && (
                <div>
                  <span className="text-white/50 text-xs uppercase block mb-1">Primary:</span>
                  {strategy.icpPrimary.description && (
                    <p className="text-sm text-white/80 mb-2">{strategy.icpPrimary.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {strategy.icpPrimary.industry && (
                      <span className="text-xs bg-white/10 rounded-full px-3 py-1">Industry: {strategy.icpPrimary.industry}</span>
                    )}
                    {strategy.icpPrimary.companySize && (
                      <span className="text-xs bg-white/10 rounded-full px-3 py-1">Size: {strategy.icpPrimary.companySize}</span>
                    )}
                    {strategy.icpPrimary.role && (
                      <span className="text-xs bg-white/10 rounded-full px-3 py-1">Role: {strategy.icpPrimary.role}</span>
                    )}
                  </div>
                  {strategy.icpPrimary.painPoints?.length > 0 && (
                    <div className="mt-2">
                      <span className="text-white/40 text-xs">Pain Points:</span>
                      <ul className="mt-1 space-y-1">
                        {strategy.icpPrimary.painPoints.map((p: string, i: number) => (
                          <li key={i} className="text-sm text-white/70 pl-3 border-l-2 border-brand-coral/30">{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {strategy.icpSecondary?.description && (
                <div>
                  <span className="text-white/50 text-xs uppercase block mb-1">Secondary:</span>
                  <p className="text-sm text-white/80">{strategy.icpSecondary.description}</p>
                </div>
              )}
              {strategy.antiIcp && (
                <div>
                  <span className="text-white/50 text-xs uppercase block mb-1">Anti-ICP:</span>
                  <p className="text-sm text-white/80">{strategy.antiIcp}</p>
                </div>
              )}
              {!strategy.icpPrimary?.description && !strategy.antiIcp && (
                <p className="text-sm text-white/40">Not set</p>
              )}
            </div>
          }
        />

        {/* Positioning */}
        <StrategySection title="Positioning Statement" content={strategy.positioningStatement} />

        {/* Content Pillars */}
        <StrategySection
          title="Content Pillars"
          content={
            <div className="space-y-3">
              {strategy.contentPillars?.map((pillar, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/5 rounded-lg p-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-coral/20 flex items-center justify-center text-brand-coral font-bold text-sm">
                    {pillar.targetPercent}%
                  </div>
                  <div>
                    <div className="font-medium text-sm">{pillar.name}</div>
                    <div className="text-xs text-white/50">{pillar.purpose}</div>
                    <div className="text-xs text-white/30 mt-1">Owner: {pillar.owner}</div>
                  </div>
                </div>
              ))}
            </div>
          }
        />

        {/* Key Messages */}
        <StrategySection
          title="Key Messages"
          content={
            <ul className="space-y-2">
              {strategy.keyMessages?.map((msg, i) => (
                <li key={i} className="text-sm text-white/80 pl-4 border-l-2 border-brand-coral/50">
                  {msg}
                </li>
              ))}
            </ul>
          }
        />

        {/* Platform Strategy */}
        {strategy.platformStrategy?.length > 0 && (
          <StrategySection
            title="Platform Strategy"
            content={
              <div className="space-y-3">
                {strategy.platformStrategy.map((ps, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{ps.platform}</span>
                      {ps.weeklyTarget > 0 && (
                        <span className="text-xs bg-brand-coral/20 text-brand-coral rounded-full px-2 py-0.5">
                          {ps.weeklyTarget}x/week
                        </span>
                      )}
                    </div>
                    {ps.primaryPurpose && (
                      <p className="text-xs text-white/60 mb-1">{ps.primaryPurpose}</p>
                    )}
                    {ps.bestFormats?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ps.bestFormats.map((f, j) => (
                          <span key={j} className="text-xs bg-white/10 rounded px-2 py-0.5">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            }
          />
        )}

        {/* Voice & Tone */}
        {(strategy.voiceShohini || strategy.voiceSanjoy || strategy.sharedTone) && (
          <StrategySection
            title="Voice & Tone"
            content={
              <div className="space-y-3">
                {strategy.voiceShohini && (
                  <div>
                    <span className="text-white/50 text-xs uppercase block mb-1">Shohini's Voice:</span>
                    <p className="text-sm text-white/80">{strategy.voiceShohini}</p>
                  </div>
                )}
                {strategy.voiceSanjoy && (
                  <div>
                    <span className="text-white/50 text-xs uppercase block mb-1">Sanjoy's Voice:</span>
                    <p className="text-sm text-white/80">{strategy.voiceSanjoy}</p>
                  </div>
                )}
                {strategy.sharedTone && (
                  <div>
                    <span className="text-white/50 text-xs uppercase block mb-1">Shared Tone:</span>
                    <p className="text-sm text-white/80">{strategy.sharedTone}</p>
                  </div>
                )}
                {strategy.bannedPhrases?.length > 0 && (
                  <div>
                    <span className="text-white/50 text-xs uppercase block mb-1">Banned Phrases:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {strategy.bannedPhrases.map((phrase, i) => (
                        <span key={i} className="text-xs bg-red-500/20 text-red-300 rounded-full px-3 py-1">
                          {phrase}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            }
          />
        )}

        {/* Metrics Targets */}
        <StrategySection
          title="Metrics Targets"
          content={
            strategy.metricsTargets && Object.values(strategy.metricsTargets).some(v => v != null) ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {strategy.metricsTargets.linkedinFollowers != null && (
                  <MetricCard label="LinkedIn Followers" value={strategy.metricsTargets.linkedinFollowers.toLocaleString()} />
                )}
                {strategy.metricsTargets.linkedinEngagementRate != null && (
                  <MetricCard label="LinkedIn Engagement" value={`${strategy.metricsTargets.linkedinEngagementRate}%`} />
                )}
                {strategy.metricsTargets.linkedinDmsPerWeek != null && (
                  <MetricCard label="LinkedIn DMs/Week" value={strategy.metricsTargets.linkedinDmsPerWeek.toString()} />
                )}
                {strategy.metricsTargets.instagramFollowers != null && (
                  <MetricCard label="Instagram Followers" value={strategy.metricsTargets.instagramFollowers.toLocaleString()} />
                )}
                {strategy.metricsTargets.instagramReach != null && (
                  <MetricCard label="Instagram Reach" value={strategy.metricsTargets.instagramReach.toLocaleString()} />
                )}
                {strategy.metricsTargets.leadsPerMonth != null && (
                  <MetricCard label="Leads/Month" value={strategy.metricsTargets.leadsPerMonth.toString()} />
                )}
                {strategy.metricsTargets.mrrTarget != null && (
                  <MetricCard label="MRR Target" value={`$${strategy.metricsTargets.mrrTarget.toLocaleString()}`} />
                )}
                {strategy.metricsTargets.trainingRevenueTarget != null && (
                  <MetricCard label="Training Revenue" value={`$${strategy.metricsTargets.trainingRevenueTarget.toLocaleString()}`} />
                )}
              </div>
            ) : (
              <p className="text-sm text-white/40">Not set</p>
            )
          }
        />
      </div>
    </div>
  );
}

function StrategySection({
  title,
  content,
  mono,
}: {
  title: string;
  content: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-3">
        {title}
      </h3>
      {typeof content === 'string' ? (
        <p className={`text-sm text-white/80 whitespace-pre-wrap ${mono ? 'font-mono text-xs' : ''}`}>
          {content || 'Not set'}
        </p>
      ) : (
        content
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-brand-coral">{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
    </div>
  );
}
