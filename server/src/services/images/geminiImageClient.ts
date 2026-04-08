import { env } from '../../config/env';

export interface GeminiImageResult {
  /** PNG image as a Buffer */
  buffer: Buffer;
  /** MIME type (typically image/png) */
  mimeType: string;
}

/**
 * Generate an image using Gemini's native image generation via REST API.
 * Uses gemini-2.0-flash-exp-image-generation model.
 * No additional SDK needed — just fetch + GEMINI_API_KEY.
 */
export async function generateImageWithGemini(prompt: string): Promise<GeminiImageResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Image generation via Gemini is unavailable.');
  }

  const model = 'gemini-3.1-flash-image-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  console.log(`[gemini-image] Generating image with ${model}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini image API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      console.log(`[gemini-image] Image generated: ${(buffer.length / 1024).toFixed(1)} KB (${part.inlineData.mimeType})`);
      return {
        buffer,
        mimeType: part.inlineData.mimeType || 'image/png',
      };
    }
  }

  throw new Error('Gemini returned no image in response');
}

/**
 * Check if Gemini image generation is available.
 */
export function isGeminiImageAvailable(): boolean {
  return !!env.GEMINI_API_KEY;
}
