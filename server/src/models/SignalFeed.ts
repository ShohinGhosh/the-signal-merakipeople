import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAIClassification {
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

export interface ISignalFeed extends Document {
  author: 'shohini' | 'sanjoy';
  rawText: string;
  tags: string[];
  urlReference: string;
  aiClassification: IAIClassification;
  routing: 'strategy_update' | 'content_seed' | 'campaign_fuel' | 'archive';
  campaignId: Types.ObjectId | null;
  status: 'pending' | 'confirmed' | 'in_calendar' | 'published' | 'archived';
  strategyUpdateProposed: Record<string, any>;
  strategyUpdateAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SignalFeedSchema = new Schema<ISignalFeed>(
  {
    author: { type: String, required: true, enum: ['shohini', 'sanjoy'] },
    rawText: { type: String, required: true },
    tags: [{ type: String }],
    urlReference: { type: String, default: '' },
    aiClassification: {
      insightType: String,
      contentPillar: String,
      timeliness: { type: String, enum: ['timely', 'evergreen'] },
      strategyRelevance: String,
      contradictions: [String],
      confidence: Number,
      evidence: {
        strategyReferences: [String],
        reasoning: String,
      },
      critiqueScore: Number,
      critiqueIterations: Number,
      critiqueFeedback: String,
    },
    routing: {
      type: String,
      enum: ['strategy_update', 'content_seed', 'campaign_fuel', 'archive'],
    },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', default: null },
    status: {
      type: String,
      default: 'pending',
      enum: ['pending', 'confirmed', 'in_calendar', 'published', 'archived'],
    },
    strategyUpdateProposed: { type: Schema.Types.Mixed, default: null },
    strategyUpdateAccepted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const SignalFeed = mongoose.model<ISignalFeed>('SignalFeed', SignalFeedSchema);
