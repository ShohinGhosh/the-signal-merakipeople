import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentRunItem {
  itemId: string;
  itemType: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  outputId?: string;
}

export interface IAgentRun extends Document {
  agentId: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  itemsFound: number;
  itemsProcessed: number;
  itemsFailed: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalIterations: number;
  results: IAgentRunItem[];
  error: string;
  triggeredBy: string;
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const AgentRunSchema = new Schema<IAgentRun>(
  {
    agentId: { type: String, required: true, index: true },
    agentName: { type: String, required: true },
    status: { type: String, required: true, enum: ['running', 'completed', 'failed'], default: 'running' },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    itemsFound: { type: Number, default: 0 },
    itemsProcessed: { type: Number, default: 0 },
    itemsFailed: { type: Number, default: 0 },
    totalCostUsd: { type: Number, default: 0 },
    totalInputTokens: { type: Number, default: 0 },
    totalOutputTokens: { type: Number, default: 0 },
    totalIterations: { type: Number, default: 0 },
    results: [
      {
        itemId: String,
        itemType: String,
        status: { type: String, enum: ['success', 'failed', 'skipped'] },
        error: String,
        outputId: String,
      },
    ],
    error: { type: String, default: '' },
    triggeredBy: { type: String, default: 'manual' },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AgentRunSchema.index({ agentId: 1, createdAt: -1 });

export const AgentRun = mongoose.model<IAgentRun>('AgentRun', AgentRunSchema);
