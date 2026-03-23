import { Post } from '../../../models/Post';
import { AgentRun, IAgentRunItem } from '../../../models/AgentRun';
import { runAgentCritiqueLoop } from '../../ai/orchestrator';
import { gatherEvidenceContext } from '../../ai/evidenceEngine';
import { generateAndStoreImage, isImageGenerationAvailable } from '../../images/imageService';

/**
 * Generate Images Agent.
 * Takes ready/scheduled posts with content but no image prompt,
 * and generates image prompts for them.
 */

export async function countEligible(): Promise<number> {
  return Post.countDocuments({
    status: { $in: ['ready', 'scheduled', 'draft'] },
    draftContent: { $nin: ['', null] },
    imagePrompt: { $in: ['', null] },
  });
}

export async function execute(
  run: InstanceType<typeof AgentRun>,
  triggeredBy: string
): Promise<void> {
  const posts = await Post.find({
    status: { $in: ['ready', 'scheduled', 'draft'] },
    draftContent: { $nin: ['', null] },
    imagePrompt: { $in: ['', null] },
  }).sort({ scheduledAt: 1 });

  run.itemsFound = posts.length;
  await run.save();

  if (posts.length === 0) return;

  for (const post of posts) {
    try {
      const evidenceContext = await gatherEvidenceContext(post.author, post.campaignId?.toString());

      const result = await runAgentCritiqueLoop({
        generatorPrompt: 'image-prompt-builder',
        critiquePrompt: 'image-prompt-critique',
        context: {
          ...evidenceContext,
          POST_CONTENT: post.draftContent || post.finalContent || '',
          PLATFORM: post.platform,
          IMAGE_TYPE: post.imageType || 'post_graphic',
          CUSTOM_PROMPT: '',
          CONTENT_PILLAR: post.contentPillar || '',
        },
        operation: 'agent-generate-image-prompt',
        user: post.author,
        relatedId: String(post._id),
        relatedCollection: 'Post',
        maxIterations: 2,
        acceptThreshold: 7,
      });

      const parsed = result.parsed || {};
      const generatedPrompt = parsed.imagePrompt || parsed.prompt || result.content;

      post.imagePrompt = generatedPrompt;
      if (!post.imageType) post.imageType = 'post_graphic';

      // Generate actual images via fal.ai + upload to S3
      if (isImageGenerationAvailable()) {
        try {
          const imageResult = await generateAndStoreImage(
            generatedPrompt,
            String(post._id),
            1
          );
          post.imageUrl = imageResult.imageUrl;
          post.imageVariations = imageResult.imageVariations;
          console.log(`[Agent generate-images] Image rendered for post ${post._id}: ${imageResult.imageUrl}`);
        } catch (imgErr: any) {
          console.warn(`[Agent generate-images] Image rendering failed for post ${post._id}, prompt saved:`, imgErr.message);
        }
      }

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

      console.log(`[Agent generate-images] Generated image prompt for post ${post._id}`);
    } catch (err: any) {
      run.itemsFailed += 1;
      run.results.push({
        itemId: String(post._id),
        itemType: 'Post',
        status: 'failed',
        error: err.message,
      } as IAgentRunItem);
      await run.save();
      console.error(`[Agent generate-images] Failed post ${post._id}:`, err.message);
    }
  }
}
