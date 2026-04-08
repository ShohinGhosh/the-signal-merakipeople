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

export interface PlatformBenchmarks {
  linkedin: {
    current_followers: number | null;
    avg_impressions: number | null;
    best_format: string | null;
    pipeline_generating: boolean | null;
    channel_purpose: string | null;
    target_90d: number | null;
  };
  instagram: {
    current_followers: number | null;
    avg_reach: number | null;
    best_format: string | null;
    pipeline_generating: boolean | null;
    channel_purpose: string | null;
    target_90d: number | null;
    is_active: boolean;
  };
}

export interface RawInputs {
  section1_businessContext: string;
  section2_goalsMetrics: string;
  section3_currentState: string;
  section3a_platformMetrics: string;
  section4_voicePositioning: string;
  section5_campaigns: string;
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
  platformBenchmarks?: PlatformBenchmarks;
  platformConfig?: {
    platform: string;
    status: 'active' | 'planned' | 'inactive';
    launchDate?: string | null;
    notes?: string;
  }[];
  competitiveIntelligence: string;
  isCurrent: boolean;
  isComplete: boolean;
  rawInputs: RawInputs;
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
  impactSummary?: {
    postCount: number;
    latestPostDate: string | null;
    latestPostStatus: string | null;
  } | null;
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
  platform: 'linkedin' | 'instagram' | 'facebook' | 'both';
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
  carouselPdfUrl: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  approvedAt: string | null;
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

// ============ Weekly Performance (Course-Correction) ============
export interface TopPostSummary {
  _id: string;
  platform: string;
  format: string;
  contentPillar: string;
  author: string;
  publishedAt: string;
  hookPreview: string;
  performance: PostPerformance;
}

export interface FormatBreakdown {
  format: string;
  postsCount: number;
  avgEngagement: number;
  totalReach: number;
}

export interface PlatformSummaryItem {
  postsCount: number;
  avgEngagement: number;
  totalReach: number;
}

export interface WoWMetric {
  thisWeek: number;
  lastWeek: number;
  change: number;
}

export interface ContentToLead {
  postId: string;
  platform: string;
  format: string;
  contentPillar: string;
  hookPreview: string;
  leadCompany: string;
  leadStage: string;
  dealValue: number;
}

export interface WeeklyPerformance {
  period: { start: string; end: string };
  topPosts: TopPostSummary[];
  formatBreakdown: FormatBreakdown[];
  platformSummary: {
    thisWeek: { linkedin: PlatformSummaryItem; instagram: PlatformSummaryItem };
    lastWeek: { linkedin: PlatformSummaryItem; instagram: PlatformSummaryItem };
  };
  weekOverWeek: {
    engagementRate: WoWMetric;
    postsPublished: WoWMetric;
    totalReach: WoWMetric;
    leadsGenerated: WoWMetric;
  };
  contentToLeads: ContentToLead[];
  platformBenchmarks: PlatformBenchmarks | null;
  pillarTargets: { name: string; targetPercent: number }[];
}

// ============ Costs ============
export interface CostLog {
  _id: string;
  timestamp: string;
  operation: string;
  model: string;
  provider: string;
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
  period: { startDate: string; endDate: string };
  totalCostUsd: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byOperation: { operation: string; count: number; costUsd: number }[];
  byModel: { model: string; count: number; costUsd: number }[];
  byAgentType: {
    generator: { count: number; costUsd: number };
    critique: { count: number; costUsd: number };
  };
  averageCostPerRequest: number;
}

export interface DailyCost {
  date: string;
  calls: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

// ============ Calendar / Week Plan ============
export interface SpecialDate {
  date: string;
  name: string;
  type: 'holiday' | 'awareness_day' | 'industry_event' | 'seasonal';
  relevance: 'high' | 'medium' | 'low';
  icpConnection: string;
  contentAngle: string;
  pillarFit: string;
}

export interface TrendingTopic {
  topic: string;
  context: string;
  relevance: 'high' | 'medium' | 'low';
  icpConnection: string;
  suggestedAngle: string;
  timelinessWindow: string;
}

export interface WeekResearch {
  specialDates: SpecialDate[];
  trendingTopics: TrendingTopic[];
  seasonalContext: string;
}

export interface GenerationInputs {
  signalsUsed: number;
  viralSignals: number;
  specialDatesResearched: boolean;
  campaigns: number;
  research?: WeekResearch;
  signals?: SignalFeedEntry[];
}

export interface WeekPlan {
  weekStart: string;
  weekEnd: string;
  days: Record<string, Post[]>;
  posts: Post[];
  stats: {
    total: number;
    byStatus: Record<string, number>;
    byPlatform: Record<string, number>;
    byAuthor: Record<string, number>;
    byPillar: Record<string, number>;
  };
  generationInputs?: GenerationInputs;
  strategyContext?: {
    platformTargets: { platform: string; weeklyTarget: number; bestFormats: string[]; bestPostingTimes: string[] }[];
    contentPillars: { name: string; targetPercent: number; owner: string }[];
  } | null;
}

// ============ Approve Progress ============
export interface ApproveProgress {
  total: number;
  contentReady: number;
  imagesReady: number;
  allDone: boolean;
  posts: { _id: string; status: string; hasDraft: boolean; hasImage: boolean }[];
}

// ============ Pending Performance ============
export interface PendingPerformance {
  pendingPosts: Post[];
  count: number;
  briefBlocked: boolean;
}

export interface WeekSignalSummary {
  weekStart: string;
  weekEnd: string;
  contentSeeds: SignalFeedEntry[];
  campaignFuel: SignalFeedEntry[];
  viralSignals: SignalFeedEntry[];
  totalCount: number;
}

export interface StrategyEvidence {
  pillarMatch: string;
  icpRelevance: string;
  goalAlignment: string;
}

// ============ Automations ============
export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  platform?: string;
  format?: string;
}

export interface AgentLastRun {
  _id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  itemsProcessed: number;
  itemsFailed: number;
  totalCostUsd: number;
  durationMs: number;
}

export interface AgentStatus {
  agent: AgentInfo;
  eligibleCount: number;
  isRunning: boolean;
  lastRun: AgentLastRun | null;
}

export interface AgentRunItem {
  itemId: string;
  itemType: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  outputId?: string;
}

export interface AgentRun {
  _id: string;
  agentId: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  itemsFound: number;
  itemsProcessed: number;
  itemsFailed: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalIterations: number;
  results?: AgentRunItem[];
  error: string;
  triggeredBy: string;
  durationMs: number;
  createdAt: string;
}

// ============ Settings / Integrations ============
export interface MetaIntegration {
  connected: boolean;
  accessToken?: string;
  pageId?: string;
  pageName?: string;
  igBusinessAccountId?: string;
  igUsername?: string;
  connectedAt?: string;
}

// ============ Journal ============
export interface JournalRecommendation {
  contentPillar: string;
  pillarWeight: string;
  format: string;
  calendarSlot: string | null;
  owner: 'shohini' | 'sanjoy';
  signalStrength: 'weak' | 'moderate' | 'strong';
  draftHook: string;
  icpResonance: string;
  keyMessageMatch: string;
  ninetyDayRelevance: string;
}

export interface JournalEntry {
  _id: string;
  author: 'shohini' | 'sanjoy';
  rawText: string;
  entryType: string | null;
  status: 'pending_analysis' | 'analysed' | 'accepted' | 'edited' | 'discarded';
  recommendation: JournalRecommendation | null;
  editedRecommendation: JournalRecommendation | null;
  founderDecision: 'accepted' | 'edited' | 'discarded' | null;
  signalFeedEntryId: string | null;
  aiCost: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    model: string;
    durationMs: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export const JOURNAL_ENTRY_TYPES = [
  { key: 'sales_call_insight', label: 'Sales Call Insight', emoji: '💬' },
  { key: 'market_observation', label: 'Market Observation', emoji: '🔍' },
  { key: 'product_update', label: 'Product Update', emoji: '⚡' },
  { key: 'customer_behaviour', label: 'Customer Behaviour', emoji: '🎯' },
  { key: 'founder_reflection', label: 'Founder Reflection', emoji: '💡' },
  { key: 'icp_language', label: 'ICP Language', emoji: '📣' },
] as const;

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
