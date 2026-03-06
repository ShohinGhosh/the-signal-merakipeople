export const BRAND = {
  colors: {
    indigo: '#152B68',
    coral: '#FF6F61',
    cloud: '#F7F9FB',
    graphite: '#2B2B2B',
  },
  fonts: {
    primary: 'Outfit, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
} as const;

export const API_URL = import.meta.env.VITE_API_URL || '/api';

export const PILLAR_COLORS: Record<string, string> = {
  'AI in B2B Sales': '#4F46E5',
  'Founder Journey': '#F59E0B',
  'Sales Communication Mastery': '#10B981',
  'Client Stories & Proof': '#EC4899',
  'India Startup Ecosystem': '#8B5CF6',
};

export const PLATFORM_ICONS: Record<string, string> = {
  linkedin: 'Linkedin',
  instagram: 'Instagram',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280',
  scheduled: '#3B82F6',
  ready: '#F59E0B',
  published: '#10B981',
  archived: '#9CA3AF',
};
