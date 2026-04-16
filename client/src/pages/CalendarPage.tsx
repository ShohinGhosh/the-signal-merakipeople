import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  KanbanSquare,
  RefreshCw,
  Loader2,
  Linkedin,
  Instagram,
  Clock,
  User,
  Eye,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  X,
  CheckCircle2,
  Circle,
  Target,
  Lightbulb,
  CalendarDays,
  TrendingUp,
  Briefcase,
  FileText,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Film,
  Play,
  Layers,
  FileDown,
  Download,
  ExternalLink,
} from 'lucide-react';
import { calendarAPI, postsAPI, feedbackAPI, journalAPI } from '../api/client';
import { ThumbsUp, ThumbsDown, MessageSquare, Send, Zap as ZapIcon, Facebook } from 'lucide-react';
import { useStrategy } from '../contexts/StrategyContext';
import type { Post, WeekPlan, GenerationInputs, ApproveProgress } from '../types';

type PlatformOption = 'linkedin' | 'instagram' | 'facebook';
const ALL_PLATFORMS: { id: PlatformOption; label: string; icon: React.ReactNode; activeBg: string; activeText: string }[] = [
  { id: 'linkedin', label: 'LinkedIn', icon: <Linkedin size={14} />, activeBg: 'bg-blue-600', activeText: 'text-white' },
  { id: 'instagram', label: 'Instagram', icon: <Instagram size={14} />, activeBg: 'bg-purple-600', activeText: 'text-white' },
  { id: 'facebook', label: 'Facebook', icon: <Facebook size={14} />, activeBg: 'bg-indigo-600', activeText: 'text-white' },
];

type ViewType = 'calendar' | 'tasks' | 'content';

const TASK_STATUSES = ['draft', 'ready', 'scheduled', 'published'] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: '#6B7280', bg: '#6B728015', icon: <Circle size={14} /> },
  ready: { label: 'Ready', color: '#F59E0B', bg: '#F59E0B15', icon: <Eye size={14} /> },
  scheduled: { label: 'Scheduled', color: '#3B82F6', bg: '#3B82F615', icon: <Clock size={14} /> },
  published: { label: 'Published', color: '#10B981', bg: '#10B98115', icon: <CheckCircle2 size={14} /> },
};

const PILLAR_PALETTE = [
  '#4F46E5', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6',
  '#06B6D4', '#F97316', '#14B8A6', '#E11D48', '#6366F1',
];

const FORMAT_COLORS: Record<string, string> = {
  text_post: '#3B82F6',
  carousel: '#8B5CF6',
  poll: '#F59E0B',
  video_caption: '#EC4899',
  story: '#06B6D4',
  reel: '#F97316',
};

const DEFAULT_QUICK_FIXES = [
  'Shorter',
  'More direct',
  'Stronger hook',
  'More data-led',
  'Different angle entirely',
];

function getPillarColor(pillar: string, allPillars: string[]): string {
  const idx = allPillars.indexOf(pillar);
  return PILLAR_PALETTE[idx >= 0 ? idx % PILLAR_PALETTE.length : 0];
}

function getFormatColor(format: string): string {
  return FORMAT_COLORS[format] || '#6B7280';
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
  const year = weekStart.getFullYear();
  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} — ${weekEnd.getDate()}, ${year}`;
  }
  return `${startMonth} ${weekStart.getDate()} — ${endMonth} ${weekEnd.getDate()}, ${year}`;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { strategy: currentStrategy, isComplete } = useStrategy();
  const [authorFilter, setAuthorFilter] = useState<'mine' | 'all'>('mine');
  const [view, setView] = useState<ViewType>('calendar');
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [weekData, setWeekData] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformOption[]>(['linkedin']);
  const [platformsInitialized, setPlatformsInitialized] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveProgress, setApproveProgress] = useState<ApproveProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [generationInputs, setGenerationInputs] = useState<GenerationInputs | null>(null);
  const [autoRegen, setAutoRegen] = useState<{ active: boolean; triggeredBy: string } | null>(null);
  const [genStep, setGenStep] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRegenPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

  // Poll for auto-regeneration status (triggered by Journal accept)
  useEffect(() => {
    const checkAutoRegen = async () => {
      try {
        const { data } = await journalAPI.autoRegenStatus();
        if (data.active && !autoRegen?.active) {
          setAutoRegen({ active: true, triggeredBy: data.triggeredBy });
          setGenerating(true);
        } else if (!data.active && autoRegen?.active) {
          setAutoRegen(null);
          setGenerating(false);
          await loadWeek(); // Refresh calendar with new data
          await journalAPI.autoRegenReset();
        }
      } catch { /* ignore */ }
    };

    autoRegenPollRef.current = setInterval(checkAutoRegen, 3000);
    return () => { if (autoRegenPollRef.current) clearInterval(autoRegenPollRef.current); };
  }, [autoRegen?.active]);

  // Filter week data by author when "mine" is selected
  const filteredWeekData = useMemo(() => {
    if (!weekData) return null;
    if (authorFilter === 'all') return weekData;

    const myRole = user?.role;
    if (!myRole) return weekData;

    const filteredDays: Record<string, any[]> = {};
    for (const [date, posts] of Object.entries(weekData.days)) {
      filteredDays[date] = (posts as any[]).filter((p: any) => p.author === myRole);
    }

    const allPosts = Object.values(filteredDays).flat();
    return {
      ...weekData,
      days: filteredDays,
      posts: allPosts,
      stats: {
        ...weekData.stats,
        total: allPosts.length,
        byStatus: allPosts.reduce((acc: any, p: any) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {}),
        byPlatform: allPosts.reduce((acc: any, p: any) => {
          acc[p.platform] = (acc[p.platform] || 0) + 1;
          return acc;
        }, {}),
        byAuthor: allPosts.reduce((acc: any, p: any) => {
          acc[p.author] = (acc[p.author] || 0) + 1;
          return acc;
        }, {}),
      },
    };
  }, [weekData, authorFilter, user?.role]);

  const loadWeek = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data } = await calendarAPI.getWeek(weekStartStr);
      setWeekData(data);
    } catch (err: any) {
      console.error('Failed to load week:', err);
      setErrorMsg(err?.response?.data?.error || 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [weekStartStr]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  // Set default platforms from strategy config (only once)
  useEffect(() => {
    if (currentStrategy?.platformConfig && !platformsInitialized) {
      const activePlatforms = currentStrategy.platformConfig
        .filter((p) => p.status === 'active')
        .map((p) => p.platform as PlatformOption);
      if (activePlatforms.length > 0) {
        setSelectedPlatforms(activePlatforms);
      }
      setPlatformsInitialized(true);
    }
  }, [currentStrategy, platformsInitialized]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setErrorMsg(null);
    setGenStep('Starting...');

    // Poll generation progress
    genProgressRef.current = setInterval(async () => {
      try {
        const { data } = await calendarAPI.generationProgress();
        if (data.active && data.step) setGenStep(data.step);
      } catch { /* ignore */ }
    }, 1500);

    try {
      const { data } = await calendarAPI.generateWeek(weekStartStr, selectedPlatforms);
      if (data.inputs) {
        setGenerationInputs(data.inputs);
      }
      await loadWeek();
    } catch (err: any) {
      console.error('Generate error:', err);
      setErrorMsg(err?.response?.data?.error || 'Failed to generate weekly plan');
    } finally {
      setGenerating(false);
      setGenStep('');
      if (genProgressRef.current) { clearInterval(genProgressRef.current); genProgressRef.current = null; }
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setErrorMsg(null);
    try {
      await calendarAPI.approveWeek(weekStartStr);
      // Start polling for progress
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await calendarAPI.approveProgress(weekStartStr);
          setApproveProgress(data);
          if (data.allDone) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setApproving(false);
            setApproveProgress(null);
            await loadWeek();
          }
        } catch {
          // ignore polling errors
        }
      }, 4000);
      // Also reload immediately to show status change
      await loadWeek();
    } catch (err: any) {
      console.error('Approve error:', err);
      setErrorMsg(err?.response?.data?.error || 'Failed to approve week plan');
      setApproving(false);
    }
  };

  const handleStatusChange = async (postId: string, newStatus: string) => {
    try {
      await calendarAPI.updateTaskStatus(postId, newStatus);
      await loadWeek();
      if (selectedPost?._id === postId) {
        setSelectedPost((prev) => prev ? { ...prev, status: newStatus as Post['status'] } : null);
      }
    } catch (err: any) {
      console.error('Status update error:', err);
    }
  };

  const navigateWeek = (dir: -1 | 1) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7 * dir);
    setWeekStart(d);
    setGenerationInputs(null);
    setApproveProgress(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setApproving(false);
  };

  const goToThisWeek = () => {
    setWeekStart(getMonday(new Date()));
  };

  const allPillars = filteredWeekData
    ? [...new Set(filteredWeekData.posts.map((p) => p.contentPillar).filter(Boolean))]
    : [];

  const totalTasks = filteredWeekData?.stats?.total || 0;
  const completedTasks = (filteredWeekData?.stats?.byStatus?.published || 0) + (filteredWeekData?.stats?.byStatus?.scheduled || 0);
  const allDrafts = totalTasks > 0 && (filteredWeekData?.stats?.byStatus?.draft || 0) === totalTasks;
  const hasApproved = totalTasks > 0 && (filteredWeekData?.stats?.byStatus?.scheduled || 0) > 0;

  if (!isComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CalendarIcon size={48} className="text-slate-200 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Calendar Locked</h2>
        <p className="text-slate-400 max-w-md">
          Complete and approve your marketing strategy to unlock the AI-powered content calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
                view === 'calendar' ? 'bg-brand-coral text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={14} />
              Calendar
            </button>
            <button
              onClick={() => setView('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
                view === 'tasks' ? 'bg-brand-coral text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <KanbanSquare size={14} />
              Tasks
            </button>
            <button
              onClick={() => setView('content')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
                view === 'content' ? 'bg-brand-coral text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText size={14} />
              Content
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={goToThisWeek}
            className="px-3 py-1.5 text-xs bg-white shadow-sm hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
          >
            This Week
          </button>
          <button onClick={() => navigateWeek(-1)} className="p-1 text-slate-500 hover:text-slate-800">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium min-w-[200px] text-center">
            {formatWeekLabel(weekStart)}
          </span>
          <button onClick={() => navigateWeek(1)} className="p-1 text-slate-500 hover:text-slate-800">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Stats Bar + Action Buttons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {/* Progress */}
          {totalTasks > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-coral rounded-full transition-all"
                  style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">{completedTasks}/{totalTasks} done</span>
            </div>
          )}

          {/* Author filter toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setAuthorFilter('mine')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                authorFilter === 'mine'
                  ? 'bg-white text-brand-coral shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              My Posts
            </button>
            <button
              onClick={() => setAuthorFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                authorFilter === 'all'
                  ? 'bg-white text-brand-coral shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All Posts
            </button>
          </div>

          {/* Quick stats */}
          {filteredWeekData && totalTasks > 0 && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {Object.entries(filteredWeekData.stats.byPlatform).map(([platform, count]) => (
                <span key={platform} className="flex items-center gap-1">
                  {platform === 'linkedin' ? (
                    <Linkedin size={12} className="text-blue-600" />
                  ) : platform === 'facebook' ? (
                    <Facebook size={12} className="text-indigo-600" />
                  ) : (
                    <Instagram size={12} className="text-pink-400" />
                  )}
                  {count}
                </span>
              ))}
              {authorFilter === 'all' && (
                <>
                  <span className="text-slate-200">|</span>
                  {Object.entries(filteredWeekData.stats.byAuthor).map(([author, count]) => (
                    <span key={author} className="flex items-center gap-1">
                      <User size={12} />
                      {author}: {count}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {totalTasks === 0 ? (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-brand-coral text-white rounded-lg font-medium text-sm hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating && genStep ? genStep : 'Generate Week Plan'}
            </button>
          ) : allDrafts && !approving ? (
            <>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-3 py-2 bg-white shadow-sm text-slate-500 rounded-lg text-sm hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {generating && genStep ? genStep : 'Regenerate'}
              </button>
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 px-5 py-2 bg-brand-coral text-white rounded-lg font-medium text-sm hover:bg-brand-coral/90 transition-colors"
              >
                <CheckCircle2 size={16} />
                Approve Week Plan
              </button>
            </>
          ) : hasApproved && !approving ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-3 py-2 bg-white shadow-sm text-slate-500 rounded-lg text-sm hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {generating && genStep ? genStep : 'Regenerate'}
              </button>
              {!generating && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
                  <CheckCircle2 size={16} />
                  Approved
                </div>
              )}
            </div>
          ) : approving ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-brand-coral/10 border border-brand-coral/20 rounded-lg text-sm text-brand-coral">
              <Loader2 size={16} className="animate-spin" />
              Creating content...
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-brand-coral text-white rounded-lg font-medium text-sm hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {generating && genStep ? genStep : 'Regenerate Week'}
            </button>
          )}
        </div>
      </div>

      {/* Platform selector row */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider mr-1">Platforms:</span>
        {ALL_PLATFORMS.map((p) => {
          const active = selectedPlatforms.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => {
                if (active && selectedPlatforms.length === 1) return;
                setSelectedPlatforms((prev) =>
                  active ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                );
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                active
                  ? `${p.activeBg} ${p.activeText} border-transparent shadow-sm`
                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 opacity-50'
              }`}
              title={active ? `Remove ${p.label}` : `Add ${p.label}`}
            >
              {p.icon}
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Auto-regeneration banner */}
      {autoRegen?.active && (
        <div className="flex items-center gap-3 px-4 py-3 bg-brand-coral/10 border border-brand-coral/20 rounded-xl text-sm text-brand-coral animate-pulse">
          <Loader2 size={16} className="animate-spin" />
          <div className="flex-1">
            <span className="font-medium">Calendar is being regenerated</span>
            <span className="text-brand-coral/70 ml-2 text-xs">New journal entry: {autoRegen.triggeredBy}</span>
          </div>
          <span className="text-xs text-brand-coral/50">This may take 30-60 seconds...</span>
        </div>
      )}

      {/* Strategy Evidence Bar */}
      {filteredWeekData?.strategyContext && totalTasks > 0 && (
        <StrategyEvidenceBar
          weekData={filteredWeekData}
          allPillars={allPillars}
        />
      )}

      {/* Pillar Alignment Bar (shown when no strategy context, fallback) */}
      {filteredWeekData && !filteredWeekData.strategyContext && allPillars.length > 0 && totalTasks > 0 && (
        <div className="mb-4 bg-white shadow-sm border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Target size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400">Content Pillar Mix</span>
          </div>
          <div className="flex gap-2">
            {allPillars.map((pillar) => {
              const count = filteredWeekData.stats.byPillar[pillar] || 0;
              const pct = Math.round((count / totalTasks) * 100);
              const color = getPillarColor(pillar, allPillars);
              return (
                <div key={pillar} className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500 truncate mb-1">{pillar}</div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="text-xs mt-0.5" style={{ color }}>{pct}% ({count})</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <span className="text-red-600 text-sm flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400/60 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Generating overlay */}
      {generating && (
        <div className="mb-4 p-6 bg-white border border-slate-200/60 rounded-xl shadow-sm text-center">
          <Loader2 size={32} className="animate-spin text-brand-coral mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Generating your content calendar...</p>
          <p className="text-slate-400 text-sm mt-1">Researching special dates, analyzing signals, and planning your week. This may take a minute.</p>
        </div>
      )}

      {/* Approve Progress Overlay */}
      {approving && approveProgress && (
        <ApproveProgressOverlay
          progress={approveProgress}
          onDismiss={() => {
            if (approveProgress.allDone) {
              setApproving(false);
              setApproveProgress(null);
            }
          }}
        />
      )}

      {/* Generation Inputs Panel */}
      {generationInputs && !generating && totalTasks > 0 && (
        <GenerationInputsPanel inputs={generationInputs} />
      )}

      {/* Main Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-slate-300" />
        </div>
      ) : !filteredWeekData || totalTasks === 0 ? (
        <EmptyCalendar onGenerate={handleGenerate} generating={generating} />
      ) : view === 'calendar' ? (
        <CalendarView
          weekStart={weekStart}
          weekData={filteredWeekData}
          allPillars={allPillars}
          onSelectPost={setSelectedPost}
          onStatusChange={handleStatusChange}
          onPostUpdate={loadWeek}
        />
      ) : view === 'tasks' ? (
        <TaskView
          weekData={filteredWeekData}
          allPillars={allPillars}
          onSelectPost={setSelectedPost}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <ContentReviewView
          weekData={filteredWeekData}
          allPillars={allPillars}
          onPostUpdate={loadWeek}
        />
      )}

      {/* Task Detail Drawer */}
      {selectedPost && (
        <TaskDetailDrawer
          post={selectedPost}
          allPillars={allPillars}
          onClose={() => setSelectedPost(null)}
          onStatusChange={handleStatusChange}
          onPostUpdate={loadWeek}
        />
      )}
    </div>
  );
}

// ============ Strategy Evidence Bar ============
function StrategyEvidenceBar({
  weekData,
  allPillars,
}: {
  weekData: WeekPlan;
  allPillars: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const ctx = weekData.strategyContext!;
  const totalTasks = weekData.stats.total;

  return (
    <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Target size={14} className="text-brand-coral" />
          <span className="text-xs text-slate-500 font-medium">Strategy Alignment</span>
          {/* Quick summary chips */}
          <div className="flex items-center gap-2">
            {ctx.platformTargets?.map((pt: any) => {
              const actual = weekData.stats.byPlatform[pt.platform] || 0;
              const onTrack = actual >= pt.weeklyTarget;
              return (
                <span
                  key={pt.platform}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                    onTrack ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {pt.platform === 'linkedin' ? <Linkedin size={10} /> : pt.platform === 'facebook' ? <Facebook size={10} /> : <Instagram size={10} />}
                  {actual}/{pt.weeklyTarget}
                </span>
              );
            })}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 space-y-3">
          {/* Author + Platform targets */}
          <div className="grid grid-cols-2 gap-3">
            {ctx.platformTargets?.map((pt: any) => {
              const actual = weekData.stats.byPlatform[pt.platform] || 0;
              const onTrack = actual >= pt.weeklyTarget;
              return (
                <div key={pt.platform} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {pt.platform === 'linkedin' ? (
                      <Linkedin size={14} className="text-blue-600" />
                    ) : pt.platform === 'facebook' ? (
                      <Facebook size={14} className="text-indigo-600" />
                    ) : (
                      <Instagram size={14} className="text-pink-400" />
                    )}
                    <span className="text-sm font-medium capitalize">{pt.platform}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${onTrack ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {actual}/{pt.weeklyTarget} posts
                    </span>
                  </div>
                  {pt.bestFormats?.length > 0 && (
                    <div className="text-xs text-slate-400">
                      Best formats: {pt.bestFormats.join(', ')}
                    </div>
                  )}
                  {pt.bestPostingTimes?.length > 0 && (
                    <div className="text-xs text-slate-300 mt-0.5">
                      Best times: {pt.bestPostingTimes.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Author split */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(weekData.stats.byAuthor).map(([author, count]) => (
              <div key={author} className="bg-slate-50 rounded-lg p-3 flex items-center gap-3">
                <User size={14} className="text-slate-400" />
                <div>
                  <span className="text-sm capitalize font-medium">{author}</span>
                  <span className="text-xs text-slate-400 ml-2">{count} posts this week</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pillar targets vs actual */}
          {ctx.contentPillars?.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-2">Content Pillar Mix</div>
              <div className="flex gap-2">
                {ctx.contentPillars.map((cp: any, idx: number) => {
                  const actualCount = weekData.stats.byPillar[cp.name] || 0;
                  const actualPct = totalTasks > 0 ? Math.round((actualCount / totalTasks) * 100) : 0;
                  const color = PILLAR_PALETTE[idx % PILLAR_PALETTE.length];
                  const diff = actualPct - (cp.targetPercent || 0);
                  return (
                    <div key={cp.name} className="flex-1 min-w-0">
                      <div className="text-xs text-slate-500 truncate mb-1">{cp.name}</div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${actualPct}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px]" style={{ color }}>{actualPct}%</span>
                        <span className="text-[10px] text-slate-300">target {cp.targetPercent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Approve Progress Overlay ============
function ApproveProgressOverlay({
  progress,
  onDismiss,
}: {
  progress: ApproveProgress;
  onDismiss: () => void;
}) {
  const totalSteps = progress.total * 2; // content + image for each
  const completedSteps = progress.contentReady + progress.imagesReady;
  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="mb-4 bg-white shadow-sm border border-brand-coral/15 rounded-xl p-5 relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-coral" />
          <span className="text-sm font-medium">AI is creating your content...</span>
        </div>
        {progress.allDone && (
          <button onClick={onDismiss} className="text-slate-400 hover:text-slate-800">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-brand-coral rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="flex items-center gap-2 text-xs">
          <FileText size={12} className={progress.contentReady === progress.total ? 'text-green-600' : 'text-slate-400'} />
          <span className={progress.contentReady === progress.total ? 'text-green-600' : 'text-slate-500'}>
            Content: {progress.contentReady}/{progress.total}
          </span>
          {progress.contentReady === progress.total && <Check size={12} className="text-green-600" />}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <ImageIcon size={12} className={progress.imagesReady === progress.total ? 'text-green-600' : 'text-slate-400'} />
          <span className={progress.imagesReady === progress.total ? 'text-green-600' : 'text-slate-500'}>
            Images: {progress.imagesReady}/{progress.total}
          </span>
          {progress.imagesReady === progress.total && <Check size={12} className="text-green-600" />}
        </div>
      </div>

      {/* Individual post status */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {progress.posts.map((p) => (
          <div
            key={p._id}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] ${
              p.hasDraft && p.hasImage
                ? 'bg-green-50 text-green-600'
                : p.hasDraft
                ? 'bg-blue-50 text-blue-600'
                : 'bg-slate-50 text-slate-300'
            }`}
          >
            {p.hasDraft && p.hasImage ? (
              <CheckCircle2 size={10} />
            ) : p.hasDraft ? (
              <FileText size={10} />
            ) : (
              <Loader2 size={10} className="animate-spin" />
            )}
            {p.hasDraft && p.hasImage ? 'Done' : p.hasDraft ? 'Content ready' : 'Drafting...'}
          </div>
        ))}
      </div>

      {progress.allDone && (
        <div className="mt-3 text-center text-sm text-green-600 font-medium">
          All content is ready! Switch to the Content tab to review.
        </div>
      )}
    </div>
  );
}

// ============ Content Review View (replaces Brain page) ============
function ContentReviewView({
  weekData,
  allPillars,
  onPostUpdate,
}: {
  weekData: WeekPlan;
  allPillars: string[];
  onPostUpdate: () => void;
}) {
  const sortedPosts = [...weekData.posts].sort((a, b) => {
    const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return dateA - dateB;
  });

  if (sortedPosts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center py-16">
        <div>
          <FileText size={48} className="text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No content to review</h3>
          <p className="text-slate-400 text-sm">Generate and approve a week plan first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto pb-4">
      {sortedPosts.map((post) => (
        <ContentCard
          key={post._id}
          post={post}
          allPillars={allPillars}
          onPostUpdate={onPostUpdate}
        />
      ))}
    </div>
  );
}

// ============ Carousel Slides Editor ============
function CarouselSlidesEditor({ post, onPostUpdate }: { post: Post; onPostUpdate: () => void }) {
  const [slides, setSlides] = useState(
    (post.draftCarouselOutline || []).map((s: any) => ({
      slideNumber: s.slideNumber,
      content: s.content || '',
      type: s.type || (s.slideNumber === 1 ? 'hook' : 'content'),
    }))
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const hasContent = slides.some((s) => s.content.trim().length > 0);

  // Sync with post data when it changes externally
  useEffect(() => {
    if (post.draftCarouselOutline?.length) {
      const newSlides = post.draftCarouselOutline.map((s: any) => ({
        slideNumber: s.slideNumber,
        content: s.content || '',
        type: s.type || (s.slideNumber === 1 ? 'hook' : 'content'),
      }));
      // Only update if content actually changed (avoid cursor jump)
      const hasNewContent = newSlides.some((s: any) => s.content.trim().length > 0);
      if (hasNewContent && !dirty) {
        setSlides(newSlides);
      }
    }
  }, [post.draftCarouselOutline]);

  const updateSlide = (idx: number, content: string) => {
    const updated = [...slides];
    updated[idx] = { ...updated[idx], content };
    setSlides(updated);
    setDirty(true);
  };

  const saveSlides = async () => {
    setSaving(true);
    try {
      await postsAPI.update(post._id, { draftCarouselOutline: slides });
      setDirty(false);
      onPostUpdate();
    } catch (err) {
      console.error('Save slides failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const regenerateSlides = async () => {
    setRegenerating(true);
    try {
      await postsAPI.generateContent(post._id, true);
      onPostUpdate();
      setDirty(false);
    } catch (err) {
      console.error('Regenerate slides failed:', err);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Layers size={12} className="text-purple-500" />
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Carousel Slides</span>
          <span className="text-[10px] text-slate-300">{slides.length} slides</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={regenerateSlides}
            disabled={regenerating || saving}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 disabled:opacity-40 transition-colors"
          >
            {regenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {regenerating ? 'Generating...' : hasContent ? 'Regenerate Slides' : 'Generate Slide Content'}
          </button>
          {dirty && (
            <button
              onClick={saveSlides}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Save Slides
            </button>
          )}
        </div>
      </div>

      {regenerating && (
        <div className="mb-3 p-4 bg-purple-50 border border-purple-200 rounded-lg text-center">
          <Loader2 size={20} className="animate-spin text-purple-500 mx-auto mb-2" />
          <p className="text-xs text-purple-600 font-medium">Generating carousel content...</p>
          <p className="text-[10px] text-purple-400 mt-1">Crafting hook, insights, and CTA for each slide</p>
        </div>
      )}

      <div className="space-y-2">
        {slides.map((slide, i) => (
          <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold text-slate-400">#{slide.slideNumber}</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  slide.type === 'hook'
                    ? 'bg-purple-50 text-purple-600'
                    : slide.type === 'cta'
                    ? 'bg-orange-50 text-orange-600'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {slide.type}
              </span>
            </div>
            <textarea
              value={slide.content}
              onChange={(e) => updateSlide(i, e.target.value)}
              placeholder={`Slide ${slide.slideNumber} content...`}
              className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-700 resize-none focus:outline-none focus:border-purple-300 min-h-[60px]"
              rows={3}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Content Card (for Content Review tab) ============
function ContentCard({
  post,
  allPillars,
  onPostUpdate,
}: {
  post: Post;
  allPillars: string[];
  onPostUpdate: () => void;
}) {
  const [editContent, setEditContent] = useState(post.draftContent || post.finalContent || '');
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  const [dirty, setDirty] = useState(false);
  // Content generation state
  const [generatingContent, setGeneratingContent] = useState(false);
  // Carousel aspect ratio & style
  const [carouselAspect, setCarouselAspect] = useState<'1:1' | '4:5' | '9:16'>('1:1');
  const [carouselStyle, setCarouselStyle] = useState<'clean_light' | 'dark_navy' | 'white_minimal' | 'coral_bold'>('clean_light');
  // Feedback state
  const [contentApproved, setContentApproved] = useState(false);
  const [imageApproved, setImageApproved] = useState(false);
  const [showFeedbackInput, setShowFeedbackInput] = useState<'content' | 'image' | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [quickFixes, setQuickFixes] = useState<string[]>(DEFAULT_QUICK_FIXES);
  const [imageQuickFixes, setImageQuickFixes] = useState<string[]>(['More vibrant', 'Simpler design', 'Different style']);

  const pillarColor = getPillarColor(post.contentPillar, allPillars);
  const formatColor = getFormatColor(post.format);
  const hasDraft = !!post.draftContent || !!post.finalContent;

  // Load dynamic quick fixes on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await feedbackAPI.quickFixes({
          format: post.format,
          platform: post.platform,
          field: 'content',
        });
        if (data.quickFixes?.length) setQuickFixes(data.quickFixes);
      } catch { /* use defaults */ }

      try {
        const fmt = post.format?.toLowerCase() || '';
        const imageField = fmt === 'carousel' ? 'carousel' : fmt === 'video_caption' ? 'thumbnail' : 'image';
        const { data } = await feedbackAPI.quickFixes({
          format: post.format,
          platform: post.platform,
          field: imageField,
        });
        if (data.quickFixes?.length) setImageQuickFixes(data.quickFixes);
      } catch { /* use defaults */ }
    })();
  }, [post.format, post.platform]);

  const submitFeedback = async (
    field: 'content' | 'image' | 'carousel' | 'thumbnail',
    rating: 'up' | 'down',
    text?: string,
    quickFix?: string
  ) => {
    try {
      await feedbackAPI.submit({
        postId: post._id,
        field,
        rating,
        feedbackText: text || '',
        quickFixUsed: quickFix || '',
        contentBefore: field === 'content' ? editContent : (post.imageUrl || ''),
        format: post.format,
        platform: post.platform,
        contentPillar: post.contentPillar,
        author: post.author,
      });
    } catch (err) {
      console.error('Feedback submission failed:', err);
    }
  };

  const handleThumbsUp = async (field: 'content' | 'image') => {
    const feedbackField = field === 'image'
      ? (post.format === 'carousel' ? 'carousel' as const : post.format === 'video_caption' ? 'thumbnail' as const : 'image' as const)
      : 'content' as const;
    await submitFeedback(feedbackField, 'up');
    if (field === 'content') setContentApproved(true);
    else setImageApproved(true);
    setShowFeedbackInput(null);
  };

  const handleThumbsDown = (field: 'content' | 'image') => {
    setShowFeedbackInput(field);
    setFeedbackText('');
  };

  const handleFeedbackRegenerate = async (instruction: string, field: 'content' | 'image') => {
    const feedbackField = field === 'image'
      ? (post.format === 'carousel' ? 'carousel' as const : post.format === 'video_caption' ? 'thumbnail' as const : 'image' as const)
      : 'content' as const;

    // Submit the negative feedback
    await submitFeedback(feedbackField, 'down', instruction, instruction);

    // Regenerate
    if (field === 'content') {
      await handleRegenerate(instruction);
    } else {
      // For images, trigger image regeneration
      setRegenerating(true);
      try {
        await postsAPI.generateImage(post._id, { imageType: 'regenerate', customPrompt: instruction });
        onPostUpdate();
      } catch (err) {
        console.error('Image regeneration failed:', err);
      } finally {
        setRegenerating(false);
      }
    }

    setShowFeedbackInput(null);
    setFeedbackText('');

    // Refresh quick fixes after feedback
    try {
      const { data } = await feedbackAPI.quickFixes({
        format: post.format,
        platform: post.platform,
        field: feedbackField,
      });
      if (data.quickFixes?.length) {
        if (field === 'content') setQuickFixes(data.quickFixes);
        else setImageQuickFixes(data.quickFixes);
      }
    } catch { /* ignore */ }
  };

  const handleRegenerate = async (instruction: string) => {
    setRegenerating(true);
    setContentApproved(false);
    try {
      const { data } = await postsAPI.regenerate(post._id, { instruction, field: 'text' });
      setEditContent(data.post?.draftContent || data.draftContent || data.finalContent || editContent);
      setDirty(false);
      onPostUpdate();
    } catch (err) {
      console.error('Regeneration failed:', err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await postsAPI.update(post._id, { draftContent: editContent });
      setDirty(false);
      onPostUpdate();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateContent = async () => {
    setGeneratingContent(true);
    try {
      const { data } = await postsAPI.regenerate(post._id, {
        instruction: `Generate a fresh draft for this ${post.format} post about: ${post.notes || post.contentPillar}. Use the hook: ${post.linkedinHook || post.instagramHook || ''}`,
        field: 'text',
      });
      const newContent = data.post?.draftContent || data.draftContent || '';
      if (newContent) {
        setEditContent(newContent);
        setDirty(false);
        onPostUpdate();
      }
    } catch (err) {
      console.error('Content generation failed:', err);
    } finally {
      setGeneratingContent(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {/* Platform icon */}
          {post.platform === 'linkedin' || post.platform === 'both' ? (
            <Linkedin size={16} className="text-blue-600" />
          ) : null}
          {post.platform === 'instagram' || post.platform === 'both' ? (
            <Instagram size={16} className="text-pink-400" />
          ) : null}
          {post.platform === 'facebook' ? (
            <Facebook size={16} className="text-indigo-600" />
          ) : null}

          {/* Author */}
          <span className="text-sm text-slate-500 capitalize">{post.author}</span>

          {/* Date */}
          {post.scheduledAt && (
            <span className="text-xs text-slate-300 flex items-center gap-1">
              <Clock size={10} />
              {new Date(post.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          )}

          {/* Format badge */}
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider"
            style={{ backgroundColor: `${formatColor}20`, color: formatColor }}
          >
            {post.format?.replace('_', ' ')}
          </span>

          {/* Pillar badge */}
          <span
            className="px-2 py-0.5 rounded text-[10px]"
            style={{ backgroundColor: `${pillarColor}20`, color: pillarColor }}
          >
            {post.contentPillar}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1 bg-brand-coral text-white rounded text-xs hover:bg-brand-coral/90 disabled:opacity-40"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save
            </button>
          )}
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{
              backgroundColor: STATUS_CONFIG[post.status]?.bg,
              color: STATUS_CONFIG[post.status]?.color,
            }}
          >
            {STATUS_CONFIG[post.status]?.label}
          </span>
        </div>
      </div>

      {(() => {
        const fmt = post.format?.toLowerCase() || '';
        const showThumbnail = ['video_caption'].includes(fmt);
        const isTextOnly = ['text_post', 'poll', 'document'].includes(fmt);
        const hasVisualPanel = !isTextOnly;

        return (
          <div className={`grid grid-cols-1 ${hasVisualPanel ? 'lg:grid-cols-3' : ''} gap-0`}>
            {/* Content area */}
            <div className={`${hasVisualPanel ? 'lg:col-span-2' : ''} p-4`}>
              {/* Source signal preview */}
              {(post as any).signalFeedId && typeof (post as any).signalFeedId === 'object' && (
                <div className="mb-3 flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <Lightbulb size={12} className="text-green-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-green-700 line-clamp-2">
                    {(post as any).signalFeedId.rawText}
                  </div>
                </div>
              )}

              {hasDraft ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => {
                      setEditContent(e.target.value);
                      setDirty(true);
                    }}
                    className="w-full h-40 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 resize-none focus:outline-none focus:border-brand-coral/50"
                  />
                  {/* Regenerate + Save buttons */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => handleGenerateContent()}
                      disabled={generatingContent || regenerating}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 transition-colors"
                    >
                      {generatingContent ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      Regenerate
                    </button>
                    {dirty && (
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-brand-coral rounded hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
                      >
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Save
                      </button>
                    )}
                  </div>
                </div>
              ) : generatingContent ? (
                <div className="w-full h-40 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 size={20} className="animate-spin text-brand-coral mx-auto mb-2" />
                    <span className="text-xs text-slate-400">Generating content...</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-40 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-center">
                  <div className="text-center">
                    <button
                      onClick={handleGenerateContent}
                      className="flex items-center gap-2 px-5 py-2.5 bg-brand-coral text-white rounded-lg font-medium text-sm hover:bg-brand-coral/90 transition-colors mx-auto"
                    >
                      <Sparkles size={16} />
                      Generate Content
                    </button>
                    <p className="text-xs text-slate-400 mt-2">Click to generate AI draft for this post</p>
                  </div>
                </div>
              )}

              {/* Carousel slides — editable */}
              {fmt === 'carousel' && post.draftCarouselOutline?.length > 0 && (
                <CarouselSlidesEditor post={post} onPostUpdate={onPostUpdate} />
              )}

              {/* Feedback: Thumbs up/down + dynamic quick fixes */}
              {hasDraft && (
                <div className="mt-3">
                  {/* Thumbs up/down bar */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Content</span>
                    <button
                      onClick={() => handleThumbsUp('content')}
                      disabled={regenerating}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                        contentApproved
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-slate-50 text-slate-400 hover:bg-green-50 hover:text-green-600'
                      }`}
                    >
                      <ThumbsUp size={12} />
                      {contentApproved ? 'Approved' : ''}
                    </button>
                    <button
                      onClick={() => handleThumbsDown('content')}
                      disabled={regenerating}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <ThumbsDown size={12} />
                    </button>
                    {regenerating && <Loader2 size={12} className="animate-spin text-brand-coral" />}
                  </div>

                  {/* Feedback input (shown on thumbs down) */}
                  {showFeedbackInput === 'content' && (
                    <div className="bg-red-50/50 border border-red-100 rounded-lg p-3 mb-2">
                      <div className="flex items-center gap-1.5 mb-2">
                        <MessageSquare size={12} className="text-red-400" />
                        <span className="text-xs text-red-500 font-medium">What should change?</span>
                      </div>

                      {/* Dynamic quick-fix buttons */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {quickFixes.map((fix) => (
                          <button
                            key={fix}
                            onClick={() => handleFeedbackRegenerate(fix, 'content')}
                            disabled={regenerating}
                            className="px-2.5 py-1 bg-white border border-red-100 rounded text-xs text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-40 transition-colors"
                          >
                            {fix}
                          </button>
                        ))}
                      </div>

                      {/* Custom feedback input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Tell us what to fix..."
                          className="flex-1 bg-white border border-red-100 rounded px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-300"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && feedbackText) {
                              handleFeedbackRegenerate(feedbackText, 'content');
                            }
                          }}
                        />
                        <button
                          onClick={() => handleFeedbackRegenerate(feedbackText, 'content')}
                          disabled={!feedbackText || regenerating}
                          className="px-3 py-1.5 bg-brand-coral text-white rounded text-xs disabled:opacity-40 hover:bg-brand-coral/90 flex items-center gap-1"
                        >
                          {regenerating ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Fix
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick-fix buttons (always visible when no feedback input) */}
                  {showFeedbackInput !== 'content' && !contentApproved && (
                    <div className="flex flex-wrap gap-1.5">
                      {quickFixes.slice(0, 5).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => handleFeedbackRegenerate(opt, 'content')}
                          disabled={regenerating}
                          className="px-2.5 py-1 bg-slate-50 rounded text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 transition-colors"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI Evidence */}
              {post.aiEvidence?.strategyReferences?.length > 0 && (
                <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target size={10} className="text-indigo-600" />
                    <span className="text-[10px] text-indigo-600 font-medium">Why this topic?</span>
                  </div>
                  <div className="text-xs text-indigo-600/70 space-y-1">
                    {post.aiEvidence.strategyReferences.slice(0, 2).map((ref, i) => (
                      <div key={i}>{ref}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hook & CTA inline for text-only formats */}
              {isTextOnly && (
                <div className="mt-3 flex gap-4">
                  {(post.linkedinHook || post.instagramHook) && (
                    <div className="text-xs text-slate-400">
                      <span className="text-[10px] text-slate-300 uppercase tracking-wider">Hook</span>
                      <p className="mt-0.5 italic text-slate-500">{post.linkedinHook || post.instagramHook}</p>
                    </div>
                  )}
                  {post.cta && (
                    <div className="text-xs text-slate-400">
                      <span className="text-[10px] text-slate-300 uppercase tracking-wider">CTA</span>
                      <p className="mt-0.5 text-slate-500">{post.cta}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Visual area — Carousel format (slide preview + PDF) */}
            {fmt === 'carousel' && (
              <div className="border-l border-slate-100 p-4">
                {/* Slide preview — show all slides or cover */}
                {post.imageVariations && post.imageVariations.length > 1 ? (
                  <CarouselSlidePreview slides={post.imageVariations} />
                ) : post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt="Carousel cover"
                    className="w-full rounded-lg border border-slate-200 mb-2"
                  />
                ) : (
                  <div className="w-full aspect-square bg-purple-50 rounded-lg flex items-center justify-center mb-2 border border-dashed border-purple-200">
                    <div className="text-center text-purple-300">
                      <Layers size={24} className="mx-auto mb-1" />
                      <span className="text-xs">
                        {generatingContent ? 'Generating slides...' : 'Generate PDF to preview'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Carousel PDF download */}
                {post.draftCarouselOutline?.length > 0 ? (
                  <div className="mb-2 space-y-1.5">
                    {/* Aspect ratio selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Ratio:</span>
                      {(['1:1', '4:5', '9:16'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setCarouselAspect(r)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            carouselAspect === r
                              ? 'bg-purple-100 text-purple-700 border border-purple-300'
                              : 'bg-slate-50 text-slate-400 border border-slate-200 hover:text-slate-600'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                      <span className="text-[10px] text-slate-300 ml-1">
                        {carouselAspect === '1:1' ? '1080×1080' : carouselAspect === '4:5' ? '1080×1350' : '1080×1920'}
                      </span>
                    </div>
                    {/* Style selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Style:</span>
                      {([
                        { id: 'clean_light', label: 'Clean', swatch: 'bg-slate-100 border-slate-300' },
                        { id: 'dark_navy', label: 'Navy', swatch: 'bg-[#0D1B3E] border-[#2A4494]' },
                        { id: 'white_minimal', label: 'Minimal', swatch: 'bg-white border-slate-300' },
                        { id: 'coral_bold', label: 'Coral', swatch: 'bg-[#FFF0EE] border-[#FF6F61]' },
                      ] as const).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setCarouselStyle(s.id)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            carouselStyle === s.id
                              ? 'bg-purple-100 text-purple-700 border border-purple-300'
                              : 'bg-slate-50 text-slate-400 border border-slate-200 hover:text-slate-600'
                          }`}
                        >
                          <span className={`inline-block w-2.5 h-2.5 rounded-full border ${s.swatch}`} />
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                    {/* Generate / Regenerate PDF button */}
                    <button
                      onClick={async () => {
                        setGeneratingContent(true);
                        try {
                          await postsAPI.generateImage(post._id, { imageType: 'carousel_pdf', aspectRatio: carouselAspect, style: carouselStyle });
                          onPostUpdate();
                        } catch (err) {
                          console.error('Carousel PDF generation failed:', err);
                        } finally {
                          setGeneratingContent(false);
                        }
                      }}
                      disabled={generatingContent}
                      className="flex items-center gap-2 px-3 py-2.5 flex-1 bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg text-purple-700 hover:from-purple-100 hover:to-purple-200 transition-all disabled:opacity-50"
                    >
                      {generatingContent ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      <div className="flex-1 text-left">
                        <span className="text-xs font-medium">
                          {generatingContent ? 'Generating...' : post.carouselPdfUrl ? 'Regenerate PDF' : 'Generate Carousel PDF'}
                        </span>
                        <span className="text-[10px] text-purple-400 block">{post.draftCarouselOutline.length} slides</span>
                      </div>
                    </button>

                    {/* Download button — only when PDF exists */}
                    {post.carouselPdfUrl && (
                      <button
                        onClick={async () => {
                          try {
                            const { data } = await postsAPI.downloadCarouselPdf(post._id);
                            const blob = new Blob([data], { type: 'application/pdf' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            const pillarSlug = (post.contentPillar || 'carousel').replace(/[^a-zA-Z0-9]+/g, '-').substring(0, 40);
                            const hookSlug = (post.linkedinHook || post.instagramHook || post.notes || '').replace(/[^a-zA-Z0-9]+/g, '-').substring(0, 50);
                            a.download = `carousel-${pillarSlug}${hookSlug ? '-' + hookSlug : ''}.pdf`.toLowerCase();
                            a.click();
                            window.URL.revokeObjectURL(url);
                          } catch (err) {
                            console.error('PDF download failed:', err);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        title="Download PDF"
                      >
                        <FileDown size={14} />
                        <span className="text-xs font-medium">Download</span>
                      </button>
                    )}
                    </div>
                  </div>
                ) : null}

                {/* Image feedback */}
                {(post.imageUrl || post.carouselPdfUrl) && (
                  <ImageFeedbackBar
                    approved={imageApproved}
                    showInput={showFeedbackInput === 'image'}
                    quickFixes={imageQuickFixes}
                    feedbackText={feedbackText}
                    regenerating={regenerating}
                    onThumbsUp={() => handleThumbsUp('image')}
                    onThumbsDown={() => handleThumbsDown('image')}
                    onQuickFix={(fix) => handleFeedbackRegenerate(fix, 'image')}
                    onFeedbackTextChange={setFeedbackText}
                    onSubmitFeedback={(text) => handleFeedbackRegenerate(text, 'image')}
                  />
                )}

                {/* Hook preview */}
                {(post.linkedinHook || post.instagramHook) && (
                  <div className="text-xs text-slate-400 mt-2">
                    <span className="text-[10px] text-slate-300 uppercase tracking-wider">Hook</span>
                    <p className="mt-0.5 italic text-slate-500">{post.linkedinHook || post.instagramHook}</p>
                  </div>
                )}

                {/* CTA */}
                {post.cta && (
                  <div className="text-xs text-slate-400 mt-2">
                    <span className="text-[10px] text-slate-300 uppercase tracking-wider">CTA</span>
                    <p className="mt-0.5 text-slate-500">{post.cta}</p>
                  </div>
                )}
              </div>
            )}

            {/* Visual area — Reel / Story formats (AI image) */}
            {(fmt === 'reel' || fmt === 'story') && (
              <div className="border-l border-slate-100 p-4">
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt="Post image"
                    className="w-full rounded-lg border border-slate-200 mb-2"
                  />
                ) : (
                  <div className="w-full aspect-square bg-slate-50 rounded-lg flex items-center justify-center text-slate-200 mb-2">
                    <div className="text-center">
                      <ImageIcon size={24} className="mx-auto mb-1" />
                      <span className="text-xs">
                        {post.imagePrompt ? 'Generating...' : 'No image yet'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Image feedback */}
                {post.imageUrl && (
                  <ImageFeedbackBar
                    approved={imageApproved}
                    showInput={showFeedbackInput === 'image'}
                    quickFixes={imageQuickFixes}
                    feedbackText={feedbackText}
                    regenerating={regenerating}
                    onThumbsUp={() => handleThumbsUp('image')}
                    onThumbsDown={() => handleThumbsDown('image')}
                    onQuickFix={(fix) => handleFeedbackRegenerate(fix, 'image')}
                    onFeedbackTextChange={setFeedbackText}
                    onSubmitFeedback={(text) => handleFeedbackRegenerate(text, 'image')}
                  />
                )}

                {/* Hook preview */}
                {(post.linkedinHook || post.instagramHook) && (
                  <div className="text-xs text-slate-400 mt-2">
                    <span className="text-[10px] text-slate-300 uppercase tracking-wider">Hook</span>
                    <p className="mt-0.5 italic text-slate-500">{post.linkedinHook || post.instagramHook}</p>
                  </div>
                )}

                {/* CTA */}
                {post.cta && (
                  <div className="text-xs text-slate-400 mt-2">
                    <span className="text-[10px] text-slate-300 uppercase tracking-wider">CTA</span>
                    <p className="mt-0.5 text-slate-500">{post.cta}</p>
                  </div>
                )}
              </div>
            )}

            {/* Thumbnail area — Video formats */}
            {showThumbnail && (
              <div className="border-l border-slate-100 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Film size={12} className="text-pink-500" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Video Thumbnail</span>
                </div>
                {post.imageUrl ? (
                  <div className="relative group">
                    <img
                      src={post.imageUrl}
                      alt="Video thumbnail"
                      className="w-full aspect-video rounded-lg border border-slate-200 object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md">
                        <Play size={16} className="text-slate-700 ml-0.5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-video bg-slate-50 rounded-lg flex items-center justify-center text-slate-200 border border-dashed border-slate-200">
                    <div className="text-center">
                      <Film size={24} className="mx-auto mb-1" />
                      <span className="text-xs">
                        {post.imagePrompt ? 'Generating thumbnail...' : 'No thumbnail'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Thumbnail feedback */}
                {post.imageUrl && (
                  <ImageFeedbackBar
                    approved={imageApproved}
                    showInput={showFeedbackInput === 'image'}
                    quickFixes={imageQuickFixes}
                    feedbackText={feedbackText}
                    regenerating={regenerating}
                    onThumbsUp={() => handleThumbsUp('image')}
                    onThumbsDown={() => handleThumbsDown('image')}
                    onQuickFix={(fix) => handleFeedbackRegenerate(fix, 'image')}
                    onFeedbackTextChange={setFeedbackText}
                    onSubmitFeedback={(text) => handleFeedbackRegenerate(text, 'image')}
                  />
                )}

                {/* Hook preview */}
                {(post.linkedinHook || post.instagramHook) && (
                  <div className="text-xs text-slate-400 mt-2">
                    <span className="text-[10px] text-slate-300 uppercase tracking-wider">Hook</span>
                    <p className="mt-0.5 italic text-slate-500">{post.linkedinHook || post.instagramHook}</p>
                  </div>
                )}

                {/* CTA */}
                {post.cta && (
                  <div className="text-xs text-slate-400 mt-2">
                    <span className="text-[10px] text-slate-300 uppercase tracking-wider">CTA</span>
                    <p className="mt-0.5 text-slate-500">{post.cta}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ============ Carousel Slide Preview (swipeable) ============
function CarouselSlidePreview({ slides }: { slides: string[] }) {
  const [activeIdx, setActiveIdx] = React.useState(0);

  return (
    <div className="mb-2">
      {/* Main slide image */}
      <div className="relative group">
        <img
          src={slides[activeIdx]}
          alt={`Slide ${activeIdx + 1}`}
          className="w-full rounded-lg border border-slate-200"
        />
        {/* Nav arrows */}
        {activeIdx > 0 && (
          <button
            onClick={() => setActiveIdx(activeIdx - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:bg-white"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {activeIdx < slides.length - 1 && (
          <button
            onClick={() => setActiveIdx(activeIdx + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:bg-white"
          >
            <ChevronRight size={16} />
          </button>
        )}
        {/* Slide counter */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/50 rounded text-white text-xs font-medium">
          {activeIdx + 1} / {slides.length}
        </div>
      </div>
      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`rounded-full transition-all ${
              i === activeIdx
                ? 'w-5 h-2 bg-purple-500'
                : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ============ Image Feedback Bar (reusable) ============
function ImageFeedbackBar({
  approved,
  showInput,
  quickFixes,
  feedbackText,
  regenerating,
  onThumbsUp,
  onThumbsDown,
  onQuickFix,
  onFeedbackTextChange,
  onSubmitFeedback,
}: {
  approved: boolean;
  showInput: boolean;
  quickFixes: string[];
  feedbackText: string;
  regenerating: boolean;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
  onQuickFix: (fix: string) => void;
  onFeedbackTextChange: (text: string) => void;
  onSubmitFeedback: (text: string) => void;
}) {
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Visual</span>
        <button
          onClick={onThumbsUp}
          disabled={regenerating}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
            approved
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-slate-50 text-slate-400 hover:bg-green-50 hover:text-green-600'
          }`}
        >
          <ThumbsUp size={10} />
          {approved ? 'Approved' : ''}
        </button>
        <button
          onClick={onThumbsDown}
          disabled={regenerating}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <ThumbsDown size={10} />
        </button>
        {regenerating && <Loader2 size={10} className="animate-spin text-brand-coral" />}
      </div>

      {showInput && (
        <div className="bg-red-50/50 border border-red-100 rounded-lg p-2">
          <div className="flex flex-wrap gap-1 mb-1.5">
            {quickFixes.map((fix) => (
              <button
                key={fix}
                onClick={() => onQuickFix(fix)}
                disabled={regenerating}
                className="px-2 py-0.5 bg-white border border-red-100 rounded text-[10px] text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 transition-colors"
              >
                {fix}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={feedbackText}
              onChange={(e) => onFeedbackTextChange(e.target.value)}
              placeholder="Describe the change..."
              className="flex-1 bg-white border border-red-100 rounded px-2 py-1 text-[11px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-300"
              onKeyDown={(e) => { if (e.key === 'Enter' && feedbackText) onSubmitFeedback(feedbackText); }}
            />
            <button
              onClick={() => onSubmitFeedback(feedbackText)}
              disabled={!feedbackText || regenerating}
              className="px-2 py-1 bg-brand-coral text-white rounded text-[11px] disabled:opacity-40 hover:bg-brand-coral/90"
            >
              {regenerating ? <Loader2 size={10} className="animate-spin" /> : 'Fix'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Empty State ============
function EmptyCalendar({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center py-16">
        <CalendarIcon size={56} className="text-slate-200 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No content planned this week</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-md">
          Let AI generate a content plan based on your marketing strategy — the right topics, platforms, and schedule.
        </p>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-3 bg-brand-coral text-white rounded-lg font-medium hover:bg-brand-coral/90 disabled:opacity-40 mx-auto transition-colors"
        >
          <Sparkles size={18} />
          Generate Week Plan
        </button>
      </div>
    </div>
  );
}

// ============ Calendar View (Week Grid) ============
function CalendarView({
  weekStart,
  weekData,
  allPillars,
  onSelectPost,
  onStatusChange,
  onPostUpdate,
}: {
  weekStart: Date;
  weekData: WeekPlan;
  allPillars: string[];
  onSelectPost: (post: Post) => void;
  onStatusChange: (postId: string, status: string) => void;
  onPostUpdate?: () => void;
}) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const handleDrop = async (targetDate: string) => {
    if (!draggingPostId) return;
    setDragOverDate(null);
    setDraggingPostId(null);
    try {
      await calendarAPI.reschedule(draggingPostId, targetDate);
      if (onPostUpdate) onPostUpdate();
    } catch (err) {
      console.error('Reschedule failed:', err);
    }
  };

  return (
    <div className="grid grid-cols-7 gap-2 flex-1">
      {days.map((day) => {
        const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        const dayPosts = weekData.days[dateKey] || [];
        const isToday = dateKey === today;
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const isDragOver = dragOverDate === dateKey;

        return (
          <div
            key={dateKey}
            className={`rounded-xl border min-h-[300px] flex flex-col transition-colors ${
              isDragOver
                ? 'border-brand-coral border-2 bg-brand-coral/5'
                : isToday
                ? 'border-brand-coral/40 bg-brand-coral/5'
                : isWeekend
                ? 'border-slate-100 bg-slate-50'
                : 'border-slate-200 bg-white shadow-sm'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOverDate(dateKey); }}
            onDragLeave={() => setDragOverDate(null)}
            onDrop={(e) => { e.preventDefault(); handleDrop(dateKey); }}
          >
            {/* Day header */}
            <div className={`px-3 py-2 border-b ${isToday ? 'border-brand-coral/20' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span
                  className={`text-sm font-medium ${
                    isToday
                      ? 'bg-brand-coral text-white w-6 h-6 rounded-full flex items-center justify-center text-xs'
                      : 'text-slate-500'
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
            </div>

            {/* Posts */}
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
              {dayPosts.map((post: Post) => (
                <TaskCard
                  key={post._id}
                  post={post}
                  allPillars={allPillars}
                  compact
                  onClick={() => onSelectPost(post)}
                  onStatusChange={onStatusChange}
                  onPostUpdate={onPostUpdate}
                  onDragStart={() => setDraggingPostId(post._id)}
                />
              ))}
              {dayPosts.length === 0 && !isWeekend && !isDragOver && (
                <div className="text-xs text-slate-200 text-center py-8">No tasks</div>
              )}
              {isDragOver && (
                <div className="text-xs text-brand-coral text-center py-4 border-2 border-dashed border-brand-coral/30 rounded-lg">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ Task View (Kanban Board) ============
function TaskView({
  weekData,
  allPillars,
  onSelectPost,
  onStatusChange,
}: {
  weekData: WeekPlan;
  allPillars: string[];
  onSelectPost: (post: Post) => void;
  onStatusChange: (postId: string, status: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-4 flex-1">
      {TASK_STATUSES.map((status) => {
        const config = STATUS_CONFIG[status];
        const postsInStatus = weekData.posts.filter((p) => p.status === status);

        return (
          <div key={status} className="flex flex-col min-h-0">
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span style={{ color: config.color }}>{config.icon}</span>
                <span className="text-sm font-medium" style={{ color: config.color }}>
                  {config.label}
                </span>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: config.bg, color: config.color }}
              >
                {postsInStatus.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 bg-slate-50 rounded-xl border border-slate-100 p-2 overflow-y-auto">
              {postsInStatus.map((post) => (
                <TaskCard
                  key={post._id}
                  post={post}
                  allPillars={allPillars}
                  compact={false}
                  onClick={() => onSelectPost(post)}
                  onStatusChange={onStatusChange}
                />
              ))}
              {postsInStatus.length === 0 && (
                <div className="text-xs text-slate-200 text-center py-8">No tasks</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ Task Card ============
function TaskCard({
  post,
  allPillars,
  compact,
  onClick,
  onStatusChange,
  onPostUpdate,
  onDragStart,
}: {
  post: Post;
  allPillars: string[];
  compact: boolean;
  onClick: () => void;
  onStatusChange: (postId: string, status: string) => void;
  onPostUpdate?: () => void;
  onDragStart?: () => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);

  const pillarColor = getPillarColor(post.contentPillar, allPillars);
  const statusConfig = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft;
  const formatColor = getFormatColor(post.format);

  const handleCalendarFeedback = async (text: string) => {
    setSubmitting(true);
    try {
      // Submit negative feedback on the topic suggestion
      await feedbackAPI.submit({
        postId: post._id,
        field: 'content',
        rating: 'down',
        feedbackText: text,
        contentBefore: post.notes || post.linkedinHook || '',
        format: post.format,
        platform: post.platform,
        contentPillar: post.contentPillar,
        author: post.author,
      });
      // Delete this post and trigger feedback-aware regeneration
      await postsAPI.delete(post._id);
      if (onPostUpdate) onPostUpdate();
    } catch (err) {
      console.error('Feedback failed:', err);
    } finally {
      setSubmitting(false);
      setShowFeedback(false);
      setFeedbackText('');
    }
  };

  const handleApprovePost = async () => {
    try {
      await feedbackAPI.submit({
        postId: post._id,
        field: 'content',
        rating: 'up',
        contentBefore: post.notes || post.linkedinHook || '',
        format: post.format,
        platform: post.platform,
        contentPillar: post.contentPillar,
        author: post.author,
      });
      setApproved(true);
    } catch { /* ignore */ }
  };

  return (
    <div
      draggable={compact}
      onDragStart={(e) => {
        if (compact && onDragStart) {
          onDragStart();
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', post._id);
          // Make the dragged element semi-transparent
          (e.target as HTMLElement).style.opacity = '0.5';
        }
      }}
      onDragEnd={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
      className={`rounded-lg border bg-white shadow-sm hover:bg-slate-100 cursor-pointer transition-colors overflow-hidden group relative ${
        compact ? 'text-xs cursor-grab active:cursor-grabbing' : 'text-sm'
      } ${approved ? 'border-green-200' : 'border-slate-200'}`}
    >
      {/* Pillar color bar */}
      <div className="h-1 w-full" style={{ backgroundColor: pillarColor }} />

      <div className={compact ? 'p-2' : 'p-3'} onClick={showFeedback ? undefined : onClick}>
        {/* Platform + Author + Format row */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {post.platform === 'linkedin' || post.platform === 'both' ? (
              <Linkedin size={compact ? 10 : 12} className="text-blue-600 flex-shrink-0" />
            ) : null}
            {post.platform === 'instagram' || post.platform === 'both' ? (
              <Instagram size={compact ? 10 : 12} className="text-pink-400 flex-shrink-0" />
            ) : null}
            {post.platform === 'facebook' ? (
              <Facebook size={compact ? 10 : 12} className="text-indigo-600 flex-shrink-0" />
            ) : null}
            <span className="text-slate-400 capitalize truncate">{post.author}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase whitespace-nowrap"
              style={{ backgroundColor: `${formatColor}20`, color: formatColor }}
            >
              {post.format?.replace('_', ' ')}
            </span>
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
              style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Topic / Hook */}
        <p className={`text-slate-700 leading-snug ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
          {post.notes || post.linkedinHook || post.instagramHook || post.draftContent || 'Untitled post'}
        </p>

        {/* Thumbs up/down + delete — visible on hover (compact calendar cards) */}
        {compact && !showFeedback && (
          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); handleApprovePost(); }}
              className={`p-1 rounded transition-colors ${approved ? 'bg-green-100 text-green-600' : 'hover:bg-green-50 text-slate-300 hover:text-green-500'}`}
              title="Good suggestion"
            >
              <ThumbsUp size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowFeedback(true); }}
              className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
              title="Bad suggestion — give feedback"
            >
              <ThumbsDown size={10} />
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (window.confirm('Delete this post?')) {
                  try {
                    await postsAPI.delete(post._id);
                    if (onPostUpdate) onPostUpdate();
                  } catch (err) { console.error('Delete failed:', err); }
                }
              }}
              className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
              title="Delete post"
            >
              <X size={10} />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-1 text-slate-300">
              <Clock size={10} />
              {post.scheduledAt && new Date(post.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}

        {/* Feedback panel (shown on thumbs down in compact mode) */}
        {compact && showFeedback && (
          <div className="mt-2 bg-red-50 border border-red-100 rounded-lg p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 mb-1.5">
              <MessageSquare size={10} className="text-red-400" />
              <span className="text-[10px] text-red-500 font-medium">What's wrong?</span>
              <button
                onClick={() => setShowFeedback(false)}
                className="ml-auto text-slate-300 hover:text-slate-500"
              >
                <X size={10} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {['Wrong topic', 'Wrong format', 'Not relevant', 'Stale/old'].map((fix) => (
                <button
                  key={fix}
                  onClick={() => handleCalendarFeedback(fix)}
                  disabled={submitting}
                  className="px-1.5 py-0.5 bg-white border border-red-100 rounded text-[9px] text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                >
                  {fix}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Or type..."
                className="flex-1 bg-white border border-red-100 rounded px-1.5 py-0.5 text-[10px] text-slate-900 placeholder-slate-400 focus:outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && feedbackText) handleCalendarFeedback(feedbackText); }}
              />
              <button
                onClick={() => handleCalendarFeedback(feedbackText)}
                disabled={!feedbackText || submitting}
                className="px-1.5 py-0.5 bg-brand-coral text-white rounded text-[9px] disabled:opacity-40"
              >
                {submitting ? '...' : 'Go'}
              </button>
            </div>
          </div>
        )}

        {/* Source signal hint */}
        {!compact && (post as any).signalFeedId && typeof (post as any).signalFeedId === 'object' && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-green-400/60">
            <Lightbulb size={9} />
            <span className="truncate">From insight</span>
          </div>
        )}

        {/* Pillar (non-compact) */}
        {!compact && (
          <div className="flex items-center gap-2 mt-2">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${pillarColor}20`, color: pillarColor }}
            >
              {post.contentPillar || 'No pillar'}
            </span>
          </div>
        )}

        {/* Quick status change row (non-compact only) */}
        {!compact && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
            {TASK_STATUSES.filter((s) => s !== post.status).map((s) => {
              const sc = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(post._id, s);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] hover:bg-slate-100 transition-colors"
                  style={{ color: sc.color }}
                  title={`Move to ${sc.label}`}
                >
                  <ArrowRight size={10} />
                  {sc.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Scheduled time (compact, no feedback) */}
        {compact && !showFeedback && post.scheduledAt && (
          <div className="flex items-center gap-1 mt-1 text-slate-300 group-hover:hidden">
            <Clock size={10} />
            {new Date(post.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Content Generation Thinking Animation ============
const GEN_STEPS = [
  'Analysing your brief...',
  'Loading strategy context...',
  'Matching content pillar tone...',
  'Crafting the hook...',
  'Writing the draft...',
  'Polishing the CTA...',
  'Final review...',
];

function ContentThinking({ isRegen }: { isRegen: boolean }) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((prev) => (prev + 1) % GEN_STEPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border border-brand-coral/20 bg-gradient-to-br from-brand-coral/5 to-white rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Loader2 size={18} className="animate-spin text-brand-coral" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 mb-2">{isRegen ? 'Regenerating content...' : 'Generating content...'}</p>
          <p className="text-sm text-brand-coral transition-all duration-500">{GEN_STEPS[stepIdx]}</p>
          <div className="mt-3 flex gap-1">
            {GEN_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i <= stepIdx ? 'bg-brand-coral w-4' : 'bg-slate-200 w-2'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Task Detail Drawer ============
function TaskDetailDrawer({
  post,
  allPillars,
  onClose,
  onStatusChange,
  onPostUpdate,
}: {
  post: Post;
  allPillars: string[];
  onClose: () => void;
  onStatusChange: (postId: string, status: string) => void;
  onPostUpdate: () => void;
}) {
  const pillarColor = getPillarColor(post.contentPillar, allPillars);
  const statusConfig = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft;
  const formatColor = getFormatColor(post.format);
  const evidence = post.aiEvidence?.strategyReferences || [];

  // Editable fields
  const [editBrief, setEditBrief] = useState(post.notes || '');
  const [editHook, setEditHook] = useState(post.linkedinHook || post.instagramHook || '');
  const [editCta, setEditCta] = useState(post.cta || '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [isRegen, setIsRegen] = useState(false);
  const [generatedContent, setGeneratedContent] = useState(post.draftContent || '');
  const [editContent, setEditContent] = useState(post.draftContent || '');

  const handleFieldChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setter(e.target.value);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await postsAPI.update(post._id, {
        notes: editBrief,
        linkedinHook: editHook,
        instagramHook: editHook,
        cta: editCta,
        draftContent: editContent,
      });
      setDirty(false);
      onPostUpdate();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative w-full max-w-lg bg-white border-l border-slate-200 h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pillarColor }} />
            <span className="font-medium">{post.contentPillar || 'Uncategorized'}</span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-medium uppercase"
              style={{ backgroundColor: `${formatColor}20`, color: formatColor }}
            >
              {post.format?.replace('_', ' ')}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status + Actions */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Status</label>
            <div className="flex items-center gap-2">
              {TASK_STATUSES.map((s) => {
                const sc = STATUS_CONFIG[s];
                const isActive = s === post.status;
                return (
                  <button
                    key={s}
                    onClick={() => onStatusChange(post._id, s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'ring-2 ring-offset-1 ring-offset-transparent'
                        : 'hover:bg-slate-100'
                    }`}
                    style={{
                      backgroundColor: isActive ? sc.bg : 'transparent',
                      color: sc.color,
                      ...(isActive ? { ringColor: sc.color } : {}),
                    }}
                  >
                    {sc.icon}
                    {sc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <label className="text-xs text-slate-400 mb-1 block">Platform</label>
              <div className="flex items-center gap-2">
                {post.platform === 'linkedin' || post.platform === 'both' ? (
                  <Linkedin size={16} className="text-blue-600" />
                ) : null}
                {post.platform === 'instagram' || post.platform === 'both' ? (
                  <Instagram size={16} className="text-pink-400" />
                ) : null}
                {post.platform === 'facebook' ? (
                  <Facebook size={16} className="text-indigo-600" />
                ) : null}
                <span className="capitalize text-sm">{post.platform}</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <label className="text-xs text-slate-400 mb-1 block">Author</label>
              <div className="flex items-center gap-2">
                <User size={16} className="text-slate-500" />
                <span className="capitalize text-sm">{post.author}</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <label className="text-xs text-slate-400 mb-1 block">Format</label>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: `${formatColor}20`, color: formatColor }}
                >
                  {post.format?.replace('_', ' ') || '—'}
                </span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <label className="text-xs text-slate-400 mb-1 block">Scheduled</label>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock size={14} className="text-slate-400" />
                {post.scheduledAt
                  ? new Date(post.scheduledAt).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </div>
            </div>
          </div>

          {/* Source signal */}
          {(post as any).signalFeedId && typeof (post as any).signalFeedId === 'object' && (
            <div>
              <label className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                <Lightbulb size={12} />
                Source Insight
              </label>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                {(post as any).signalFeedId.rawText}
              </div>
            </div>
          )}

          {/* Topic Brief — editable */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Topic Brief</label>
            <textarea
              value={editBrief}
              onChange={handleFieldChange(setEditBrief)}
              placeholder="Describe the topic and angle for this post..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 leading-relaxed resize-none focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20 transition-colors"
              rows={4}
            />
          </div>

          {/* Hook — editable */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Hook</label>
            <textarea
              value={editHook}
              onChange={handleFieldChange(setEditHook)}
              placeholder="Write a compelling opening line..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 italic resize-none focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20 transition-colors"
              rows={3}
            />
          </div>

          {/* CTA — editable */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Call to Action</label>
            <textarea
              value={editCta}
              onChange={handleFieldChange(setEditCta)}
              placeholder="What should the reader do next?"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 resize-none focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20 transition-colors"
              rows={2}
            />
          </div>

          {/* Save button — only shows when dirty */}
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-coral text-white rounded-lg text-sm font-medium hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}

          {/* Content Draft — editable */}
          {generatedContent && !generatingContent && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4">
                <label className="text-xs text-slate-400 mb-2 block">Content Draft</label>
                <textarea
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    setGeneratedContent(e.target.value);
                    setDirty(true);
                  }}
                  className="w-full bg-slate-50 rounded-lg p-4 text-sm text-slate-700 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-brand-coral/40 focus:border-brand-coral/40 border border-transparent"
                  style={{ minHeight: '200px' }}
                  rows={Math.max(8, editContent.split('\n').length + 2)}
                />
              </div>
            </div>
          )}

          {/* Generate / Regenerate button */}
          {generatingContent ? (
            <ContentThinking isRegen={isRegen} />
          ) : generatedContent ? (
            <button
              type="button"
              onClick={async () => {
                setIsRegen(true);
                setGeneratingContent(true);
                try {
                  const { data } = await postsAPI.generateContent(post._id, true);
                  const newContent = data.post?.draftContent || data.draftContent || '';
                  setGeneratedContent(newContent);
                  setEditContent(newContent);
                  onPostUpdate();
                } catch (err) {
                  console.error('Content regeneration failed:', err);
                } finally {
                  setGeneratingContent(false);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-brand-coral text-brand-coral rounded-lg text-sm font-medium hover:bg-brand-coral/5 transition-colors"
            >
              <RefreshCw size={14} /> Regenerate Content
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                setIsRegen(false);
                setGeneratingContent(true);
                try {
                  const { data } = await postsAPI.generateContent(post._id);
                  const newContent = data.post?.draftContent || data.draftContent || '';
                  setGeneratedContent(newContent);
                  setEditContent(newContent);
                  onPostUpdate();
                } catch (err) {
                  console.error('Content generation failed:', err);
                } finally {
                  setGeneratingContent(false);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-brand-coral to-brand-coral/80 text-white rounded-lg text-sm font-medium hover:from-brand-coral/90 hover:to-brand-coral/70 transition-all shadow-sm"
            >
              <Sparkles size={16} /> Generate Content for This Post
            </button>
          )}

          {/* Strategy Evidence */}
          {evidence.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                <Target size={12} />
                Why This Topic
              </label>
              <div className="space-y-2">
                {evidence.map((ref, i) => (
                  <div
                    key={i}
                    className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-600"
                  >
                    {ref}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Confidence */}
          {post.aiEvidence && (
            <div className="text-xs text-slate-300 flex items-center gap-2 pt-2 border-t border-slate-100">
              <Sparkles size={12} />
              AI Confidence: {Math.round((post.aiEvidence.confidenceScore || 0) * 100)}% |
              Critique Score: {post.aiEvidence.finalCritiqueScore || '—'}/10
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Generation Inputs Panel ============
function GenerationInputsPanel({ inputs }: { inputs: GenerationInputs }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">Generation Inputs</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium">
              <Briefcase size={10} />
              Strategy
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded text-[10px] font-medium">
              <Lightbulb size={10} />
              {inputs.signalsUsed} Insights
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-medium">
              <CalendarDays size={10} />
              Special Dates
            </span>
            {inputs.viralSignals > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-pink-50 text-pink-600 rounded text-[10px] font-medium">
                <TrendingUp size={10} />
                {inputs.viralSignals} Trends
              </span>
            )}
            {inputs.campaigns > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-medium">
                {inputs.campaigns} Campaigns
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Signals */}
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb size={12} className="text-green-600" />
                <span className="text-xs text-green-600 font-medium">Insights</span>
              </div>
              <p className="text-xs text-slate-500">
                {inputs.signalsUsed > 0
                  ? `${inputs.signalsUsed} confirmed insights used as content seeds`
                  : 'No confirmed insights this week'}
              </p>
            </div>

            {/* Special Dates */}
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarDays size={12} className="text-amber-600" />
                <span className="text-xs text-amber-600 font-medium">Special Dates</span>
              </div>
              <p className="text-xs text-slate-500">
                AI researched holidays, awareness days, and events relevant to your ICP
              </p>
            </div>

            {/* Viral Trends */}
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={12} className="text-pink-600" />
                <span className="text-xs text-pink-600 font-medium">Viral / Trending</span>
              </div>
              <p className="text-xs text-slate-500">
                {inputs.viralSignals > 0
                  ? `${inputs.viralSignals} market observations and trends analyzed`
                  : 'No trending signals captured recently'}
              </p>
            </div>

            {/* Strategy */}
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Briefcase size={12} className="text-indigo-600" />
                <span className="text-xs text-indigo-600 font-medium">Strategy</span>
              </div>
              <p className="text-xs text-slate-500">
                Pillars, ICP, voice profiles, platform targets, and key messages
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
