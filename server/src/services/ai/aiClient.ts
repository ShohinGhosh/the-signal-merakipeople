import { callClaude } from './claudeClient';
import { callGemini } from './geminiClient';
import { env } from '../../config/env';

export type AIProvider = 'claude' | 'gemini';

export interface AICallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: AIProvider;
  stopReason: string | null;
}

export interface AICallParams {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Force a specific provider. Default: auto-detect based on available keys */
  provider?: AIProvider;
  /** If true, falls back to the other provider on error. Default: true */
  enableFallback?: boolean;
}

/** Maps Claude model names to Gemini equivalents for fallback */
const GEMINI_MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-5-20250514': 'gemini-2.0-flash',
  'claude-sonnet-4-5': 'gemini-2.0-flash',
  'claude-3-5-sonnet-20241022': 'gemini-2.0-flash',
  'claude-haiku-3-5': 'gemini-2.0-flash',
};

function getDefaultProvider(): AIProvider {
  if (env.ANTHROPIC_API_KEY) return 'claude';
  if (env.GEMINI_API_KEY) return 'gemini';
  throw new Error('No AI provider API key configured (ANTHROPIC_API_KEY or GEMINI_API_KEY)');
}

function toGeminiModel(claudeModel?: string): string {
  if (!claudeModel) return 'gemini-2.0-flash';
  return GEMINI_MODEL_MAP[claudeModel] || claudeModel;
}

async function callWithClaude(params: AICallParams): Promise<AICallResult> {
  const result = await callClaude({
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    model: params.model,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
  });
  return {
    content: result.content,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
    provider: 'claude',
    stopReason: result.stopReason,
  };
}

async function callWithGemini(params: AICallParams): Promise<AICallResult> {
  const geminiModel = toGeminiModel(params.model);
  const result = await callGemini({
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    model: geminiModel,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
  });
  return {
    content: result.content,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
    provider: 'gemini',
    stopReason: result.finishReason,
  };
}

/**
 * Unified AI caller with automatic provider fallback.
 * Claude is the default generator; Gemini is the default critique agent.
 * If the primary provider fails, automatically falls back to the other.
 */
export async function callAI(params: AICallParams): Promise<AICallResult> {
  const enableFallback = params.enableFallback !== false;
  const primaryProvider = params.provider || getDefaultProvider();

  const callPrimary = primaryProvider === 'claude' ? callWithClaude : callWithGemini;
  const callFallback = primaryProvider === 'claude' ? callWithGemini : callWithClaude;
  const fallbackProvider: AIProvider = primaryProvider === 'claude' ? 'gemini' : 'claude';

  try {
    return await callPrimary(params);
  } catch (error) {
    if (!enableFallback) throw error;

    // Check if fallback provider has a key
    const fallbackHasKey = fallbackProvider === 'gemini' ? !!env.GEMINI_API_KEY : !!env.ANTHROPIC_API_KEY;
    if (!fallbackHasKey) throw error;

    console.warn(
      `[AI Fallback] ${primaryProvider} failed, falling back to ${fallbackProvider}:`,
      (error as Error).message
    );

    return await callFallback(params);
  }
}
