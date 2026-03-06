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
        owner: { type: String, enum: ['shohini', 'sanjoy', 'both'] },
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
    competitiveIntelligence: { type: String, default: '' },
    isCurrent: { type: Boolean, default: true },
    isComplete: { type: Boolean, default: false },
    onboardingProgress: {
      currentSection: { type: Number, default: 0 },
      totalSections: { type: Number, default: 5 },
      completedSections: [{ type: String }],
    },
    updatedBy: { type: String, default: '' },
    updateReason: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Strategy = mongoose.model<IStrategy>('Strategy', StrategySchema);
