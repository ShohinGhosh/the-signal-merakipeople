import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScoreBreakdown {
  postingConsistency: number;
  pipelineActivity: number;
  strategyAlignment: number;
  engagementHealth: number;
}

export interface IAIRecommendation {
  recommendation: string;
  reasoning: string;
  evidence: string[];
  accepted: boolean | null;
  dismissedAt: Date | null;
}

export interface IPillarPerformance {
  pillar: string;
  postsCount: number;
  avgEngagement: number;
  leadsGenerated: number;
  actualPercent: number;
  targetPercent: number;
}

export interface IAnalyticsWeekly extends Document {
  weekStart: Date;
  signalScore: number;
  scoreBreakdown: IScoreBreakdown;
  postsPublished: {
    linkedin: { shohini: number; sanjoy: number };
    instagram: { shohini: number; sanjoy: number };
  };
  topPostId: Types.ObjectId | null;
  pipelineNewLeads: number;
  pipelineDemos: number;
  pipelineSigned: number;
  pillarPerformance: IPillarPerformance[];
  aiRecommendations: IAIRecommendation[];
  mondayBriefGenerated: boolean;
  mondayBriefContent: string;
  createdAt: Date;
}

const AnalyticsWeeklySchema = new Schema<IAnalyticsWeekly>(
  {
    weekStart: { type: Date, required: true, unique: true },
    signalScore: { type: Number, default: 0 },
    scoreBreakdown: {
      postingConsistency: { type: Number, default: 0 },
      pipelineActivity: { type: Number, default: 0 },
      strategyAlignment: { type: Number, default: 0 },
      engagementHealth: { type: Number, default: 0 },
    },
    postsPublished: {
      linkedin: {
        shohini: { type: Number, default: 0 },
        sanjoy: { type: Number, default: 0 },
      },
      instagram: {
        shohini: { type: Number, default: 0 },
        sanjoy: { type: Number, default: 0 },
      },
    },
    topPostId: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    pipelineNewLeads: { type: Number, default: 0 },
    pipelineDemos: { type: Number, default: 0 },
    pipelineSigned: { type: Number, default: 0 },
    pillarPerformance: [
      {
        pillar: String,
        postsCount: Number,
        avgEngagement: Number,
        leadsGenerated: Number,
        actualPercent: Number,
        targetPercent: Number,
      },
    ],
    aiRecommendations: [
      {
        recommendation: String,
        reasoning: String,
        evidence: [String],
        accepted: { type: Boolean, default: null },
        dismissedAt: { type: Date, default: null },
      },
    ],
    mondayBriefGenerated: { type: Boolean, default: false },
    mondayBriefContent: { type: String, default: '' },
  },
  { timestamps: true }
);

export const AnalyticsWeekly = mongoose.model<IAnalyticsWeekly>('AnalyticsWeekly', AnalyticsWeeklySchema);
