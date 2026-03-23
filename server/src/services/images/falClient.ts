import * as fal from '@fal-ai/serverless-client';
import { env } from '../../config/env';

let configured = false;

/**
 * Lazy-init the fal.ai client with the API key from env.
 */
function ensureConfigured(): void {
  if (configured) return;
  if (!env.FAL_KEY) {
    throw new Error('FAL_KEY is not set. Image generation is unavailable.');
  }
  fal.config({ credentials: env.FAL_KEY });
  configured = true;
}

export interface FalImageResult {
  /** Temporary URLs from fal.ai (expire after ~1 hour) */
  imageUrls: string[];
  /** Model used */
  model: string;
}

/**
 * Supported aspect ratios for Nano Banana Pro and compatible models.
 */
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

/**
 * Generate images using fal.ai (Nano Banana Pro by default).
 *
 * @param prompt - The image generation prompt
 * @param aspectRatio - Aspect ratio (default '1:1')
 * @param resolution - Resolution tier: '1K', '2K', or '4K' (default '1K')
 * @param numImages - Number of images to generate, 1-4 (default 1)
 * @returns Array of temporary image URLs from fal.ai
 */
export async function generateImage(
  prompt: string,
  aspectRatio: AspectRatio = '1:1',
  resolution: '1K' | '2K' | '4K' = '1K',
  numImages = 1
): Promise<FalImageResult> {
  ensureConfigured();

  const model = env.FAL_IMAGE_MODEL || 'fal-ai/nano-banana-pro';

  console.log(`[fal.ai] Generating ${numImages} image(s) with model ${model}`);

  const result = await fal.subscribe(model, {
    input: {
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      num_images: Math.min(numImages, 4),
      output_format: 'png',
    },
    logs: false,
  }) as any;

  // fal.ai response shape: { images: [{ url, content_type, width, height }], ... }
  const images = result?.images || result?.output?.images || [];
  const imageUrls = images.map((img: any) => img.url || img);

  if (imageUrls.length === 0) {
    throw new Error('fal.ai returned no images');
  }

  console.log(`[fal.ai] Generated ${imageUrls.length} image(s) successfully`);
  return { imageUrls, model };
}
