import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Post } from '../models/Post';
import { SignalFeed } from '../models/SignalFeed';
import { runAgentCritiqueLoop } from '../services/ai/orchestrator';
import { gatherEvidenceContext } from '../services/ai/evidenceEngine';
import { hasContentFields } from '../services/ai/jsonExtractor';
import { generateAndStoreImage, isImageGenerationAvailable } from '../services/images/imageService';

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

    // Choose prompt based on platform
    const generatorPrompt = post.platform === 'instagram'
      ? 'post-generator-instagram'
      : 'post-generator-linkedin';

    // Run AI agent-critique loop with regeneration instruction
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
  const { imageType, customPrompt } = req.body;

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
        CUSTOM_PROMPT: customPrompt || '',
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

    // Generate actual images via fal.ai + upload to S3
    if (isImageGenerationAvailable()) {
      try {
        const imageResult = await generateAndStoreImage(
          generatedImagePrompt,
          String(post._id),
          1
        );
        post.imageUrl = imageResult.imageUrl;
        post.imageVariations = imageResult.imageVariations;
        console.log(`[generate-image] Image generated for post ${post._id}: ${imageResult.imageUrl}`);
      } catch (imgErr: any) {
        console.error(`[generate-image] Image rendering failed, saving prompt only:`, imgErr.message);
        // Graceful fallback: prompt is saved, image can be retried later
      }
    }

    await post.save();

    res.json({
      message: post.imageUrl ? 'Image generated' : 'Image prompt generated (image rendering unavailable)',
      imageUrl: post.imageUrl || null,
      imagePrompt: generatedImagePrompt,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Image prompt generation failed: ${error.message}` });
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
    const post = await Post.findByIdAndUpdate(id, req.body, { new: true });
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({
      message: 'Post updated',
      post,
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
