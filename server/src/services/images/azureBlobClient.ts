import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { env } from '../../config/env';

let containerClient: ContainerClient | null = null;

/**
 * Lazy-init the Azure Blob Storage container client.
 * Returns null if Azure Storage is not configured.
 */
async function getContainerClient(): Promise<ContainerClient | null> {
  if (containerClient) return containerClient;
  if (!env.AZURE_STORAGE_CONNECTION_STRING) {
    return null;
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(env.AZURE_STORAGE_CONNECTION_STRING);
  const container = env.AZURE_STORAGE_CONTAINER || 'signal-images';
  containerClient = blobServiceClient.getContainerClient(container);

  // Ensure the container exists (create if it doesn't)
  await containerClient.createIfNotExists({ access: 'blob' });

  return containerClient;
}

/**
 * Uploads a buffer to Azure Blob Storage and returns the public URL.
 *
 * @param buffer - The image data
 * @param blobName - The blob name (e.g., "images/posts/post-123/0.png")
 * @param contentType - MIME type (default "image/png")
 * @returns The public blob URL
 */
export async function uploadImageToAzure(
  buffer: Buffer,
  blobName: string,
  contentType = 'image/png'
): Promise<string> {
  const client = await getContainerClient();
  if (!client) {
    throw new Error('Azure Blob Storage is not configured. Set AZURE_STORAGE_CONNECTION_STRING.');
  }

  const blockBlobClient = client.getBlockBlobClient(blobName);

  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

/**
 * Check if Azure Blob Storage is configured and available.
 */
export function isAzureConfigured(): boolean {
  return !!env.AZURE_STORAGE_CONNECTION_STRING;
}
