import { Post } from '../../../models/Post';
import { AgentRun, IAgentRunItem } from '../../../models/AgentRun';
import { runAgentCritiqueLoop } from '../../ai/orchestrator';
import { gatherEvidenceContext } from '../../ai/evidenceEngine';

/**
 * Cross-Platform Repurpose Agent.
 * Takes ready/published LinkedIn posts and creates Instagram versions.
 */

export async function countEligible(): Promise<number> {
  // Find LinkedIn posts with content that don't have an Instagram counterpart
  const linkedinPosts = await Post.find({
    platform: 'linkedin',
    status: { $in: ['ready', 'published'] },
    draftContent: { $nin: ['', null] },
  }).select('_id').lean();

  if (linkedinPosts.length === 0) return 0;

  // Check which ones already have repurposed Instagram posts
  let eligible = 0;
  for (const lp of linkedinPosts) {
    const hasRepurpose = await Post.exists({
      notes: { $regex: `repurposed-from:${lp._id}` },
      platform: 'instagram',
    });
    if (!hasRepurpose) eligible++;
  }
  return eligible;
}

export async function execute(
  run: InstanceType<typeof AgentRun>,
  triggeredBy: string
): Promise<void> {
  const linkedinPosts = await Post.find({
    platform: 'linkedin',
    status: { $in: ['ready', 'published'] },
    draftContent: { $nin: ['', null] },
  }).lean();

  if (linkedinPosts.length === 0) {
    run.itemsFound = 0;
    await run.save();
    return;
  }

  // Filter to only those without an Instagram repurpose
  const eligiblePosts = [];
  for (const lp of linkedinPosts) {
    const hasRepurpose = await Post.exists({
      notes: { $regex: `repurposed-from:${lp._id}` },
      platform: 'instagram',
    });
    if (!hasRepurpose) eligiblePosts.push(lp);
  }

  run.itemsFound = eligiblePosts.length;
  await run.save();

  if (eligiblePosts.length === 0) return;

  for (const sourcPost of eligiblePosts) {
    try {
      const evidenceContext = await gatherEvidenceContext(sourcPost.author);

      const result = await runAgentCritiqueLoop({
        generatorPrompt: 'post-generator-instagram',
        critiquePrompt: 'post-critique',
        context: {
          ...evidenceContext,
          SIGNAL_TEXT: sourcPost.draftContent || '',
          PLATFORM: 'instagram',
          FORMAT: 'text_post',
          CONTENT_PILLAR: sourcPost.contentPillar || '',
        },
        operation: 'agent-cross-platform-repurpose',
        user: sourcPost.author,
        relatedId: String(sourcPost._id),
        relatedCollection: 'Post',
        maxIterations: 2,
        acceptThreshold: 7,
      });

      const parsed = result.parsed || {};

      const newPost = await Post.create({
        author: sourcPost.author,
        platform: 'instagram',
        format: parsed.format || 'text_post',
        contentPillar: sourcPost.contentPillar || '',
        draftContent: parsed.content || parsed.draftContent || result.content,
        linkedinHook: '',
        instagramHook: parsed.instagramHook || parsed.hook || '',
        cta: parsed.cta || '',
        hashtags: parsed.hashtags || [],
        status: 'draft',
        signalFeedId: sourcPost.signalFeedId || null,
        campaignId: sourcPost.campaignId || null,
        notes: `[repurposed-from:${sourcPost._id}] Repurposed from LinkedIn post`,
        aiEvidence: {
          strategyReferences: result.evidence.strategyReferences,
          dataPoints: result.evidence.dataPoints,
          signalFeedSources: [],
          confidenceScore: result.critique.score / 10,
          critiqueIterations: result.iterations,
          finalCritiqueScore: result.critique.score,
        },
      });

      run.itemsProcessed += 1;
      run.totalCostUsd += result.totalCostUsd;
      run.totalInputTokens += result.totalInputTokens;
      run.totalOutputTokens += result.totalOutputTokens;
      run.totalIterations += result.iterations;
      run.results.push({
        itemId: String(sourcPost._id),
        itemType: 'Post',
        status: 'success',
        outputId: String(newPost._id),
      } as IAgentRunItem);
      await run.save();

      console.log(`[Agent repurpose] Created Instagram post ${newPost._id} from LinkedIn ${sourcPost._id}`);
    } catch (err: any) {
      run.itemsFailed += 1;
      run.results.push({
        itemId: String(sourcPost._id),
        itemType: 'Post',
        status: 'failed',
        error: err.message,
      } as IAgentRunItem);
      await run.save();
      console.error(`[Agent repurpose] Failed ${sourcPost._id}:`, err.message);
    }
  }
}
