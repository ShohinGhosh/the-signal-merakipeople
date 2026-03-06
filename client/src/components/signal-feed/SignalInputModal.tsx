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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-brand-graphite border border-white/10 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold">Add to Signal</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="What happened? What did you notice? What do you believe today that you didn't yesterday?"
            className="w-full h-40 bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-coral/50"
            autoFocus
          />

          {/* Tags */}
          <div>
            <p className="text-xs text-white/50 mb-2">Context tags (optional)</p>
            <div className="flex flex-wrap gap-2">
              {SIGNAL_TAGS.map((tag) => (
                <button
                  key={tag.key}
                  onClick={() => toggleTag(tag.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedTags.includes(tag.key)
                      ? 'bg-brand-coral text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
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
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-coral/50"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <div className="w-6 h-6 rounded-full bg-brand-coral/20 flex items-center justify-center text-brand-coral text-xs font-medium">
              {user?.name?.[0]}
            </div>
            <span className="capitalize">{user?.role}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!rawText.trim() || submitting}
            className="px-6 py-2 bg-brand-coral text-white rounded-lg text-sm font-medium hover:bg-brand-coral/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Processing...' : 'Add to Signal'}
          </button>
        </div>
      </div>
    </div>
  );
}
