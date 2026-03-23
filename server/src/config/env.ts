import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/the-signal',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  FAL_KEY: process.env.FAL_KEY || '',
  FAL_IMAGE_MODEL: process.env.FAL_IMAGE_MODEL || 'fal-ai/nano-banana-pro',
  AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
  AZURE_STORAGE_CONTAINER: process.env.AZURE_STORAGE_CONTAINER || 'signal-images',
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
};

export function validateEnv(): void {
  const required: (keyof typeof env)[] = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Fatal: Missing required env vars: ${missing.join(', ')}`);
  }

  if (!env.ANTHROPIC_API_KEY && !env.GEMINI_API_KEY) {
    console.warn('  Warning: Neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is set. AI features will fail.');
  } else {
    if (env.ANTHROPIC_API_KEY) console.log('  AI Provider: Claude (Anthropic) configured');
    if (env.GEMINI_API_KEY) console.log('  AI Provider: Gemini (Google) configured');
  }

  if (!env.FAL_KEY) {
    console.warn('  Warning: FAL_KEY is not set. Image generation will be unavailable.');
  }
}
