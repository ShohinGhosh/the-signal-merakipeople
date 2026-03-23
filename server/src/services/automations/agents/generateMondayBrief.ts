import { AgentRun, IAgentRunItem } from '../../../models/AgentRun';
import { AnalyticsWeekly } from '../../../models/index';
import { runAgentCritiqueLoop } from '../../ai/orchestrator';
import { Post } from '../../../models/Post';
import { Lead } from '../../../models/Lead';
import { Strategy } from '../../../models/Strategy';

/**
 * Monday Brief Agent.
 * Compiles weekly analytics and generates the Monday brief.
 */

function getCurrentMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export async function countEligible(): Promise<number> {
  // Check if there's a Monday brief for the current week
  // AnalyticsWeekly imported at top level
  const weekStart = getCurrentMonday();
  const existing = await AnalyticsWeekly.findOne({
    weekStart: {
      $gte: weekStart,
      $lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
    mondayBriefGenerated: true,
  });
  return existing ? 0 : 1;
}

export async function execute(
  run: InstanceType<typeof AgentRun>,
  triggeredBy: string
): Promise<void> {
  // AnalyticsWeekly imported at top level

  const weekStart = getCurrentMonday();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Check if already generated
  const existing = await AnalyticsWeekly.findOne({
    weekStart: { $gte: weekStart, $lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
    mondayBriefGenerated: true,
  });

  if (existing) {
    run.itemsFound = 0;
    await run.save();
    return;
  }

  run.itemsFound = 1;
  await run.save();

  try {
    // Gather performance data for the brief
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const [postsThisWeek, postsLastWeek, strategy, leads] = await Promise.all([
      Post.find({
        status: 'published',
        publishedAt: { $gte: lastWeekStart, $lt: weekStart },
      }).lean(),
      Post.find({
        status: 'published',
        publishedAt: { $gte: new Date(lastWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000), $lt: lastWeekStart },
      }).lean(),
      Strategy.findOne({ isCurrent: true }),
      Lead.find({ stage: { $nin: ['SIGNED', 'LOST'] } }).lean(),
    ]);

    // Build performance summary
    const thisWeekStats = {
      total: postsThisWeek.length,
      linkedin: postsThisWeek.filter((p) => p.platform === 'linkedin' || p.platform === 'both').length,
      instagram: postsThisWeek.filter((p) => p.platform === 'instagram' || p.platform === 'both').length,
      avgEngagement: postsThisWeek.length > 0
        ? postsThisWeek.reduce((sum, p) => sum + (p.performance?.engagementRate || 0), 0) / postsThisWeek.length
        : 0,
    };

    const context: Record<string, string> = {
      WEEK_START: weekStart.toISOString().slice(0, 10),
      POSTS_PUBLISHED_THIS_WEEK: String(thisWeekStats.total),
      LINKEDIN_POSTS: String(thisWeekStats.linkedin),
      INSTAGRAM_POSTS: String(thisWeekStats.instagram),
      AVG_ENGAGEMENT: thisWeekStats.avgEngagement.toFixed(2),
      POSTS_LAST_WEEK: String(postsLastWeek.length),
      TOP_POSTS: postsThisWeek
        .sort((a, b) => (b.performance?.engagementRate || 0) - (a.performance?.engagementRate || 0))
        .slice(0, 3)
        .map((p, i) => `${i + 1}. [${p.contentPillar}] ${p.linkedinHook || p.instagramHook || 'untitled'} — ${p.performance?.engagementRate || 0}%`)
        .join('\n') || 'No published posts with performance data',
      PIPELINE_SUMMARY: `${leads.length} active leads`,
      NORTH_STAR: strategy?.northStar || 'Not set',
      GOAL_90_DAY: strategy?.goal90Day || 'Not set',
      CONTENT_PILLARS: (strategy?.contentPillars || []).map((p) => `${p.name} (${p.targetPercent}%)`).join(', ') || 'None',
    };

    const result = await runAgentCritiqueLoop({
      generatorPrompt: 'monday-brief',
      critiquePrompt: 'monday-brief-critique',
      context,
      operation: 'agent-monday-brief',
      user: triggeredBy,
      maxIterations: 2,
      acceptThreshold: 7,
    });

    // Save or update the analytics weekly record
    const weeklyRecord = await AnalyticsWeekly.findOneAndUpdate(
      {
        weekStart: { $gte: weekStart, $lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
      {
        weekStart,
        mondayBriefGenerated: true,
        mondayBriefContent: result.content,
        postsPublished: {
          linkedin: {
            shohini: postsThisWeek.filter((p) => (p.platform === 'linkedin' || p.platform === 'both') && p.author === 'shohini').length,
            sanjoy: postsThisWeek.filter((p) => (p.platform === 'linkedin' || p.platform === 'both') && p.author === 'sanjoy').length,
          },
          instagram: {
            shohini: postsThisWeek.filter((p) => (p.platform === 'instagram' || p.platform === 'both') && p.author === 'shohini').length,
            sanjoy: postsThisWeek.filter((p) => (p.platform === 'instagram' || p.platform === 'both') && p.author === 'sanjoy').length,
          },
        },
      },
      { upsert: true, new: true }
    );

    run.itemsProcessed = 1;
    run.totalCostUsd = result.totalCostUsd;
    run.totalInputTokens = result.totalInputTokens;
    run.totalOutputTokens = result.totalOutputTokens;
    run.totalIterations = result.iterations;
    run.results.push({
      itemId: String(weeklyRecord._id),
      itemType: 'AnalyticsWeekly',
      status: 'success',
      outputId: String(weeklyRecord._id),
    } as IAgentRunItem);
    await run.save();

    console.log(`[Agent monday-brief] Generated Monday brief for ${weekStart.toISOString().slice(0, 10)}`);
  } catch (err: any) {
    run.itemsFailed = 1;
    run.results.push({
      itemId: 'monday-brief',
      itemType: 'AnalyticsWeekly',
      status: 'failed',
      error: err.message,
    } as IAgentRunItem);
    await run.save();
    console.error('[Agent monday-brief] Failed:', err.message);
  }
}
