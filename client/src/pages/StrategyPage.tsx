import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrategy } from '../contexts/StrategyContext';
import { strategyAPI, analyticsAPI } from '../api/client';
import EmptyState from '../components/shared/EmptyState';
import type { Strategy, RawInputs, PlatformBenchmarks, WeeklyPerformance } from '../types';
import {
  Compass,
  ChevronRight,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Edit3,
  ArrowLeft,
  Upload,
  TrendingUp,
  TrendingDown,
  Image as ImageIcon,
  Lock,
  Pencil,
  Save,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: '1', key: 'section1_businessContext' as keyof RawInputs, title: 'Business Context', description: 'What MerakiPeople does and who it serves' },
  { id: '2', key: 'section2_goalsMetrics' as keyof RawInputs, title: 'Goals & Metrics', description: 'Success targets and revenue goals' },
  { id: '3', key: 'section3_currentState' as keyof RawInputs, title: 'Current State', description: 'Current platforms, content, and campaigns' },
  { id: '3a', key: 'section3a_platformMetrics' as keyof RawInputs, title: 'Platform Snapshot', description: 'LinkedIn & Instagram metrics and growth goals' },
  { id: '4', key: 'section4_voicePositioning' as keyof RawInputs, title: 'Voice & Positioning', description: 'How you communicate and what you stand for' },
  { id: '5', key: 'section5_campaigns' as keyof RawInputs, title: 'Campaigns', description: 'Upcoming launches, events, and priorities' },
];

// ---------------------------------------------------------------------------
// Platform Snapshot form types, serialization & parsing
// ---------------------------------------------------------------------------

interface PlatformFormState {
  linkedin: {
    current_followers: string;
    avg_impressions: string;
    best_format: string;
    pipeline_generating: string;
    channel_purpose: string;
    target_90d: string;
  };
  instagram: {
    is_active: boolean;
    current_followers: string;
    avg_reach: string;
    best_format: string;
    pipeline_generating: string;
    channel_purpose: string;
    target_90d: string;
  };
}

const EMPTY_FORM: PlatformFormState = {
  linkedin: { current_followers: '', avg_impressions: '', best_format: '', pipeline_generating: '', channel_purpose: '', target_90d: '' },
  instagram: { is_active: true, current_followers: '', avg_reach: '', best_format: '', pipeline_generating: '', channel_purpose: '', target_90d: '' },
};

const LINKEDIN_FORMATS = ['Text posts', 'Carousels', 'Video', 'Articles', 'Polls'];
const INSTAGRAM_FORMATS = ['Reels', 'Carousels', 'Single images', 'Stories'];
const LINKEDIN_PURPOSES = ['Lead generation', 'Brand awareness', 'Thought leadership', 'Community building', 'Leads + Awareness'];
const INSTAGRAM_PURPOSES = ['Brand awareness', 'Personal brand', 'Lead generation', 'Community', 'Awareness + Leads'];

function serializePlatformForm(form: PlatformFormState): string {
  const lines: string[] = ['LinkedIn:'];
  lines.push(`- Current Followers: ${form.linkedin.current_followers || '—'}`);
  lines.push(`- Avg Impressions: ${form.linkedin.avg_impressions || '—'}`);
  lines.push(`- Best Format: ${form.linkedin.best_format || '—'}`);
  lines.push(`- Pipeline Generating: ${form.linkedin.pipeline_generating || '—'}`);
  lines.push(`- Channel Purpose: ${form.linkedin.channel_purpose || '—'}`);
  lines.push(`- 90-Day Follower Target: ${form.linkedin.target_90d || '—'}`);
  lines.push('');
  lines.push('Instagram:');
  if (!form.instagram.is_active) {
    lines.push('- Active: No (Secondary — 1x/week, brand awareness only)');
  } else {
    lines.push('- Active: Yes');
    lines.push(`- Current Followers: ${form.instagram.current_followers || '—'}`);
    lines.push(`- Avg Reach: ${form.instagram.avg_reach || '—'}`);
    lines.push(`- Best Format: ${form.instagram.best_format || '—'}`);
    lines.push(`- Pipeline Generating: ${form.instagram.pipeline_generating || '—'}`);
    lines.push(`- Channel Purpose: ${form.instagram.channel_purpose || '—'}`);
    lines.push(`- 90-Day Follower Target: ${form.instagram.target_90d || '—'}`);
  }
  return lines.join('\n');
}

function parsePlatformText(text: string): PlatformFormState {
  if (!text) return { ...EMPTY_FORM, linkedin: { ...EMPTY_FORM.linkedin }, instagram: { ...EMPTY_FORM.instagram } };

  const extract = (pattern: RegExp): string => {
    const match = text.match(pattern);
    return match?.[1]?.trim() === '—' ? '' : (match?.[1]?.trim() || '');
  };

  const isInstaActive = !text.includes('Active: No');

  return {
    linkedin: {
      current_followers: extract(/LinkedIn:[\s\S]*?Current Followers:\s*(.+)/),
      avg_impressions: extract(/LinkedIn:[\s\S]*?Avg Impressions:\s*(.+)/),
      best_format: extract(/LinkedIn:[\s\S]*?Best Format:\s*(.+)/),
      pipeline_generating: extract(/LinkedIn:[\s\S]*?Pipeline Generating:\s*(.+)/),
      channel_purpose: extract(/LinkedIn:[\s\S]*?Channel Purpose:\s*(.+)/),
      target_90d: extract(/LinkedIn:[\s\S]*?90-Day Follower Target:\s*(.+)/),
    },
    instagram: {
      is_active: isInstaActive,
      current_followers: isInstaActive ? extract(/Instagram:[\s\S]*?Current Followers:\s*(.+)/) : '',
      avg_reach: isInstaActive ? extract(/Instagram:[\s\S]*?Avg Reach:\s*(.+)/) : '',
      best_format: isInstaActive ? extract(/Instagram:[\s\S]*?Best Format:\s*(.+)/) : '',
      pipeline_generating: isInstaActive ? extract(/Instagram:[\s\S]*?Pipeline Generating:\s*(.+)/) : '',
      channel_purpose: isInstaActive ? extract(/Instagram:[\s\S]*?Channel Purpose:\s*(.+)/) : '',
      target_90d: isInstaActive ? extract(/Instagram:[\s\S]*?90-Day Follower Target:\s*(.+)/) : '',
    },
  };
}

// ---------------------------------------------------------------------------
// PlatformSnapshotForm component
// ---------------------------------------------------------------------------

function PlatformSnapshotForm({
  initialText,
  onSave,
  onCancel,
  saving,
}: {
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<PlatformFormState>(() => parsePlatformText(initialText));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const updateLinkedin = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, linkedin: { ...prev.linkedin, [field]: value } }));
  const updateInstagram = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, instagram: { ...prev.instagram, [field]: value } }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await strategyAPI.extractPlatformMetrics(base64);
      const metrics = res.data?.metrics;
      if (metrics) {
        // Populate LinkedIn fields
        if (metrics.linkedin) {
          const li = metrics.linkedin;
          setForm((prev) => ({
            ...prev,
            linkedin: {
              current_followers: li.current_followers != null ? String(li.current_followers) : prev.linkedin.current_followers,
              avg_impressions: li.avg_impressions != null ? String(li.avg_impressions) : prev.linkedin.avg_impressions,
              best_format: li.best_format || prev.linkedin.best_format,
              pipeline_generating: li.pipeline_generating != null ? (li.pipeline_generating ? 'Yes' : 'No') : prev.linkedin.pipeline_generating,
              channel_purpose: li.channel_purpose || prev.linkedin.channel_purpose,
              target_90d: li.target_90d != null ? String(li.target_90d) : prev.linkedin.target_90d,
            },
          }));
        }
        // Populate Instagram fields
        if (metrics.instagram) {
          const ig = metrics.instagram;
          setForm((prev) => ({
            ...prev,
            instagram: {
              is_active: ig.is_active ?? prev.instagram.is_active,
              current_followers: ig.current_followers != null ? String(ig.current_followers) : prev.instagram.current_followers,
              avg_reach: ig.avg_reach != null ? String(ig.avg_reach) : prev.instagram.avg_reach,
              best_format: ig.best_format || prev.instagram.best_format,
              pipeline_generating: ig.pipeline_generating != null ? (ig.pipeline_generating ? 'Yes' : 'No') : prev.instagram.pipeline_generating,
              channel_purpose: ig.channel_purpose || prev.instagram.channel_purpose,
              target_90d: ig.target_90d != null ? String(ig.target_90d) : prev.instagram.target_90d,
            },
          }));
        }
      }
    } catch (err) {
      console.error('Image extraction error:', err);
      setUploadError('Could not extract metrics from image. Please fill in manually.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = () => {
    onSave(serializePlatformForm(form));
  };

  const hasAnyData =
    form.linkedin.current_followers || form.linkedin.avg_impressions || form.linkedin.target_90d ||
    form.instagram.current_followers || form.instagram.avg_reach || form.instagram.target_90d;

  return (
    <div className="space-y-4">
      {/* Image upload */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors text-sm">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'Analyzing...' : 'Upload Screenshot'}
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
        </label>
        <span className="text-xs text-slate-300">Upload a profile or analytics screenshot to auto-fill</span>
      </div>
      {uploadError && (
        <p className="text-xs text-red-600">{uploadError}</p>
      )}

      {/* Two-column platform cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LinkedIn Card */}
        <div className="bg-slate-50 rounded-xl p-4 border-l-2 border-blue-500 space-y-3">
          <h4 className="text-sm font-semibold text-blue-600">LinkedIn</h4>
          <FormNumberInput label="Current Followers" value={form.linkedin.current_followers} onChange={(v) => updateLinkedin('current_followers', v)} placeholder="e.g. 1200" />
          <FormNumberInput label="Avg Impressions" value={form.linkedin.avg_impressions} onChange={(v) => updateLinkedin('avg_impressions', v)} placeholder="e.g. 800" />
          <FormSelect label="Best Format" value={form.linkedin.best_format} onChange={(v) => updateLinkedin('best_format', v)} options={LINKEDIN_FORMATS} />
          <FormToggle label="Pipeline Generating?" value={form.linkedin.pipeline_generating} onChange={(v) => updateLinkedin('pipeline_generating', v)} />
          <FormSelect label="Channel Purpose" value={form.linkedin.channel_purpose} onChange={(v) => updateLinkedin('channel_purpose', v)} options={LINKEDIN_PURPOSES} />
          <FormNumberInput label="90-Day Follower Target" value={form.linkedin.target_90d} onChange={(v) => updateLinkedin('target_90d', v)} placeholder="e.g. 2000" />
        </div>

        {/* Instagram Card */}
        <div className="bg-slate-50 rounded-xl p-4 border-l-2 border-purple-500 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-purple-400">Instagram</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Active</span>
              <button
                onClick={() => updateInstagram('is_active', !form.instagram.is_active)}
                className={`w-10 h-5 rounded-full transition-colors relative ${form.instagram.is_active ? 'bg-purple-500' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.instagram.is_active ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
          {form.instagram.is_active ? (
            <>
              <FormNumberInput label="Current Followers" value={form.instagram.current_followers} onChange={(v) => updateInstagram('current_followers', v)} placeholder="e.g. 500" />
              <FormNumberInput label="Avg Reach" value={form.instagram.avg_reach} onChange={(v) => updateInstagram('avg_reach', v)} placeholder="e.g. 300" />
              <FormSelect label="Best Format" value={form.instagram.best_format} onChange={(v) => updateInstagram('best_format', v)} options={INSTAGRAM_FORMATS} />
              <FormToggle label="Pipeline Generating?" value={form.instagram.pipeline_generating} onChange={(v) => updateInstagram('pipeline_generating', v)} />
              <FormSelect label="Channel Purpose" value={form.instagram.channel_purpose} onChange={(v) => updateInstagram('channel_purpose', v)} options={INSTAGRAM_PURPOSES} />
              <FormNumberInput label="90-Day Follower Target" value={form.instagram.target_90d} onChange={(v) => updateInstagram('target_90d', v)} placeholder="e.g. 800" />
            </>
          ) : (
            <p className="text-xs text-slate-400 py-2">Secondary — 1x/week, brand awareness only</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !hasAnyData}
          className="flex items-center gap-1.5 px-5 py-2 text-sm bg-brand-coral text-white rounded-lg hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Save
        </button>
      </div>
    </div>
  );
}

// Form sub-components
function FormNumberInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20"
      />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20 appearance-none"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function FormToggle({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <div className="flex gap-2">
        <button
          onClick={() => onChange('Yes')}
          className={`px-3 py-1 text-xs rounded-lg border transition-colors ${value === 'Yes' ? 'bg-green-50 border-green-300 text-green-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-500'}`}
        >
          Yes
        </button>
        <button
          onClick={() => onChange('No')}
          className={`px-3 py-1 text-xs rounded-lg border transition-colors ${value === 'No' ? 'bg-red-50 border-red-300 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-500'}`}
        >
          No
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function StrategyPage() {
  const { strategy, isComplete, allInputsFilled, hasGeneratedContent, refresh } = useStrategy();

  // Local state
  const [editMode, setEditMode] = useState(false);

  // ---- Determine which state to show ----

  // State C: Living Strategy Document (isComplete and not editing)
  if (isComplete && !editMode) {
    return (
      <LivingStrategyDocument
        strategy={strategy!}
        onEditInputs={() => setEditMode(true)}
      />
    );
  }

  // State B: Review & Generate (all inputs filled OR editMode from State C)
  if (allInputsFilled || editMode) {
    return (
      <ReviewAndGenerate
        strategy={strategy!}
        hasGeneratedContent={hasGeneratedContent}
        refresh={refresh}
        onApproved={() => setEditMode(false)}
        showBackToStrategy={editMode && isComplete}
        onBackToStrategy={() => setEditMode(false)}
      />
    );
  }

  // State A: Onboarding Interview (not complete and not all inputs filled)
  if (strategy) {
    return <OnboardingInterview strategy={strategy} refresh={refresh} />;
  }

  // No strategy at all — empty state
  return (
    <EmptyState
      icon={<Compass size={48} />}
      title="The Signal is dark"
      description="Build your strategy to turn it on."
      action={{ label: 'Start Strategy Interview', onClick: () => refresh() }}
    />
  );
}

// ===========================================================================
// STATE A: Onboarding Interview
// ===========================================================================

function OnboardingInterview({
  strategy,
  refresh,
}: {
  strategy: Strategy;
  refresh: () => Promise<void>;
}) {
  const [currentSection, setCurrentSection] = useState('1');
  const [answers, setAnswers] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completedSections, setCompletedSections] = useState<string[]>([]);

  // Derive completed sections from rawInputs
  useEffect(() => {
    const completed: string[] = [];
    SECTIONS.forEach((s) => {
      if (strategy.rawInputs?.[s.key]) {
        completed.push(s.id);
      }
    });
    setCompletedSections(completed);

    // Set current section to the first incomplete section
    const firstIncomplete = SECTIONS.find((s) => !strategy.rawInputs?.[s.key]);
    if (firstIncomplete) {
      setCurrentSection(firstIncomplete.id);
    }
  }, [strategy]);

  // Pre-fill textarea when navigating to a section that already has text
  useEffect(() => {
    const section = SECTIONS.find((s) => s.id === currentSection);
    if (section && strategy.rawInputs?.[section.key]) {
      setAnswers(strategy.rawInputs[section.key]);
    } else {
      setAnswers('');
    }
  }, [currentSection, strategy]);

  const handleSubmitSection = async () => {
    if (!answers.trim()) return;
    setSubmitting(true);
    try {
      await strategyAPI.submitOnboarding(currentSection, { response: answers });
      setCompletedSections((prev) =>
        prev.includes(currentSection) ? prev : [...prev, currentSection]
      );
      const currentIdx = SECTIONS.findIndex((s) => s.id === currentSection);
      if (currentIdx < SECTIONS.length - 1) {
        setCurrentSection(SECTIONS[currentIdx + 1].id);
      } else {
        // After last section: refresh to transition to State B
        await refresh();
      }
      setAnswers('');
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSectionClick = (sectionId: string) => {
    // Allow clicking on completed sections or the current section
    if (completedSections.includes(sectionId) || sectionId === currentSection) {
      setCurrentSection(sectionId);
    }
  };

  const section = SECTIONS.find((s) => s.id === currentSection);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Build Your Strategy</h1>
        <p className="text-slate-500">
          This takes about 15 minutes. It will drive everything the system does for you.
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-1.5 mb-8">
        {SECTIONS.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <button
              onClick={() => handleSectionClick(s.id)}
              disabled={!completedSections.includes(s.id) && s.id !== currentSection}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                completedSections.includes(s.id)
                  ? 'bg-green-500 text-white cursor-pointer hover:bg-green-400'
                  : s.id === currentSection
                    ? 'bg-brand-coral text-white'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title={s.title}
            >
              {completedSections.includes(s.id) ? <Check size={14} /> : s.id.toUpperCase()}
            </button>
            {idx < SECTIONS.length - 1 && <ChevronRight size={12} className="text-slate-200" />}
          </div>
        ))}
      </div>

      {/* Current section */}
      <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-1">
          Section {currentSection.toUpperCase()}: {section?.title}
        </h2>
        <p className="text-slate-400 text-sm mb-6">{section?.description}</p>

        {currentSection === '3a' ? (
          <PlatformSnapshotForm
            initialText={answers}
            onSave={async (text) => {
              setSubmitting(true);
              try {
                await strategyAPI.submitOnboarding('3a', { response: text });
                setCompletedSections((prev) => prev.includes('3a') ? prev : [...prev, '3a']);
                const currentIdx = SECTIONS.findIndex((s) => s.id === '3a');
                if (currentIdx < SECTIONS.length - 1) {
                  setCurrentSection(SECTIONS[currentIdx + 1].id);
                } else {
                  await refresh();
                }
                setAnswers('');
              } catch (err) {
                console.error('Onboarding error:', err);
              } finally {
                setSubmitting(false);
              }
            }}
            onCancel={() => {
              const idx = SECTIONS.findIndex((s) => s.id === '3a');
              if (idx > 0) setCurrentSection(SECTIONS[idx - 1].id);
            }}
            saving={submitting}
          />
        ) : (
          <>
            <textarea
              value={answers}
              onChange={(e) => setAnswers(e.target.value)}
              placeholder="Type your response naturally..."
              className="w-full h-48 bg-white border border-slate-200 rounded-lg p-4 text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20"
            />

            <div className="flex justify-between mt-4">
              <div>
                {SECTIONS.findIndex((s) => s.id === currentSection) > 0 && (
                  <button
                    onClick={() => {
                      const idx = SECTIONS.findIndex((s) => s.id === currentSection);
                      if (idx > 0) setCurrentSection(SECTIONS[idx - 1].id);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                )}
              </div>
              <button
                onClick={handleSubmitSection}
                disabled={!answers.trim() || submitting}
                className="px-6 py-2.5 bg-brand-coral text-white rounded-lg font-medium hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </span>
                ) : currentSection === '5' ? (
                  'Complete & Review'
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// STATE B: Review & Generate
// ===========================================================================

function ReviewAndGenerate({
  strategy,
  hasGeneratedContent,
  refresh,
  onApproved,
  showBackToStrategy,
  onBackToStrategy,
}: {
  strategy: Strategy;
  hasGeneratedContent: boolean;
  refresh: () => Promise<void>;
  onApproved: () => void;
  showBackToStrategy: boolean;
  onBackToStrategy: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingSection, setSavingSection] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['1']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<{
    onboardingSections: number;
    contentHistoryPosts: number;
    hasPerformanceData: boolean;
    performanceRecommendations: number;
  } | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setErrorMsg(null);
    setDataSources(null);
    try {
      const { data } = await strategyAPI.generate();
      if (data.dataSources) setDataSources(data.dataSources);
      await refresh();
    } catch (err: any) {
      console.error('Generation error:', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to generate strategy';
      setErrorMsg(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await strategyAPI.approve();
      await refresh();
      onApproved();
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setApproving(false);
    }
  };

  const handleEditSection = (sectionId: string) => {
    const section = SECTIONS.find((s) => s.id === sectionId);
    if (section) {
      setEditText(strategy.rawInputs?.[section.key] || '');
      setEditingSection(sectionId);
    }
  };

  const handleSaveSection = async () => {
    if (editingSection === null) return;
    setSavingSection(true);
    try {
      await strategyAPI.submitOnboarding(editingSection, { response: editText });
      await refresh();
      setEditingSection(null);
      setEditText('');
    } catch (err) {
      console.error('Save section error:', err);
    } finally {
      setSavingSection(false);
    }
  };

  const toggleExpanded = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Loading overlay */}
      {generating && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <Loader2 size={48} className="animate-spin text-brand-coral mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Generating your marketing strategy...</h3>
            <p className="text-slate-500 text-sm">This may take a minute or two.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {showBackToStrategy && (
              <button
                onClick={onBackToStrategy}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h1 className="text-2xl font-bold">Review & Generate Your Strategy</h1>
          </div>
        </div>
        <p className="text-slate-500 text-sm">
          Review your inputs on the left, then generate your strategy on the right.
        </p>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-coral text-white rounded-lg font-medium hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
          {hasGeneratedContent ? 'Regenerate' : 'Generate Strategy'}
        </button>
        <button
          onClick={handleApprove}
          disabled={!hasGeneratedContent || approving}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 disabled:opacity-40 transition-colors"
        >
          {approving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
          Approve & Activate
        </button>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <span className="text-red-600 text-sm flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400/60 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* Left column: Your Inputs (40%) */}
        <div className="w-2/5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Your Inputs
          </h2>
          {SECTIONS.map((section) => {
            const isExpanded = expandedSections.includes(section.id);
            const isEditing = editingSection === section.id;
            const rawText = strategy.rawInputs?.[section.key] || '';

            return (
              <div
                key={section.id}
                className="bg-white border border-slate-200/60 rounded-xl shadow-sm overflow-hidden"
              >
                {/* Accordion header */}
                <button
                  onClick={() => toggleExpanded(section.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check size={12} />
                    </div>
                    <span className="font-medium text-sm">{section.title}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                </button>

                {/* Accordion body */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100">
                    {isEditing && section.id === '3a' ? (
                      <div className="mt-3">
                        <PlatformSnapshotForm
                          initialText={rawText}
                          onSave={async (text) => {
                            setSavingSection(true);
                            try {
                              await strategyAPI.submitOnboarding('3a', { response: text });
                              await refresh();
                              setEditingSection(null);
                            } catch (err) {
                              console.error('Save section error:', err);
                            } finally {
                              setSavingSection(false);
                            }
                          }}
                          onCancel={() => { setEditingSection(null); setEditText(''); }}
                          saving={savingSection}
                        />
                      </div>
                    ) : isEditing ? (
                      <div className="mt-3">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full h-36 bg-white border border-slate-200 rounded-lg p-3 text-slate-900 text-sm placeholder-slate-400 resize-none focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => {
                              setEditingSection(null);
                              setEditText('');
                            }}
                            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveSection}
                            disabled={savingSection || !editText.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-coral text-white rounded-lg hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
                          >
                            {savingSection ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : null}
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        {section.id === '3a' && rawText ? (
                          <PlatformSnapshotDisplay text={rawText} />
                        ) : (
                          <p className="text-sm text-slate-600 whitespace-pre-wrap">
                            {rawText || 'No input provided'}
                          </p>
                        )}
                        <button
                          onClick={() => handleEditSection(section.id)}
                          className="flex items-center gap-1.5 mt-2 text-xs text-brand-coral hover:text-brand-coral/80 transition-colors"
                        >
                          <Edit3 size={12} />
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right column: Generated Strategy (60%) */}
        <div className="w-3/5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Generated Strategy
          </h2>
          {hasGeneratedContent ? (
            <div className="space-y-4">
              {/* Data sources banner */}
              {dataSources && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                  <span className="font-semibold">Data sources used:</span>{' '}
                  {dataSources.onboardingSections} interview sections
                  {dataSources.contentHistoryPosts > 0
                    ? `, ${dataSources.contentHistoryPosts} past posts from content history`
                    : ', no content history uploaded'}
                  {dataSources.hasPerformanceData
                    ? `, ${dataSources.performanceRecommendations} performance-based recommendations`
                    : ', no performance data yet'}
                </div>
              )}
              <StrategySection title="North Star" content={strategy.northStar} />
              <StrategySection title="90-Day Goal" content={strategy.goal90Day} />
              <StrategySection
                title="Ideal Customer Profile"
                content={<ICPContent strategy={strategy} />}
              />
              <StrategySection title="Positioning Statement" content={strategy.positioningStatement} />
              <StrategySection
                title="Content Pillars"
                content={<ContentPillarsContent pillars={strategy.contentPillars} />}
              />
              <StrategySection
                title="Key Messages"
                content={<KeyMessagesContent messages={strategy.keyMessages} />}
              />
              {strategy.platformStrategy?.length > 0 && (
                <StrategySection
                  title="Platform Strategy"
                  content={<PlatformStrategyContent platforms={strategy.platformStrategy} />}
                />
              )}
              {(strategy.voiceShohini || strategy.voiceSanjoy || strategy.sharedTone) && (
                <StrategySection
                  title="Voice & Tone"
                  content={<VoiceToneContent strategy={strategy} />}
                />
              )}
              <StrategySection
                title="Metrics Targets"
                content={<MetricsTargetsContent targets={strategy.metricsTargets} />}
              />
              {strategy.platformBenchmarks && Object.keys(strategy.platformBenchmarks).length > 0 && (
                <StrategySection
                  title="Platform Benchmarks & Targets"
                  content={<PlatformBenchmarksContent benchmarks={strategy.platformBenchmarks} />}
                />
              )}
              <StrategySection
                title="This Week's Performance"
                content={<LastWeekPerformanceSummary />}
              />
            </div>
          ) : (
            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-8 text-center">
              <Compass size={40} className="text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2 text-slate-500">No strategy generated yet</h3>
              <p className="text-sm text-slate-400">
                Click "Generate Strategy" to create your marketing strategy from your inputs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// STATE C: Living Strategy Document
// ===========================================================================

function LivingStrategyDocument({
  strategy,
  onEditInputs,
}: {
  strategy: Strategy;
  onEditInputs: () => void;
}) {
  const { refresh } = useStrategy();
  const navigate = useNavigate();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editMessages, setEditMessages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const startEdit = (field: string, currentValue: string | string[]) => {
    setEditingField(field);
    if (Array.isArray(currentValue)) {
      setEditMessages([...currentValue]);
      setEditValue('');
    } else {
      setEditValue(currentValue || '');
      setEditMessages([]);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    setEditMessages([]);
  };

  const saveField = async (field: string, value: any) => {
    setSaving(true);
    try {
      await strategyAPI.update(strategy._id, { [field]: value }, `Updated ${field}`);
      await refresh();
      setEditingField(null);
      setEditValue('');
      setEditMessages([]);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Marketing Strategy</h1>
          <p className="text-slate-400 text-sm">
            Version {strategy.version} | Updated{' '}
            {new Date(strategy.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={onEditInputs}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          <Edit3 size={14} />
          Re-run Strategy Interview
        </button>
      </div>

      {/* ── Foundation: stable, rarely changes ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={14} className="text-slate-400" />
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Foundation
          </h2>
          <span className="text-[10px] text-slate-300 ml-1">
            Business context, ICP, positioning, pillars, voice
          </span>
          <button
            onClick={() => navigate('/settings')}
            className="ml-auto text-[11px] text-brand-coral hover:text-brand-coral/80 flex items-center gap-1"
          >
            <Pencil size={10} />
            Edit in Settings
          </button>
        </div>
        <div className="space-y-4">
          <StrategySection title="North Star" content={strategy.northStar} />
          <StrategySection
            title="Ideal Customer Profile"
            content={<ICPContent strategy={strategy} />}
          />
          <StrategySection title="Positioning Statement" content={strategy.positioningStatement} />
          <StrategySection
            title="Content Pillars"
            content={<ContentPillarsContent pillars={strategy.contentPillars} />}
          />
          {strategy.platformStrategy?.length > 0 && (
            <StrategySection
              title="Platform Strategy"
              content={<PlatformStrategyContent platforms={strategy.platformStrategy} />}
            />
          )}
          {(strategy.voiceShohini || strategy.voiceSanjoy || strategy.sharedTone) && (
            <StrategySection
              title="Voice & Tone"
              content={<VoiceToneContent strategy={strategy} />}
            />
          )}
        </div>
      </div>

      {/* ── Current Focus: changes often, inline-editable ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Pencil size={14} className="text-brand-coral" />
          <h2 className="text-xs font-semibold text-brand-coral uppercase tracking-wider">
            Current Focus
          </h2>
          <span className="text-[10px] text-slate-300 ml-1">
            Goals, campaigns, metrics — click the pencil to edit directly
          </span>
        </div>
        <div className="space-y-4">
          {/* 90-Day Goal — editable */}
          <EditableSection
            title="90-Day Goal"
            field="goal90Day"
            value={strategy.goal90Day}
            editingField={editingField}
            editValue={editValue}
            saving={saving}
            onStartEdit={startEdit}
            onCancel={cancelEdit}
            onChange={setEditValue}
            onSave={saveField}
          />

          {/* Key Messages — editable list */}
          <EditableListSection
            title="Key Messages"
            field="keyMessages"
            items={strategy.keyMessages}
            editingField={editingField}
            editMessages={editMessages}
            saving={saving}
            onStartEdit={startEdit}
            onCancel={cancelEdit}
            onChangeMessages={setEditMessages}
            onSave={saveField}
            renderView={<KeyMessagesContent messages={strategy.keyMessages} />}
          />

          {/* Metrics Targets */}
          <StrategySection
            title="Metrics Targets"
            content={<MetricsTargetsContent targets={strategy.metricsTargets} />}
          />

          {/* Platform Benchmarks & Targets */}
          {strategy.platformBenchmarks && Object.keys(strategy.platformBenchmarks).length > 0 && (
            <StrategySection
              title="Platform Benchmarks & Targets"
              content={<PlatformBenchmarksContent benchmarks={strategy.platformBenchmarks} />}
            />
          )}

          {/* Last Week Performance */}
          <StrategySection
            title="This Week's Performance"
            content={<LastWeekPerformanceSummary />}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline-editable text section (for goal90Day etc.)
// ---------------------------------------------------------------------------

function EditableSection({
  title,
  field,
  value,
  editingField,
  editValue,
  saving,
  onStartEdit,
  onCancel,
  onChange,
  onSave,
}: {
  title: string;
  field: string;
  value: string;
  editingField: string | null;
  editValue: string;
  saving: boolean;
  onStartEdit: (field: string, value: string) => void;
  onCancel: () => void;
  onChange: (v: string) => void;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const isEditing = editingField === field;

  return (
    <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5 group">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider">
          {title}
        </h3>
        {!isEditing && (
          <button
            onClick={() => onStartEdit(field, value)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-brand-coral"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-coral/30 focus:border-brand-coral outline-none resize-y"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              disabled={saving}
            >
              <X size={12} className="inline mr-1" />
              Cancel
            </button>
            <button
              onClick={() => onSave(field, editValue)}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-brand-coral text-white rounded-lg hover:bg-brand-coral/90 disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{value || 'Not set'}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline-editable list section (for keyMessages etc.)
// ---------------------------------------------------------------------------

function EditableListSection({
  title,
  field,
  items,
  editingField,
  editMessages,
  saving,
  onStartEdit,
  onCancel,
  onChangeMessages,
  onSave,
  renderView,
}: {
  title: string;
  field: string;
  items: string[];
  editingField: string | null;
  editMessages: string[];
  saving: boolean;
  onStartEdit: (field: string, value: string[]) => void;
  onCancel: () => void;
  onChangeMessages: (msgs: string[]) => void;
  onSave: (field: string, value: string[]) => Promise<void>;
  renderView: React.ReactNode;
}) {
  const isEditing = editingField === field;

  const updateMessage = (idx: number, val: string) => {
    const updated = [...editMessages];
    updated[idx] = val;
    onChangeMessages(updated);
  };

  const addMessage = () => onChangeMessages([...editMessages, '']);

  const removeMessage = (idx: number) => {
    onChangeMessages(editMessages.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5 group">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider">
          {title}
        </h3>
        {!isEditing && (
          <button
            onClick={() => onStartEdit(field, items)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-brand-coral"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-3">
          {editMessages.map((msg, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                value={msg}
                onChange={(e) => updateMessage(i, e.target.value)}
                className="flex-1 text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-brand-coral/30 focus:border-brand-coral outline-none"
                placeholder={`Message ${i + 1}`}
              />
              <button
                onClick={() => removeMessage(i)}
                className="mt-2 text-slate-300 hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={addMessage}
            className="text-xs text-brand-coral hover:text-brand-coral/80"
          >
            + Add message
          </button>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              disabled={saving}
            >
              <X size={12} className="inline mr-1" />
              Cancel
            </button>
            <button
              onClick={() => onSave(field, editMessages.filter((m) => m.trim()))}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-brand-coral text-white rounded-lg hover:bg-brand-coral/90 disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        </div>
      ) : (
        renderView
      )}
    </div>
  );
}

// ===========================================================================
// Shared content sub-components
// ===========================================================================

function ICPContent({ strategy }: { strategy: Strategy }) {
  return (
    <div className="space-y-3">
      {strategy.icpPrimary && Object.keys(strategy.icpPrimary).length > 0 && (
        <div>
          <span className="text-slate-500 text-xs uppercase block mb-1">Primary:</span>
          {strategy.icpPrimary.description && (
            <p className="text-sm text-slate-700 mb-2">{strategy.icpPrimary.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {strategy.icpPrimary.industry && (
              <span className="text-xs bg-slate-100 rounded-full px-3 py-1">
                Industry: {strategy.icpPrimary.industry}
              </span>
            )}
            {strategy.icpPrimary.companySize && (
              <span className="text-xs bg-slate-100 rounded-full px-3 py-1">
                Size: {strategy.icpPrimary.companySize}
              </span>
            )}
            {strategy.icpPrimary.role && (
              <span className="text-xs bg-slate-100 rounded-full px-3 py-1">
                Role: {strategy.icpPrimary.role}
              </span>
            )}
          </div>
          {strategy.icpPrimary.painPoints?.length > 0 && (
            <div className="mt-2">
              <span className="text-slate-400 text-xs">Pain Points:</span>
              <ul className="mt-1 space-y-1">
                {strategy.icpPrimary.painPoints.map((p: string, i: number) => (
                  <li key={i} className="text-sm text-slate-600 pl-3 border-l-2 border-brand-coral/30">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {strategy.icpSecondary?.description && (
        <div>
          <span className="text-slate-500 text-xs uppercase block mb-1">Secondary:</span>
          <p className="text-sm text-slate-700">{strategy.icpSecondary.description}</p>
        </div>
      )}
      {strategy.antiIcp && (
        <div>
          <span className="text-slate-500 text-xs uppercase block mb-1">Anti-ICP:</span>
          <p className="text-sm text-slate-700">{strategy.antiIcp}</p>
        </div>
      )}
      {!strategy.icpPrimary?.description && !strategy.antiIcp && (
        <p className="text-sm text-slate-400">Not set</p>
      )}
    </div>
  );
}

function ContentPillarsContent({ pillars }: { pillars: Strategy['contentPillars'] }) {
  if (!pillars?.length) return <p className="text-sm text-slate-400">Not set</p>;
  return (
    <div className="space-y-3">
      {pillars.map((pillar, i) => (
        <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
          <div className="w-10 h-10 rounded-lg bg-brand-coral/10 flex items-center justify-center text-brand-coral font-bold text-sm">
            {pillar.targetPercent}%
          </div>
          <div>
            <div className="font-medium text-sm">{pillar.name}</div>
            <div className="text-xs text-slate-500">{pillar.purpose}</div>
            <div className="text-xs text-slate-300 mt-1">Owner: {pillar.owner}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KeyMessagesContent({ messages }: { messages: string[] }) {
  if (!messages?.length) return <p className="text-sm text-slate-400">Not set</p>;
  return (
    <ul className="space-y-2">
      {messages.map((msg, i) => (
        <li key={i} className="text-sm text-slate-700 pl-4 border-l-2 border-brand-coral/50">
          {msg}
        </li>
      ))}
    </ul>
  );
}

function PlatformStrategyContent({ platforms }: { platforms: Strategy['platformStrategy'] }) {
  return (
    <div className="space-y-3">
      {platforms.map((ps, i) => (
        <div key={i} className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">{ps.platform}</span>
            {ps.weeklyTarget > 0 && (
              <span className="text-xs bg-brand-coral/10 text-brand-coral rounded-full px-2 py-0.5">
                {ps.weeklyTarget}x/week
              </span>
            )}
          </div>
          {ps.primaryPurpose && (
            <p className="text-xs text-slate-500 mb-1">{ps.primaryPurpose}</p>
          )}
          {ps.bestFormats?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {ps.bestFormats.map((f, j) => (
                <span key={j} className="text-xs bg-slate-100 rounded px-2 py-0.5">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function VoiceToneContent({ strategy }: { strategy: Strategy }) {
  return (
    <div className="space-y-3">
      {strategy.voiceShohini && (
        <div>
          <span className="text-slate-500 text-xs uppercase block mb-1">Shohini's Voice:</span>
          <p className="text-sm text-slate-700">{strategy.voiceShohini}</p>
        </div>
      )}
      {strategy.voiceSanjoy && (
        <div>
          <span className="text-slate-500 text-xs uppercase block mb-1">Sanjoy's Voice:</span>
          <p className="text-sm text-slate-700">{strategy.voiceSanjoy}</p>
        </div>
      )}
      {strategy.sharedTone && (
        <div>
          <span className="text-slate-500 text-xs uppercase block mb-1">Shared Tone:</span>
          <p className="text-sm text-slate-700">{strategy.sharedTone}</p>
        </div>
      )}
      {strategy.bannedPhrases?.length > 0 && (
        <div>
          <span className="text-slate-500 text-xs uppercase block mb-1">Banned Phrases:</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {strategy.bannedPhrases.map((phrase, i) => (
              <span key={i} className="text-xs bg-red-50 text-red-600 rounded-full px-3 py-1">
                {phrase}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricsTargetsContent({ targets }: { targets: Strategy['metricsTargets'] }) {
  if (!targets || !Object.values(targets).some((v) => v != null)) {
    return <p className="text-sm text-slate-400">Not set</p>;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {targets.linkedinFollowers != null && (
        <MetricCard label="LinkedIn Followers" value={targets.linkedinFollowers.toLocaleString()} />
      )}
      {targets.linkedinEngagementRate != null && (
        <MetricCard label="LinkedIn Engagement" value={`${targets.linkedinEngagementRate}%`} />
      )}
      {targets.linkedinDmsPerWeek != null && (
        <MetricCard label="LinkedIn DMs/Week" value={targets.linkedinDmsPerWeek.toString()} />
      )}
      {targets.instagramFollowers != null && (
        <MetricCard label="Instagram Followers" value={targets.instagramFollowers.toLocaleString()} />
      )}
      {targets.instagramReach != null && (
        <MetricCard label="Instagram Reach" value={targets.instagramReach.toLocaleString()} />
      )}
      {targets.leadsPerMonth != null && (
        <MetricCard label="Leads/Month" value={targets.leadsPerMonth.toString()} />
      )}
      {targets.mrrTarget != null && (
        <MetricCard label="MRR Target" value={`$${targets.mrrTarget.toLocaleString()}`} />
      )}
      {targets.trainingRevenueTarget != null && (
        <MetricCard label="Training Revenue" value={`$${targets.trainingRevenueTarget.toLocaleString()}`} />
      )}
    </div>
  );
}

function PlatformSnapshotDisplay({ text }: { text: string }) {
  const form = parsePlatformText(text);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-slate-50 rounded-lg p-3 border-l-2 border-blue-500">
        <h5 className="text-xs font-semibold text-blue-600 mb-2">LinkedIn</h5>
        <div className="space-y-1 text-xs">
          {form.linkedin.current_followers && <div className="flex justify-between"><span className="text-slate-400">Followers</span><span>{form.linkedin.current_followers}</span></div>}
          {form.linkedin.avg_impressions && <div className="flex justify-between"><span className="text-slate-400">Avg Impressions</span><span>{form.linkedin.avg_impressions}</span></div>}
          {form.linkedin.best_format && <div className="flex justify-between"><span className="text-slate-400">Best Format</span><span>{form.linkedin.best_format}</span></div>}
          {form.linkedin.channel_purpose && <div className="flex justify-between"><span className="text-slate-400">Purpose</span><span>{form.linkedin.channel_purpose}</span></div>}
          {form.linkedin.target_90d && <div className="flex justify-between"><span className="text-slate-400">90-Day Target</span><span className="text-green-600">{form.linkedin.target_90d}</span></div>}
        </div>
      </div>
      <div className="bg-slate-50 rounded-lg p-3 border-l-2 border-purple-500">
        <h5 className="text-xs font-semibold text-purple-400 mb-2">Instagram</h5>
        {!form.instagram.is_active ? (
          <p className="text-xs text-slate-400">Secondary — 1x/week</p>
        ) : (
          <div className="space-y-1 text-xs">
            {form.instagram.current_followers && <div className="flex justify-between"><span className="text-slate-400">Followers</span><span>{form.instagram.current_followers}</span></div>}
            {form.instagram.avg_reach && <div className="flex justify-between"><span className="text-slate-400">Avg Reach</span><span>{form.instagram.avg_reach}</span></div>}
            {form.instagram.best_format && <div className="flex justify-between"><span className="text-slate-400">Best Format</span><span>{form.instagram.best_format}</span></div>}
            {form.instagram.channel_purpose && <div className="flex justify-between"><span className="text-slate-400">Purpose</span><span>{form.instagram.channel_purpose}</span></div>}
            {form.instagram.target_90d && <div className="flex justify-between"><span className="text-slate-400">90-Day Target</span><span className="text-green-600">{form.instagram.target_90d}</span></div>}
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformBenchmarksContent({ benchmarks }: { benchmarks: PlatformBenchmarks }) {
  const li = benchmarks.linkedin;
  const ig = benchmarks.instagram;

  if (!li && !ig) return <p className="text-sm text-slate-400">Not set</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* LinkedIn */}
      {li && (
        <div className="bg-slate-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold">in</div>
            <span className="font-medium text-sm">LinkedIn</span>
          </div>
          <div className="space-y-2 text-sm">
            {li.current_followers != null && (
              <div className="flex justify-between"><span className="text-slate-500">Followers</span><span>{li.current_followers.toLocaleString()}</span></div>
            )}
            {li.avg_impressions != null && (
              <div className="flex justify-between"><span className="text-slate-500">Avg Impressions</span><span>~{li.avg_impressions.toLocaleString()}/post</span></div>
            )}
            {li.best_format && (
              <div className="flex justify-between"><span className="text-slate-500">Best Format</span><span className="capitalize">{li.best_format}</span></div>
            )}
            {li.pipeline_generating != null && (
              <div className="flex justify-between"><span className="text-slate-500">Pipeline</span><span>{li.pipeline_generating ? 'Yes' : 'Not yet'}</span></div>
            )}
            {li.channel_purpose && (
              <div className="flex justify-between"><span className="text-slate-500">Purpose</span><span className="capitalize">{li.channel_purpose}</span></div>
            )}
            {li.target_90d != null && (
              <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-500">90-Day Target</span>
                <span className="text-brand-coral font-medium">{li.target_90d.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instagram */}
      {ig && (
        <div className={`bg-slate-50 rounded-lg p-4 border ${ig.is_active === false ? 'border-slate-200 opacity-60' : 'border-purple-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-purple-50 flex items-center justify-center text-purple-600 text-xs font-bold">ig</div>
            <span className="font-medium text-sm">Instagram</span>
            {ig.is_active === false && (
              <span className="text-xs bg-slate-100 text-slate-400 rounded-full px-2 py-0.5 ml-auto">Secondary</span>
            )}
          </div>
          {ig.is_active === false ? (
            <p className="text-sm text-slate-400">1x/week, brand awareness only</p>
          ) : (
            <div className="space-y-2 text-sm">
              {ig.current_followers != null && (
                <div className="flex justify-between"><span className="text-slate-500">Followers</span><span>{ig.current_followers.toLocaleString()}</span></div>
              )}
              {ig.avg_reach != null && (
                <div className="flex justify-between"><span className="text-slate-500">Avg Reach</span><span>~{ig.avg_reach.toLocaleString()}/post</span></div>
              )}
              {ig.best_format && (
                <div className="flex justify-between"><span className="text-slate-500">Best Format</span><span className="capitalize">{ig.best_format}</span></div>
              )}
              {ig.pipeline_generating != null && (
                <div className="flex justify-between"><span className="text-slate-500">Pipeline</span><span>{ig.pipeline_generating ? 'Yes' : 'Not yet'}</span></div>
              )}
              {ig.channel_purpose && (
                <div className="flex justify-between"><span className="text-slate-500">Purpose</span><span className="capitalize">{ig.channel_purpose}</span></div>
              )}
              {ig.target_90d != null && (
                <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                  <span className="text-slate-500">90-Day Target</span>
                  <span className="text-brand-coral font-medium">{ig.target_90d.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Last Week Performance Summary (for Strategy page)
// ===========================================================================

const FORMAT_LABELS: Record<string, string> = {
  text_post: 'Text Post',
  carousel: 'Carousel',
  poll: 'Poll',
  document: 'Document',
  video_caption: 'Video',
  reel: 'Reel',
  story: 'Story',
};

function LastWeekPerformanceSummary() {
  const [data, setData] = useState<WeeklyPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.weeklyPerformance()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-4 text-slate-300 text-sm">Loading performance...</div>;
  if (!data) return null;

  const wow = data.weekOverWeek;
  const hasTopPosts = data.topPosts.length > 0;
  const hasFormats = data.formatBreakdown.length > 0;

  return (
    <div className="space-y-4">
      {/* WoW Trend Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniWoWCard label="Engagement" value={`${wow.engagementRate.thisWeek}%`} change={wow.engagementRate.change} />
        <MiniWoWCard label="Posts" value={wow.postsPublished.thisWeek} change={wow.postsPublished.change} />
        <MiniWoWCard label="Reach" value={wow.totalReach.thisWeek.toLocaleString()} change={wow.totalReach.change} />
        <MiniWoWCard label="Leads" value={wow.leadsGenerated.thisWeek} change={wow.leadsGenerated.change} />
      </div>

      {/* Top Posts (compact) */}
      {hasTopPosts && (
        <div>
          <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Top Posts This Week</h4>
          <div className="space-y-2">
            {data.topPosts.slice(0, 3).map((post, i) => (
              <div key={post._id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                <span className="text-sm font-bold font-mono text-brand-coral/60 w-5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 truncate">{post.hookPreview}</p>
                  <div className="flex gap-1.5 mt-0.5">
                    <span className={`text-[10px] px-1 py-0.5 rounded ${post.platform === 'linkedin' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                      {post.platform}
                    </span>
                    <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-400">
                      {FORMAT_LABELS[post.format] || post.format}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold font-mono text-green-600">{post.performance.engagementRate}%</div>
                  <div className="text-[10px] text-slate-300">{post.performance.reach.toLocaleString()} reach</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Format Breakdown (compact) */}
      {hasFormats && (
        <div>
          <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Format Performance</h4>
          <div className="flex flex-wrap gap-2">
            {data.formatBreakdown.map((fmt) => (
              <div key={fmt.format} className="bg-slate-50 rounded-lg px-3 py-2 text-center">
                <div className="text-xs font-medium text-slate-600">{FORMAT_LABELS[fmt.format] || fmt.format}</div>
                <div className="text-sm font-bold font-mono text-brand-coral">{fmt.avgEngagement}%</div>
                <div className="text-[10px] text-slate-300">{fmt.postsCount} post{fmt.postsCount !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content -> Pipeline */}
      {data.contentToLeads.length > 0 && (
        <div>
          <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Content → Leads</h4>
          {data.contentToLeads.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 rounded p-2 mb-1">
              <span className={`px-1 py-0.5 rounded ${item.platform === 'linkedin' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                {item.platform}
              </span>
              <span className="text-slate-500 truncate flex-1">{item.hookPreview}</span>
              <span className="text-slate-600 font-medium shrink-0">{item.leadCompany}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniWoWCard({ label, value, change }: { label: string; value: string | number; change: number }) {
  const isPositive = change > 0;
  const isNeutral = change === 0;
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-[10px] text-slate-400 uppercase">{label}</div>
      <div className="text-lg font-bold font-mono">{value}</div>
      <div className="flex items-center gap-1">
        {!isNeutral && (
          isPositive
            ? <TrendingUp size={10} className="text-green-600" />
            : <TrendingDown size={10} className="text-red-600" />
        )}
        <span className={`text-[10px] font-mono ${isNeutral ? 'text-slate-300' : isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isNeutral ? '—' : `${isPositive ? '+' : ''}${change}%`}
        </span>
      </div>
    </div>
  );
}

// ===========================================================================
// Shared helper components
// ===========================================================================

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
    <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-3">
        {title}
      </h3>
      {typeof content === 'string' ? (
        <p className={`text-sm text-slate-700 whitespace-pre-wrap ${mono ? 'font-mono text-xs' : ''}`}>
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
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-brand-coral">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
