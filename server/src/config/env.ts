import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/the-signal',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  FAL_KEY: process.env.FAL_KEY || '',
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
};

export function validateEnv(): void {
  const required: (keyof typeof env)[] = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    console.warn(`Warning: Missing env vars: ${missing.join(', ')}`);
  }
}
