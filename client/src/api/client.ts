import axios from 'axios';
import { API_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('signal_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('signal_token');
      localStorage.removeItem('signal_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ============ Auth API ============
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

// ============ Strategy API ============
export const strategyAPI = {
  getCurrent: () => api.get('/strategy/current'),
  submitOnboarding: (section: number | string, answers: Record<string, any>) =>
    api.post('/strategy/onboarding', { section, answers }),
  generate: () => api.post('/strategy/generate'),
  approve: () => api.post('/strategy/approve'),
  update: (id: string, fields: Record<string, any>, reason: string) =>
    api.put(`/strategy/${id}`, { fields, reason }),
  getVersions: () => api.get('/strategy/versions'),
  getRecommendations: () => api.get('/strategy/recommendations'),
  acceptRecommendation: (id: string) =>
    api.post(`/strategy/recommendations/${id}/accept`),
  extractPlatformMetrics: (imageBase64: string) =>
    api.post('/strategy/extract-platform-metrics', { image: imageBase64 }),
};

// ============ Campaign API ============
export const campaignAPI = {
  list: () => api.get('/campaigns'),
  create: (data: any) => api.post('/campaigns', data),
  update: (id: string, data: any) => api.put(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
};

// ============ Signal Feed API ============
export const signalFeedAPI = {
  submit: (data: { rawText: string; author: string; tags: string[]; urlReference?: string }) =>
    api.post('/signal-feed', data),
  quickAdd: (data: { rawText: string; tags?: string[]; urlReference?: string }) =>
    api.post('/signal-feed/quick', data),
  list: (params?: Record<string, any>) => api.get('/signal-feed', { params }),
  weekSummary: (weekStart: string) =>
    api.get('/signal-feed/week-summary', { params: { weekStart } }),
  get: (id: string) => api.get(`/signal-feed/${id}`),
  confirm: (id: string) => api.put(`/signal-feed/${id}/confirm`),
  override: (id: string, data: { routing: string; campaignId?: string }) =>
    api.put(`/signal-feed/${id}/override`, data),
};

// ============ Posts API ============
export const postsAPI = {
  generate: (data: any) => api.post('/posts/generate', data),
  regenerate: (id: string, data: { instruction: string; field: 'text' | 'image' }) =>
    api.post(`/posts/${id}/regenerate`, data),
  generateContent: (id: string, force?: boolean) =>
    api.post(`/posts/${id}/generate-content`, { force: force || false }),
  generateImage: (id: string, data: { imageType: string; customPrompt?: string }) =>
    api.post(`/posts/${id}/generate-image`, data),
  list: (params?: Record<string, any>) => api.get('/posts', { params }),
  get: (id: string) => api.get(`/posts/${id}`),
  update: (id: string, data: any) => api.put(`/posts/${id}`, data),
  delete: (id: string) => api.delete(`/posts/${id}`),
  downloadCarouselPdf: (id: string) =>
    api.get(`/posts/${id}/carousel-pdf`, { responseType: 'blob' }),
};

// ============ Calendar API ============
export const calendarAPI = {
  get: (params: { view: string; date: string; author?: string }) =>
    api.get('/calendar', { params }),
  getWeek: (weekStart?: string) =>
    api.get('/calendar/week', { params: weekStart ? { weekStart } : {} }),
  generateWeek: (weekStart?: string, platforms?: string[]) =>
    api.post('/calendar/generate-week', { ...(weekStart ? { weekStart } : {}), ...(platforms?.length ? { platforms } : {}) }),
  updateTaskStatus: (postId: string, status: string) =>
    api.put(`/calendar/task/${postId}/status`, { status }),
  getGaps: () => api.get('/calendar/gaps'),
  getAlignment: () => api.get('/calendar/alignment'),
  reschedule: (postId: string, newDate: string) =>
    api.put('/calendar/reschedule', { postId, newDate }),
  approveWeek: (weekStart: string) =>
    api.post('/calendar/approve-week', { weekStart }),
  approveProgress: (weekStart: string) =>
    api.get('/calendar/approve-progress', { params: { weekStart } }),
  generationProgress: () => api.get('/calendar/generation-progress'),
};

// ============ Pipeline API ============
export const pipelineAPI = {
  list: (params?: Record<string, any>) => api.get('/pipeline', { params }),
  create: (data: any) => api.post('/pipeline', data),
  get: (id: string) => api.get(`/pipeline/${id}`),
  update: (id: string, data: any) => api.put(`/pipeline/${id}`, data),
  draftOutreach: (id: string, channel: string) =>
    api.post(`/pipeline/${id}/draft-outreach`, { channel }),
  delete: (id: string) => api.delete(`/pipeline/${id}`),
};

// ============ Analytics API ============
export const analyticsAPI = {
  logPerformance: (data: any) => api.post('/analytics/post-performance', data),
  dashboard: () => api.get('/analytics/dashboard'),
  signalScore: () => api.get('/analytics/signal-score'),
  mondayBrief: () => api.get('/analytics/monday-brief'),
  generateWeekly: () => api.post('/analytics/generate-weekly'),
  weeklyPerformance: () => api.get('/analytics/weekly-performance'),
  pendingPerformance: () => api.get('/analytics/pending-performance'),
};

// ============ Costs API ============
export const costsAPI = {
  list: (params?: Record<string, any>) => api.get('/costs', { params }),
  summary: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/costs/summary', { params }),
  daily: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/costs/daily', { params }),
};

// ============ Journal API ============
export const journalAPI = {
  create: (data: { rawText: string; author: string; entryType?: string; priority?: 'normal' | 'high' }) =>
    api.post('/journal', data),
  reanalyse: (id: string) => api.post(`/journal/${id}/analyse`),
  accept: (id: string) => api.put(`/journal/${id}/accept`),
  edit: (id: string, data: Record<string, any>) => api.put(`/journal/${id}/edit`, data),
  discard: (id: string) => api.put(`/journal/${id}/discard`),
  archive: (id: string) => api.put(`/journal/${id}/archive`),
  autoRegenStatus: () => api.get('/journal/auto-regen-status'),
  autoRegenReset: () => api.post('/journal/auto-regen-reset'),
  list: (params?: Record<string, any>) => api.get('/journal', { params }),
  get: (id: string) => api.get(`/journal/${id}`),
};

// ============ Feedback API ============
export const feedbackAPI = {
  submit: (data: {
    postId: string;
    field: string;
    rating: 'up' | 'down';
    feedbackText?: string;
    quickFixUsed?: string;
    contentBefore?: string;
    contentAfter?: string;
    format?: string;
    platform?: string;
    contentPillar?: string;
    author?: string;
  }) => api.post('/feedback', data),
  quickFixes: (params: { format?: string; platform?: string; field?: string }) =>
    api.get('/feedback/quick-fixes', { params }),
  intelligence: (params?: { format?: string; platform?: string; contentPillar?: string }) =>
    api.get('/feedback/intelligence', { params }),
  stats: () => api.get('/feedback/stats'),
};

// ============ Content History API ============
export const contentHistoryAPI = {
  upload: (entries: any[]) => api.post('/content-history/upload', { entries }),
  list: (params?: Record<string, any>) => api.get('/content-history', { params }),
  summary: () => api.get('/content-history/summary'),
  insights: (params?: Record<string, any>) => api.get('/content-history/insights', { params }),
  clear: () => api.delete('/content-history'),
};

// ============ Prompts API ============
export const promptsAPI = {
  list: () => api.get('/prompts'),
  get: (name: string) => api.get(`/prompts/${name}`),
  update: (name: string, content: string) => api.put(`/prompts/${name}`, { content }),
};

// ============ Automations API ============
export const automationsAPI = {
  agents: () => api.get('/automations/agents'),
  agentStatus: (agentId: string) => api.get(`/automations/agents/${agentId}`),
  run: (agentId: string) => api.post(`/automations/run/${agentId}`),
  runs: (params?: { agentId?: string; page?: number; limit?: number }) =>
    api.get('/automations/runs', { params }),
  getRun: (runId: string) => api.get(`/automations/runs/${runId}`),
};
