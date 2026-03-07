import mongoose, { Schema, Document } from 'mongoose';

export interface ICostLog extends Document {
  timestamp: Date;
  operation: string;
  aiModel: string;
  provider: 'claude' | 'gemini';
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  iteration: number;
  totalIterations: number;
  agentType: 'generator' | 'critique';
  user: string;
  relatedId: string;
  relatedCollection: string;
  promptName: string;
  durationMs: number;
}

// Claude pricing per 1M tokens
export const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250514': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-haiku-3-5': { input: 0.25, output: 1.25 },
};

// Gemini pricing per 1M tokens
export const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-2.0-pro': { input: 1.25, output: 10.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
};

// Combined pricing for all providers
export const AI_PRICING: Record<string, { input: number; output: number }> = {
  ...CLAUDE_PRICING,
  ...GEMINI_PRICING,
};

const CostLogSchema = new Schema<ICostLog>({
  timestamp: { type: Date, default: Date.now },
  operation: { type: String, required: true },
  aiModel: { type: String, required: true },
  provider: { type: String, enum: ['claude', 'gemini'], default: 'claude' },
  inputTokens: { type: Number, required: true },
  outputTokens: { type: Number, required: true },
  costUsd: { type: Number, required: true },
  iteration: { type: Number, default: 1 },
  totalIterations: { type: Number, default: 1 },
  agentType: { type: String, enum: ['generator', 'critique'], required: true },
  user: { type: String, default: '' },
  relatedId: { type: String, default: '' },
  relatedCollection: { type: String, default: '' },
  promptName: { type: String, default: '' },
  durationMs: { type: Number, default: 0 },
});

CostLogSchema.index({ timestamp: -1 });
CostLogSchema.index({ operation: 1, timestamp: -1 });

export const CostLog = mongoose.model<ICostLog>('CostLog', CostLogSchema);
