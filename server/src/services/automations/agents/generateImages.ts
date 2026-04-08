import { Post } from '../../../models/Post';
import { AgentRun, IAgentRunItem } from '../../../models/AgentRun';
import { runAgentCritiqueLoop } from '../../ai/orchestrator';
import { gatherEvidenceContext } from '../../ai/evidenceEngine';
import { generateAndStoreImage, isImageGenerationAvailable } from '../../images/imageService';
import { generateCarouselPdf } from '../../images/carouselPdfService';

/**
 * Generate Images Agent.
 * Takes ready/scheduled/draft posts with content but no image prompt,
 * and generates format-appropriate visual assets:
 *
 * - Image posts (reel, story): AI-generated image via fal.ai (1:1)
 * - Video posts (video_caption): AI-generated thumbnail via fal.ai (16:9)
 * - Carousel posts: PDF from slide outline + cover image
 * - Text posts, polls, documents: Skipped (no visual needed)
 */

/** Formats that need visual asset generation */
const VISUAL_FORMATS = ['carousel', 'reel', 'story', 'video_caption'];

/** Formats that are text-only and need no image */
const TEXT_ONLY_FORMATS = ['text_post', 'poll', 'document'];

export async function countEligible(): Promise<number> {
  return Post.countDocuments({
    status: { $in: ['ready', 'scheduled', 'draft'] },
    format: { $in: VISUAL_FORMATS },
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
    format: { $in: VISUAL_FORMATS },
    draftContent: { $nin: ['', null] },
    imagePrompt: { $in: ['', null] },
  }).sort({ scheduledAt: 1 });

  run.itemsFound = posts.length;
  await run.save();

  if (posts.length === 0) return;

  for (const post of posts) {
    try {
      const format = post.format?.toLowerCase() || '';

      // ── CAROUSEL: Generate PDF from slide outline ──
      if (format === 'carousel') {
        await handleCarousel(post);
        run.itemsProcessed += 1;
        run.results.push({
          itemId: String(post._id),
          itemType: 'Post',
          status: 'success',
          outputId: String(post._id),
        } as IAgentRunItem);
        await run.save();
        console.log(`[Agent generate-images] Carousel PDF generated for post ${post._id}`);
        continue;
      }

      // ── VIDEO: Generate thumbnail (16:9) ──
      // ── IMAGE: Generate post graphic (1:1) ──
      const isVideo = format === 'video_caption';
      const imageType = isVideo ? 'thumbnail' : 'post_graphic';
      const aspectRatio = isVideo ? '16:9' : '1:1';

      const evidenceContext = await gatherEvidenceContext(post.author, post.campaignId?.toString());

      const result = await runAgentCritiqueLoop({
        generatorPrompt: 'image-prompt-builder',
        critiquePrompt: 'image-prompt-critique',
        context: {
          ...evidenceContext,
          POST_CONTENT: post.draftContent || post.finalContent || '',
          PLATFORM: post.platform,
          IMAGE_TYPE: imageType,
          CUSTOM_PROMPT: isVideo
            ? 'Create a compelling video thumbnail. Bold visual, high contrast, eye-catching. Include visual cues that suggest video content (motion, energy). 16:9 aspect ratio.'
            : '',
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
      post.imageType = imageType;

      // Generate actual images via fal.ai + upload to storage
      if (isImageGenerationAvailable()) {
        try {
          const imageResult = await generateAndStoreImage(
            generatedPrompt,
            String(post._id),
            1,
            aspectRatio as any
          );
          post.imageUrl = imageResult.imageUrl;
          post.imageVariations = imageResult.imageVariations;
          console.log(`[Agent generate-images] ${isVideo ? 'Thumbnail' : 'Image'} rendered for post ${post._id}: ${imageResult.imageUrl}`);
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

      console.log(`[Agent generate-images] Generated ${isVideo ? 'thumbnail' : 'image'} prompt for post ${post._id}`);
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

/**
 * Handle carousel format: generate PDF from slide outline + optional cover image
 */
async function handleCarousel(post: InstanceType<any>): Promise<void> {
  const slides = post.draftCarouselOutline || [];

  if (slides.length > 0) {
    // Generate carousel PDF with AI-generated slide images (Nano Banana Pro)
    const pdfResult = await generateCarouselPdf(
      slides,
      String(post._id),
      post.contentPillar || 'Carousel',
      post.author || ''
    );
    post.carouselPdfUrl = pdfResult.pdfUrl;
    post.imageType = 'carousel_pdf';
    post.imagePrompt = `Carousel PDF: ${slides.length} slides (AI-generated images)`;
    console.log(`[Agent generate-images] Carousel PDF: ${pdfResult.slideCount} slides → ${pdfResult.pdfUrl}`);

    // Use the first slide image as the cover/preview image
    if (pdfResult.slideImageUrls.length > 0) {
      post.imageUrl = pdfResult.slideImageUrls[0];
      post.imageVariations = pdfResult.slideImageUrls;
    }
  }

  await post.save();
}
