import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

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
router.post('/generate', (req: Request, res: Response) => {
  const { triggerType, platform, author } = req.body;

  if (!triggerType || !platform || !author) {
    res.status(400).json({ error: 'triggerType, platform, and author are required' });
    return;
  }

  // TODO: Replace with AI post generation via orchestrator
  res.status(201).json({
    message: 'Post generated',
    post: {
      _id: 'new-post-id',
      signalFeedId: req.body.signalFeedId || null,
      campaignId: req.body.campaignId || null,
      author,
      platform,
      format: req.body.format || 'text_post',
      contentPillar: req.body.pillar || '',
      draftContent: 'AI-generated draft content will appear here.',
      draftCarouselOutline: [],
      finalContent: '',
      cta: '',
      hashtags: [],
      linkedinHook: '',
      instagramHook: '',
      imageType: null,
      imagePrompt: '',
      imageUrl: '',
      imageVariations: [],
      scheduledAt: null,
      publishedAt: null,
      status: 'draft',
      performance: null,
      notes: '',
      aiEvidence: {
        strategyReferences: ['northStar', 'contentPillars[0]'],
        dataPoints: ['Signal feed entry analysis'],
        signalFeedSources: [],
        confidenceScore: 0.82,
        critiqueIterations: 2,
        finalCritiqueScore: 7.5,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
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
router.post('/:id/regenerate', (req: Request, res: Response) => {
  const { id } = req.params;
  const { instruction, field } = req.body;

  if (!instruction || !field) {
    res.status(400).json({ error: 'instruction and field are required' });
    return;
  }

  // TODO: Replace with AI regeneration via orchestrator
  res.json({
    message: `Post ${field} regenerated`,
    post: {
      _id: id,
      draftContent: 'Regenerated content based on instruction.',
      updatedAt: new Date().toISOString(),
    },
  });
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
router.post('/:id/generate-image', (req: Request, res: Response) => {
  const { id } = req.params;
  const { imageType, customPrompt } = req.body;

  if (!imageType) {
    res.status(400).json({ error: 'imageType is required' });
    return;
  }

  // TODO: Replace with AI image generation
  res.json({
    message: 'Image generated',
    imageUrl: 'https://storage.example.com/images/placeholder.png',
    imagePrompt: customPrompt || 'AI-generated prompt based on post content and strategy',
  });
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
router.get('/', (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  // TODO: Replace with Post.find() with filters + pagination
  res.json({
    posts: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0,
    },
  });
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
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Replace with Post.findById(id)
  res.json({
    _id: id,
    signalFeedId: null,
    campaignId: null,
    author: 'shohini',
    platform: 'linkedin',
    format: 'text_post',
    contentPillar: '',
    draftContent: 'Mock draft content',
    draftCarouselOutline: [],
    finalContent: '',
    cta: '',
    hashtags: [],
    linkedinHook: '',
    instagramHook: '',
    imageType: null,
    imagePrompt: '',
    imageUrl: '',
    imageVariations: [],
    scheduledAt: null,
    publishedAt: null,
    status: 'draft',
    performance: null,
    notes: '',
    aiEvidence: {
      strategyReferences: [],
      dataPoints: [],
      signalFeedSources: [],
      confidenceScore: 0,
      critiqueIterations: 0,
      finalCritiqueScore: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
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
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Replace with Post.findByIdAndUpdate(id, req.body, { new: true })
  res.json({
    message: 'Post updated',
    post: {
      _id: id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    },
  });
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
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Replace with Post.findById(id) check status then delete
  res.json({ message: 'Post deleted' });
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
