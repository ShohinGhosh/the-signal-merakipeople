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
        strategy.onboardingProgress.completedSections.map((s) => parseInt(s))
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
            <div className="space-y-2">
              <div>
                <span className="text-white/50 text-xs uppercase">Primary:</span>
                <p className="text-sm">{JSON.stringify(strategy.icpPrimary)}</p>
              </div>
              <div>
                <span className="text-white/50 text-xs uppercase">Anti-ICP:</span>
                <p className="text-sm">{strategy.antiIcp}</p>
              </div>
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

        {/* Metrics Targets */}
        <StrategySection
          title="Metrics Targets"
          content={JSON.stringify(strategy.metricsTargets, null, 2)}
          mono
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
