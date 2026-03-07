import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface ClaudeCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  stopReason: string | null;
}

/**
 * Makes a single Claude API call and returns structured result with token counts.
 */
export async function callClaude(params: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<ClaudeCallResult> {
  const claude = getClaudeClient();

  const response = await claude.messages.create({
    model: params.model || 'claude-3-5-sonnet-20241022',
    max_tokens: params.maxTokens || 2000,
    temperature: params.temperature ?? 0.7,
    system: params.systemPrompt,
    messages: [{ role: 'user', content: params.userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const content = textBlock ? textBlock.text : '';

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
    stopReason: response.stop_reason,
  };
}
