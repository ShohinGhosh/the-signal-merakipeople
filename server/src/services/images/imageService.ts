import { generateImage, AspectRatio } from './falClient';
import { generateImageWithGemini, isGeminiImageAvailable } from './geminiImageClient';
import { uploadImageToAzure, isAzureConfigured } from './azureBlobClient';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ImageGenerationResult {
  /** The primary image URL (Azure Blob, local, or fal.ai temp URL) */
  imageUrl: string;
  /** All variation URLs */
  imageVariations: string[];
  /** Whether images are stored permanently in Azure */
  isPermanent: boolean;
  /** The image prompt that was used */
  prompt: string;
}

/**
 * High-level image generation orchestrator.
 *
 * Flow:
 * 1. Try Gemini if available (no FAL_KEY needed)
 * 2. Fall back to fal.ai if FAL_KEY is set
 * 3. Upload to Azure if configured, otherwise serve locally
 */
export async function generateAndStoreImage(
  prompt: string,
  postId: string,
  numVariations = 1,
  aspectRatio: AspectRatio = '1:1'
): Promise<ImageGenerationResult> {
  let imageBuffer: Buffer | null = null;

  // Strategy 1: Try Gemini (preferred — uses existing GEMINI_API_KEY)
  if (isGeminiImageAvailable()) {
    try {
      console.log(`[imageService] Generating cover image via Gemini...`);
      const result = await generateImageWithGemini(prompt);
      imageBuffer = result.buffer;
    } catch (err: any) {
      console.warn(`[imageService] Gemini image generation failed: ${err.message}`);
    }
  }

  // Strategy 2: Fall back to fal.ai
  if (!imageBuffer && process.env.FAL_KEY) {
    try {
      console.log(`[imageService] Generating cover image via fal.ai...`);
      const falResult = await generateImage(prompt, aspectRatio, '1K', numVariations);

      if (isAzureConfigured()) {
        const permanentUrls: string[] = [];
        for (let i = 0; i < falResult.imageUrls.length; i++) {
          const tempUrl = falResult.imageUrls[i];
          const buffer = await fetchImageBuffer(tempUrl);
          const blobName = `posts/${postId}/${i}.png`;
          const azureUrl = await uploadImageToAzure(buffer, blobName);
          permanentUrls.push(azureUrl);
        }
        return { imageUrl: permanentUrls[0], imageVariations: permanentUrls, isPermanent: true, prompt };
      }

      return { imageUrl: falResult.imageUrls[0], imageVariations: falResult.imageUrls, isPermanent: false, prompt };
    } catch (err: any) {
      console.warn(`[imageService] fal.ai image generation failed: ${err.message}`);
    }
  }

  // If we have a Gemini buffer, store it
  if (imageBuffer) {
    if (isAzureConfigured()) {
      try {
        const blobName = `posts/${postId}/cover.png`;
        const azureUrl = await uploadImageToAzure(imageBuffer, blobName);
        console.log(`[imageService] Cover image uploaded to Azure: ${blobName}`);
        return { imageUrl: azureUrl, imageVariations: [azureUrl], isPermanent: true, prompt };
      } catch (azureErr: any) {
        console.warn(`[imageService] Azure upload failed, saving locally: ${azureErr.message}`);
      }
    }

    // Save locally and serve via API
    const tmpDir = path.join(os.tmpdir(), 'signal-covers');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `${postId}.png`);
    fs.writeFileSync(tmpPath, imageBuffer);
    console.log(`[imageService] Cover image saved locally: ${tmpPath}`);

    const localUrl = `/api/posts/${postId}/cover-image`;
    return { imageUrl: localUrl, imageVariations: [localUrl], isPermanent: false, prompt };
  }

  throw new Error('No image generation provider available (need GEMINI_API_KEY or FAL_KEY)');
}

/**
 * Fetches an image from a URL and returns it as a Buffer.
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Check if image generation is available (Gemini or FAL_KEY).
 */
export function isImageGenerationAvailable(): boolean {
  return isGeminiImageAvailable() || !!(process.env.FAL_KEY);
}
