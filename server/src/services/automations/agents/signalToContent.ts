import { Post } from '../../../models/Post';
import { SignalFeed } from '../../../models/SignalFeed';
import { AgentRun, IAgentRunItem } from '../../../models/AgentRun';
import { runAgentCritiqueLoop } from '../../ai/orchestrator';
import { gatherEvidenceContext } from '../../ai/evidenceEngine';

/**
 * Signal → Content Agent.
 * Finds confirmed content_seed signals not yet linked to any post,
 * and generates draft LinkedIn posts from them.
 */

export async function countEligible(): Promise<number> {
  // Find confirmed content_seed signals that haven't been linked to a post
  const signals = await SignalFeed.find({
    status: 'confirmed',
    routing: 'content_seed',
  }).lean();

  if (signals.length === 0) return 0;

  const signalIds = signals.map((s: any) => s._id);
  const linkedCount = await Post.countDocuments({
    signalFeedId: { $in: signalIds },
  });

  return signals.length - linkedCount;
}

export async function execute(
  run: InstanceType<typeof AgentRun>,
  triggeredBy: string
): Promise<void> {
  // Find confirmed content_seed signals
  const signals = await SignalFeed.find({
    status: 'confirmed',
    routing: 'content_seed',
  }).lean();

  if (signals.length === 0) {
    run.itemsFound = 0;
    await run.save();
    return;
  }

  // Filter out signals already linked to posts
  const signalIds = signals.map((s: any) => s._id);
  const linkedPosts = await Post.find({
    signalFeedId: { $in: signalIds },
  }).select('signalFeedId').lean();

  const linkedSignalIds = new Set(linkedPosts.map((p) => String(p.signalFeedId)));
  const unlinkedSignals = signals.filter((s: any) => !linkedSignalIds.has(String(s._id)));

  run.itemsFound = unlinkedSignals.length;
  await run.save();

  if (unlinkedSignals.length === 0) return;

  for (const signal of unlinkedSignals) {
    try {
      const author = (signal as any).author || 'shohini';
      const evidenceContext = await gatherEvidenceContext(author);

      const result = await runAgentCritiqueLoop({
        generatorPrompt: 'post-generator-linkedin',
        critiquePrompt: 'post-critique',
        context: {
          ...evidenceContext,
          SIGNAL_TEXT: (signal as any).rawText || '',
          PLATFORM: 'linkedin',
          FORMAT: 'text_post',
          CONTENT_PILLAR: (signal as any).aiClassification?.contentPillar || '',
        },
        operation: 'agent-signal-to-content',
        user: author,
        relatedId: String((signal as any)._id),
        relatedCollection: 'SignalFeed',
        maxIterations: 2,
        acceptThreshold: 7,
      });

      const parsed = result.parsed || {};

      // Create new post from signal
      const post = await Post.create({
        author,
        platform: 'linkedin',
        format: 'text_post',
        contentPillar: (signal as any).aiClassification?.contentPillar || parsed.pillar || '',
        draftContent: parsed.content || parsed.draftContent || result.content,
        linkedinHook: parsed.linkedinHook || parsed.hook || '',
        instagramHook: '',
        cta: parsed.cta || '',
        hashtags: parsed.hashtags || [],
        status: 'draft',
        signalFeedId: (signal as any)._id,
        notes: `[Source: signal — ${(signal as any).rawText?.substring(0, 100)}]`,
        aiEvidence: {
          strategyReferences: result.evidence.strategyReferences,
          dataPoints: result.evidence.dataPoints,
          signalFeedSources: [String((signal as any)._id)],
          confidenceScore: result.critique.score / 10,
          critiqueIterations: result.iterations,
          finalCritiqueScore: result.critique.score,
        },
      });

      // Update signal status
      await SignalFeed.findByIdAndUpdate((signal as any)._id, { status: 'in_calendar' });

      run.itemsProcessed += 1;
      run.totalCostUsd += result.totalCostUsd;
      run.totalInputTokens += result.totalInputTokens;
      run.totalOutputTokens += result.totalOutputTokens;
      run.totalIterations += result.iterations;
      run.results.push({
        itemId: String((signal as any)._id),
        itemType: 'SignalFeed',
        status: 'success',
        outputId: String(post._id),
      } as IAgentRunItem);
      await run.save();

      console.log(`[Agent signal-to-content] Created post ${post._id} from signal ${(signal as any)._id}`);
    } catch (err: any) {
      run.itemsFailed += 1;
      run.results.push({
        itemId: String((signal as any)._id),
        itemType: 'SignalFeed',
        status: 'failed',
        error: err.message,
      } as IAgentRunItem);
      await run.save();
      console.error(`[Agent signal-to-content] Failed signal ${(signal as any)._id}:`, err.message);
    }
  }
}
