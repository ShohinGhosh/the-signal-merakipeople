import { ContentHistory } from '../../models/ContentHistory';

// ─── Parse engagement metrics from the performanceNotes string ───
interface ParsedMetrics {
  likes: number;
  comments: number;
  reposts: number;
  impressions: number;
  engagementRate: number;
}

function parsePerformanceNotes(notes: string): ParsedMetrics | null {
  if (!notes || typeof notes !== 'string') return null;

  const likes = parseInt(notes.match(/(\d+)\s*likes?/i)?.[1] || '0');
  const comments = parseInt(notes.match(/(\d+)\s*comments?/i)?.[1] || '0');
  const reposts = parseInt(notes.match(/(\d+)\s*(?:reposts?|shares?)/i)?.[1] || '0');
  const impressions = parseInt(notes.match(/(\d+)\s*(?:impressions?|reach|views?)/i)?.[1] || '0');
  const engagementRate = parseFloat(notes.match(/([\d.]+)%?\s*eng/i)?.[1] || '0');

  if (impressions === 0 && likes === 0 && engagementRate === 0) return null;

  return { likes, comments, reposts, impressions, engagementRate };
}

// ─── Performance Insights ───
export interface PillarInsight {
  pillar: string;
  avgEngagement: number;
  totalImpressions: number;
  totalLikes: number;
  count: number;
}

export interface FormatInsight {
  format: string;
  avgEngagement: number;
  totalImpressions: number;
  count: number;
}

export interface ComboInsight {
  pillar: string;
  format: string;
  avgEngagement: number;
  count: number;
}

export interface TopPost {
  topic: string;
  hook: string;
  pillar: string;
  format: string;
  engagementRate: number;
  impressions: number;
  author: string;
}

export interface PerformanceInsights {
  byPillar: PillarInsight[];
  byFormat: FormatInsight[];
  byPillarFormat: ComboInsight[];
  topPosts: TopPost[];
  worstPosts: TopPost[];
  overallStats: {
    totalAnalyzed: number;
    avgEngagement: number;
    medianEngagement: number;
    totalImpressions: number;
  };
}

export async function getPerformanceInsights(author?: string): Promise<PerformanceInsights> {
  const filter: any = { performanceNotes: { $ne: '' } };
  if (author) filter.author = author;

  const entries = await ContentHistory.find(filter).lean();

  // Parse all entries with valid metrics
  const parsed: Array<{
    topic: string; hook: string; pillar: string; format: string;
    author: string; metrics: ParsedMetrics;
  }> = [];

  for (const e of entries) {
    const m = parsePerformanceNotes(e.performanceNotes);
    if (!m) continue;
    parsed.push({
      topic: e.topic,
      hook: e.hook || '',
      pillar: e.contentPillar || 'Unknown',
      format: e.format || 'text_post',
      author: e.author,
      metrics: m,
    });
  }

  if (parsed.length === 0) {
    return {
      byPillar: [], byFormat: [], byPillarFormat: [],
      topPosts: [], worstPosts: [],
      overallStats: { totalAnalyzed: 0, avgEngagement: 0, medianEngagement: 0, totalImpressions: 0 },
    };
  }

  // ── By Pillar ──
  const pillarMap = new Map<string, { engSum: number; impSum: number; likesSum: number; count: number }>();
  for (const p of parsed) {
    const curr = pillarMap.get(p.pillar) || { engSum: 0, impSum: 0, likesSum: 0, count: 0 };
    curr.engSum += p.metrics.engagementRate;
    curr.impSum += p.metrics.impressions;
    curr.likesSum += p.metrics.likes;
    curr.count++;
    pillarMap.set(p.pillar, curr);
  }
  const byPillar: PillarInsight[] = Array.from(pillarMap.entries())
    .map(([pillar, d]) => ({
      pillar, avgEngagement: +(d.engSum / d.count).toFixed(2),
      totalImpressions: d.impSum, totalLikes: d.likesSum, count: d.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // ── By Format ──
  const formatMap = new Map<string, { engSum: number; impSum: number; count: number }>();
  for (const p of parsed) {
    const curr = formatMap.get(p.format) || { engSum: 0, impSum: 0, count: 0 };
    curr.engSum += p.metrics.engagementRate;
    curr.impSum += p.metrics.impressions;
    curr.count++;
    formatMap.set(p.format, curr);
  }
  const byFormat: FormatInsight[] = Array.from(formatMap.entries())
    .map(([format, d]) => ({
      format, avgEngagement: +(d.engSum / d.count).toFixed(2),
      totalImpressions: d.impSum, count: d.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // ── By Pillar × Format Combo ──
  const comboMap = new Map<string, { engSum: number; count: number }>();
  for (const p of parsed) {
    const key = `${p.pillar}|||${p.format}`;
    const curr = comboMap.get(key) || { engSum: 0, count: 0 };
    curr.engSum += p.metrics.engagementRate;
    curr.count++;
    comboMap.set(key, curr);
  }
  const byPillarFormat: ComboInsight[] = Array.from(comboMap.entries())
    .map(([key, d]) => {
      const [pillar, format] = key.split('|||');
      return { pillar, format, avgEngagement: +(d.engSum / d.count).toFixed(2), count: d.count };
    })
    .filter(c => c.count >= 2)
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // ── Top & Worst Posts ──
  const sorted = [...parsed].sort((a, b) => b.metrics.engagementRate - a.metrics.engagementRate);
  const topPosts = sorted.slice(0, 5).map(p => ({
    topic: p.topic, hook: p.hook, pillar: p.pillar, format: p.format,
    engagementRate: p.metrics.engagementRate, impressions: p.metrics.impressions, author: p.author,
  }));
  const worstPosts = sorted.filter(p => p.metrics.impressions > 50)
    .slice(-5).reverse().map(p => ({
      topic: p.topic, hook: p.hook, pillar: p.pillar, format: p.format,
      engagementRate: p.metrics.engagementRate, impressions: p.metrics.impressions, author: p.author,
    }));

  // ── Overall Stats ──
  const engRates = parsed.map(p => p.metrics.engagementRate).sort((a, b) => a - b);
  const avgEng = +(engRates.reduce((a, b) => a + b, 0) / engRates.length).toFixed(2);
  const medianEng = +(engRates[Math.floor(engRates.length / 2)]).toFixed(2);
  const totalImp = parsed.reduce((a, p) => a + p.metrics.impressions, 0);

  return {
    byPillar, byFormat, byPillarFormat, topPosts, worstPosts,
    overallStats: { totalAnalyzed: parsed.length, avgEngagement: avgEng, medianEngagement: medianEng, totalImpressions: totalImp },
  };
}

// ─── Strategy Recommendations (rule-based, from performance data) ───
export interface StrategyRecommendation {
  type: 'pillar_shift' | 'format_shift' | 'combo_highlight' | 'general';
  recommendation: string;
  confidence: 'high' | 'medium' | 'low';
  dataPoints: string;
}

export function generateStrategyRecommendations(insights: PerformanceInsights): StrategyRecommendation[] {
  const recs: StrategyRecommendation[] = [];
  const { byPillar, byFormat, byPillarFormat, overallStats, topPosts } = insights;

  if (overallStats.totalAnalyzed < 5) {
    recs.push({
      type: 'general',
      recommendation: 'Need more published posts with engagement data for meaningful recommendations. Keep posting and tracking!',
      confidence: 'low',
      dataPoints: `Only ${overallStats.totalAnalyzed} posts analyzed`,
    });
    return recs;
  }

  const avgEng = overallStats.avgEngagement;
  const confidence = (count: number): 'high' | 'medium' | 'low' =>
    count >= 10 ? 'high' : count >= 5 ? 'medium' : 'low';

  // ── Pillar recommendations ──
  for (const p of byPillar) {
    if (p.count >= 3 && p.avgEngagement > avgEng * 1.5) {
      recs.push({
        type: 'pillar_shift',
        recommendation: `Increase "${p.pillar}" content — it outperforms your average by ${(p.avgEngagement / avgEng).toFixed(1)}x (${p.avgEngagement}% vs ${avgEng}% avg engagement).`,
        confidence: confidence(p.count),
        dataPoints: `${p.count} posts, ${p.totalImpressions.toLocaleString()} total impressions`,
      });
    }
    if (p.count >= 5 && p.avgEngagement < avgEng * 0.6) {
      recs.push({
        type: 'pillar_shift',
        recommendation: `Reduce "${p.pillar}" content or rethink the angle — it underperforms at ${p.avgEngagement}% vs your ${avgEng}% average.`,
        confidence: confidence(p.count),
        dataPoints: `${p.count} posts, ${p.avgEngagement}% avg engagement`,
      });
    }
  }

  // ── Format recommendations ──
  if (byFormat.length >= 2) {
    const best = byFormat[0];
    const worst = byFormat[byFormat.length - 1];
    if (best.count >= 3 && worst.count >= 3 && best.avgEngagement > worst.avgEngagement * 1.8) {
      recs.push({
        type: 'format_shift',
        recommendation: `Use more ${best.format.replace('_', ' ')}s — they get ${(best.avgEngagement / worst.avgEngagement).toFixed(1)}x the engagement of ${worst.format.replace('_', ' ')}s (${best.avgEngagement}% vs ${worst.avgEngagement}%).`,
        confidence: confidence(best.count),
        dataPoints: `${best.count} ${best.format}s vs ${worst.count} ${worst.format}s analyzed`,
      });
    }
  }

  // ── Best combo recommendation ──
  if (byPillarFormat.length > 0) {
    const bestCombo = byPillarFormat[0];
    if (bestCombo.count >= 3 && bestCombo.avgEngagement > avgEng * 1.3) {
      recs.push({
        type: 'combo_highlight',
        recommendation: `"${bestCombo.pillar}" + ${bestCombo.format.replace('_', ' ')} is your winning combo — ${bestCombo.avgEngagement}% avg engagement across ${bestCombo.count} posts.`,
        confidence: confidence(bestCombo.count),
        dataPoints: `${bestCombo.avgEngagement}% avg eng, ${bestCombo.count} posts`,
      });
    }
  }

  // ── Top post pattern ──
  if (topPosts.length >= 3) {
    const topPillars = topPosts.map(p => p.pillar);
    const mode = topPillars.sort((a, b) =>
      topPillars.filter(v => v === a).length - topPillars.filter(v => v === b).length
    ).pop();
    const modeCount = topPillars.filter(v => v === mode).length;
    if (modeCount >= 3) {
      recs.push({
        type: 'general',
        recommendation: `${modeCount} of your top 5 posts are about "${mode}" — this is clearly what your audience wants more of.`,
        confidence: 'high',
        dataPoints: `Top 5 posts analysis`,
      });
    }
  }

  return recs;
}

// ─── Build prompt augmentation string for calendar planner ───
export async function getPerformanceRecommendationsText(): Promise<string> {
  const insights = await getPerformanceInsights();
  if (insights.overallStats.totalAnalyzed === 0) return '';

  const recs = generateStrategyRecommendations(insights);
  if (recs.length === 0) return '';

  let text = '';
  for (const r of recs) {
    const badge = r.confidence.toUpperCase();
    text += `- [${badge}] ${r.recommendation} (${r.dataPoints})\n`;
  }
  return text;
}
