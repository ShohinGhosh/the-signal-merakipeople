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
 * If the template defines an output_schema, appends a JSON-only instruction to the
 * user prompt so the AI model returns structured output instead of conversational text.
 */
export function buildPrompt(
  promptName: string,
  context: Record<string, string>
): { systemPrompt: string; userPrompt: string; template: PromptTemplate } {
  const template = loadPrompt(promptName);
  const systemPrompt = interpolatePrompt(template.system_prompt, context);
  let userPrompt = interpolatePrompt(template.user_prompt, context);

  // Inject output_schema enforcement if the template defines one
  if (template.output_schema && Object.keys(template.output_schema).length > 0) {
    const schemaStr = JSON.stringify(template.output_schema, null, 2);
    userPrompt += `\n\nIMPORTANT: You MUST respond with ONLY valid JSON matching this schema. No markdown fences, no explanation, no text before or after the JSON object.\n${schemaStr}`;
  }

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
