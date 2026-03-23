import React, { useState } from 'react';
import { X } from 'lucide-react';
import { signalFeedAPI } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { SIGNAL_TAGS } from '../../types';

interface Props {
  onClose: () => void;
}

export default function SignalInputModal({ onClose }: Props) {
  const { user } = useAuth();
  const [rawText, setRawText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [urlReference, setUrlReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (key: string) => {
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    if (!rawText.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      await signalFeedAPI.submit({
        rawText: rawText.trim(),
        author: user?.role || 'shohini',
        tags: selectedTags,
        urlReference: urlReference.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Add Insight</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="What happened? What did you notice? What do you believe today that you didn't yesterday?"
            className="w-full h-40 bg-white border border-slate-200 rounded-lg p-3 text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20"
            autoFocus
          />

          {/* Tags */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Context tags (optional)</p>
            <div className="flex flex-wrap gap-2">
              {SIGNAL_TAGS.map((tag) => (
                <button
                  key={tag.key}
                  onClick={() => toggleTag(tag.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedTags.includes(tag.key)
                      ? 'bg-brand-coral text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {tag.emoji} {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL reference */}
          <input
            type="url"
            value={urlReference}
            onChange={(e) => setUrlReference(e.target.value)}
            placeholder="Inspired by URL (optional)"
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="w-6 h-6 rounded-full bg-brand-coral/10 flex items-center justify-center text-brand-coral text-xs font-medium">
              {user?.name?.[0]}
            </div>
            <span className="capitalize">{user?.role}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!rawText.trim() || submitting}
            className="px-6 py-2 bg-brand-coral text-white rounded-lg text-sm font-medium hover:bg-brand-coral/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submitting ? 'Processing...' : 'Add Insight'}
          </button>
        </div>
      </div>
    </div>
  );
}
