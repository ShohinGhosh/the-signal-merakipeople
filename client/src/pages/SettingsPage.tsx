import React, { useState, useEffect, useCallback, useRef } from 'react';
import { promptsAPI, contentHistoryAPI, strategyAPI, foundationDocsAPI } from '../api/client';
import { useStrategy } from '../contexts/StrategyContext';
import type { Strategy } from '../types';
import * as XLSX from 'xlsx';
import {
  Instagram, Linkedin, ExternalLink, CheckCircle2, AlertCircle,
  Key, Database, Brain, Globe, Unplug, Link2,
  FileText, Save, Loader2, ChevronRight, X,
  Upload, Trash2, History, FileSpreadsheet,
  Shield, Pencil, Plus, Facebook,
} from 'lucide-react';

interface PromptSummary {
  name: string;
  description: string;
  model: string;
  version: string;
}

interface MetaConnection {
  connected: boolean;
  pageName?: string;
  igUsername?: string;
  connectedAt?: string;
}

// ─── Prompt categories for organization ───
const PROMPT_CATEGORIES: Record<string, string[]> = {
  'Content Generation': [
    'post-generator-linkedin',
    'post-generator-instagram',
    'post-critique',
  ],
  'Calendar Planning': [
    'calendar-week-planner',
    'calendar-week-critique',
    'calendar-week-research',
    'calendar-week-research-critique',
  ],
  'Image & Visual': [
    'image-prompt-builder',
    'image-prompt-critique',
  ],
  'Strategy': [
    'strategy-generator',
    'strategy-generator-critique',
    'strategy-extractor',
    'strategy-critique',
    'strategy-recommender',
  ],
  'Outreach': [
    'outreach-drafter',
    'outreach-critique',
  ],
  'Journal': [
    'journal-analyser',
    'journal-critique',
  ],
  'Signal Feed': [
    'signal-feed-classifier',
    'signal-feed-critique',
  ],
  'Onboarding': [
    'onboarding-interviewer',
  ],
  'Weekly Brief': [
    'monday-brief',
    'monday-brief-critique',
  ],
};

function getCategoryForPrompt(name: string): string {
  for (const [cat, names] of Object.entries(PROMPT_CATEGORIES)) {
    if (names.includes(name)) return cat;
  }
  return 'Other';
}

// ─── Prompts Editor Component ───
function PromptsEditor() {
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await promptsAPI.list();
        setPrompts(data);
      } catch (err) {
        console.error('Failed to load prompts:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadPrompt = useCallback(async (name: string) => {
    setSelectedPrompt(name);
    setLoadingContent(true);
    setSaved(false);
    try {
      const { data } = await promptsAPI.get(name);
      setContent(data.content);
    } catch (err) {
      console.error('Failed to load prompt:', err);
      setContent('# Error loading prompt');
    } finally {
      setLoadingContent(false);
    }
  }, []);

  const handleSave = async () => {
    if (!selectedPrompt) return;
    setSaving(true);
    try {
      await promptsAPI.update(selectedPrompt, content);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save prompt:', err);
      alert('Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  // Group prompts by category
  const grouped: Record<string, PromptSummary[]> = {};
  prompts.forEach((p) => {
    const cat = getCategoryForPrompt(p.name);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading prompts...
      </div>
    );
  }

  return (
    <div className="flex gap-6" style={{ minHeight: '600px' }}>
      {/* Prompt list */}
      <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h4 className="text-xs font-semibold text-brand-coral uppercase tracking-wider mb-2">
              {category}
            </h4>
            <div className="space-y-1">
              {items.map((p) => (
                <button
                  key={p.name}
                  onClick={() => loadPrompt(p.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                    selectedPrompt === p.name
                      ? 'bg-brand-coral/10 text-brand-coral border border-brand-coral/20'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate text-xs">{p.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{p.description}</div>
                  </div>
                  <ChevronRight size={12} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0">
        {selectedPrompt ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-brand-coral" />
                <h4 className="font-semibold text-slate-900 text-sm">{selectedPrompt}.yaml</h4>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  {getCategoryForPrompt(selectedPrompt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Saved
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || loadingContent}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-coral text-white rounded-lg text-xs font-medium hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
                <button
                  onClick={() => setSelectedPrompt(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Edit the YAML prompt below. Changes take effect on the next AI call (no restart needed).
            </p>

            {loadingContent ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 size={16} className="animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); setSaved(false); }}
                className="w-full bg-slate-900 text-slate-100 font-mono text-xs rounded-xl p-4 border border-slate-700 focus:outline-none focus:border-brand-coral/50 resize-none"
                style={{ minHeight: '55vh' }}
                spellCheck={false}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center">
              <FileText size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Select a prompt to view and edit</p>
              <p className="text-xs text-slate-300 mt-1">Changes are saved to disk and take effect immediately</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Integrations Tab ───
function IntegrationsTab() {
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaConnection, setMetaConnection] = useState<MetaConnection>({ connected: false });
  const [connecting, setConnecting] = useState(false);

  const handleMetaConnect = () => {
    if (!metaAppId) {
      alert('Please enter your Meta App ID first');
      return;
    }

    const redirectUri = `${window.location.origin}/settings`;
    const scope = [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_read_engagement',
      'business_management',
    ].join(',');

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;

    window.open(authUrl, '_blank', 'width=600,height=700');
  };

  return (
    <div className="space-y-6">
      {/* Meta Business Account Integration */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Instagram size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Meta Business Account
            </h3>
            <p className="text-xs text-slate-400">Connect Instagram for publishing and analytics</p>
          </div>
          {metaConnection.connected ? (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={12} />
              Connected
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              <Unplug size={12} />
              Not connected
            </span>
          )}
        </div>

        {!metaConnection.connected && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-sm text-slate-900 font-medium mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-coral/10 text-brand-coral text-xs flex items-center justify-center font-bold">1</span>
                Create a Meta App
              </h4>
              <p className="text-xs text-slate-400 mb-2">
                Go to Meta for Developers, create an app, and add Instagram Graph API product.
              </p>
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-coral hover:underline"
              >
                <ExternalLink size={10} />
                Open Meta Developer Portal
              </a>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-sm text-slate-900 font-medium mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-coral/10 text-brand-coral text-xs flex items-center justify-center font-bold">2</span>
                Enter App Credentials
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Meta App ID</label>
                  <input
                    type="text"
                    value={metaAppId}
                    onChange={(e) => setMetaAppId(e.target.value)}
                    placeholder="Enter your Meta App ID"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-brand-coral/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Meta App Secret</label>
                  <input
                    type="password"
                    value={metaAppSecret}
                    onChange={(e) => setMetaAppSecret(e.target.value)}
                    placeholder="Enter your Meta App Secret"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-brand-coral/50"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-sm text-slate-900 font-medium mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-coral/10 text-brand-coral text-xs flex items-center justify-center font-bold">3</span>
                Connect Your Account
              </h4>
              <button
                onClick={handleMetaConnect}
                disabled={connecting || !metaAppId}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  metaAppId
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-sm'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                <Instagram size={16} />
                Connect with Meta
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LinkedIn */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm opacity-60">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Linkedin size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">LinkedIn</h3>
            <p className="text-xs text-slate-400">Auto-publish and track LinkedIn posts</p>
          </div>
          <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            Coming Soon
          </span>
        </div>
      </div>

      {/* API Configuration */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4 flex items-center gap-2">
          <Key size={14} />
          API Configuration
        </h3>
        <div className="space-y-3 text-sm">
          {[
            { icon: Brain, label: 'Anthropic Claude', status: 'Configured via .env', ok: true },
            { icon: Globe, label: 'Google Gemini', status: 'Configured via .env', ok: true },
            { icon: Link2, label: 'fal.ai Image Generation', status: 'Pending integration', ok: false },
            { icon: Database, label: 'MongoDB', status: 'Configured via .env', ok: true },
          ].map(({ icon: Icon, label, status, ok }) => (
            <div key={label} className="flex justify-between items-center py-1">
              <span className="text-slate-500 flex items-center gap-2">
                <Icon size={14} className="text-slate-300" />
                {label}
              </span>
              <span className={`text-xs flex items-center gap-1 ${ok ? 'text-green-600' : 'text-yellow-600'}`}>
                {ok ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Content History Tab ───
function ContentHistoryTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEntries = async () => {
    try {
      const { data } = await contentHistoryAPI.list({ limit: 200 });
      setEntries(data);
    } catch (err) {
      console.error('Failed to load content history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, []);

  // Convert Excel serial date number to ISO date string
  const excelDateToISO = (serial: number): string => {
    if (!serial || typeof serial !== 'number' || serial < 1) return '';
    // Excel epoch: Jan 0, 1900 (with the Lotus 1-2-3 leap year bug)
    const epoch = new Date(1899, 11, 30); // Dec 30, 1899
    const date = new Date(epoch.getTime() + serial * 86400000);
    return date.toISOString().slice(0, 10);
  };

  const mapRowToEntry = (row: Record<string, any>): any => {
    // Normalize keys to lowercase
    const r: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      r[k.toLowerCase().trim()] = typeof v === 'string' ? v.trim() : v;
    }

    // "summary" is often the actual post content (e.g. LinkedIn tracker exports)
    // "article title" for article sheets, "summary / excerpt" for article descriptions
    const topic = r.summary || r['summary / excerpt'] || r['article title'] || r.topic || r.title || r.subject || r.content || r.post || r['post topic'] || r.description || '';

    // "topic" column often maps to pillar/category when "summary" is the real content
    // "topic / theme" for article sheets
    const pillar = (r.summary && r.topic) ? r.topic
      : (r['topic / theme'] || r.pillar || r['content pillar'] || r.category || r.theme || '');

    // Handle date: could be a Date object, Excel serial number, or string
    let dateVal = r.date || r['date (approx)'] || r['approx. period'] || r['published date'] || r['publish date'] || r.published || r['post date'] || '';
    if (typeof dateVal === 'number') {
      dateVal = excelDateToISO(dateVal);
    } else if (dateVal instanceof Date) {
      dateVal = dateVal.toISOString().slice(0, 10);
    } else if (typeof dateVal === 'string') {
      // Handle "Feb 2026", "March 2025" style dates → first of that month
      const monthYear = dateVal.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})$/i);
      if (monthYear) {
        const months: Record<string, string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
        const m = months[monthYear[1].toLowerCase().slice(0, 3)] || '01';
        dateVal = `${monthYear[2]}-${m}-01`;
      }
    }

    // Build engagement/performance notes from metrics columns
    const engParts: string[] = [];
    if (r.likes) engParts.push(`${r.likes} likes`);
    if (r.comments) engParts.push(`${r.comments} comments`);
    if (r.reposts || r.shares) engParts.push(`${r.reposts || r.shares} reposts`);
    if (r.impressions) engParts.push(`${r.impressions} impressions`);
    if (r['eng. rate %'] || r['engagement rate']) engParts.push(`${(r['eng. rate %'] || r['engagement rate'])}% eng`);

    return {
      topic,
      hook: r.hook || r.opening || r['first line'] || r['opening line'] || '',
      author: r.author || r.by || r.name || r['posted by'] || 'shohini',
      platform: r.platform || r.channel || 'linkedin',
      format: r.format || r.type || r['post type'] || r['content type'] || 'text_post',
      contentPillar: pillar,
      publishedDate: dateVal,
      performanceNotes: r.notes || r.performance || engParts.join(', ') || '',
    };
  };

  const parseSpreadsheet = (buffer: ArrayBuffer): any[] => {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const allEntries: any[] = [];

    for (const sheetName of workbook.SheetNames) {
      if (sheetName.toLowerCase().includes('legend') || sheetName.toLowerCase().includes('template')) continue;
      const sheet = workbook.Sheets[sheetName];

      // First try standard header-in-row-1 parsing
      let rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      let entries = rows.map(mapRowToEntry).filter((e: any) => e.topic);

      // If no entries found, the header might not be in row 1 (e.g. merged title rows)
      // Scan first 5 rows to find the real header row
      if (entries.length === 0) {
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 }) as any;
        for (let headerIdx = 1; headerIdx < Math.min(rawRows.length, 6); headerIdx++) {
          const headerRow = rawRows[headerIdx];
          if (!Array.isArray(headerRow)) continue;
          const headers = headerRow.map((h: any) => String(h || '').toLowerCase().trim());
          // Check if this looks like a header row (has topic-like columns)
          const hasTopicCol = headers.some(h => ['topic', 'title', 'summary', 'article title', 'subject', 'description'].includes(h));
          if (!hasTopicCol) continue;

          // Parse data rows using this header
          const dataRows = rawRows.slice(headerIdx + 1);
          const mapped = dataRows
            .filter((dr: any[]) => dr.some((v: any) => v !== ''))
            .map((dr: any[]) => {
              const obj: Record<string, any> = {};
              headers.forEach((h: string, i: number) => { if (h) obj[h] = dr[i] ?? ''; });
              return mapRowToEntry(obj);
            })
            .filter((e: any) => e.topic);

          if (mapped.length > 0) { entries = mapped; break; }
        }
      }

      allEntries.push(...entries);
    }
    return allEntries;
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of lines[i]) {
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
        current += char;
      }
      values.push(current.trim());

      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
      results.push(mapRowToEntry(row));
    }
    return results.filter((e: any) => e.topic);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const isExcel = file.name.match(/\.xlsx?$/i);
      let parsed: any[];

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        parsed = parseSpreadsheet(buffer);
      } else {
        const text = await file.text();
        parsed = parseCSV(text);
      }

      if (parsed.length === 0) {
        setUploadResult('No valid entries found. Make sure the file has a header row with at least a "topic" (or "title") and "date" column.');
        return;
      }

      const { data } = await contentHistoryAPI.upload(parsed);
      setUploadResult(`Uploaded ${data.count} entries from "${file.name}" successfully.`);
      loadEntries();
    } catch (err: any) {
      setUploadResult(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasteUpload = async () => {
    if (!pasteText.trim()) return;
    setUploading(true);
    setUploadResult(null);

    try {
      // Try CSV format first
      let parsed = parseCSV(pasteText);

      // If CSV didn't work, try simple line-by-line (one topic per line)
      if (parsed.length === 0) {
        const lines = pasteText.trim().split('\n').filter(l => l.trim());
        parsed = lines.map(line => {
          // Try to detect "date - topic" or "topic (date)" patterns
          const dateTopicMatch = line.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s*[-–|]\s*(.+)/);
          const topicDateMatch = line.match(/^(.+?)\s*\((\d{4}[-/]\d{1,2}[-/]\d{1,2})\)/);

          if (dateTopicMatch) return { topic: dateTopicMatch[2].trim(), publishedDate: dateTopicMatch[1] };
          if (topicDateMatch) return { topic: topicDateMatch[1].trim(), publishedDate: topicDateMatch[2] };
          return { topic: line.trim(), publishedDate: new Date().toISOString().slice(0, 10) };
        });
      }

      if (parsed.length === 0) {
        setUploadResult('No entries could be parsed.');
        return;
      }

      const { data } = await contentHistoryAPI.upload(parsed);
      setUploadResult(`Uploaded ${data.count} entries successfully.`);
      setPasteText('');
      setPasteMode(false);
      loadEntries();
    } catch (err: any) {
      setUploadResult(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // ── Performance Insights ──
  const [insights, setInsights] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const { data } = await contentHistoryAPI.insights();
      setInsights(data.insights);
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    if (entries.length > 0) loadInsights();
  }, [entries.length]);

  const handleClearHistory = async () => {
    if (!window.confirm('Delete all uploaded content history? This cannot be undone.')) return;
    try {
      await contentHistoryAPI.clear();
      setEntries([]);
      setUploadResult('Content history cleared.');
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider flex items-center gap-2">
              <Upload size={14} />
              Upload Past Content
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Upload a report of content you've posted in the last 6 months. The AI will avoid repeating these topics.
            </p>
          </div>
          {entries.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 size={12} />
              Clear All
            </button>
          )}
        </div>

        <div className="flex gap-3 mb-4">
          {/* Excel / CSV Upload */}
          <label className="flex-1 cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-brand-coral/40 hover:bg-brand-coral/5 transition-colors">
              <FileSpreadsheet size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-600 font-medium">Upload Excel or CSV</p>
              <p className="text-xs text-slate-400 mt-1">
                .xlsx, .xls, or .csv with columns: topic, date, author, platform, hook, pillar
              </p>
            </div>
          </label>

          {/* Paste option */}
          <button
            onClick={() => setPasteMode(!pasteMode)}
            className="flex-1 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-brand-coral/40 hover:bg-brand-coral/5 transition-colors"
          >
            <FileText size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-600 font-medium">Paste Text</p>
            <p className="text-xs text-slate-400 mt-1">
              Paste CSV, or one topic per line
            </p>
          </button>
        </div>

        {/* Paste textarea */}
        {pasteMode && (
          <div className="space-y-3">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Paste your content list here. Formats supported:\n\nCSV with headers:\ntopic,date,author,platform\n"How we closed our first enterprise deal",2025-11-15,shohini,linkedin\n\nOr simple list (one topic per line):\n2025-11-15 - How we closed our first enterprise deal\n2025-11-20 - Why founder-led sales beats hiring SDRs early\n2025-12-01 - The communication framework that changed our org`}
              className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 resize-none focus:outline-none focus:border-brand-coral/50 placeholder:text-slate-300"
            />
            <div className="flex gap-2">
              <button
                onClick={handlePasteUpload}
                disabled={uploading || !pasteText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-brand-coral text-white rounded-lg text-sm font-medium hover:bg-brand-coral/90 disabled:opacity-40 transition-colors"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload
              </button>
              <button
                onClick={() => { setPasteMode(false); setPasteText(''); }}
                className="px-4 py-2 text-slate-500 text-sm hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Upload result */}
        {uploadResult && (
          <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm ${
            uploadResult.includes('success') || uploadResult.includes('cleared')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {uploadResult}
          </div>
        )}
      </div>

      {/* Performance Insights + Recommendations */}
      {insights && insights.overallStats.totalAnalyzed > 0 && (
        <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider flex items-center gap-2 mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Performance Insights
            <span className="text-[10px] text-slate-400 font-normal ml-1">
              ({insights.overallStats.totalAnalyzed} posts with engagement data)
            </span>
          </h3>

          {/* Overall Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-slate-900">{insights.overallStats.avgEngagement}%</div>
              <div className="text-[10px] text-slate-400 uppercase">Avg Engagement</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-slate-900">{insights.overallStats.medianEngagement}%</div>
              <div className="text-[10px] text-slate-400 uppercase">Median Engagement</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-slate-900">{insights.overallStats.totalImpressions.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400 uppercase">Total Impressions</div>
            </div>
          </div>

          {/* Strategy Recommendations */}
          {recommendations.length > 0 && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Strategy Recommendations</h4>
              <div className="space-y-2">
                {recommendations.map((r: any, i: number) => (
                  <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                    r.confidence === 'high' ? 'bg-green-50 border-green-200' :
                    r.confidence === 'medium' ? 'bg-amber-50 border-amber-200' :
                    'bg-slate-50 border-slate-200'
                  }`}>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      r.confidence === 'high' ? 'bg-green-200 text-green-800' :
                      r.confidence === 'medium' ? 'bg-amber-200 text-amber-800' :
                      'bg-slate-200 text-slate-600'
                    }`}>{r.confidence}</span>
                    <div>
                      <p className="text-sm text-slate-700">{r.recommendation}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{r.dataPoints}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pillar Performance Table */}
          {insights.byPillar.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">By Content Pillar</h4>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">Pillar</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-medium">Posts</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-medium">Avg Eng %</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-medium">Impressions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.byPillar.map((p: any) => (
                      <tr key={p.pillar} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700 font-medium">{p.pillar}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{p.count}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-medium ${p.avgEngagement > insights.overallStats.avgEngagement ? 'text-green-600' : 'text-slate-500'}`}>
                            {p.avgEngagement}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500">{p.totalImpressions.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Format Performance Table */}
          {insights.byFormat.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">By Format</h4>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">Format</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-medium">Posts</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-medium">Avg Eng %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.byFormat.map((f: any) => (
                      <tr key={f.format} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700 font-medium capitalize">{f.format.replace('_', ' ')}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{f.count}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-medium ${f.avgEngagement > insights.overallStats.avgEngagement ? 'text-green-600' : 'text-slate-500'}`}>
                            {f.avgEngagement}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Posts */}
          {insights.topPosts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Top Performing Posts</h4>
              <div className="space-y-1">
                {insights.topPosts.slice(0, 5).map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50/50">
                    <span className="text-[10px] font-bold text-green-600 w-8">#{i + 1}</span>
                    <span className="text-xs text-slate-700 flex-1 truncate">{p.topic}</span>
                    <span className="text-[10px] text-slate-400">{p.pillar}</span>
                    <span className="text-xs font-bold text-green-600">{Number(p.engagementRate).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History list */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider flex items-center gap-2 mb-4">
          <History size={14} />
          Past Content ({entries.length} entries)
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 size={16} className="animate-spin mr-2" />
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <History size={32} className="mx-auto mb-3 text-slate-200" />
            <p className="text-sm">No past content uploaded yet</p>
            <p className="text-xs text-slate-300 mt-1">Upload a CSV or paste your published post history above</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {entries.map((entry, i) => (
              <div key={entry._id || i} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 group">
                <div className="text-[10px] text-slate-300 w-20 shrink-0 pt-0.5">
                  {new Date(entry.publishedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 truncate">{entry.topic}</p>
                  {entry.hook && <p className="text-xs text-slate-400 truncate italic">"{entry.hook}"</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entry.contentPillar && (
                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{entry.contentPillar}</span>
                  )}
                  <span className="text-[9px] text-slate-300">{entry.author}</span>
                  <span className="text-[9px] text-slate-300">{entry.platform}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Settings Page ───
// ─── Foundation Documents Tab ───

const DOC_TYPES = [
  { value: 'sales_deck', label: 'Sales Deck' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'brand_guidelines', label: 'Brand Guidelines' },
  { value: 'product_info', label: 'Product Info' },
  { value: 'competitor_intel', label: 'Competitor Intel' },
  { value: 'process_doc', label: 'Process Doc' },
  { value: 'other', label: 'Other' },
] as const;

interface DocIntelligence {
  summary?: string;
  keyThemes?: string[];
  messagingAnchors?: string[];
  icpInsights?: string;
  contentPillarFit?: string[];
  proofPoints?: string[];
  toneAndVoice?: string;
  suggestedUses?: string[];
}

interface FoundationDoc {
  _id: string;
  title: string;
  description: string;
  docType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isActive: boolean;
  intelligence: DocIntelligence | null;
  aiCost: { inputTokens: number; outputTokens: number; costUsd: number; model: string } | null;
  createdAt: string;
}

function FoundationDocsTab() {
  const [docs, setDocs] = useState<FoundationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState('other');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reanalysing, setReanalysing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const { data } = await foundationDocsAPI.list();
      setDocs(data.documents || []);
    } catch (err) {
      console.error('Failed to fetch foundation docs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Poll for intelligence updates on docs that don't have it yet
  useEffect(() => {
    const pending = docs.filter((d) => !d.intelligence);
    if (pending.length === 0) return;
    const timer = setTimeout(() => fetchDocs(), 5000);
    return () => clearTimeout(timer);
  }, [docs, fetchDocs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('File too large. Maximum size is 10MB.');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      await foundationDocsAPI.upload({
        fileName: file.name,
        mimeType: file.type,
        fileBase64: base64,
        title: file.name.replace(/\.[^.]+$/, ''),
        docType: 'other',
      });

      await fetchDocs();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleActive = async (doc: FoundationDoc) => {
    try {
      await foundationDocsAPI.update(doc._id, { isActive: !doc.isActive });
      setDocs((prev) => prev.map((d) => (d._id === doc._id ? { ...d, isActive: !d.isActive } : d)));
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await foundationDocsAPI.delete(id);
      setDocs((prev) => prev.filter((d) => d._id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleReanalyse = async (id: string) => {
    setReanalysing(id);
    try {
      await foundationDocsAPI.reanalyse(id);
      // Poll for updated intelligence
      setTimeout(() => fetchDocs(), 8000);
    } catch (err) {
      console.error('Reanalyse failed:', err);
    } finally {
      setTimeout(() => setReanalysing(null), 8000);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await foundationDocsAPI.update(editingId, {
        title: editTitle,
        description: editDesc,
        docType: editType,
      });
      setDocs((prev) =>
        prev.map((d) =>
          d._id === editingId ? { ...d, title: editTitle, description: editDesc, docType: editType } : d
        )
      );
      setEditingId(null);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const startEdit = (doc: FoundationDoc) => {
    setEditingId(doc._id);
    setEditTitle(doc.title);
    setEditDesc(doc.description);
    setEditType(doc.docType);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeLabel = (type: string) => DOC_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider flex items-center gap-2">
          <FileText size={14} />
          Foundation Documents
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Upload company documents (sales decks, case studies, brand guidelines). AI extracts intelligence from each document and uses it to generate better content aligned with your strategy.
        </p>
      </div>

      {/* Upload area */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          uploading
            ? 'border-purple-300 bg-purple-50'
            : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md"
          onChange={handleFileUpload}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-purple-500" />
            <span className="text-sm text-purple-600 font-medium">Uploading & extracting intelligence...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={24} className="text-slate-300" />
            <span className="text-sm text-slate-500 font-medium">Click to upload a document</span>
            <span className="text-xs text-slate-400">PDF, DOCX, TXT, MD — up to 10MB</span>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={14} />
          {uploadError}
        </div>
      )}

      {/* Documents list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-slate-300" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          No documents uploaded yet. Upload your first document to enhance AI content generation.
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const intel = doc.intelligence;
            const isExpanded = expandedId === doc._id;
            const isPending = !intel && doc.isActive;

            return (
            <div
              key={doc._id}
              className={`border rounded-xl transition-colors ${
                doc.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'
              }`}
            >
              {editingId === doc._id ? (
                /* Edit mode */
                <div className="p-4 space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    placeholder="Document title"
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                    rows={2}
                    placeholder="Brief description (optional)"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Type:</span>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      {DOC_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700"
                    >
                      <Save size={12} /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                {/* Header row */}
                <div className="p-4 flex items-start justify-between gap-4">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : doc._id)}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <span className="text-sm font-medium text-slate-800 truncate">{doc.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 whitespace-nowrap">
                        {getTypeLabel(doc.docType)}
                      </span>
                      {isPending && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600">
                          <Loader2 size={10} className="animate-spin" /> Analysing...
                        </span>
                      )}
                      {intel && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600">
                          Intelligence ready
                        </span>
                      )}
                    </div>
                    {intel?.summary && !isExpanded && (
                      <p className="text-xs text-slate-400 mt-1 ml-[22px] line-clamp-1">{intel.summary}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 ml-[22px] text-[11px] text-slate-400">
                      <span>{doc.fileName}</span>
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleActive(doc)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                        doc.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                      title={doc.isActive ? 'Active — feeding into AI prompts' : 'Inactive — not used by AI'}
                    >
                      {doc.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => handleReanalyse(doc._id)}
                      disabled={reanalysing === doc._id}
                      className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Re-analyse with AI"
                    >
                      {reanalysing === doc._id ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
                    </button>
                    <button
                      onClick={() => startEdit(doc)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(doc._id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded intelligence panel */}
                {isExpanded && intel && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    {/* Summary */}
                    {intel.summary && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Summary</span>
                        <p className="text-xs text-slate-600 mt-0.5">{intel.summary}</p>
                      </div>
                    )}

                    {/* Key Themes + Content Pillar Fit */}
                    <div className="grid grid-cols-2 gap-3">
                      {intel.keyThemes && intel.keyThemes.length > 0 && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Key Themes</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {intel.keyThemes.map((t, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-600">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {intel.contentPillarFit && intel.contentPillarFit.length > 0 && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Strategy Pillar Fit</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {intel.contentPillarFit.map((p, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-full text-[11px] bg-purple-50 text-purple-600">{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ICP Insights */}
                    {intel.icpInsights && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">ICP Insights</span>
                        <p className="text-xs text-slate-600 mt-0.5">{intel.icpInsights}</p>
                      </div>
                    )}

                    {/* Messaging Anchors */}
                    {intel.messagingAnchors && intel.messagingAnchors.length > 0 && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Messaging Anchors</span>
                        <ul className="mt-1 space-y-0.5">
                          {intel.messagingAnchors.map((a, i) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                              <span className="text-purple-400 mt-0.5 shrink-0">&bull;</span>
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Proof Points */}
                    {intel.proofPoints && intel.proofPoints.length > 0 && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Proof Points & Data</span>
                        <ul className="mt-1 space-y-0.5">
                          {intel.proofPoints.map((p, i) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                              <CheckCircle2 size={11} className="text-green-500 mt-0.5 shrink-0" />
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Tone & Voice */}
                    {intel.toneAndVoice && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Tone & Voice</span>
                        <p className="text-xs text-slate-600 mt-0.5">{intel.toneAndVoice}</p>
                      </div>
                    )}

                    {/* Suggested Uses */}
                    {intel.suggestedUses && intel.suggestedUses.length > 0 && (
                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-2.5">
                        <span className="text-[10px] text-purple-600 uppercase tracking-wider font-medium">Suggested Content Uses</span>
                        <ul className="mt-1 space-y-0.5">
                          {intel.suggestedUses.map((s, i) => (
                            <li key={i} className="text-xs text-purple-700 flex items-start gap-1.5">
                              <span className="shrink-0">→</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* AI cost */}
                    {doc.aiCost && (
                      <div className="text-[10px] text-slate-300 text-right">
                        Intelligence: {doc.aiCost.model} · ${doc.aiCost.costUsd?.toFixed(4)}
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded but no intelligence yet */}
                {isExpanded && !intel && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2 text-xs text-amber-600">
                      <Loader2 size={12} className="animate-spin" />
                      AI is analysing this document against your strategy. This usually takes 10-15 seconds...
                    </div>
                  </div>
                )}
                </>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* How it feeds into strategy */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-purple-600" />
          <span className="text-xs font-semibold text-purple-800">How Foundation Documents Feed Into Your Strategy</span>
        </div>
        <div className="text-xs text-purple-700/80 space-y-1.5 ml-[22px]">
          <p><strong>Text Extraction:</strong> Raw text is extracted from every uploaded document (PDF, DOCX, TXT).</p>
          <p><strong>AI Intelligence:</strong> Claude analyses each document to extract key themes, messaging anchors, proof points, ICP insights, and content pillar alignment.</p>
          <p><strong>Content Generation:</strong> Active documents are injected as context into every AI prompt — post generation, calendar planning, journal analysis, and outreach drafting all reference your foundation docs.</p>
          <p><strong>Toggle Control:</strong> Mark documents as Active/Inactive to control which ones the AI uses. Useful for seasonal content or deprecated materials.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Strategy Foundation Editor ───

function StrategyFoundationTab() {
  const { strategy, refresh } = useStrategy();
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Field-specific state
  const [textValue, setTextValue] = useState('');
  const [listValue, setListValue] = useState<string[]>([]);

  if (!strategy) {
    return (
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <p className="text-sm text-slate-400">No strategy loaded. Complete the strategy interview first.</p>
      </div>
    );
  }

  const startTextEdit = (field: string, current: string) => {
    setEditing(field);
    setTextValue(current || '');
  };

  const startListEdit = (field: string, current: string[]) => {
    setEditing(field);
    setListValue([...(current || [])]);
  };

  const cancel = () => {
    setEditing(null);
    setTextValue('');
    setListValue([]);
  };

  const save = async (field: string, value: any) => {
    setSaving(true);
    try {
      await strategyAPI.update(strategy._id, { [field]: value }, `Updated ${field} from Settings`);
      await refresh();
      cancel();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const FOUNDATION_FIELDS = [
    { key: 'northStar', label: 'North Star', type: 'text' as const },
    { key: 'positioningStatement', label: 'Positioning Statement', type: 'text' as const },
    { key: 'voiceShohini', label: "Shohini's Voice", type: 'text' as const },
    { key: 'voiceSanjoy', label: "Sanjoy's Voice", type: 'text' as const },
    { key: 'sharedTone', label: 'Shared Tone', type: 'text' as const },
    { key: 'bannedPhrases', label: 'Banned Phrases', type: 'list' as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider flex items-center gap-2">
            <Shield size={14} />
            Strategy Foundation
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Core business identity — ICP, positioning, voice, pillars. These rarely change. Edits create a new strategy version.
          </p>
        </div>

        <div className="space-y-4">
          {/* Simple text / list fields */}
          {FOUNDATION_FIELDS.map((f) => {
            const isEditing = editing === f.key;
            const currentValue = (strategy as any)[f.key];

            return (
              <div key={f.key} className="border border-slate-100 rounded-lg p-4 group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{f.label}</span>
                  {!isEditing && (
                    <button
                      onClick={() =>
                        f.type === 'list'
                          ? startListEdit(f.key, currentValue)
                          : startTextEdit(f.key, currentValue)
                      }
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-brand-coral"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    {f.type === 'text' ? (
                      <textarea
                        value={textValue}
                        onChange={(e) => setTextValue(e.target.value)}
                        rows={3}
                        className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-coral/30 focus:border-brand-coral outline-none resize-y"
                      />
                    ) : (
                      <>
                        {listValue.map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              value={item}
                              onChange={(e) => {
                                const updated = [...listValue];
                                updated[i] = e.target.value;
                                setListValue(updated);
                              }}
                              className="flex-1 text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-brand-coral/30 focus:border-brand-coral outline-none"
                            />
                            <button
                              onClick={() => setListValue(listValue.filter((_, j) => j !== i))}
                              className="text-slate-300 hover:text-red-500"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setListValue([...listValue, ''])}
                          className="text-xs text-brand-coral hover:text-brand-coral/80 flex items-center gap-1"
                        >
                          <Plus size={12} /> Add
                        </button>
                      </>
                    )}
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button onClick={cancel} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700" disabled={saving}>
                        Cancel
                      </button>
                      <button
                        onClick={() => save(f.key, f.type === 'list' ? listValue.filter((v) => v.trim()) : textValue)}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs bg-brand-coral text-white rounded-lg hover:bg-brand-coral/90 disabled:opacity-50 flex items-center gap-1"
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  f.type === 'list' ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(currentValue as string[])?.length > 0 ? (
                        (currentValue as string[]).map((item: string, i: number) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 rounded-full px-3 py-1">{item}</span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-300">Not set</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{currentValue || <span className="text-slate-300">Not set</span>}</p>
                  )
                )}
              </div>
            );
          })}

          {/* ICP — structured display */}
          <div className="border border-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ideal Customer Profile</span>
              <span className="text-[10px] text-slate-300">Edit via Strategy Interview</span>
            </div>
            {strategy.icpPrimary?.description && (
              <div className="mb-2">
                <span className="text-[10px] text-slate-400 uppercase">Primary:</span>
                <p className="text-sm text-slate-700">{strategy.icpPrimary.description}</p>
                {strategy.icpPrimary.painPoints?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {strategy.icpPrimary.painPoints.map((p: string, i: number) => (
                      <span key={i} className="text-[10px] bg-red-50 text-red-500 rounded px-2 py-0.5">{p}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {strategy.icpSecondary?.description && (
              <div className="mb-2">
                <span className="text-[10px] text-slate-400 uppercase">Secondary:</span>
                <p className="text-sm text-slate-700">{strategy.icpSecondary.description}</p>
              </div>
            )}
            {strategy.antiIcp && (
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Anti-ICP:</span>
                <p className="text-sm text-slate-700">{strategy.antiIcp}</p>
              </div>
            )}
          </div>

          {/* Content Pillars — structured display */}
          <div className="border border-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Content Pillars</span>
              <span className="text-[10px] text-slate-300">Edit via Strategy Interview</span>
            </div>
            <div className="space-y-2">
              {strategy.contentPillars?.map((pillar, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg p-2">
                  <span className="text-xs font-bold text-brand-coral w-8 text-center">{pillar.targetPercent}%</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{pillar.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{pillar.purpose}</span>
                  </div>
                  <span className="text-[10px] text-slate-300">{pillar.owner}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Platform Config — active / planned / inactive */}
          <div className="border border-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Channel Status</span>
              <span className="text-[10px] text-slate-300">Which platforms are you active on?</span>
            </div>
            <div className="space-y-3">
              {(strategy.platformConfig && strategy.platformConfig.length > 0
                ? strategy.platformConfig
                : [
                    { platform: 'linkedin', status: 'active' as const, launchDate: null, notes: '' },
                    { platform: 'instagram', status: 'planned' as const, launchDate: null, notes: '' },
                    { platform: 'facebook', status: 'planned' as const, launchDate: null, notes: '' },
                  ]
              ).map((pc, i) => {
                const platformIcon = pc.platform === 'linkedin'
                  ? <Linkedin size={16} className="text-blue-600" />
                  : pc.platform === 'facebook'
                  ? <Facebook size={16} className="text-indigo-600" />
                  : <Instagram size={16} className="text-purple-600" />;

                const statusColors = {
                  active: 'bg-green-100 text-green-700 border-green-300',
                  planned: 'bg-amber-50 text-amber-600 border-amber-200',
                  inactive: 'bg-slate-50 text-slate-400 border-slate-200',
                };

                return (
                  <div key={pc.platform} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                    {platformIcon}
                    <span className="text-sm font-medium capitalize w-20">{pc.platform}</span>

                    {/* Status toggle buttons */}
                    <div className="flex items-center gap-1">
                      {(['active', 'planned', 'inactive'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={async () => {
                            const updatedConfig = (strategy.platformConfig || [
                              { platform: 'linkedin', status: 'active', launchDate: null, notes: '' },
                              { platform: 'instagram', status: 'planned', launchDate: null, notes: '' },
                              { platform: 'facebook', status: 'planned', launchDate: null, notes: '' },
                            ]).map((p) =>
                              p.platform === pc.platform ? { ...p, status: st } : p
                            );
                            try {
                              await strategyAPI.update(strategy._id, { platformConfig: updatedConfig }, `Changed ${pc.platform} status to ${st}`);
                              await refresh();
                            } catch (err) {
                              console.error('Failed to update platform config:', err);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all capitalize ${
                            pc.status === st
                              ? statusColors[st]
                              : 'bg-white text-slate-300 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          {st === 'active' ? '● Active' : st === 'planned' ? '◐ Planned' : '○ Inactive'}
                        </button>
                      ))}
                    </div>

                    {/* Launch hint */}
                    {pc.status === 'planned' && (
                      <span className="text-[10px] text-amber-500 ml-auto">New channel launch when activated</span>
                    )}
                    {pc.status === 'active' && (
                      <span className="text-[10px] text-green-500 ml-auto">Included in calendar planning</span>
                    )}
                    {pc.status === 'inactive' && (
                      <span className="text-[10px] text-slate-300 ml-auto">Hidden from calendar</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Platform Strategy — editable weekly targets */}
          {strategy.platformStrategy?.length > 0 && (
            <div className="border border-slate-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Platform Strategy</span>
                <span className="text-[10px] text-slate-300">Click the number to change posting frequency</span>
              </div>
              <div className="space-y-3">
                {strategy.platformStrategy.map((ps, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {ps.platform.toLowerCase() === 'linkedin' ? (
                          <Linkedin size={14} className="text-blue-600" />
                        ) : ps.platform.toLowerCase() === 'facebook' ? (
                          <Facebook size={14} className="text-indigo-600" />
                        ) : (
                          <Instagram size={14} className="text-purple-600" />
                        )}
                        <span className="text-sm font-medium capitalize">{ps.platform}</span>
                      </div>
                      {/* Editable weekly target */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={async () => {
                            const updated = strategy.platformStrategy.map((p, j) =>
                              j === i ? { ...p, weeklyTarget: Math.max(1, p.weeklyTarget - 1) } : p
                            );
                            await strategyAPI.update(strategy._id, { platformStrategy: updated }, `Decreased ${ps.platform} weekly target`);
                            await refresh();
                          }}
                          className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-brand-coral hover:border-brand-coral text-sm flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="text-sm font-bold text-brand-coral w-12 text-center">{ps.weeklyTarget}x/wk</span>
                        <button
                          onClick={async () => {
                            const updated = strategy.platformStrategy.map((p, j) =>
                              j === i ? { ...p, weeklyTarget: p.weeklyTarget + 1 } : p
                            );
                            await strategyAPI.update(strategy._id, { platformStrategy: updated }, `Increased ${ps.platform} weekly target`);
                            await refresh();
                          }}
                          className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-brand-coral hover:border-brand-coral text-sm flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {ps.primaryPurpose && (
                      <p className="text-xs text-slate-400 ml-6">{ps.primaryPurpose}</p>
                    )}
                    {ps.bestFormats?.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-6 mt-1">
                        {ps.bestFormats.map((f, j) => (
                          <span key={j} className="text-[10px] bg-white border border-slate-100 rounded px-1.5 py-0.5 text-slate-400">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'foundation', label: 'Strategy Foundation' },
  { id: 'foundation-docs', label: 'Foundation Docs' },
  { id: 'prompts', label: 'AI Prompts' },
  { id: 'content-history', label: 'Content History' },
  { id: 'integrations', label: 'Integrations' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('prompts');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure AI prompts, integrations, and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'foundation' && <StrategyFoundationTab />}

      {activeTab === 'foundation-docs' && <FoundationDocsTab />}

      {activeTab === 'prompts' && (
        <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider flex items-center gap-2">
              <FileText size={14} />
              AI Prompt Templates
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Edit the prompts that drive content generation, calendar planning, and strategy. Changes take effect immediately.
            </p>
          </div>
          <PromptsEditor />
        </div>
      )}

      {activeTab === 'content-history' && <ContentHistoryTab />}

      {activeTab === 'integrations' && <IntegrationsTab />}

      {/* About */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-brand-coral uppercase tracking-wider mb-4">About</h3>
        <p className="text-sm text-slate-500">The Signal v2.0 — MerakiPeople Growth OS</p>
        <p className="text-xs text-slate-400 mt-1">Strategy-driven content at founder speed.</p>
      </div>
    </div>
  );
}
