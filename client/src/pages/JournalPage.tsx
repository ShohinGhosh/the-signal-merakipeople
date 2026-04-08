import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Loader2,
  Check,
  Pencil,
  X,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Calendar,
  Zap,
  ChevronDown,
  ChevronUp,
  Flame,
  Archive,
} from 'lucide-react';
import { journalAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useStrategy } from '../contexts/StrategyContext';
import type { JournalEntry, JournalRecommendation } from '../types';
import { JOURNAL_ENTRY_TYPES } from '../types';

type Screen = 'write' | 'recommendation' | 'confirmed';

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending_analysis: { label: 'Analysing...', color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  analysed: { label: 'Ready', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  accepted: { label: 'Accepted', color: 'bg-green-50 text-green-600 border-green-200' },
  edited: { label: 'Edited & Accepted', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  discarded: { label: 'Discarded', color: 'bg-gray-100 text-gray-400 border-gray-200' },
  archived: { label: 'Archived', color: 'bg-slate-50 text-slate-400 border-slate-200' },
};

const STRENGTH_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  strong: { bg: 'bg-green-50', text: 'text-green-700', label: 'Strong Signal' },
  moderate: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Moderate Signal' },
  weak: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Weak Signal' },
};

export default function JournalPage() {
  const { user } = useAuth();
  const { strategy } = useStrategy();
  const pillarOptions = (strategy?.contentPillars || []).map((p: any) => p.name);
  const [screen, setScreen] = useState<Screen>('write');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedEntries, setArchivedEntries] = useState<JournalEntry[]>([]);

  // Write screen state
  const [rawText, setRawText] = useState('');
  const [entryType, setEntryType] = useState<string | null>(null);
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [submitting, setSubmitting] = useState(false);

  // Recommendation screen state
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [polling, setPolling] = useState(false);
  const [editedHook, setEditedHook] = useState('');
  const [editedFormat, setEditedFormat] = useState('');
  const [editedOwner, setEditedOwner] = useState<'shohini' | 'sanjoy'>('shohini');
  const [editedPillar, setEditedPillar] = useState('');
  const [editedSlot, setEditedSlot] = useState('');
  const [accepting, setAccepting] = useState(false);

  // Confirmation screen state
  const [confirmedEntry, setConfirmedEntry] = useState<JournalEntry | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await journalAPI.list({ limit: 50 });
      setEntries(data.entries || []);
    } catch (err) {
      console.error('Failed to load journal entries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Poll for analysis completion
  useEffect(() => {
    if (!polling || !activeEntry) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await journalAPI.get(activeEntry._id);
        if (data.status === 'analysed') {
          setActiveEntry(data);
          const rec = data.recommendation;
          setEditedHook(rec?.draftHook || '');
          setEditedFormat(rec?.format || 'text_post');
          setEditedOwner((rec?.owner as 'shohini' | 'sanjoy') || 'shohini');
          setEditedPillar(rec?.contentPillar || '');
          setEditedSlot(rec?.calendarSlot || '');
          setPolling(false);
          setScreen('recommendation');
        }
      } catch (err) {
        console.error('Poll failed:', err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, activeEntry]);

  const handleSubmit = async () => {
    if (!rawText.trim()) return;
    try {
      setSubmitting(true);
      const { data } = await journalAPI.create({
        rawText: rawText.trim(),
        author: user?.role || 'shohini',
        entryType: entryType || undefined,
        priority,
      });
      setActiveEntry(data.entry);
      setPolling(true);
      setRawText('');
      setEntryType(null);
      setPriority('normal');
      await loadEntries();
    } catch (err) {
      console.error('Failed to submit journal entry:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const hasEdits = activeEntry?.recommendation ? (
    editedHook !== activeEntry.recommendation.draftHook ||
    editedFormat !== activeEntry.recommendation.format ||
    editedOwner !== activeEntry.recommendation.owner ||
    editedPillar !== activeEntry.recommendation.contentPillar ||
    editedSlot !== (activeEntry.recommendation.calendarSlot || '')
  ) : false;

  const handleAccept = async () => {
    if (!activeEntry) return;
    try {
      setAccepting(true);
      // If any field was edited, use the edit endpoint; otherwise plain accept
      if (hasEdits) {
        const { data } = await journalAPI.edit(activeEntry._id, {
          ...activeEntry.recommendation,
          draftHook: editedHook,
          format: editedFormat,
          owner: editedOwner,
          contentPillar: editedPillar,
          calendarSlot: editedSlot || null,
        });
        setConfirmedEntry(data.entry);
      } else {
        const { data } = await journalAPI.accept(activeEntry._id);
        setConfirmedEntry(data.entry);
      }
      setScreen('confirmed');
      await loadEntries();
    } catch (err) {
      console.error('Failed to accept:', err);
    } finally {
      setAccepting(false);
    }
  };

  const handleDiscard = async () => {
    if (!activeEntry) return;
    try {
      await journalAPI.discard(activeEntry._id);
      setActiveEntry(null);
      setScreen('write');
      await loadEntries();
    } catch (err) {
      console.error('Failed to discard:', err);
    }
  };

  const loadArchivedEntries = async () => {
    try {
      const { data } = await journalAPI.list({ status: 'archived', limit: 50 });
      setArchivedEntries(data.entries || []);
    } catch (err) {
      console.error('Failed to load archived entries:', err);
    }
  };

  const handleArchive = async (entryId: string) => {
    try {
      await journalAPI.archive(entryId);
      await loadEntries();
      if (showArchived) await loadArchivedEntries();
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  const handleUnarchive = async (entryId: string) => {
    try {
      // Restore to 'discarded' status (safe neutral state)
      await journalAPI.discard(entryId);
      await loadArchivedEntries();
      await loadEntries();
    } catch (err) {
      console.error('Failed to unarchive:', err);
    }
  };

  const toggleArchived = async () => {
    const next = !showArchived;
    setShowArchived(next);
    if (next) await loadArchivedEntries();
  };

  const handleViewEntry = (entry: JournalEntry) => {
    if (entry.status === 'analysed') {
      setActiveEntry(entry);
      const rec = entry.recommendation;
      setEditedHook(rec?.draftHook || '');
      setEditedFormat(rec?.format || 'text_post');
      setEditedOwner((rec?.owner as 'shohini' | 'sanjoy') || 'shohini');
      setEditedPillar(rec?.contentPillar || '');
      setEditedSlot(rec?.calendarSlot || '');
      setScreen('recommendation');
    } else if (entry.status === 'pending_analysis') {
      setActiveEntry(entry);
      setPolling(true);
    }
  };

  const handleReanalyse = async () => {
    if (!activeEntry) return;
    try {
      await journalAPI.reanalyse(activeEntry._id);
      setPolling(true);
    } catch (err) {
      console.error('Failed to re-analyse:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen size={24} className="text-brand-coral" />
        <h1 className="text-2xl font-bold text-slate-800">Journal</h1>
        <span className="text-sm text-slate-400">Capture what matters. Let AI route it.</span>
      </div>

      {/* ==================== SCREEN 1: WRITE ==================== */}
      {screen === 'write' && !polling && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-8">
          <p className="text-sm text-slate-500 mb-4">
            What happened today that could become a post? A call insight, something you noticed, a pattern, a product update. Just write.
          </p>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Write freely..."
            rows={5}
            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-brand-coral/30 focus:border-brand-coral text-sm leading-relaxed"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
          />

          {/* Entry type pills */}
          <div className="mt-3">
            <span className="text-xs text-slate-400 mr-2">Entry type (optional):</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {JOURNAL_ENTRY_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setEntryType(entryType === t.key ? null : t.key)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    entryType === t.key
                      ? 'bg-brand-coral/10 border-brand-coral/30 text-brand-coral'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Signal strength toggle */}
          <div className="mt-3">
            <button
              onClick={() => setPriority(priority === 'normal' ? 'high' : 'normal')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                priority === 'high'
                  ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm shadow-orange-100'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
              }`}
            >
              <Flame size={14} className={priority === 'high' ? 'text-orange-500' : 'text-slate-300'} />
              {priority === 'high' ? '🔥 Priority Signal — this will override the calendar' : 'Mark as Priority Signal'}
            </button>
            {priority === 'high' && (
              <p className="text-[11px] text-orange-500/70 mt-1 ml-1">
                This entry will be treated as a "stop press" — the AI will prioritise it and create a post for it immediately.
              </p>
            )}
          </div>

          <div className="flex justify-between items-center mt-4">
            <span className="text-xs text-slate-300">Ctrl+Enter to submit</span>
            <button
              onClick={handleSubmit}
              disabled={!rawText.trim() || submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-coral text-white rounded-lg text-sm font-medium hover:bg-brand-coral/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Analyse & Get Recommendation
            </button>
          </div>
        </div>
      )}

      {/* ==================== POLLING STATE ==================== */}
      {polling && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm mb-8 text-center">
          <Loader2 size={32} className="animate-spin text-brand-coral mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Analysing your journal entry...</p>
          <p className="text-sm text-slate-400 mt-1">Running against your strategy, ICP, pillars, and calendar.</p>
        </div>
      )}

      {/* ==================== SCREEN 2: RECOMMENDATION ==================== */}
      {screen === 'recommendation' && activeEntry?.recommendation && (
        <div className="space-y-4 mb-8">
          {/* Original entry */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Your Entry</div>
            <p className="text-slate-700 text-sm leading-relaxed">{activeEntry.rawText}</p>
            {activeEntry.entryType && (
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500 border border-slate-200">
                {JOURNAL_ENTRY_TYPES.find(t => t.key === activeEntry.entryType)?.emoji}{' '}
                {JOURNAL_ENTRY_TYPES.find(t => t.key === activeEntry.entryType)?.label}
              </span>
            )}
          </div>

          {/* Strategy match */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Strategy Match</div>
            <div className="grid grid-cols-2 gap-4">
              <MatchItem label="Content Pillar" value={`${activeEntry.recommendation.contentPillar} (${activeEntry.recommendation.pillarWeight})`} />
              <MatchItem label="ICP Resonance" value={activeEntry.recommendation.icpResonance} />
              <MatchItem label="Key Message Match" value={activeEntry.recommendation.keyMessageMatch} />
              <MatchItem label="90-Day Relevance" value={activeEntry.recommendation.ninetyDayRelevance} />
            </div>
          </div>

          {/* Recommendation — EDITABLE */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider">Recommendation</div>
              {hasEdits && (
                <span className="text-[10px] text-brand-coral bg-brand-coral/10 px-2 py-0.5 rounded-full">Edited</span>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {/* Format */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1.5">Format</div>
                <select
                  value={editedFormat}
                  onChange={(e) => setEditedFormat(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-brand-coral/50"
                >
                  <option value="text_post">Text Post</option>
                  <option value="carousel">Carousel</option>
                  <option value="poll">Poll</option>
                  <option value="document">Document</option>
                  <option value="video_caption">Video</option>
                  <option value="reel">Reel</option>
                  <option value="story">Story</option>
                </select>
              </div>

              {/* Content Pillar */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1.5">Content Pillar</div>
                <select
                  value={editedPillar}
                  onChange={(e) => setEditedPillar(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-brand-coral/50"
                >
                  {pillarOptions.length > 0 ? (
                    pillarOptions.map((p: string) => (
                      <option key={p} value={p}>{p}</option>
                    ))
                  ) : (
                    <option value={editedPillar}>{editedPillar}</option>
                  )}
                </select>
              </div>

              {/* Calendar Slot */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1.5">Calendar Slot</div>
                <input
                  type="date"
                  value={editedSlot ? editedSlot.substring(0, 10) : ''}
                  onChange={(e) => setEditedSlot(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-brand-coral/50"
                />
              </div>

              {/* Owner */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1.5">Owner</div>
                <select
                  value={editedOwner}
                  onChange={(e) => setEditedOwner(e.target.value as 'shohini' | 'sanjoy')}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-brand-coral/50"
                >
                  <option value="shohini">Shohini</option>
                  <option value="sanjoy">Sanjoy</option>
                </select>
              </div>
            </div>

            {/* Signal Strength (read-only, AI-determined) */}
            <div className="flex items-center gap-3">
              <div className={`text-xs font-medium px-2.5 py-1 rounded inline-flex items-center gap-1 ${STRENGTH_COLORS[activeEntry.recommendation.signalStrength]?.bg} ${STRENGTH_COLORS[activeEntry.recommendation.signalStrength]?.text}`}>
                <Zap size={11} />
                {STRENGTH_COLORS[activeEntry.recommendation.signalStrength]?.label}
              </div>
            </div>
          </div>

          {/* Draft hook */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">AI Draft Hook (editable)</div>
            <textarea
              value={editedHook}
              onChange={(e) => setEditedHook(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-brand-coral/30 focus:border-brand-coral"
            />
          </div>

          {/* AI cost */}
          {activeEntry.aiCost && (
            <div className="text-xs text-slate-300 text-right">
              Analysis: ${activeEntry.aiCost.costUsd.toFixed(4)} | {(activeEntry.aiCost.durationMs / 1000).toFixed(1)}s
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-coral text-white rounded-lg text-sm font-medium hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
            >
              {accepting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {hasEdits ? 'Accept with Changes' : 'Accept & Send to Signal Feed'}
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center justify-center gap-2 px-5 py-3 border border-slate-200 text-slate-400 rounded-lg text-sm hover:text-red-500 hover:border-red-200 transition-colors"
            >
              <X size={14} />
              Discard
            </button>
          </div>

          <button
            onClick={handleReanalyse}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mt-1"
          >
            <RefreshCw size={12} />
            Re-analyse with fresh context
          </button>
        </div>
      )}

      {/* ==================== SCREEN 3: CONFIRMATION ==================== */}
      {screen === 'confirmed' && confirmedEntry && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check size={24} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-green-800 mb-2">Saved to Signal Feed</h2>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mt-4 text-sm">
            <div>
              <div className="text-xs text-green-600/60">Format</div>
              <div className="font-medium text-green-800 capitalize">
                {(confirmedEntry.editedRecommendation || confirmedEntry.recommendation)?.format?.replace('_', ' ')}
              </div>
            </div>
            <div>
              <div className="text-xs text-green-600/60">Pillar</div>
              <div className="font-medium text-green-800">
                {(confirmedEntry.editedRecommendation || confirmedEntry.recommendation)?.contentPillar}
              </div>
            </div>
            <div>
              <div className="text-xs text-green-600/60">Owner</div>
              <div className="font-medium text-green-800 capitalize">
                {(confirmedEntry.editedRecommendation || confirmedEntry.recommendation)?.owner}
              </div>
            </div>
          </div>
          <button
            onClick={() => { setScreen('write'); setActiveEntry(null); setConfirmedEntry(null); }}
            className="mt-5 flex items-center gap-2 mx-auto px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <ArrowRight size={14} />
            Back to Journal
          </button>
        </div>
      )}

      {/* ==================== HISTORY ==================== */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {historyExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Journal History ({entries.length})
          </button>
          {historyExpanded && (
            <button
              onClick={toggleArchived}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                showArchived
                  ? 'bg-slate-200 text-slate-600'
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-500'
              }`}
            >
              <Archive size={12} />
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
          )}
        </div>

        {historyExpanded && (
          loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>
          ) : entries.length === 0 && !showArchived ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
              <BookOpen size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-400 text-sm">No journal entries yet</p>
              <p className="text-slate-300 text-xs mt-1">Write your first entry above to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <HistoryCard key={entry._id} entry={entry} onView={handleViewEntry} onArchive={handleArchive} />
              ))}

              {/* Archived entries */}
              {showArchived && archivedEntries.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mt-4 mb-2">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Archive size={10} />
                      Archived ({archivedEntries.length})
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  {archivedEntries.map((entry) => (
                    <div key={entry._id} className="opacity-60">
                      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-slate-400">
                              {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                            <span className="text-xs text-slate-300 capitalize">{entry.author}</span>
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2">{entry.rawText}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-xs border bg-slate-50 text-slate-400 border-slate-200">
                            Archived
                          </span>
                          <button
                            onClick={() => handleUnarchive(entry._id)}
                            title="Restore"
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                          >
                            <RefreshCw size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {showArchived && archivedEntries.length === 0 && (
                <div className="text-center py-4 text-xs text-slate-400">No archived entries</div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function MatchItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="text-sm text-slate-700">{value || '—'}</div>
    </div>
  );
}

function HistoryCard({ entry, onView, onArchive }: { entry: JournalEntry; onView: (e: JournalEntry) => void; onArchive: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const badge = STATUS_BADGES[entry.status] || STATUS_BADGES.pending_analysis;
  const isActionable = entry.status === 'analysed' || entry.status === 'pending_analysis';
  const isCompleted = entry.status === 'accepted' || entry.status === 'edited';
  const entryTypeInfo = JOURNAL_ENTRY_TYPES.find(t => t.key === entry.entryType);
  const rec = entry.editedRecommendation || entry.recommendation;

  const handleClick = () => {
    if (isActionable) {
      onView(entry);
    } else if (isCompleted) {
      setExpanded(!expanded);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${
        isActionable ? 'cursor-pointer hover:border-brand-coral/30 hover:shadow-sm' :
        isCompleted ? 'cursor-pointer hover:border-slate-300' : ''
      } transition-all group`}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-400">
              {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
            <span className="text-xs text-slate-300 capitalize">{entry.author}</span>
            {entryTypeInfo && (
              <span className="text-xs text-slate-400">{entryTypeInfo.emoji} {entryTypeInfo.label}</span>
            )}
          </div>
          <p className="text-sm text-slate-600 line-clamp-2">{entry.rawText}</p>
          {rec && entry.status !== 'pending_analysis' && (
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
              <span>{rec.contentPillar}</span>
              <span className="capitalize">{rec.format?.replace('_', ' ')}</span>
              {rec.signalStrength && (
                <span className={`px-1.5 py-0.5 rounded ${STRENGTH_COLORS[rec.signalStrength]?.bg} ${STRENGTH_COLORS[rec.signalStrength]?.text}`}>
                  {rec.signalStrength}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs border ${badge.color}`}>
            {entry.status === 'pending_analysis' && <Loader2 size={10} className="inline animate-spin mr-1" />}
            {badge.label}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(entry._id); }}
            title="Archive"
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-all"
          >
            <Archive size={14} />
          </button>
          {isActionable && <ArrowRight size={14} className="text-slate-300" />}
          {isCompleted && (expanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />)}
        </div>
      </div>

      {/* Expanded details for accepted/edited entries */}
      {expanded && isCompleted && rec && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Format</div>
              <div className="text-xs font-medium text-slate-700 capitalize">{rec.format?.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Scheduled For</div>
              <div className="text-xs font-medium text-slate-700 flex items-center gap-1">
                <Calendar size={10} />
                {rec.calendarSlot
                  ? new Date(rec.calendarSlot).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  : 'Next available'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Content Pillar</div>
              <div className="text-xs font-medium text-slate-700">{rec.contentPillar}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Owner</div>
              <div className="text-xs font-medium text-slate-700 capitalize">{rec.owner}</div>
            </div>
          </div>

          {rec.draftHook && (
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Draft Hook</div>
              <p className="text-xs text-slate-600 italic bg-white rounded p-2 border border-slate-200">{rec.draftHook}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {rec.icpResonance && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">ICP Resonance</div>
                <p className="text-xs text-slate-500">{rec.icpResonance}</p>
              </div>
            )}
            {rec.keyMessageMatch && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Key Message Match</div>
                <p className="text-xs text-slate-500">{rec.keyMessageMatch}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
