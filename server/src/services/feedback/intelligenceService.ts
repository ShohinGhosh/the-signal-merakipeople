import Feedback, { IFeedback } from '../../models/Feedback';

/**
 * The Intelligence Layer — aggregates user feedback into actionable patterns
 * that are injected into AI prompts for self-learning content improvement.
 */

interface FeedbackPattern {
  pattern: string;
  count: number;
  recentExamples: string[];
}

interface IntelligenceContext {
  /** Aggregated feedback rules to inject into prompts */
  promptAugmentation: string;
  /** Dynamic quick-fix suggestions based on feedback history */
  quickFixes: string[];
  /** Stats for transparency */
  stats: {
    totalFeedback: number;
    approvalRate: number;
    topIssues: string[];
  };
}

/**
 * Get dynamic quick-fix buttons for a specific content type.
 * Analyzes recent negative feedback to surface the most common complaints
 * as one-click fix buttons.
 */
export async function getDynamicQuickFixes(
  format: string,
  platform: string,
  field: string = 'content'
): Promise<string[]> {
  // Default quick fixes that always show
  const defaults: Record<string, string[]> = {
    content: ['Shorter', 'More direct', 'Stronger hook'],
    image: ['More vibrant', 'Simpler design', 'Different style'],
    carousel: ['Fewer slides', 'More visual', 'Stronger CTA slide'],
    thumbnail: ['More eye-catching', 'Cleaner layout', 'Add text overlay'],
  };

  const baseDefaults = defaults[field] || defaults.content;

  // Get recent negative feedback for this format+platform+field combo
  const recentNegative = await Feedback.find({
    rating: 'down',
    field,
    ...(format && { format }),
    ...(platform && { platform }),
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  if (recentNegative.length === 0) {
    return baseDefaults;
  }

  // Count feedback text patterns
  const patternCounts = new Map<string, number>();

  for (const fb of recentNegative) {
    const text = (fb.feedbackText || fb.quickFixUsed || '').toLowerCase().trim();
    if (!text) continue;

    // Normalize common patterns
    const normalized = normalizePattern(text);
    patternCounts.set(normalized, (patternCounts.get(normalized) || 0) + 1);
  }

  // Sort by frequency and take top patterns
  const sorted = [...patternCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pattern]) => capitalizeFirst(pattern));

  // Merge: frequent feedback patterns first, then fill with defaults
  const seen = new Set(sorted.map((s) => s.toLowerCase()));
  const merged = [...sorted];
  for (const d of baseDefaults) {
    if (!seen.has(d.toLowerCase())) {
      merged.push(d);
    }
  }

  return merged.slice(0, 6);
}

/**
 * Build prompt augmentation from accumulated feedback.
 * This is the core of the self-learning system — past feedback
 * is aggregated into rules that are injected into the AI prompt.
 */
export async function getIntelligenceContext(
  format?: string,
  platform?: string,
  contentPillar?: string
): Promise<IntelligenceContext> {
  // Get all feedback, with optional filters
  const filter: Record<string, any> = {};
  if (format) filter.format = format;
  if (platform) filter.platform = platform;

  const allFeedback = await Feedback.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const total = allFeedback.length;
  const approvals = allFeedback.filter((f) => f.rating === 'up').length;
  const rejections = allFeedback.filter((f) => f.rating === 'down');

  // Extract patterns from negative feedback
  const issuePatterns: FeedbackPattern[] = [];
  const issueCounts = new Map<string, { count: number; examples: string[] }>();

  for (const fb of rejections) {
    const text = fb.feedbackText || fb.quickFixUsed || '';
    if (!text) continue;
    const key = normalizePattern(text);
    const existing = issueCounts.get(key) || { count: 0, examples: [] };
    existing.count++;
    if (existing.examples.length < 3) existing.examples.push(text);
    issueCounts.set(key, existing);
  }

  for (const [pattern, data] of issueCounts) {
    issuePatterns.push({
      pattern,
      count: data.count,
      recentExamples: data.examples,
    });
  }

  issuePatterns.sort((a, b) => b.count - a.count);

  // Build prompt augmentation text
  const lines: string[] = [];

  if (issuePatterns.length > 0) {
    lines.push('USER FEEDBACK INTELLIGENCE (learn from past corrections):');
    for (const p of issuePatterns.slice(0, 8)) {
      lines.push(`  - AVOID: "${p.pattern}" (flagged ${p.count} time${p.count > 1 ? 's' : ''})`);
    }
  }

  // Extract positive patterns from thumbs-up feedback
  const approvedFeedback = allFeedback.filter((f) => f.rating === 'up' && f.contentBefore);
  if (approvedFeedback.length > 0) {
    lines.push('');
    lines.push('USER PREFERENCES (content that was approved):');

    // Analyze approved content characteristics
    const avgLength = Math.round(
      approvedFeedback.reduce((sum, f) => sum + (f.contentBefore?.length || 0), 0) /
        approvedFeedback.length
    );
    lines.push(`  - Preferred content length: ~${avgLength} characters`);

    // Look for approved quick-fix patterns (what the user tends to request)
    const approvedAfterFixes = rejections
      .filter((f) => f.quickFixUsed)
      .map((f) => f.quickFixUsed!);

    if (approvedAfterFixes.length > 0) {
      const fixCounts = new Map<string, number>();
      for (const fix of approvedAfterFixes) {
        const key = normalizePattern(fix);
        fixCounts.set(key, (fixCounts.get(key) || 0) + 1);
      }
      const topFixes = [...fixCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [fix, count] of topFixes) {
        lines.push(`  - User frequently requests: "${fix}" (${count}x)`);
      }
    }
  }

  // Pillar-specific feedback
  if (contentPillar) {
    const pillarFeedback = rejections.filter(
      (f) => f.contentPillar?.toLowerCase() === contentPillar.toLowerCase()
    );
    if (pillarFeedback.length > 0) {
      lines.push('');
      lines.push(`PILLAR-SPECIFIC NOTES for "${contentPillar}":`);
      const pillarIssues = new Map<string, number>();
      for (const fb of pillarFeedback) {
        const text = fb.feedbackText || fb.quickFixUsed || '';
        if (text) {
          const key = normalizePattern(text);
          pillarIssues.set(key, (pillarIssues.get(key) || 0) + 1);
        }
      }
      for (const [issue, count] of [...pillarIssues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
        lines.push(`  - "${issue}" (${count}x)`);
      }
    }
  }

  return {
    promptAugmentation: lines.join('\n'),
    quickFixes: await getDynamicQuickFixes(format || '', platform || ''),
    stats: {
      totalFeedback: total,
      approvalRate: total > 0 ? Math.round((approvals / total) * 100) : 0,
      topIssues: issuePatterns.slice(0, 5).map((p) => p.pattern),
    },
  };
}

// ─── Helpers ───

function normalizePattern(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.!?,;:]+$/g, '') // strip trailing punctuation
    .replace(/\s+/g, ' ')
    .replace(/^(make it |make |please |can you )/i, '') // strip politeness prefixes
    .replace(/^(too |very |really |extremely )/i, 'too '); // normalize intensity
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
