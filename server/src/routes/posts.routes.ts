import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Post } from '../models/Post';
import { SignalFeed } from '../models/SignalFeed';
import { runAgentCritiqueLoop } from '../services/ai/orchestrator';
import { gatherEvidenceContext } from '../services/ai/evidenceEngine';
import { hasContentFields } from '../services/ai/jsonExtractor';
import { generateAndStoreImage, isImageGenerationAvailable } from '../services/images/imageService';
import { generateCarouselPdf } from '../services/images/carouselPdfService';
import { getIntelligenceContext } from '../services/feedback/intelligenceService';
import { ContentHistory } from '../models/ContentHistory';

// Helper: load past content topics to avoid repetition
async function getContentHistorySummary(): Promise<string> {
  try {
    const entries = await ContentHistory.find({})
      .sort({ publishedDate: -1 })
      .limit(100)
      .select('topic contentPillar');
    if (entries.length === 0) return '';
    const topics = entries.map(e => `- ${e.topic}${e.contentPillar ? ` [${e.contentPillar}]` : ''}`);
    return 'PAST TOPICS ALREADY PUBLISHED (avoid repeating):\n' + topics.join('\n');
  } catch { return ''; }
}
import path from 'path';
import fs from 'fs';
import os from 'os';

const router = Router();

// All post routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/posts/generate:
 *   post:
 *     tags:
 *       - Posts
 *     summary: Generate a new post via AI
 *     description: Generates a new social media post using AI. The post is created based on a trigger type (signal seed, calendar fill, or manual) and the current Living Strategy. Returns a draft post with AI evidence.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - triggerType
 *               - platform
 *               - author
 *             properties:
 *               triggerType:
 *                 type: string
 *                 enum: [signal_seed, calendar_fill, manual]
 *                 description: What triggered this post generation
 *                 example: signal_seed
 *               signalFeedId:
 *                 type: string
 *                 description: Signal feed entry ID (required when triggerType is signal_seed)
 *                 example: 507f1f77bcf86cd799439011
 *               platform:
 *                 type: string
 *                 enum: [linkedin, instagram, both]
 *                 example: linkedin
 *               pillar:
 *                 type: string
 *                 description: Content pillar to align the post with
 *                 example: thought_leadership
 *               format:
 *                 type: string
 *                 enum: [text_post, carousel, poll, document, video_caption, reel, story]
 *                 description: Post format
 *                 example: text_post
 *               campaignId:
 *                 type: string
 *                 description: Campaign to associate the post with
 *               author:
 *                 type: string
 *                 enum: [shohini, sanjoy]
 *                 example: shohini
 *     responses:
 *       201:
 *         description: Post generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post generated
 *                 post:
 *                   $ref: '#/components/schemas/Post'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: triggerType, platform, and author are required
 */
router.post('/generate', async (req: Request, res: Response) => {
  const { triggerType, signalFeedId, platform, pillar, format, campaignId, author } = req.body;

  if (!triggerType || !platform || !author) {
    res.status(400).json({ error: 'triggerType, platform, and author are required' });
    return;
  }

  try {
    // Gather evidence context from strategy, performance, signals, pipeline
    const evidenceContext = await gatherEvidenceContext(author, campaignId);

    // If triggered by a signal, fetch the signal entry
    let signal = null;
    if (triggerType === 'signal_seed' && signalFeedId) {
      signal = await SignalFeed.findById(signalFeedId);
    }

    // Choose prompt based on platform
    const generatorPrompt = platform === 'instagram'
      ? 'post-generator-instagram'
      : 'post-generator-linkedin';

    // Run AI agent-critique loop
    const result = await runAgentCritiqueLoop({
      generatorPrompt,
      critiquePrompt: 'post-critique',
      context: {
        ...evidenceContext,
        SIGNAL_TEXT: signal?.rawText || '',
        PLATFORM: platform,
        FORMAT: format || 'text_post',
        CONTENT_PILLAR: pillar || '',
      },
      operation: 'generate-post',
      user: author,
      relatedCollection: 'Post',
    });

    // Parse structured output from AI — only use parsed fields if they contain real content
    const parsed = result.parsed || {};
    const useParsed = hasContentFields(parsed);

    // Create the post document
    const post = new Post({
      author,
      platform,
      format: format || 'text_post',
      contentPillar: pillar || parsed.pillar || '',
      draftContent: useParsed ? (parsed.body || parsed.content || parsed.caption || parsed.draftContent) : result.content,
      linkedinHook: useParsed ? (parsed.linkedinHook || parsed.hook || '') : '',
      instagramHook: useParsed ? (parsed.instagramHook || parsed.hook || '') : '',
      cta: useParsed ? (parsed.cta || '') : '',
      hashtags: useParsed ? (parsed.hashtags || []) : [],
      status: 'draft',
      signalFeedId: signalFeedId || null,
      campaignId: campaignId || null,
      aiEvidence: {
        strategyReferences: result.evidence.strategyReferences,
        dataPoints: result.evidence.dataPoints,
        signalFeedSources: signalFeedId ? [signalFeedId] : [],
        confidenceScore: result.critique.score / 10,
        critiqueIterations: result.iterations,
        finalCritiqueScore: result.critique.score,
      },
    });

    await post.save();

    res.status(201).json({
      message: 'Post generated',
      post,
    });
  } catch (error: any) {
    // If AI fails, still create a basic post so the user can manually edit
    try {
      const fallbackPost = new Post({
        author,
        platform,
        format: format || 'text_post',
        contentPillar: pillar || '',
        draftContent: '',
        status: 'draft',
        signalFeedId: signalFeedId || null,
        campaignId: campaignId || null,
        notes: `AI generation failed: ${error.message}. Please write content manually.`,
        aiEvidence: {
          strategyReferences: [],
          dataPoints: [],
          signalFeedSources: [],
          confidenceScore: 0,
          critiqueIterations: 0,
          finalCritiqueScore: 0,
        },
      });

      await fallbackPost.save();

      res.status(201).json({
        message: 'Post created with empty draft (AI generation failed)',
        post: fallbackPost,
      });
    } catch (saveError: any) {
      res.status(500).json({ error: `Failed to create post: ${saveError.message}` });
    }
  }
});

/**
 * @openapi
 * /api/posts/{id}/regenerate:
 *   post:
 *     tags:
 *       - Posts
 *     summary: Regenerate a post with instruction
 *     description: Regenerates a specific field (text or image) of a post based on a user instruction. Uses the existing post context and strategy for the AI regeneration.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - instruction
 *               - field
 *             properties:
 *               instruction:
 *                 type: string
 *                 description: Instruction for the AI regeneration
 *                 example: Make it more conversational and add a personal anecdote
 *               field:
 *                 type: string
 *                 enum: [text, image]
 *                 description: Which field to regenerate
 *                 example: text
 *     responses:
 *       200:
 *         description: Post regenerated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post text regenerated
 *                 post:
 *                   $ref: '#/components/schemas/Post'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: instruction and field are required
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Post not found
 */
router.post('/:id/regenerate', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { instruction, field } = req.body;

  if (!instruction || !field) {
    res.status(400).json({ error: 'instruction and field are required' });
    return;
  }

  try {
    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Gather evidence context
    const evidenceContext = await gatherEvidenceContext(post.author, post.campaignId?.toString());

    // Gather intelligence from past feedback
    const intelligence = await getIntelligenceContext(
      post.format,
      post.platform,
      post.contentPillar
    );

    // Choose prompt based on platform
    const generatorPrompt = post.platform === 'instagram'
      ? 'post-generator-instagram'
      : 'post-generator-linkedin';

    // Load past content history for de-duplication
    const contentHistory = await getContentHistorySummary();

    // Run AI agent-critique loop with regeneration instruction + feedback intelligence
    const result = await runAgentCritiqueLoop({
      generatorPrompt,
      critiquePrompt: 'post-critique',
      context: {
        ...evidenceContext,
        SIGNAL_TEXT: '',
        PLATFORM: post.platform,
        FORMAT: post.format || 'text_post',
        CONTENT_PILLAR: post.contentPillar || '',
        REGENERATION_INSTRUCTION: instruction,
        CURRENT_CONTENT: post.draftContent || '',
        FEEDBACK_INTELLIGENCE: intelligence.promptAugmentation || '',
        CONTENT_HISTORY: contentHistory,
      },
      operation: 'regenerate-post',
      user: post.author,
      relatedId: id as string,
      relatedCollection: 'Post',
    });

    const parsed = result.parsed || {};
    const useParsed = hasContentFields(parsed);

    // Update the post with new content — only use parsed fields if they contain real content
    post.draftContent = useParsed ? (parsed.body || parsed.content || parsed.caption || parsed.draftContent) : result.content;
    post.linkedinHook = useParsed ? (parsed.linkedinHook || parsed.hook || post.linkedinHook) : post.linkedinHook;
    post.instagramHook = useParsed ? (parsed.instagramHook || parsed.hook || post.instagramHook) : post.instagramHook;
    post.cta = useParsed ? (parsed.cta || post.cta) : post.cta;
    post.hashtags = useParsed ? (parsed.hashtags || post.hashtags) : post.hashtags;
    post.aiEvidence = {
      strategyReferences: result.evidence.strategyReferences,
      dataPoints: result.evidence.dataPoints,
      signalFeedSources: post.aiEvidence?.signalFeedSources || [],
      confidenceScore: result.critique.score / 10,
      critiqueIterations: result.iterations,
      finalCritiqueScore: result.critique.score,
    };

    await post.save();

    res.json({
      message: `Post ${field} regenerated`,
      post,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Regeneration failed: ${error.message}` });
  }
});

/**
 * POST /api/posts/:id/generate-content — Generate content for a single post
 * This is the per-post content generation endpoint. Called when user clicks
 * "Generate Content" on an individual post instead of bulk generation.
 */
router.post('/:id/generate-content', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // If already has content, skip (unless force=true)
    if (post.draftContent && post.draftContent.trim() !== '' && !req.body.force) {
      res.json({ message: 'Post already has content', post });
      return;
    }

    // Gather evidence context
    const evidenceContext = await gatherEvidenceContext(post.author, post.campaignId?.toString());

    // Gather intelligence from past feedback
    const intelligence = await getIntelligenceContext(post.format, post.platform, post.contentPillar);

    // Fetch the signal feed entry if linked (provides the primary input context)
    let signalFeedEntry = '';
    if (post.signalFeedId) {
      const signal = await SignalFeed.findById(post.signalFeedId).lean();
      if (signal) {
        signalFeedEntry = `ORIGINAL FOUNDER INSIGHT (THIS IS THE PRIMARY INPUT — the post MUST be about this):\n"${(signal as any).rawText}"\n\nTags: ${((signal as any).tags || []).join(', ')}`;
      }
    }

    // Build approved hook/CTA context — if the user already wrote or edited these, the AI must use them verbatim
    const existingHook = post.linkedinHook || post.instagramHook || '';
    const existingCta = post.cta || '';
    let approvedFieldsContext = '';
    if (existingHook || existingCta) {
      approvedFieldsContext = '=== APPROVED CONTENT (USE EXACTLY AS WRITTEN) ===\n';
      if (existingHook) {
        approvedFieldsContext += `APPROVED HOOK (use this VERBATIM as the first line — do NOT rewrite, soften, or rephrase it):\n"${existingHook}"\n\n`;
      }
      if (existingCta) {
        approvedFieldsContext += `APPROVED CTA (include this VERBATIM at the end of the body — do NOT omit or rephrase it):\n"${existingCta}"\n\n`;
      }
    }

    // Choose prompt based on platform
    const generatorPrompt = post.platform === 'instagram'
      ? 'post-generator-instagram'
      : 'post-generator-linkedin';

    // Load past content history for de-duplication
    const contentHistory = await getContentHistorySummary();

    // Run AI agent-critique loop
    const result = await runAgentCritiqueLoop({
      generatorPrompt,
      critiquePrompt: 'post-critique',
      context: {
        ...evidenceContext,
        SIGNAL_FEED_ENTRY: signalFeedEntry || `Topic brief: ${post.notes || 'No topic brief provided'}`,
        SIGNAL_TEXT: post.notes || '',
        PLATFORM: post.platform,
        FORMAT: post.format || 'text_post',
        CONTENT_PILLAR: post.contentPillar || '',
        CURRENT_CONTENT: '',
        FEEDBACK_INTELLIGENCE: intelligence.promptAugmentation || '',
        CONTENT_HISTORY: contentHistory,
        APPROVED_FIELDS: approvedFieldsContext,
      },
      operation: 'generate-post-content',
      user: post.author,
      relatedId: id as string,
      relatedCollection: 'Post',
    });

    const parsed = result.parsed || {};
    const useParsed = hasContentFields(parsed);

    // Update the post with generated content
    // Preserve user-approved hook and CTA — only use AI-generated ones if the user hasn't set them
    const generatedContent = useParsed ? (parsed.body || parsed.content || parsed.caption || parsed.draftContent) : result.content;
    const generatedHook = useParsed ? (parsed.linkedinHook || parsed.hook || '') : '';
    const generatedCta = useParsed ? (parsed.cta || '') : '';

    // Store the original AI output for edit intelligence tracking
    post.aiGeneratedContent = generatedContent || '';
    post.aiGeneratedHook = generatedHook || existingHook || '';
    post.aiGeneratedCta = generatedCta || existingCta || '';

    post.draftContent = generatedContent;
    if (!existingHook) {
      post.linkedinHook = useParsed ? (parsed.linkedinHook || parsed.hook || post.linkedinHook) : post.linkedinHook;
      post.instagramHook = useParsed ? (parsed.instagramHook || parsed.hook || post.instagramHook) : post.instagramHook;
    }
    if (!existingCta) {
      post.cta = useParsed ? (parsed.cta || post.cta) : post.cta;
    }
    post.hashtags = useParsed ? (parsed.hashtags || post.hashtags) : post.hashtags;

    if (parsed.carouselOutline && Array.isArray(parsed.carouselOutline)) {
      post.draftCarouselOutline = parsed.carouselOutline.map((slide: any, idx: number) => ({
        slideNumber: slide.slideNumber || idx + 1,
        content: slide.headline ? `${slide.headline}\n${slide.bodyText || ''}` : slide.content || '',
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

    console.log(`[Post Generate] Content generated for post ${id} (${post.format}, ${post.platform})`);

    res.json({
      message: 'Content generated',
      post,
    });
  } catch (error: any) {
    console.error(`[Post Generate] Failed for post ${id}:`, error.message);
    res.status(500).json({ error: `Content generation failed: ${error.message}` });
  }
});

/**
 * @openapi
 * /api/posts/{id}/generate-image:
 *   post:
 *     tags:
 *       - Posts
 *     summary: Generate an image for a post
 *     description: Generates an image for the post using AI. Supports different image types including post graphics, thumbnails, carousel covers, and quote cards.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageType
 *             properties:
 *               imageType:
 *                 type: string
 *                 enum: [post_graphic, thumbnail, carousel_cover, quote_card]
 *                 example: post_graphic
 *               customPrompt:
 *                 type: string
 *                 description: Optional custom prompt to guide image generation
 *                 example: A professional office setting with diverse team collaborating
 *     responses:
 *       200:
 *         description: Image generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Image generated
 *                 imageUrl:
 *                   type: string
 *                   example: https://storage.example.com/images/generated-123.png
 *                 imagePrompt:
 *                   type: string
 *                   example: AI-generated prompt used for the image
 *       400:
 *         description: Missing imageType
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: imageType is required
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Post not found
 */
router.post('/:id/generate-image', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { imageType, customPrompt, aspectRatio, style } = req.body;

  if (!imageType) {
    res.status(400).json({ error: 'imageType is required' });
    return;
  }

  try {
    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const format = post.format?.toLowerCase() || '';

    // ── CAROUSEL FORMAT: Generate PDF from slide outline ──
    if (format === 'carousel' && imageType === 'carousel_pdf') {
      const slides = post.draftCarouselOutline || [];
      if (slides.length === 0) {
        res.status(400).json({ error: 'No carousel slides found. Generate content first.' });
        return;
      }

      const pdfResult = await generateCarouselPdf(
        slides,
        String(post._id),
        post.contentPillar || 'Carousel',
        post.author || '',
        aspectRatio || '1:1',
        style || 'clean_light'
      );

      post.carouselPdfUrl = pdfResult.pdfUrl;
      post.imageType = 'carousel_pdf';
      post.imagePrompt = `Carousel PDF: ${slides.length} slides`;
      console.log(`[generate-image] Setting carouselPdfUrl = ${pdfResult.pdfUrl}`);

      // Use the first slide screenshot as cover image (from Puppeteer render)
      if (pdfResult.slideImageUrls.length > 0) {
        post.imageUrl = pdfResult.slideImageUrls[0]; // /api/posts/:id/carousel-slide/1
        post.imageVariations = pdfResult.slideImageUrls;
      }

      try {
        await post.save();
        console.log(`[generate-image] Post saved. carouselPdfUrl in DB: ${post.carouselPdfUrl}`);
      } catch (saveErr: any) {
        console.error(`[generate-image] SAVE FAILED:`, saveErr.message);
        res.status(500).json({ error: 'Failed to save carousel PDF', details: saveErr.message });
        return;
      }

      res.json({
        message: 'Carousel PDF generated',
        carouselPdfUrl: post.carouselPdfUrl,
        imageUrl: post.imageUrl || null,
        slideCount: pdfResult.slideCount,
        slideImageUrls: pdfResult.slideImageUrls,
      });
      return;
    }

    // ── VIDEO FORMAT: Generate thumbnail (16:9) ──
    const isVideo = format === 'video_caption';
    const imageAspectRatio = isVideo ? '16:9' : '1:1';

    // Use orchestrator to generate an image prompt via AI
    const evidenceContext = await gatherEvidenceContext(post.author, post.campaignId?.toString());

    const result = await runAgentCritiqueLoop({
      generatorPrompt: 'image-prompt-builder',
      critiquePrompt: 'image-prompt-critique',
      context: {
        ...evidenceContext,
        POST_CONTENT: post.draftContent || post.finalContent || '',
        PLATFORM: post.platform,
        IMAGE_TYPE: imageType,
        CUSTOM_PROMPT: customPrompt || (isVideo
          ? 'Create a compelling video thumbnail. Bold visual, high contrast, eye-catching. 16:9 aspect ratio.'
          : ''),
        CONTENT_PILLAR: post.contentPillar || '',
      },
      operation: 'generate-image-prompt',
      user: post.author,
      relatedId: id as string,
      relatedCollection: 'Post',
    });

    const parsed = result.parsed || {};
    const generatedImagePrompt = parsed.imagePrompt || parsed.prompt || result.content;

    // Update post with image type and the AI-generated image prompt
    post.imageType = imageType;
    post.imagePrompt = generatedImagePrompt;

    // Generate actual images via fal.ai + upload to storage
    if (isImageGenerationAvailable()) {
      try {
        const imageResult = await generateAndStoreImage(
          generatedImagePrompt,
          String(post._id),
          1,
          imageAspectRatio as any
        );
        post.imageUrl = imageResult.imageUrl;
        post.imageVariations = imageResult.imageVariations;
        console.log(`[generate-image] ${isVideo ? 'Thumbnail' : 'Image'} generated for post ${post._id}: ${imageResult.imageUrl}`);
      } catch (imgErr: any) {
        console.error(`[generate-image] Image rendering failed, saving prompt only:`, imgErr.message);
      }
    }

    await post.save();

    res.json({
      message: post.imageUrl ? `${isVideo ? 'Thumbnail' : 'Image'} generated` : 'Image prompt generated (image rendering unavailable)',
      imageUrl: post.imageUrl || null,
      imagePrompt: generatedImagePrompt,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Image generation failed: ${error.message}` });
  }
});

/**
 * GET /api/posts/:id/carousel-pdf
 * Serves a locally-stored carousel PDF (fallback when Azure is not configured).
 */
router.get('/:id/carousel-pdf', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // If PDF is stored in Azure, redirect
    if (post.carouselPdfUrl && post.carouselPdfUrl.startsWith('http')) {
      res.redirect(post.carouselPdfUrl);
      return;
    }

    // Serve from local temp directory
    const tmpPath = path.join(os.tmpdir(), 'signal-carousels', `${id}.pdf`);
    if (!fs.existsSync(tmpPath)) {
      res.status(404).json({ error: 'Carousel PDF not found. Generate it first.' });
      return;
    }

    // Build a descriptive filename from the post's content pillar and hook
    const pillarSlug = (post.contentPillar || 'carousel').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
    const hookSnippet = (post.linkedinHook || post.instagramHook || post.notes || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
    const pdfFileName = `carousel-${pillarSlug}${hookSnippet ? '-' + hookSnippet : ''}.pdf`.toLowerCase();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFileName}"`);
    fs.createReadStream(tmpPath).pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to serve carousel PDF: ${error.message}` });
  }
});

/**
 * GET /api/posts/:id/carousel-slide/:num
 * Serves an individual slide image (PNG) for carousel preview.
 */
router.get('/:id/carousel-slide/:num', async (req: Request, res: Response) => {
  const { id, num } = req.params;
  try {
    const tmpPath = path.join(os.tmpdir(), 'signal-carousels', id, `slide-${num}.png`);
    if (!fs.existsSync(tmpPath)) {
      res.status(404).json({ error: `Slide ${num} not found.` });
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(tmpPath).pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to serve slide image: ${error.message}` });
  }
});

/**
 * GET /api/posts/:id/cover-image
 * Serves a locally-stored cover image (fallback when Azure is not configured).
 */
router.get('/:id/cover-image', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const tmpPath = path.join(os.tmpdir(), 'signal-covers', `${id}.png`);
    if (!fs.existsSync(tmpPath)) {
      res.status(404).json({ error: 'Cover image not found.' });
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(tmpPath).pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to serve cover image: ${error.message}` });
  }
});

/**
 * @openapi
 * /api/posts:
 *   get:
 *     tags:
 *       - Posts
 *     summary: List posts
 *     description: Returns a paginated list of posts with optional filters for author, platform, status, pillar, and campaign.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *           enum: [shohini, sanjoy]
 *         description: Filter by author
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [linkedin, instagram, both]
 *         description: Filter by platform
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, ready, published, archived]
 *         description: Filter by post status
 *       - in: query
 *         name: pillar
 *         schema:
 *           type: string
 *         description: Filter by content pillar
 *       - in: query
 *         name: campaignId
 *         schema:
 *           type: string
 *         description: Filter by campaign ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *         description: Number of posts per page
 *     responses:
 *       200:
 *         description: Paginated list of posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                       example: 1
 *                     limit:
 *                       type: number
 *                       example: 20
 *                     total:
 *                       type: number
 *                       example: 52
 *                     totalPages:
 *                       type: number
 *                       example: 3
 */
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    // Build filter from query params
    const filter: Record<string, any> = {};
    if (req.query.author) filter.author = req.query.author;
    if (req.query.platform) filter.platform = req.query.platform;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.pillar) filter.contentPillar = req.query.pillar;
    if (req.query.campaignId) filter.campaignId = req.query.campaignId;

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Post.countDocuments(filter),
    ]);

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch posts: ${error.message}` });
  }
});

/**
 * @openapi
 * /api/posts/{id}:
 *   get:
 *     tags:
 *       - Posts
 *     summary: Get a single post
 *     description: Returns a single post by ID with full content, AI evidence, and performance data.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Post details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Post not found
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json(post);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch post: ${error.message}` });
  }
});

/**
 * @openapi
 * /api/posts/{id}:
 *   put:
 *     tags:
 *       - Posts
 *     summary: Update a post
 *     description: Updates post content, schedule, status, or other fields.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               draftContent:
 *                 type: string
 *               finalContent:
 *                 type: string
 *               cta:
 *                 type: string
 *               hashtags:
 *                 type: array
 *                 items:
 *                   type: string
 *               linkedinHook:
 *                 type: string
 *               instagramHook:
 *                 type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [draft, scheduled, ready, published, archived]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Post updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post updated
 *                 post:
 *                   $ref: '#/components/schemas/Post'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Post not found
 */
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Fetch existing post first to track edit diffs
    const existing = await Post.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Track meaningful content edits for intelligence
    const edits: Array<{ field: string; before: string; after: string; editedAt: Date }> = [];
    const now = new Date();

    if (req.body.draftContent !== undefined && req.body.draftContent !== existing.draftContent) {
      edits.push({ field: 'content', before: existing.draftContent || '', after: req.body.draftContent, editedAt: now });
    }
    if (req.body.linkedinHook !== undefined && req.body.linkedinHook !== existing.linkedinHook) {
      edits.push({ field: 'hook', before: existing.linkedinHook || '', after: req.body.linkedinHook, editedAt: now });
    }
    if (req.body.instagramHook !== undefined && req.body.instagramHook !== existing.instagramHook) {
      edits.push({ field: 'hook', before: existing.instagramHook || '', after: req.body.instagramHook, editedAt: now });
    }
    if (req.body.cta !== undefined && req.body.cta !== existing.cta) {
      edits.push({ field: 'cta', before: existing.cta || '', after: req.body.cta, editedAt: now });
    }

    // Append edit history (keep last 20 edits per post)
    if (edits.length > 0) {
      const currentHistory = existing.editHistory || [];
      const updatedHistory = [...currentHistory, ...edits].slice(-20);
      req.body.editHistory = updatedHistory;

      console.log(`[Post Edit] ${edits.length} edit(s) tracked for post ${id}: ${edits.map(e => e.field).join(', ')}`);
    }

    const post = await Post.findByIdAndUpdate(id, req.body, { new: true });

    res.json({
      message: 'Post updated',
      post,
      editsTracked: edits.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to update post: ${error.message}` });
  }
});

/**
 * @openapi
 * /api/posts/{id}:
 *   delete:
 *     tags:
 *       - Posts
 *     summary: Delete a draft post
 *     description: Deletes a post. Only posts with draft status can be deleted.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Post deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post deleted
 *       400:
 *         description: Cannot delete non-draft post
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Only draft posts can be deleted
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Post not found
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (post.status !== 'draft') {
      res.status(400).json({ error: 'Only draft posts can be deleted' });
      return;
    }

    await Post.findByIdAndDelete(id);

    res.json({ message: 'Post deleted' });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to delete post: ${error.message}` });
  }
});

/**
 * @openapi
 * components:
 *   schemas:
 *     Post:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         signalFeedId:
 *           type: string
 *           nullable: true
 *           description: Reference to the signal feed entry that seeded this post
 *         campaignId:
 *           type: string
 *           nullable: true
 *           description: Reference to the associated campaign
 *         author:
 *           type: string
 *           enum: [shohini, sanjoy]
 *           example: shohini
 *         platform:
 *           type: string
 *           enum: [linkedin, instagram, both]
 *           example: linkedin
 *         format:
 *           type: string
 *           enum: [text_post, carousel, poll, document, video_caption, reel, story]
 *           example: text_post
 *         contentPillar:
 *           type: string
 *           example: thought_leadership
 *         draftContent:
 *           type: string
 *         draftCarouselOutline:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               slideNumber:
 *                 type: number
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [hook, content, cta]
 *         finalContent:
 *           type: string
 *         cta:
 *           type: string
 *         hashtags:
 *           type: array
 *           items:
 *             type: string
 *         linkedinHook:
 *           type: string
 *         instagramHook:
 *           type: string
 *         imageType:
 *           type: string
 *           enum: [post_graphic, thumbnail, carousel_cover, quote_card]
 *           nullable: true
 *         imagePrompt:
 *           type: string
 *         imageUrl:
 *           type: string
 *         imageVariations:
 *           type: array
 *           items:
 *             type: string
 *         scheduledAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         publishedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [draft, scheduled, ready, published, archived]
 *           example: draft
 *         performance:
 *           type: object
 *           nullable: true
 *           properties:
 *             likes:
 *               type: number
 *             comments:
 *               type: number
 *             shares:
 *               type: number
 *             dms:
 *               type: number
 *             reach:
 *               type: number
 *             saves:
 *               type: number
 *             engagementRate:
 *               type: number
 *         notes:
 *           type: string
 *         aiEvidence:
 *           type: object
 *           properties:
 *             strategyReferences:
 *               type: array
 *               items:
 *                 type: string
 *             dataPoints:
 *               type: array
 *               items:
 *                 type: string
 *             signalFeedSources:
 *               type: array
 *               items:
 *                 type: string
 *             confidenceScore:
 *               type: number
 *             critiqueIterations:
 *               type: number
 *             finalCritiqueScore:
 *               type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export default router;
