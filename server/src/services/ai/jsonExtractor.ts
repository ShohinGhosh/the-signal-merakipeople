/**
 * Robust JSON extraction utility.
 *
 * AI models sometimes wrap valid JSON in markdown fences, conversational preamble,
 * or other text. This utility tries multiple strategies to extract the JSON object.
 *
 * Strategy order:
 * 1. Direct JSON.parse() on the full string
 * 2. Extract from markdown code fences (```json ... ```)
 * 3. Match the outermost { ... } braces
 */

/**
 * Attempts to extract a JSON object from an AI response string.
 * Returns the parsed object on success, or null if no valid JSON is found.
 */
export function extractJSON(raw: string): Record<string, any> | null {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();

  // Strategy 1: Direct parse (content is pure JSON)
  try {
    const result = JSON.parse(trimmed);
    if (typeof result === 'object' && result !== null) {
      return result;
    }
  } catch {
    // Not pure JSON, try other strategies
  }

  // Strategy 2: Extract from markdown code fences
  // Matches ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      const result = JSON.parse(fenceMatch[1].trim());
      if (typeof result === 'object' && result !== null) {
        return result;
      }
    } catch {
      // Fence content wasn't valid JSON
    }
  }

  // Strategy 3: Match outermost { ... } braces
  // This handles cases where AI adds preamble text before/after the JSON
  const braceMatch = trimmed.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      const result = JSON.parse(braceMatch[0]);
      if (typeof result === 'object' && result !== null) {
        return result;
      }
    } catch {
      // Brace content wasn't valid JSON — could be nested or malformed
    }
  }

  return null;
}

/**
 * Checks whether a parsed result contains meaningful content fields.
 * Used to prevent saving empty parsed objects when JSON extraction
 * technically succeeds but doesn't contain expected content.
 */
export function hasContentFields(parsed: Record<string, any> | null): boolean {
  if (!parsed) return false;

  // Check for any of the known content field names across different prompt schemas
  const contentFields = [
    'body', 'content', 'caption', 'draftContent',
    'hook', 'linkedinHook', 'instagramHook',
    'cta', 'hashtags',
  ];

  return contentFields.some((field) => {
    const val = parsed[field];
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    return false;
  });
}
