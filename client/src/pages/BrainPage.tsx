import React, { useState } from 'react';
import { Brain, RefreshCw, Download, Image as ImageIcon } from 'lucide-react';
import { postsAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Post } from '../types';

const REGENERATE_OPTIONS = [
  'Shorter',
  'More direct',
  'More vulnerable / personal',
  'More data-led',
  'Different angle entirely',
  'More LinkedIn',
  'More Instagram',
];

const IMAGE_REGENERATE_OPTIONS = [
  'Different color treatment',
  'Different layout',
  'Text-only version',
  'More minimal',
];

export default function BrainPage() {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [post, setPost] = useState<Post | null>(null);
  const [platform, setPlatform] = useState<'linkedin' | 'instagram'>('linkedin');
  const [pillar, setPillar] = useState('');
  const [format, setFormat] = useState('text_post');
  const [customInstruction, setCustomInstruction] = useState('');
  const [activeTab, setActiveTab] = useState<'linkedin' | 'instagram'>('linkedin');

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await postsAPI.generate({
        triggerType: 'manual',
        platform,
        pillar: pillar || undefined,
        format,
        author: user?.role,
      });
      setPost(data);
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async (instruction: string) => {
    if (!post) return;
    setGenerating(true);
    try {
      const { data } = await postsAPI.regenerate(post._id, { instruction, field: 'text' });
      setPost(data);
    } catch (err) {
      console.error('Regeneration failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateImage = async (instruction?: string) => {
    if (!post) return;
    try {
      const { data } = await postsAPI.generateImage(post._id, {
        imageType: 'post_graphic',
        customPrompt: instruction,
      });
      setPost(data);
    } catch (err) {
      console.error('Image generation failed:', err);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Brain — Content Engine</h1>

      {!post ? (
        /* Generation controls */
        <div className="max-w-lg mx-auto bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Post</h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Platform</label>
              <div className="flex gap-2">
                {(['linkedin', 'instagram'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`flex-1 py-2 rounded-lg text-sm capitalize ${
                      platform === p
                        ? 'bg-brand-coral text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 mb-1 block">Content Pillar (optional)</label>
              <input
                type="text"
                value={pillar}
                onChange={(e) => setPillar(e.target.value)}
                placeholder="e.g., AI in B2B Sales, Founder Journey"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-coral/50"
              />
            </div>

            <div>
              <label className="text-xs text-white/50 mb-1 block">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="text_post">Text Post</option>
                <option value="carousel">Carousel</option>
                <option value="poll">Poll</option>
                <option value="video_caption">Video Caption</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 bg-brand-coral text-white rounded-lg font-medium hover:bg-brand-coral/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Brain size={16} />
                  Generate Post
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Post Review Interface */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Text content */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex gap-2 mb-4">
              {(['linkedin', 'instagram'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded text-sm capitalize ${
                    activeTab === tab
                      ? 'bg-brand-coral text-white'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="mb-2">
              <span className="text-xs text-white/40">Pillar: </span>
              <span className="text-xs text-brand-coral">{post.contentPillar}</span>
              <span className="text-xs text-white/40 ml-3">Format: </span>
              <span className="text-xs text-white/60">{post.format}</span>
            </div>

            <textarea
              value={post.draftContent || post.finalContent}
              onChange={(e) => setPost({ ...post, draftContent: e.target.value })}
              className="w-full h-64 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-brand-coral/50"
            />

            {/* Evidence */}
            {post.aiEvidence && (
              <div className="mt-3 bg-brand-indigo/20 rounded-lg p-3">
                <p className="text-xs text-white/50 mb-1">AI Evidence</p>
                <p className="text-xs text-white/60">
                  Critique score: {post.aiEvidence.finalCritiqueScore}/10 |
                  Iterations: {post.aiEvidence.critiqueIterations} |
                  Confidence: {Math.round(post.aiEvidence.confidenceScore * 100)}%
                </p>
                {post.aiEvidence.strategyReferences?.length > 0 && (
                  <p className="text-xs text-white/40 mt-1">
                    References: {post.aiEvidence.strategyReferences.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Regenerate options */}
            <div className="mt-4">
              <p className="text-xs text-white/40 mb-2">Regenerate text:</p>
              <div className="flex flex-wrap gap-1.5">
                {REGENERATE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleRegenerate(opt)}
                    disabled={generating}
                    className="px-2.5 py-1 bg-white/5 rounded text-xs text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40"
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
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/30"
                />
                <button
                  onClick={() => {
                    handleRegenerate(customInstruction);
                    setCustomInstruction('');
                  }}
                  disabled={!customInstruction || generating}
                  className="px-3 py-1 bg-brand-coral text-white rounded text-xs disabled:opacity-40"
                >
                  Go
                </button>
              </div>
            </div>
          </div>

          {/* Right: Image panel */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ImageIcon size={14} />
              Generated Image
            </h3>

            {post.imageUrl ? (
              <img
                src={post.imageUrl}
                alt="Generated"
                className="w-full rounded-lg mb-3 border border-white/10"
              />
            ) : (
              <div className="w-full h-48 bg-white/5 rounded-lg flex items-center justify-center text-white/20 mb-3">
                No image generated
              </div>
            )}

            {/* Variations */}
            {post.imageVariations?.length > 0 && (
              <div className="flex gap-2 mb-3">
                {post.imageVariations.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Variation ${i + 1}`}
                    className="w-20 h-20 rounded border border-white/10 cursor-pointer hover:border-brand-coral"
                    onClick={() => setPost({ ...post, imageUrl: url })}
                  />
                ))}
              </div>
            )}

            {/* Image actions */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => handleRegenerateImage()}
                className="flex-1 py-2 bg-white/5 text-white/60 rounded text-xs hover:bg-white/10 flex items-center justify-center gap-1"
              >
                <RefreshCw size={12} /> Regenerate
              </button>
              <button className="flex-1 py-2 bg-white/5 text-white/60 rounded text-xs hover:bg-white/10 flex items-center justify-center gap-1">
                <Download size={12} /> Download
              </button>
            </div>

            {/* Image regenerate options */}
            <div className="flex flex-wrap gap-1.5">
              {IMAGE_REGENERATE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleRegenerateImage(opt)}
                  className="px-2.5 py-1 bg-white/5 rounded text-xs text-white/60 hover:bg-white/10"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule actions */}
      {post && (
        <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
          <div className="text-sm text-white/60">
            Suggested: {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'Not scheduled'}
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white/5 text-white/60 rounded-lg text-sm hover:bg-white/10">
              Save Draft
            </button>
            <button className="px-4 py-2 bg-brand-coral text-white rounded-lg text-sm hover:bg-brand-coral/90">
              Schedule
            </button>
            <button
              onClick={() => setPost(null)}
              className="px-4 py-2 bg-white/5 text-white/60 rounded-lg text-sm hover:bg-white/10"
            >
              New Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
