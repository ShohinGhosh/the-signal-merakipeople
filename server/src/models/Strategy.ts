import mongoose, { Schema, Document } from 'mongoose';

export interface IContentPillar {
  name: string;
  purpose: string;
  targetPercent: number;
  examplePostTypes: string[];
  owner: 'shohini' | 'sanjoy' | 'both';
}

export interface IPlatformStrategy {
  platform: string;
  primaryPurpose: string;
  weeklyTarget: number;
  bestFormats: string[];
  bestPostingTimes: string[];
}

export interface IMetricsTargets {
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

export interface IPlatformBenchmarks {
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

export interface IRawInputs {
  section1_businessContext: string;
  section2_goalsMetrics: string;
  section3_currentState: string;
  section3a_platformMetrics: string;
  section4_voicePositioning: string;
  section5_campaigns: string;
}

export interface IStrategy extends Document {
  version: number;
  northStar: string;
  goal90Day: string;
  icpPrimary: Record<string, any>;
  icpSecondary: Record<string, any>;
  antiIcp: string;
  positioningStatement: string;
  contentPillars: IContentPillar[];
  voiceShohini: string;
  voiceSanjoy: string;
  sharedTone: string;
  bannedPhrases: string[];
  platformStrategy: IPlatformStrategy[];
  keyMessages: string[];
  objectionContent: Record<string, string>[];
  clientRoster: Record<string, any>[];
  metricsTargets: IMetricsTargets;
  platformBenchmarks: IPlatformBenchmarks;
  platformConfig: {
    platform: string;
    status: 'active' | 'planned' | 'inactive';
    launchDate?: Date | null;
    notes?: string;
  }[];
  competitiveIntelligence: string;
  isCurrent: boolean;
  isComplete: boolean;
  rawInputs: IRawInputs;
  onboardingProgress: {
    currentSection: number;
    totalSections: number;
    completedSections: string[];
  };
  updatedBy: string;
  updateReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const StrategySchema = new Schema<IStrategy>(
  {
    version: { type: Number, default: 1 },
    northStar: { type: String, default: '' },
    goal90Day: { type: String, default: '' },
    icpPrimary: { type: Schema.Types.Mixed, default: {} },
    icpSecondary: { type: Schema.Types.Mixed, default: {} },
    antiIcp: { type: String, default: '' },
    positioningStatement: { type: String, default: '' },
    contentPillars: [
      {
        name: String,
        purpose: String,
        targetPercent: Number,
        examplePostTypes: [String],
        owner: { type: String },
      },
    ],
    voiceShohini: { type: String, default: '' },
    voiceSanjoy: { type: String, default: '' },
    sharedTone: { type: String, default: '' },
    bannedPhrases: [{ type: String }],
    platformStrategy: [
      {
        platform: String,
        primaryPurpose: String,
        weeklyTarget: Number,
        bestFormats: [String],
        bestPostingTimes: [String],
      },
    ],
    keyMessages: [{ type: String }],
    objectionContent: [{ type: Schema.Types.Mixed }],
    clientRoster: [{ type: Schema.Types.Mixed }],
    metricsTargets: {
      linkedinFollowers: Number,
      linkedinEngagementRate: Number,
      linkedinDmsPerWeek: Number,
      instagramFollowers: Number,
      instagramReach: Number,
      leadsPerMonth: Number,
      demoToCloseRate: Number,
      mrrTarget: Number,
      trainingRevenueTarget: Number,
    },
    platformBenchmarks: { type: Schema.Types.Mixed, default: {} },
    platformConfig: {
      type: [
        {
          platform: { type: String, required: true },
          status: { type: String, enum: ['active', 'planned', 'inactive'], default: 'planned' },
          launchDate: { type: Date, default: null },
          notes: { type: String, default: '' },
        },
      ],
      default: [
        { platform: 'linkedin', status: 'active', launchDate: null, notes: '' },
        { platform: 'instagram', status: 'planned', launchDate: null, notes: '' },
        { platform: 'facebook', status: 'planned', launchDate: null, notes: '' },
      ],
    },
    competitiveIntelligence: { type: String, default: '' },
    isCurrent: { type: Boolean, default: true },
    isComplete: { type: Boolean, default: false },
    rawInputs: {
      section1_businessContext: { type: String, default: '' },
      section2_goalsMetrics: { type: String, default: '' },
      section3_currentState: { type: String, default: '' },
      section3a_platformMetrics: { type: String, default: '' },
      section4_voicePositioning: { type: String, default: '' },
      section5_campaigns: { type: String, default: '' },
    },
    onboardingProgress: {
      currentSection: { type: Number, default: 0 },
      totalSections: { type: Number, default: 6 },
      completedSections: [{ type: String }],
    },
    updatedBy: { type: String, default: '' },
    updateReason: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Strategy = mongoose.model<IStrategy>('Strategy', StrategySchema);
