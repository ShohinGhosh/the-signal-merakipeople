import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface PromptTemplate {
  name: string;
  version: string;
  description: string;
  model: string;
  max_tokens: number;
  temperature: number;
  system_prompt: string;
  user_prompt: string;
  evidence_requirements: string[];
  output_schema: Record<string, any>;
}

const promptCache = new Map<string, { template: PromptTemplate; mtime: number }>();
const PROMPTS_DIR = path.resolve(__dirname, '../../prompts');

/**
 * Loads a prompt template from YAML, with file-modification caching
 * so edits to YAML files are picked up without restart.
 */
export function loadPrompt(promptName: string): PromptTemplate {
  const filePath = path.join(PROMPTS_DIR, `${promptName}.yaml`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt template not found: ${promptName} (looked in ${filePath})`);
  }

  const stat = fs.statSync(filePath);
  const cached = promptCache.get(promptName);

  if (cached && cached.mtime === stat.mtimeMs) {
    return cached.template;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const template = yaml.load(raw) as PromptTemplate;

  promptCache.set(promptName, { template, mtime: stat.mtimeMs });
  return template;
}

/**
 * Interpolates {{VARIABLE}} placeholders in a prompt string
 * with values from the provided context object.
 */
export function interpolatePrompt(template: string, context: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(context)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value || '');
  }
  return result;
}

/**
 * Builds a ready-to-use prompt pair (system + user) from a template name and context.
 */
export function buildPrompt(
  promptName: string,
  context: Record<string, string>
): { systemPrompt: string; userPrompt: string; template: PromptTemplate } {
  const template = loadPrompt(promptName);
  const systemPrompt = interpolatePrompt(template.system_prompt, context);
  const userPrompt = interpolatePrompt(template.user_prompt, context);
  return { systemPrompt, userPrompt, template };
}

/**
 * Lists all available prompt templates.
 */
export function listPrompts(): string[] {
  if (!fs.existsSync(PROMPTS_DIR)) return [];
  return fs
    .readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace('.yaml', ''));
}
