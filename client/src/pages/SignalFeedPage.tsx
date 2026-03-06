import React, { useState, useEffect } from 'react';
import { Radio } from 'lucide-react';
import { signalFeedAPI } from '../api/client';
import EmptyState from '../components/shared/EmptyState';
import type { SignalFeedEntry } from '../types';
import { SIGNAL_TAGS } from '../types';

const ROUTING_BADGES: Record<string, { label: string; color: string }> = {
  strategy_update: { label: 'Strategy', color: 'bg-blue-500/20 text-blue-400' },
  content_seed: { label: 'Post Queued', color: 'bg-green-500/20 text-green-400' },
  campaign_fuel: { label: 'Campaign', color: 'bg-purple-500/20 text-purple-400' },
  archive: { label: 'Archive', color: 'bg-gray-500/20 text-gray-400' },
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending Review', color: 'text-yellow-400' },
  confirmed: { label: 'Confirmed', color: 'text-green-400' },
  in_calendar: { label: 'In Calendar', color: 'text-blue-400' },
  published: { label: 'Published', color: 'text-brand-coral' },
  archived: { label: 'Archived', color: 'text-white/30' },
};

export default function SignalFeedPage() {
  const [entries, setEntries] = useState<SignalFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ author?: string; status?: string }>({});

  useEffect(() => {
    loadEntries();
  }, [filter]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const { data } = await signalFeedAPI.list(filter);
      setEntries(data.entries || data || []);
    } catch (err) {
      console.error('Failed to load signal feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const confirmRouting = async (id: string) => {
    await signalFeedAPI.confirm(id);
    loadEntries();
  };

  if (!loading && entries.length === 0) {
    return (
      <EmptyState
        icon={<Radio size={48} />}
        title="No entries yet"
        description="The best content starts with a real moment. What happened today?"
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Signal Feed</h1>
        <div className="flex gap-2">
          <select
            value={filter.author || ''}
            onChange={(e) => setFilter((f) => ({ ...f, author: e.target.value || undefined }))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="">All authors</option>
            <option value="shohini">Shohini</option>
            <option value="sanjoy">Sanjoy</option>
          </select>
          <select
            value={filter.status || ''}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_calendar">In Calendar</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Loading...</div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry._id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-coral/20 flex items-center justify-center text-brand-coral text-xs font-medium capitalize">
                    {entry.author[0]}
                  </div>
                  <span className="text-sm text-white/60 capitalize">{entry.author}</span>
                  <span className="text-xs text-white/30">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className={`text-xs ${STATUS_BADGES[entry.status]?.color || ''}`}>
                  {STATUS_BADGES[entry.status]?.label || entry.status}
                </span>
              </div>

              {/* Content */}
              <p className="text-sm text-white/80 mb-3">{entry.rawText}</p>

              {/* Tags */}
              {entry.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {entry.tags.map((tag) => {
                    const tagInfo = SIGNAL_TAGS.find((t) => t.key === tag);
                    return (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-white/5 rounded-full text-xs text-white/50"
                      >
                        {tagInfo?.emoji} {tagInfo?.label || tag}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Routing badge + actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {entry.routing && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ROUTING_BADGES[entry.routing]?.color || ''
                      }`}
                    >
                      {ROUTING_BADGES[entry.routing]?.label || entry.routing}
                    </span>
                  )}
                  {entry.aiClassification?.confidence && (
                    <span className="text-xs text-white/30 font-mono">
                      {Math.round(entry.aiClassification.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
                {entry.status === 'pending' && (
                  <button
                    onClick={() => confirmRouting(entry._id)}
                    className="text-xs text-brand-coral hover:text-brand-coral/80"
                  >
                    Confirm routing
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
