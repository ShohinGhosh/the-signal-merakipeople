import { Strategy } from '../../models/Strategy';
import { Post } from '../../models/Post';
import { SignalFeed } from '../../models/SignalFeed';
import { Lead } from '../../models/Lead';
import { FoundationDocument } from '../../models/FoundationDocument';

export interface EvidenceContext {
  STRATEGY_CONTEXT: string;
  AUTHOR_VOICE: string;
  CAMPAIGN_CONTEXT: string;
  PERFORMANCE_CONTEXT: string;
  RECENT_SIGNALS: string;
  PIPELINE_CONTEXT: string;
  FOUNDATION_DOCS: string;
}

/**
 * Gathers evidence from the database to provide context for AI prompts.
 * All AI responses are grounded in actual data from the system.
 */
export async function gatherEvidenceContext(author?: string, campaignId?: string): Promise<EvidenceContext> {
  // Get current strategy
  const strategy = await Strategy.findOne({ isCurrent: true });
  const strategyContext = strategy
    ? JSON.stringify({
        northStar: strategy.northStar,
        goal90Day: strategy.goal90Day,
        icpPrimary: strategy.icpPrimary,
        icpSecondary: strategy.icpSecondary,
        antiIcp: strategy.antiIcp,
        positioningStatement: strategy.positioningStatement,
        contentPillars: strategy.contentPillars,
        keyMessages: strategy.keyMessages,
        bannedPhrases: strategy.bannedPhrases,
        metricsTargets: strategy.metricsTargets,
        competitiveIntelligence: strategy.competitiveIntelligence,
      })
    : 'No strategy configured yet.';

  // Get author voice
  let authorVoice = '';
  if (strategy && author) {
    if (author === 'shohini') {
      authorVoice = `Voice profile: ${strategy.voiceShohini}\nShared tone: ${strategy.sharedTone}`;
    } else if (author === 'sanjoy') {
      authorVoice = `Voice profile: ${strategy.voiceSanjoy}\nShared tone: ${strategy.sharedTone}`;
    }
    if (strategy.bannedPhrases?.length) {
      authorVoice += `\nBanned phrases: ${strategy.bannedPhrases.join(', ')}`;
    }
  }

  // Get active campaign if specified
  let campaignContext = 'No active campaign.';
  if (campaignId) {
    const { Campaign } = await import('../../models/Campaign');
    const campaign = await Campaign.findById(campaignId);
    if (campaign) {
      campaignContext = JSON.stringify({
        name: campaign.name,
        goal: campaign.goal,
        targetSegment: campaign.targetSegment,
        contentBrief: campaign.contentBrief,
        platforms: campaign.platforms,
        successMetric: campaign.successMetric,
      });
    }
  }

  // Get recent top-performing posts (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const topPosts = await Post.find({
    status: 'published',
    publishedAt: { $gte: thirtyDaysAgo },
    'performance.engagementRate': { $gt: 0 },
  })
    .sort({ 'performance.engagementRate': -1 })
    .limit(3)
    .lean();

  const performanceContext =
    topPosts.length > 0
      ? `Top 3 performing posts this month:\n${topPosts
          .map(
            (p, i) =>
              `${i + 1}. [${p.contentPillar}] ${p.linkedinHook || p.instagramHook || 'No hook'} — Engagement: ${p.performance?.engagementRate || 0}%`
          )
          .join('\n')}`
      : 'No published posts with performance data yet.';

  // Get recent signal feed entries
  const recentSignals = await SignalFeed.find({ status: { $ne: 'archived' } })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const recentSignalsContext =
    recentSignals.length > 0
      ? recentSignals
          .map((s) => `[${s.author}] [${s.tags?.join(', ') || 'untagged'}] ${s.rawText.substring(0, 150)}`)
          .join('\n')
      : 'No recent signal feed entries.';

  // Get pipeline summary
  const leads = await Lead.find({
    stage: { $nin: ['SIGNED', 'LOST'] },
  }).lean();

  const pipelineContext = `Active pipeline: ${leads.length} leads. Stages: ${
    leads.reduce(
      (acc, l) => {
        acc[l.stage] = (acc[l.stage] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
      ? JSON.stringify(
          leads.reduce(
            (acc, l) => {
              acc[l.stage] = (acc[l.stage] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          )
        )
      : 'empty'
  }`;

  // Get active foundation documents
  const foundationDocs = await FoundationDocument.find({ isActive: true })
    .select('title docType extractedText')
    .lean();

  const foundationDocsContext =
    foundationDocs.length > 0
      ? foundationDocs
          .map((d) => {
            // Truncate very long docs to ~4000 chars each to stay within prompt limits
            const text = (d.extractedText || '').substring(0, 4000);
            return `--- ${d.title} (${d.docType}) ---\n${text}`;
          })
          .join('\n\n')
      : '';

  return {
    STRATEGY_CONTEXT: strategyContext,
    AUTHOR_VOICE: authorVoice,
    CAMPAIGN_CONTEXT: campaignContext,
    PERFORMANCE_CONTEXT: performanceContext,
    RECENT_SIGNALS: recentSignalsContext,
    PIPELINE_CONTEXT: pipelineContext,
    FOUNDATION_DOCS: foundationDocsContext,
  };
}
