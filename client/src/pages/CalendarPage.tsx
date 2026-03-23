import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import { calendarAPI, postsAPI } from '../api/client';
import { useStrategy } from '../contexts/StrategyContext';
import type { Post, WeekPlan, GenerationInputs, ApproveProgress } from '../types';

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

const REGENERATE_OPTIONS = [
  'Shorter',
  'More direct',
  'More vulnerable / personal',
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
  const { isComplete } = useStrategy();
  const [view, setView] = useState<ViewType>('calendar');
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [weekData, setWeekData] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveProgress, setApproveProgress] = useState<ApproveProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [generationInputs, setGenerationInputs] = useState<GenerationInputs | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const weekStartStr = weekStart.toISOString().slice(0, 10);

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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const { data } = await calendarAPI.generateWeek(weekStartStr);
      if (data.inputs) {
        setGenerationInputs(data.inputs);
      }
      await loadWeek();
    } catch (err: any) {
      console.error('Generate error:', err);
      setErrorMsg(err?.response?.data?.error || 'Failed to generate weekly plan');
    } finally {
      setGenerating(false);
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

  const allPillars = weekData
    ? [...new Set(weekData.posts.map((p) => p.contentPillar).filter(Boolean))]
    : [];

  const totalTasks = weekData?.stats?.total || 0;
  const completedTasks = (weekData?.stats?.byStatus?.published || 0) + (weekData?.stats?.byStatus?.scheduled || 0);
  const allDrafts = totalTasks > 0 && (weekData?.stats?.byStatus?.draft || 0) === totalTasks;
  const hasApproved = totalTasks > 0 && (weekData?.stats?.byStatus?.scheduled || 0) > 0;

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

          {/* Quick stats */}
          {weekData && totalTasks > 0 && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {Object.entries(weekData.stats.byPlatform).map(([platform, count]) => (
                <span key={platform} className="flex items-center gap-1">
                  {platform === 'linkedin' ? (
                    <Linkedin size={12} className="text-blue-600" />
                  ) : (
                    <Instagram size={12} className="text-pink-400" />
                  )}
                  {count}
                </span>
              ))}
              <span className="text-slate-200">|</span>
              {Object.entries(weekData.stats.byAuthor).map(([author, count]) => (
                <span key={author} className="flex items-center gap-1">
                  <User size={12} />
                  {author}: {count}
                </span>
              ))}
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
              Generate Week Plan
            </button>
          ) : allDrafts && !approving ? (
            <>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-3 py-2 bg-white shadow-sm text-slate-500 rounded-lg text-sm hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <RefreshCw size={14} />
                Regenerate
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
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              <CheckCircle2 size={16} />
              Approved
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
              Regenerate Week
            </button>
          )}
        </div>
      </div>

      {/* Strategy Evidence Bar */}
      {weekData?.strategyContext && totalTasks > 0 && (
        <StrategyEvidenceBar
          weekData={weekData}
          allPillars={allPillars}
        />
      )}

      {/* Pillar Alignment Bar (shown when no strategy context, fallback) */}
      {weekData && !weekData.strategyContext && allPillars.length > 0 && totalTasks > 0 && (
        <div className="mb-4 bg-white shadow-sm border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Target size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400">Content Pillar Mix</span>
          </div>
          <div className="flex gap-2">
            {allPillars.map((pillar) => {
              const count = weekData.stats.byPillar[pillar] || 0;
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
      ) : !weekData || totalTasks === 0 ? (
        <EmptyCalendar onGenerate={handleGenerate} generating={generating} />
      ) : view === 'calendar' ? (
        <CalendarView
          weekStart={weekStart}
          weekData={weekData}
          allPillars={allPillars}
          onSelectPost={setSelectedPost}
          onStatusChange={handleStatusChange}
        />
      ) : view === 'tasks' ? (
        <TaskView
          weekData={weekData}
          allPillars={allPillars}
          onSelectPost={setSelectedPost}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <ContentReviewView
          weekData={weekData}
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
                  {pt.platform === 'linkedin' ? <Linkedin size={10} /> : <Instagram size={10} />}
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

  const pillarColor = getPillarColor(post.contentPillar, allPillars);
  const formatColor = getFormatColor(post.format);
  const hasDraft = !!post.draftContent || !!post.finalContent;

  const handleRegenerate = async (instruction: string) => {
    setRegenerating(true);
    try {
      const { data } = await postsAPI.regenerate(post._id, { instruction, field: 'text' });
      setEditContent(data.draftContent || data.finalContent || '');
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Content area (2/3) */}
        <div className="lg:col-span-2 p-4">
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
            <textarea
              value={editContent}
              onChange={(e) => {
                setEditContent(e.target.value);
                setDirty(true);
              }}
              className="w-full h-40 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 resize-none focus:outline-none focus:border-brand-coral/50"
            />
          ) : (
            <div className="w-full h-40 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={20} className="animate-spin text-brand-coral mx-auto mb-2" />
                <span className="text-xs text-slate-400">AI drafting content...</span>
              </div>
            </div>
          )}

          {/* Regenerate options */}
          {hasDraft && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1.5">
                {REGENERATE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleRegenerate(opt)}
                    disabled={regenerating}
                    className="px-2.5 py-1 bg-slate-50 rounded text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="Custom instruction..."
                  className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-coral/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customInstruction) {
                      handleRegenerate(customInstruction);
                      setCustomInstruction('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    handleRegenerate(customInstruction);
                    setCustomInstruction('');
                  }}
                  disabled={!customInstruction || regenerating}
                  className="px-3 py-1 bg-brand-coral text-white rounded text-xs disabled:opacity-40 hover:bg-brand-coral/90"
                >
                  {regenerating ? <Loader2 size={12} className="animate-spin" /> : 'Go'}
                </button>
              </div>
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
        </div>

        {/* Image area (1/3) */}
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
                  {post.imagePrompt ? 'Generating...' : 'No image'}
                </span>
              </div>
            </div>
          )}

          {/* Image variations */}
          {post.imageVariations?.length > 0 && (
            <div className="flex gap-1.5 mb-2">
              {post.imageVariations.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Variation ${i + 1}`}
                  className="w-12 h-12 rounded border border-slate-200 cursor-pointer hover:border-brand-coral object-cover"
                />
              ))}
            </div>
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
      </div>
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
}: {
  weekStart: Date;
  weekData: WeekPlan;
  allPillars: string[];
  onSelectPost: (post: Post) => void;
  onStatusChange: (postId: string, status: string) => void;
}) {
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-7 gap-2 flex-1">
      {days.map((day) => {
        const dateKey = day.toISOString().slice(0, 10);
        const dayPosts = weekData.days[dateKey] || [];
        const isToday = dateKey === today;
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;

        return (
          <div
            key={dateKey}
            className={`rounded-xl border min-h-[300px] flex flex-col ${
              isToday
                ? 'border-brand-coral/40 bg-brand-coral/5'
                : isWeekend
                ? 'border-slate-100 bg-slate-50'
                : 'border-slate-200 bg-white shadow-sm'
            }`}
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
                />
              ))}
              {dayPosts.length === 0 && !isWeekend && (
                <div className="text-xs text-slate-200 text-center py-8">No tasks</div>
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
}: {
  post: Post;
  allPillars: string[];
  compact: boolean;
  onClick: () => void;
  onStatusChange: (postId: string, status: string) => void;
}) {
  const pillarColor = getPillarColor(post.contentPillar, allPillars);
  const statusConfig = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft;
  const formatColor = getFormatColor(post.format);

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-slate-200 bg-white shadow-sm hover:bg-slate-100 cursor-pointer transition-colors overflow-hidden ${
        compact ? 'text-xs' : 'text-sm'
      }`}
    >
      {/* Pillar color bar */}
      <div className="h-1 w-full" style={{ backgroundColor: pillarColor }} />

      <div className={compact ? 'p-2' : 'p-3'}>
        {/* Platform + Author + Format row */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            {post.platform === 'linkedin' || post.platform === 'both' ? (
              <Linkedin size={compact ? 10 : 12} className="text-blue-600" />
            ) : null}
            {post.platform === 'instagram' || post.platform === 'both' ? (
              <Instagram size={compact ? 10 : 12} className="text-pink-400" />
            ) : null}
            <span className="text-slate-400 capitalize">{post.author}</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Format badge */}
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase"
              style={{ backgroundColor: `${formatColor}20`, color: formatColor }}
            >
              {post.format?.replace('_', ' ')}
            </span>
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
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

        {/* Scheduled time (compact) */}
        {compact && post.scheduledAt && (
          <div className="flex items-center gap-1 mt-1 text-slate-300">
            <Clock size={10} />
            {new Date(post.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
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
}: {
  post: Post;
  allPillars: string[];
  onClose: () => void;
  onStatusChange: (postId: string, status: string) => void;
}) {
  const pillarColor = getPillarColor(post.contentPillar, allPillars);
  const statusConfig = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft;
  const formatColor = getFormatColor(post.format);
  const evidence = post.aiEvidence?.strategyReferences || [];

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

          {/* Topic Brief */}
          {post.notes && (
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Topic Brief</label>
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 leading-relaxed">
                {post.notes}
              </div>
            </div>
          )}

          {/* Hook */}
          {(post.linkedinHook || post.instagramHook) && (
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Hook</label>
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 italic">
                "{post.linkedinHook || post.instagramHook}"
              </div>
            </div>
          )}

          {/* CTA */}
          {post.cta && (
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Call to Action</label>
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700">
                {post.cta}
              </div>
            </div>
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
