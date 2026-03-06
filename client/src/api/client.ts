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
  submitOnboarding: (section: number, answers: Record<string, any>) =>
    api.post('/strategy/onboarding', { section, answers }),
  update: (id: string, fields: Record<string, any>, reason: string) =>
    api.put(`/strategy/${id}`, { fields, reason }),
  getVersions: () => api.get('/strategy/versions'),
  getRecommendations: () => api.get('/strategy/recommendations'),
  acceptRecommendation: (id: string) =>
    api.post(`/strategy/recommendations/${id}/accept`),
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
  list: (params?: Record<string, any>) => api.get('/signal-feed', { params }),
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
  generateImage: (id: string, data: { imageType: string; customPrompt?: string }) =>
    api.post(`/posts/${id}/generate-image`, data),
  list: (params?: Record<string, any>) => api.get('/posts', { params }),
  get: (id: string) => api.get(`/posts/${id}`),
  update: (id: string, data: any) => api.put(`/posts/${id}`, data),
  delete: (id: string) => api.delete(`/posts/${id}`),
};

// ============ Calendar API ============
export const calendarAPI = {
  get: (params: { view: string; date: string; author?: string }) =>
    api.get('/calendar', { params }),
  getGaps: () => api.get('/calendar/gaps'),
  getAlignment: () => api.get('/calendar/alignment'),
  reschedule: (postId: string, newDate: string) =>
    api.put('/calendar/reschedule', { postId, newDate }),
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
};

// ============ Costs API ============
export const costsAPI = {
  list: (params?: Record<string, any>) => api.get('/costs', { params }),
  summary: (params?: { startDate: string; endDate: string }) =>
    api.get('/costs/summary', { params }),
};
