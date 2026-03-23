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

/**
 * Makes a Gemini vision call with an image + text prompt.
 * Accepts base64 image data (with or without data URI prefix).
 */
export async function callGeminiVision(params: {
  prompt: string;
  imageBase64: string;
  mimeType?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<GeminiCallResult> {
  const genAI = getGeminiClient();
  const modelName = params.model || 'gemini-2.0-flash';

  const model: GenerativeModel = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: params.maxTokens || 2000,
      temperature: params.temperature ?? 0.3,
    },
  });

  // Strip data URI prefix if present
  let base64Data = params.imageBase64;
  let mimeType = params.mimeType || 'image/png';
  if (base64Data.startsWith('data:')) {
    const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
  }

  const result = await model.generateContent([
    params.prompt,
    { inlineData: { mimeType, data: base64Data } },
  ]);

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
