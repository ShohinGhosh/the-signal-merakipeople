import { CostLog, AI_PRICING, CLAUDE_PRICING } from '../../models/CostLog';
import type { AIProvider } from './aiClient';

export interface CostEntry {
  operation: string;
  model: string;
  provider?: AIProvider;
  inputTokens: number;
  outputTokens: number;
  iteration: number;
  totalIterations: number;
  agentType: 'generator' | 'critique';
  user?: string;
  relatedId?: string;
  relatedCollection?: string;
  promptName?: string;
  durationMs?: number;
}

/**
 * Calculates USD cost from token counts based on model pricing.
 * Supports both Claude and Gemini models.
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = AI_PRICING[model];

  if (!pricing) {
    // Fallback to cheapest Claude pricing for unknown models
    const fallback = CLAUDE_PRICING['claude-sonnet-4-5'];
    return (inputTokens / 1_000_000) * fallback.input + (outputTokens / 1_000_000) * fallback.output;
  }

  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

/**
 * Logs a single AI API call to the cost_logs collection.
 */
export async function logCost(entry: CostEntry): Promise<void> {
  const costUsd = calculateCost(entry.model, entry.inputTokens, entry.outputTokens);

  await CostLog.create({
    timestamp: new Date(),
    operation: entry.operation,
    aiModel: entry.model,
    provider: entry.provider || 'claude',
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    costUsd,
    iteration: entry.iteration,
    totalIterations: entry.totalIterations,
    agentType: entry.agentType,
    user: entry.user || '',
    relatedId: entry.relatedId || '',
    relatedCollection: entry.relatedCollection || '',
    promptName: entry.promptName || '',
    durationMs: entry.durationMs || 0,
  });
}

/**
 * Gets cost summary for a date range.
 */
export async function getCostSummary(startDate: Date, endDate: Date) {
  const logs = await CostLog.find({
    timestamp: { $gte: startDate, $lte: endDate },
  });

  const totalCost = logs.reduce((sum, log) => sum + log.costUsd, 0);
  const totalInputTokens = logs.reduce((sum, log) => sum + log.inputTokens, 0);
  const totalOutputTokens = logs.reduce((sum, log) => sum + log.outputTokens, 0);
  const totalCalls = logs.length;

  const byOperation: Record<string, { calls: number; cost: number }> = {};
  const byProvider: Record<string, { calls: number; cost: number }> = {};
  for (const log of logs) {
    if (!byOperation[log.operation]) {
      byOperation[log.operation] = { calls: 0, cost: 0 };
    }
    byOperation[log.operation].calls++;
    byOperation[log.operation].cost += log.costUsd;

    const prov = log.provider || 'claude';
    if (!byProvider[prov]) {
      byProvider[prov] = { calls: 0, cost: 0 };
    }
    byProvider[prov].calls++;
    byProvider[prov].cost += log.costUsd;
  }

  return { totalCost, totalInputTokens, totalOutputTokens, totalCalls, byOperation, byProvider };
}
