import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { env } from '../../config/env';

let client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!client) {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return client;
}

export interface GeminiCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  finishReason: string | null;
}

/**
 * Makes a single Gemini API call and returns structured result with token counts.
 */
export async function callGemini(params: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<GeminiCallResult> {
  const genAI = getGeminiClient();
  const modelName = params.model || 'gemini-2.0-flash';

  const model: GenerativeModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: params.systemPrompt,
    generationConfig: {
      maxOutputTokens: params.maxTokens || 2000,
      temperature: params.temperature ?? 0.7,
    },
  });

  const result = await model.generateContent(params.userPrompt);
  const response = result.response;
  const content = response.text();
  const usageMetadata = response.usageMetadata;

  return {
    content,
    inputTokens: usageMetadata?.promptTokenCount || 0,
    outputTokens: usageMetadata?.candidatesTokenCount || 0,
    model: modelName,
    finishReason: response.candidates?.[0]?.finishReason || null,
  };
}
