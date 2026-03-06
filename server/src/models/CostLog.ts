import mongoose, { Schema, Document } from 'mongoose';

export interface ICostLog extends Document {
  timestamp: Date;
  operation: string;
  model: string;
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

// Claude pricing per 1M tokens (claude-sonnet-4-5 as of 2025)
export const CLAUDE_PRICING = {
  'claude-sonnet-4-5-20250514': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-haiku-3-5': { input: 0.25, output: 1.25 },
};

const CostLogSchema = new Schema<ICostLog>({
  timestamp: { type: Date, default: Date.now },
  operation: { type: String, required: true },
  model: { type: String, required: true },
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
