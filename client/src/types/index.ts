// ============ Auth ============
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'shohini' | 'sanjoy';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

// ============ Strategy ============
export interface ContentPillar {
  name: string;
  purpose: string;
  targetPercent: number;
  examplePostTypes: string[];
  owner: 'shohini' | 'sanjoy' | 'both';
}

export interface PlatformStrategy {
  platform: string;
  primaryPurpose: string;
  weeklyTarget: number;
  bestFormats: string[];
  bestPostingTimes: string[];
}

export interface MetricsTargets {
  linkedinFollowers?: number;
  linkedinEngagementRate?: number;
  linkedinDmsPerWeek?: number;
  instagramFollowers?: number;
  instagramReach?: number;
  leadsPerMonth?: number;
  demoToCloseRate?: number;
  mrrTarget?: number;
  trainingRevenueTarget?: number;
}

export interface Strategy {
  _id: string;
  version: number;
  northStar: string;
  goal90Day: string;
  icpPrimary: Record<string, any>;
  icpSecondary: Record<string, any>;
  antiIcp: string;
  positioningStatement: string;
  contentPillars: ContentPillar[];
  voiceShohini: string;
  voiceSanjoy: string;
  sharedTone: string;
  bannedPhrases: string[];
  platformStrategy: PlatformStrategy[];
  keyMessages: string[];
  objectionContent: Record<string, string>[];
  clientRoster: Record<string, any>[];
  metricsTargets: MetricsTargets;
  competitiveIntelligence: string;
  isCurrent: boolean;
  isComplete: boolean;
  onboardingProgress: {
    currentSection: number;
    totalSections: number;
    completedSections: string[];
  };
  updatedBy: string;
  updateReason: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Campaign ============
export interface Campaign {
  _id: string;
  name: string;
  goal: string;
  targetSegment: string;
  startDate: string;
  endDate: string;
  contentBrief: string;
  platforms: string[];
  budget: number;
  successMetric: string;
  status: 'draft' | 'active' | 'paused' | 'complete';
  createdAt: string;
  updatedAt: string;
}

// ============ Signal Feed ============
export interface AIClassification {
  insightType: string;
  contentPillar: string;
  timeliness: 'timely' | 'evergreen';
  strategyRelevance: string;
  contradictions: string[];
  confidence: number;
  evidence: {
    strategyReferences: string[];
    reasoning: string;
  };
  critiqueScore: number;
  critiqueIterations: number;
  critiqueFeedback: string;
}

export interface SignalFeedEntry {
  _id: string;
  author: 'shohini' | 'sanjoy';
  rawText: string;
  tags: string[];
  urlReference: string;
  aiClassification: AIClassification;
  routing: 'strategy_update' | 'content_seed' | 'campaign_fuel' | 'archive';
  campaignId: string | null;
  status: 'pending' | 'confirmed' | 'in_calendar' | 'published' | 'archived';
  strategyUpdateProposed: Record<string, any>;
  strategyUpdateAccepted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============ Post ============
export interface CarouselSlide {
  slideNumber: number;
  content: string;
  type: 'hook' | 'content' | 'cta';
}

export interface PostPerformance {
  likes: number;
  comments: number;
  shares: number;
  dms: number;
  reach: number;
  saves: number;
  engagementRate: number;
}

export interface AIEvidence {
  strategyReferences: string[];
  dataPoints: string[];
  signalFeedSources: string[];
  confidenceScore: number;
  critiqueIterations: number;
  finalCritiqueScore: number;
}

export interface Post {
  _id: string;
  signalFeedId: string | null;
  campaignId: string | null;
  author: 'shohini' | 'sanjoy';
  platform: 'linkedin' | 'instagram' | 'both';
  format: string;
  contentPillar: string;
  draftContent: string;
  draftCarouselOutline: CarouselSlide[];
  finalContent: string;
  cta: string;
  hashtags: string[];
  linkedinHook: string;
  instagramHook: string;
  imageType: string | null;
  imagePrompt: string;
  imageUrl: string;
  imageVariations: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  status: 'draft' | 'scheduled' | 'ready' | 'published' | 'archived';
  performance: PostPerformance | null;
  notes: string;
  aiEvidence: AIEvidence;
  createdAt: string;
  updatedAt: string;
}

// ============ Lead ============
export interface LeadNote {
  text: string;
  timestamp: string;
  author: string;
}

export interface Lead {
  _id: string;
  companyName: string;
  contactName: string;
  contactRole: string;
  source: string;
  sourcePostId: string | null;
  vertical: string;
  dealValue: number;
  owner: 'shohini' | 'sanjoy';
  stage: 'RADAR' | 'CONTACTED' | 'CONVERSATION' | 'DEMO_DONE' | 'PROPOSAL' | 'NEGOTIATING' | 'SIGNED' | 'LOST';
  lastContactAt: string | null;
  nextAction: string;
  nextActionAt: string | null;
  notes: LeadNote[];
  createdAt: string;
  updatedAt: string;
}

// ============ Analytics ============
export interface ScoreBreakdown {
  postingConsistency: number;
  pipelineActivity: number;
  strategyAlignment: number;
  engagementHealth: number;
}

export interface AIRecommendation {
  recommendation: string;
  reasoning: string;
  evidence: string[];
  accepted: boolean | null;
  dismissedAt: string | null;
}

export interface PillarPerformance {
  pillar: string;
  postsCount: number;
  avgEngagement: number;
  leadsGenerated: number;
  actualPercent: number;
  targetPercent: number;
}

export interface AnalyticsWeekly {
  _id: string;
  weekStart: string;
  signalScore: number;
  scoreBreakdown: ScoreBreakdown;
  postsPublished: {
    linkedin: { shohini: number; sanjoy: number };
    instagram: { shohini: number; sanjoy: number };
  };
  topPostId: string | null;
  pipelineNewLeads: number;
  pipelineDemos: number;
  pipelineSigned: number;
  pillarPerformance: PillarPerformance[];
  aiRecommendations: AIRecommendation[];
  mondayBriefGenerated: boolean;
  mondayBriefContent: string;
  createdAt: string;
}

// ============ Costs ============
export interface CostLog {
  _id: string;
  timestamp: string;
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  iteration: number;
  totalIterations: number;
  agentType: 'generator' | 'critique';
  user: string;
  promptName: string;
  durationMs: number;
}

export interface CostSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCalls: number;
  byOperation: Record<string, { calls: number; cost: number }>;
}

// ============ Signal Tags ============
export const SIGNAL_TAGS = [
  { key: 'win', label: 'Win', emoji: '🏆' },
  { key: 'frustration', label: 'Frustration', emoji: '🔥' },
  { key: 'insight', label: 'Insight', emoji: '💡' },
  { key: 'strong_opinion', label: 'Strong Opinion', emoji: '📣' },
  { key: 'open_question', label: 'Open Question', emoji: '❓' },
  { key: 'client_moment', label: 'Client Moment', emoji: '👤' },
  { key: 'market_observation', label: 'Market Observation', emoji: '🌍' },
  { key: 'number', label: 'Number', emoji: '📊' },
  { key: 'inspired_by', label: 'Inspired By', emoji: '🔗' },
] as const;

// ============ Pipeline Stages ============
export const PIPELINE_STAGES = [
  'RADAR',
  'CONTACTED',
  'CONVERSATION',
  'DEMO_DONE',
  'PROPOSAL',
  'NEGOTIATING',
  'SIGNED',
  'LOST',
] as const;
