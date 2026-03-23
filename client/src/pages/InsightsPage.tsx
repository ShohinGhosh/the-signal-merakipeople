import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight, Link2, Check, ArrowRight, Calendar } from 'lucide-react';
import { signalFeedAPI } from '../api/client';
import type { SignalFeedEntry } from '../types';
import { SIGNAL_TAGS } from '../types';

const ROUTING_BADGES: Record<string, { label: string; color: string }> = {
  strategy_update: { label: 'Strategy', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  content_seed: { label: 'Content Seed', color: 'bg-green-50 text-green-600 border-green-200' },
  campaign_fuel: { label: 'Campaign', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  archive: { label: 'Archive', color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-600' },
  confirmed: { label: 'Confirmed', color: 'text-green-600' },
  in_calendar: { label: 'In Calendar', color: 'text-blue-600' },
  published: { label: 'Published', color: 'text-brand-coral' },
  archived: { label: 'Archived', color: 'text-slate-300' },
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatWeekLabel(monday: Date): string {
  const now = new Date();
  const thisMonday = getMonday(now);
  const diff = Math.round((monday.getTime() - thisMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (diff === 0) return 'This Week';
  if (diff === -1) return 'Last Week';
  if (diff === 1) return 'Next Week';
  const end = new Date(monday);
  end.setDate(monday.getDate() + 6);
  return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function InsightsPage() {
  const [entries, setEntries] = useState<SignalFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [filter, setFilter] = useState<{ author?: string; status?: string }>({});

  // Quick-add state
  const [quickText, setQuickText] = useState('');
  const [quickUrl, setQuickUrl] = useState('');
  const [quickTags, setQuickTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = formatDateKey(weekStart);
      const end = new Date(weekStart);
      end.setDate(weekStart.getDate() + 13);
      const endDate = formatDateKey(end);
      const { data } = await signalFeedAPI.list({
        ...filter,
        startDate,
        endDate,
        limit: 100,
      });
      setEntries(data.entries || data || []);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoading(false);
    }
  }, [weekStart, filter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleQuickAdd = async () => {
    if (!quickText.trim()) return;
    setSubmitting(true);
    try {
      await signalFeedAPI.quickAdd({
        rawText: quickText.trim(),
        tags: quickTags.length > 0 ? quickTags : undefined,
        urlReference: quickUrl.trim() || undefined,
      });
      setQuickText('');
      setQuickUrl('');
      setQuickTags([]);
      setShowUrlInput(false);
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 2000);
      loadEntries();
    } catch (err) {
      console.error('Failed to add insight:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRouting = async (id: string) => {
    await signalFeedAPI.confirm(id);
    loadEntries();
  };

  const toggleTag = (key: string) => {
    setQuickTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const navigateWeek = (direction: number) => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + direction * 7);
      return next;
    });
  };

  const goToThisWeek = () => setWeekStart(getMonday(new Date()));

  // Group entries by day within the current week
  const groupedByDay: Record<string, SignalFeedEntry[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    groupedByDay[formatDateKey(d)] = [];
  }

  const nextWeekEntries: SignalFeedEntry[] = [];

  for (const entry of entries) {
    const dateKey = formatDateKey(new Date(entry.createdAt));
    if (groupedByDay[dateKey]) {
      groupedByDay[dateKey].push(entry);
    } else {
      nextWeekEntries.push(entry);
    }
  }

  const thisWeekCount = entries.length - nextWeekEntries.length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb size={24} className="text-brand-coral" />
            Insights
          </h1>
          <p className="text-sm text-slate-400 mt-1">Your observations fuel the content calendar</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter.author || ''}
            onChange={(e) => setFilter((f) => ({ ...f, author: e.target.value || undefined }))}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 shadow-sm"
          >
            <option value="">All authors</option>
            <option value="shohini">Shohini</option>
            <option value="sanjoy">Sanjoy</option>
          </select>
          <select
            value={filter.status || ''}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 shadow-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_calendar">In Calendar</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {/* Quick Add Form */}
      <div className={`bg-white border rounded-xl p-4 mb-6 transition-colors shadow-sm ${
        successFlash ? 'border-green-300 bg-green-50' : 'border-slate-200/60'
      }`}>
        <textarea
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          placeholder="What did you observe today? A conversation, a trend, a win, a frustration..."
          className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-sm resize-none outline-none min-h-[60px]"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleQuickAdd();
            }
          }}
        />

        {/* Tag Pills */}
        <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
          {SIGNAL_TAGS.map((tag) => (
            <button
              key={tag.key}
              onClick={() => toggleTag(tag.key)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                quickTags.includes(tag.key)
                  ? 'bg-brand-coral/10 text-brand-coral border border-brand-coral/40'
                  : 'bg-slate-100 text-slate-400 border border-transparent hover:text-slate-500 hover:bg-slate-200'
              }`}
            >
              {tag.emoji} {tag.label}
            </button>
          ))}
        </div>

        {/* URL input + submit */}
        <div className="flex items-center gap-2">
          {showUrlInput ? (
            <input
              type="url"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 placeholder-slate-300 outline-none focus:border-slate-300"
            />
          ) : (
            <button
              onClick={() => setShowUrlInput(true)}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-slate-500 transition-colors"
            >
              <Link2 size={14} />
              Add URL
            </button>
          )}
          <div className="flex-1" />
          <span className="text-xs text-slate-200">
            {quickText.trim() ? 'Ctrl+Enter to save' : ''}
          </span>
          <button
            onClick={handleQuickAdd}
            disabled={!quickText.trim() || submitting}
            className="px-4 py-1.5 bg-brand-coral text-white text-sm font-medium rounded-lg hover:bg-brand-coral/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submitting ? 'Saving...' : 'Capture'}
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{formatWeekLabel(weekStart)}</h2>
          <span className="text-xs text-slate-300">
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {thisWeekCount > 0 && (
            <span className="px-2 py-0.5 bg-brand-coral/10 text-brand-coral text-xs rounded-full font-medium">
              {thisWeekCount} insights
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {formatWeekLabel(weekStart) !== 'This Week' && (
            <button
              onClick={goToThisWeek}
              className="text-xs text-slate-400 hover:text-slate-500 mr-2"
            >
              Today
            </button>
          )}
          <button
            onClick={() => navigateWeek(1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Week Entries Grouped by Day */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-2">
          {Object.entries(groupedByDay).map(([dateKey, dayEntries]) => {
            const date = new Date(dateKey + 'T00:00:00');
            const dayIndex = (date.getDay() + 6) % 7;
            const isToday = dateKey === formatDateKey(new Date());

            return (
              <div key={dateKey}>
                {/* Day Header */}
                <div className={`flex items-center gap-2 py-2 px-1 ${isToday ? 'text-brand-coral' : 'text-slate-400'}`}>
                  <span className="text-xs font-medium uppercase tracking-wider">
                    {DAY_NAMES[dayIndex]}
                  </span>
                  <span className="text-xs">
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  {isToday && <span className="text-[10px] bg-brand-coral/10 px-1.5 py-0.5 rounded-full">today</span>}
                  {dayEntries.length > 0 && (
                    <span className="text-[10px] text-slate-300">{dayEntries.length}</span>
                  )}
                  <div className="flex-1 border-b border-slate-100" />
                </div>

                {/* Day Entries */}
                {dayEntries.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {dayEntries.map((entry) => (
                      <EntryCard
                        key={entry._id}
                        entry={entry}
                        onConfirm={confirmRouting}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-2 mb-1" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EntryCard({ entry, onConfirm }: { entry: SignalFeedEntry; onConfirm: (id: string) => void }) {
  const isConfirmed = entry.status === 'confirmed';
  const isPending = entry.status === 'pending';
  const isInCalendar = entry.status === 'in_calendar';
  const isContentSeed = entry.routing === 'content_seed';

  const borderClass = isInCalendar
    ? 'border-l-blue-400 border-l-2'
    : isConfirmed
    ? isContentSeed
      ? 'border-l-green-400 border-l-2'
      : 'border-l-purple-400 border-l-2'
    : isPending
    ? 'border-l-yellow-400/50 border-l-2 border-dashed'
    : 'border-l-slate-200 border-l-2';

  return (
    <div className={`bg-white border border-slate-200/60 rounded-lg p-3 hover:border-slate-300 hover:shadow-md transition-all shadow-sm ${borderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Author + time */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-brand-coral/10 flex items-center justify-center text-brand-coral text-[10px] font-medium capitalize">
              {entry.author[0]}
            </div>
            <span className="text-xs text-slate-400 capitalize">{entry.author}</span>
            <span className="text-[10px] text-slate-300">
              {new Date(entry.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>

          {/* Content */}
          <p className="text-sm text-slate-700 leading-relaxed">{entry.rawText}</p>

          {/* URL reference */}
          {entry.urlReference && (
            <a
              href={entry.urlReference}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-500/70 hover:text-blue-600 mt-1.5"
            >
              <Link2 size={11} />
              {entry.urlReference.length > 50
                ? entry.urlReference.slice(0, 50) + '...'
                : entry.urlReference}
            </a>
          )}

          {/* Tags */}
          {entry.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.tags.map((tag) => {
                const tagInfo = SIGNAL_TAGS.find((t) => t.key === tag);
                return (
                  <span key={tag} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500">
                    {tagInfo?.emoji} {tagInfo?.label || tag}
                  </span>
                );
              })}
            </div>
          )}

          {/* Impact Trail */}
          {entry.impactSummary && entry.impactSummary.postCount > 0 && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
              <ArrowRight size={10} className="text-brand-coral" />
              <span className="text-[11px] text-brand-coral">
                Became {entry.impactSummary.postCount} post{entry.impactSummary.postCount > 1 ? 's' : ''}
                {entry.impactSummary.latestPostDate && (
                  <> on {new Date(entry.impactSummary.latestPostDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                )}
                {entry.impactSummary.latestPostStatus && (
                  <> ({entry.impactSummary.latestPostStatus})</>
                )}
              </span>
            </div>
          )}

          {/* Strategy update impact */}
          {entry.routing === 'strategy_update' && entry.strategyUpdateAccepted && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
              <ArrowRight size={10} className="text-blue-600" />
              <span className="text-[11px] text-blue-600">
                Updated strategy
                {entry.aiClassification?.contentPillar && (
                  <> — {entry.aiClassification.contentPillar}</>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Right side: routing + actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] ${STATUS_BADGES[entry.status]?.color || 'text-slate-300'}`}>
            {STATUS_BADGES[entry.status]?.label || entry.status}
          </span>

          {entry.routing && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${ROUTING_BADGES[entry.routing]?.color || ''}`}>
              {ROUTING_BADGES[entry.routing]?.label || entry.routing}
            </span>
          )}

          {entry.aiClassification?.confidence != null && (
            <span className="text-[10px] text-slate-300 font-mono">
              {Math.round(entry.aiClassification.confidence * 100)}%
            </span>
          )}

          {isPending && entry.routing && (
            <button
              onClick={() => onConfirm(entry._id)}
              className="flex items-center gap-1 text-[10px] text-brand-coral hover:text-brand-coral/80 mt-1"
            >
              <Check size={10} /> Confirm
            </button>
          )}

          {isConfirmed && isContentSeed && (
            <div className="flex items-center gap-1 text-[10px] text-green-500/60 mt-1">
              <Calendar size={10} /> Ready for calendar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
