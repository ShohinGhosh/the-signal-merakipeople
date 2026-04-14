import { Post } from '../../../models/Post';
import { SignalFeed } from '../../../models/SignalFeed';
import { AgentRun, IAgentRunItem } from '../../../models/AgentRun';
import { runAgentCritiqueLoop } from '../../ai/orchestrator';
import { gatherEvidenceContext } from '../../ai/evidenceEngine';
import { hasContentFields } from '../../ai/jsonExtractor';
import { getIntelligenceContext } from '../../feedback/intelligenceService';

/**
 * Content Drafter Agent Factory.
 * Creates agents that generate full post content for a specific platform + format combination.
 * These agents find draft posts with topic briefs but empty draftContent and fill them.
 */

export async function countEligible(platform: string, format: string): Promise<number> {
  return Post.countDocuments({
    status: 'draft',
    platform: { $in: [platform, 'both'] },
    format,
    draftContent: { $in: ['', null] },
    notes: { $nin: ['', null] }, // must have a topic brief
    scheduledAt: { $ne: null },
  });
}

export async function execute(
  platform: string,
  format: string,
  run: InstanceType<typeof AgentRun>,
  triggeredBy: string
): Promise<void> {
  // Find eligible posts
  const posts = await Post.find({
    status: 'draft',
    platform: { $in: [platform, 'both'] },
    format,
    draftContent: { $in: ['', null] },
    notes: { $nin: ['', null] },
    scheduledAt: { $ne: null },
  }).sort({ scheduledAt: 1 });

  run.itemsFound = posts.length;
  await run.save();

  if (posts.length === 0) return;

  // Group by author to gather evidence once per author
  const authorPosts: Record<string, typeof posts> = {};
  for (const post of posts) {
    if (!authorPosts[post.author]) authorPosts[post.author] = [];
    authorPosts[post.author].push(post);
  }

  const generatorPrompt = platform === 'instagram'
    ? 'post-generator-instagram'
    : 'post-generator-linkedin';

  for (const [author, authorPostsList] of Object.entries(authorPosts)) {
    // Gather evidence once per author
    const evidenceContext = await gatherEvidenceContext(author);

    for (const post of authorPostsList) {
      try {
        // Fetch the actual signal raw text if this post is linked to a signal
        let signalFeedEntry = '';
        if (post.signalFeedId) {
          const signal = await SignalFeed.findById(post.signalFeedId).lean();
          if (signal) {
            signalFeedEntry = `ORIGINAL FOUNDER INSIGHT (THIS IS THE PRIMARY INPUT — the post MUST be about this):\n"${(signal as any).rawText}"\n\nTags: ${((signal as any).tags || []).join(', ')}`;
          }
        }

        // Get feedback intelligence for self-learning
        let feedbackIntel = '';
        try {
          const intel = await getIntelligenceContext(format, platform, post.contentPillar);
          feedbackIntel = intel.promptAugmentation || '';
        } catch { /* non-blocking */ }

        const result = await runAgentCritiqueLoop({
          generatorPrompt,
          critiquePrompt: 'post-critique',
          context: {
            ...evidenceContext,
            SIGNAL_FEED_ENTRY: signalFeedEntry || `Topic brief: ${post.notes || 'No topic brief provided'}`,
            SIGNAL_TEXT: post.notes || '',
            PLATFORM: platform,
            FORMAT: format,
            CONTENT_PILLAR: post.contentPillar || '',
            FEEDBACK_INTELLIGENCE: feedbackIntel,
          },
          operation: `agent-draft-${platform}-${format}`,
          user: author,
          relatedId: String(post._id),
          relatedCollection: 'Post',
          maxIterations: 2,
          acceptThreshold: 7,
        });

        const parsed = result.parsed || {};
        const useParsed = hasContentFields(parsed);

        // Update the post with generated content — only use parsed fields if they contain real content
        post.draftContent = useParsed ? (parsed.body || parsed.content || parsed.caption || parsed.draftContent) : result.content;
        post.linkedinHook = useParsed ? (parsed.linkedinHook || parsed.hook || post.linkedinHook) : post.linkedinHook;
        post.instagramHook = useParsed ? (parsed.instagramHook || parsed.hook || post.instagramHook) : post.instagramHook;
        post.cta = useParsed ? (parsed.cta || post.cta) : post.cta;
        post.hashtags = useParsed ? (parsed.hashtags || post.hashtags) : post.hashtags;

        // Handle carousel outline if format is carousel
        if (format === 'carousel' && parsed.carouselOutline && Array.isArray(parsed.carouselOutline)) {
          post.draftCarouselOutline = parsed.carouselOutline.map((slide: any, idx: number) => ({
            slideNumber: slide.slideNumber || idx + 1,
            content: slide.headline ? `${slide.headline}\n${slide.bodyText || ''}` : slide.content || slide.text || '',
            type: idx === 0 ? 'hook' : (idx === parsed.carouselOutline.length - 1 ? 'cta' : 'content'),
          }));
        }

        post.aiEvidence = {
          strategyReferences: result.evidence.strategyReferences,
          dataPoints: result.evidence.dataPoints,
          signalFeedSources: post.aiEvidence?.signalFeedSources || [],
          confidenceScore: result.critique.score / 10,
          critiqueIterations: result.iterations,
          finalCritiqueScore: result.critique.score,
        };

        await post.save();

        run.itemsProcessed += 1;
        run.totalCostUsd += result.totalCostUsd;
        run.totalInputTokens += result.totalInputTokens;
        run.totalOutputTokens += result.totalOutputTokens;
        run.totalIterations += result.iterations;
        run.results.push({
          itemId: String(post._id),
          itemType: 'Post',
          status: 'success',
          outputId: String(post._id),
        } as IAgentRunItem);
        await run.save();

        console.log(`[Agent draft-${platform}-${format}] Drafted post ${post._id} for ${author}`);
      } catch (err: any) {
        run.itemsFailed += 1;
        run.results.push({
          itemId: String(post._id),
          itemType: 'Post',
          status: 'failed',
          error: err.message,
        } as IAgentRunItem);
        await run.save();
        console.error(`[Agent draft-${platform}-${format}] Failed post ${post._id}:`, err.message);
      }
    }
  }
}
