import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IJournalRecommendation {
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

export interface IJournal extends Document {
  author: 'shohini' | 'sanjoy';
  rawText: string;
  entryType: string | null;
  priority: 'normal' | 'high';
  status: 'pending_analysis' | 'analysed' | 'accepted' | 'edited' | 'discarded' | 'archived';
  recommendation: IJournalRecommendation | null;
  editedRecommendation: IJournalRecommendation | null;
  founderDecision: 'accepted' | 'edited' | 'discarded' | null;
  signalFeedEntryId: Types.ObjectId | null;
  aiCost: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    model: string;
    durationMs: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const RecommendationSchema = {
  contentPillar: { type: String, default: '' },
  pillarWeight: { type: String, default: '' },
  format: { type: String, default: '' },
  calendarSlot: { type: String, default: null },
  owner: { type: String, enum: ['shohini', 'sanjoy'], default: 'shohini' },
  signalStrength: { type: String, enum: ['weak', 'moderate', 'strong'], default: 'moderate' },
  draftHook: { type: String, default: '' },
  icpResonance: { type: String, default: '' },
  keyMessageMatch: { type: String, default: '' },
  ninetyDayRelevance: { type: String, default: '' },
};

const JournalSchema = new Schema<IJournal>(
  {
    author: { type: String, required: true, enum: ['shohini', 'sanjoy'] },
    rawText: { type: String, required: true },
    entryType: {
      type: String,
      enum: ['sales_call_insight', 'market_observation', 'product_update', 'customer_behaviour', 'founder_reflection', 'icp_language', null],
      default: null,
    },
    priority: {
      type: String,
      enum: ['normal', 'high'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: ['pending_analysis', 'analysed', 'accepted', 'edited', 'discarded', 'archived'],
      default: 'pending_analysis',
    },
    recommendation: {
      type: RecommendationSchema,
      default: null,
    },
    editedRecommendation: {
      type: RecommendationSchema,
      default: null,
    },
    founderDecision: {
      type: String,
      enum: ['accepted', 'edited', 'discarded', null],
      default: null,
    },
    signalFeedEntryId: { type: Schema.Types.ObjectId, ref: 'SignalFeed', default: null },
    aiCost: {
      type: {
        inputTokens: Number,
        outputTokens: Number,
        costUsd: Number,
        model: String,
        durationMs: Number,
      },
      default: null,
    },
  },
  { timestamps: true }
);

JournalSchema.index({ author: 1, createdAt: -1 });
JournalSchema.index({ status: 1 });

export const Journal = mongoose.model<IJournal>('Journal', JournalSchema);
