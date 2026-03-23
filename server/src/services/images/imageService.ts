import { generateImage } from './falClient';
import { uploadImageToAzure, isAzureConfigured } from './azureBlobClient';

export interface ImageGenerationResult {
  /** The primary image URL (Azure Blob or fal.ai temp URL) */
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
 * 1. Call fal.ai (Nano Banana Pro) to generate image(s) from the prompt
 * 2. If Azure Blob is configured: fetch temp URLs → upload buffer to Azure → return permanent URLs
 * 3. If Azure is NOT configured: return fal.ai temp URLs (they expire in ~1 hour)
 *
 * @param prompt - The image generation prompt
 * @param postId - Post ID (used for blob naming)
 * @param numVariations - Number of image variations to generate (default 1)
 */
export async function generateAndStoreImage(
  prompt: string,
  postId: string,
  numVariations = 1
): Promise<ImageGenerationResult> {
  // Step 1: Generate via fal.ai (Nano Banana Pro)
  const falResult = await generateImage(prompt, '1:1', '1K', numVariations);

  // Step 2: Upload to Azure Blob Storage if configured, otherwise return temp URLs
  if (isAzureConfigured()) {
    const permanentUrls: string[] = [];

    for (let i = 0; i < falResult.imageUrls.length; i++) {
      const tempUrl = falResult.imageUrls[i];
      const buffer = await fetchImageBuffer(tempUrl);
      const blobName = `posts/${postId}/${i}.png`;
      const azureUrl = await uploadImageToAzure(buffer, blobName);
      permanentUrls.push(azureUrl);
      console.log(`[imageService] Uploaded image ${i} to Azure: ${blobName}`);
    }

    return {
      imageUrl: permanentUrls[0],
      imageVariations: permanentUrls,
      isPermanent: true,
      prompt,
    };
  }

  // Azure not configured — return temp URLs with a warning
  console.warn('[imageService] Azure Blob not configured. Returning temporary fal.ai URLs (expire in ~1 hour).');

  return {
    imageUrl: falResult.imageUrls[0],
    imageVariations: falResult.imageUrls,
    isPermanent: false,
    prompt,
  };
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
 * Check if image generation is available (FAL_KEY is set).
 */
export function isImageGenerationAvailable(): boolean {
  return !!(process.env.FAL_KEY);
}
