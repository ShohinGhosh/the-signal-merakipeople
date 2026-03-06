import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All signal feed routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/signal-feed:
 *   post:
 *     tags:
 *       - Signal Feed
 *     summary: Submit a new signal feed entry
 *     description: Creates a new signal feed entry with raw text. Triggers AI classification to determine routing (strategy_update, content_seed, campaign_fuel, or archive) and extracts structured metadata.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rawText
 *               - author
 *               - tags
 *             properties:
 *               rawText:
 *                 type: string
 *                 description: The raw signal text content
 *                 example: Just had a great conversation with a CTO about how AI is changing their hiring process. They mentioned budget is being reallocated from job boards to AI tools.
 *               author:
 *                 type: string
 *                 enum: [shohini, sanjoy]
 *                 example: shohini
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [hiring, AI, market-signal]
 *               urlReference:
 *                 type: string
 *                 description: Optional URL reference for the signal source
 *                 example: https://linkedin.com/post/12345
 *     responses:
 *       201:
 *         description: Signal feed entry created and AI classification triggered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Signal feed entry created
 *                 entry:
 *                   $ref: '#/components/schemas/SignalFeedEntry'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: rawText, author, and tags are required
 */
router.post('/', (req: Request, res: Response) => {
  const { rawText, author, tags } = req.body;

  if (!rawText || !author || !tags) {
    res.status(400).json({ error: 'rawText, author, and tags are required' });
    return;
  }

  // TODO: Replace with new SignalFeed(req.body).save() + AI classification via orchestrator
  res.status(201).json({
    message: 'Signal feed entry created',
    entry: {
      _id: 'new-signal-id',
      rawText,
      author,
      tags,
      urlReference: req.body.urlReference || '',
      aiClassification: {
        insightType: 'market_signal',
        contentPillar: 'thought_leadership',
        timeliness: 'timely',
        strategyRelevance: 'High — aligns with ICP pain points',
        contradictions: [],
        confidence: 0.85,
        evidence: {
          strategyReferences: ['icpPrimary.painPoints'],
          reasoning: 'AI classification pending',
        },
        critiqueScore: 0,
        critiqueIterations: 0,
        critiqueFeedback: '',
      },
      routing: 'content_seed',
      campaignId: null,
      status: 'pending',
      strategyUpdateProposed: null,
      strategyUpdateAccepted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
});

/**
 * @openapi
 * /api/signal-feed:
 *   get:
 *     tags:
 *       - Signal Feed
 *     summary: List signal feed entries
 *     description: Returns a paginated list of signal feed entries with optional filters for author, tag, status, routing, and date range.
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
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter by tag
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, in_calendar, published, archived]
 *         description: Filter by status
 *       - in: query
 *         name: routing
 *         schema:
 *           type: string
 *           enum: [strategy_update, content_seed, campaign_fuel, archive]
 *         description: Filter by routing classification
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter entries created on or after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter entries created on or before this date
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
 *         description: Number of entries per page
 *     responses:
 *       200:
 *         description: Paginated list of signal feed entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SignalFeedEntry'
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
 *                       example: 45
 *                     totalPages:
 *                       type: number
 *                       example: 3
 */
router.get('/', (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  // TODO: Replace with SignalFeed.find() with filters + pagination
  res.json({
    entries: [],
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
 * /api/signal-feed/{id}:
 *   get:
 *     tags:
 *       - Signal Feed
 *     summary: Get a single signal feed entry
 *     description: Returns a single signal feed entry by ID with full AI classification details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Signal feed entry ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Signal feed entry details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SignalFeedEntry'
 *       404:
 *         description: Signal feed entry not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Signal feed entry not found
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Replace with SignalFeed.findById(id)
  res.json({
    _id: id,
    rawText: 'Mock signal entry',
    author: 'shohini',
    tags: ['mock'],
    urlReference: '',
    aiClassification: {
      insightType: 'market_signal',
      contentPillar: 'thought_leadership',
      timeliness: 'timely',
      strategyRelevance: '',
      contradictions: [],
      confidence: 0,
      evidence: { strategyReferences: [], reasoning: '' },
      critiqueScore: 0,
      critiqueIterations: 0,
      critiqueFeedback: '',
    },
    routing: 'content_seed',
    campaignId: null,
    status: 'pending',
    strategyUpdateProposed: null,
    strategyUpdateAccepted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

/**
 * @openapi
 * /api/signal-feed/{id}/confirm:
 *   put:
 *     tags:
 *       - Signal Feed
 *     summary: Confirm AI routing for an entry
 *     description: Confirms the AI-suggested routing for a signal feed entry, changing its status from pending to confirmed.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Signal feed entry ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Routing confirmed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Routing confirmed
 *                 entry:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: confirmed
 *                     routing:
 *                       type: string
 *       404:
 *         description: Signal feed entry not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Signal feed entry not found
 */
router.put('/:id/confirm', (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Replace with SignalFeed.findByIdAndUpdate(id, { status: 'confirmed' }, { new: true })
  res.json({
    message: 'Routing confirmed',
    entry: {
      _id: id,
      status: 'confirmed',
      routing: 'content_seed',
    },
  });
});

/**
 * @openapi
 * /api/signal-feed/{id}/override:
 *   put:
 *     tags:
 *       - Signal Feed
 *     summary: Override AI routing for an entry
 *     description: Manually overrides the AI-suggested routing for a signal feed entry. Optionally links to a campaign for campaign_fuel routing.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Signal feed entry ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - routing
 *             properties:
 *               routing:
 *                 type: string
 *                 enum: [strategy_update, content_seed, campaign_fuel, archive]
 *                 example: campaign_fuel
 *               campaignId:
 *                 type: string
 *                 description: Campaign ID to link when routing is campaign_fuel
 *                 example: 507f1f77bcf86cd799439022
 *     responses:
 *       200:
 *         description: Routing overridden successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Routing overridden to campaign_fuel
 *                 entry:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     routing:
 *                       type: string
 *                     campaignId:
 *                       type: string
 *                       nullable: true
 *                     status:
 *                       type: string
 *                       example: confirmed
 *       400:
 *         description: Invalid routing value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid routing. Must be one of strategy_update, content_seed, campaign_fuel, archive
 *       404:
 *         description: Signal feed entry not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Signal feed entry not found
 */
router.put('/:id/override', (req: Request, res: Response) => {
  const { id } = req.params;
  const { routing, campaignId } = req.body;

  const validRoutings = ['strategy_update', 'content_seed', 'campaign_fuel', 'archive'];
  if (!routing || !validRoutings.includes(routing)) {
    res.status(400).json({
      error: 'Invalid routing. Must be one of strategy_update, content_seed, campaign_fuel, archive',
    });
    return;
  }

  // TODO: Replace with SignalFeed.findByIdAndUpdate(id, { routing, campaignId, status: 'confirmed' }, { new: true })
  res.json({
    message: `Routing overridden to ${routing}`,
    entry: {
      _id: id,
      routing,
      campaignId: campaignId || null,
      status: 'confirmed',
    },
  });
});

/**
 * @openapi
 * components:
 *   schemas:
 *     SignalFeedEntry:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         author:
 *           type: string
 *           enum: [shohini, sanjoy]
 *           example: shohini
 *         rawText:
 *           type: string
 *           example: Just had a great conversation with a CTO about AI hiring trends
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           example: [hiring, AI, market-signal]
 *         urlReference:
 *           type: string
 *           example: https://linkedin.com/post/12345
 *         aiClassification:
 *           type: object
 *           properties:
 *             insightType:
 *               type: string
 *               example: market_signal
 *             contentPillar:
 *               type: string
 *               example: thought_leadership
 *             timeliness:
 *               type: string
 *               enum: [timely, evergreen]
 *               example: timely
 *             strategyRelevance:
 *               type: string
 *             contradictions:
 *               type: array
 *               items:
 *                 type: string
 *             confidence:
 *               type: number
 *               example: 0.85
 *             evidence:
 *               type: object
 *               properties:
 *                 strategyReferences:
 *                   type: array
 *                   items:
 *                     type: string
 *                 reasoning:
 *                   type: string
 *             critiqueScore:
 *               type: number
 *             critiqueIterations:
 *               type: number
 *             critiqueFeedback:
 *               type: string
 *         routing:
 *           type: string
 *           enum: [strategy_update, content_seed, campaign_fuel, archive]
 *           example: content_seed
 *         campaignId:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [pending, confirmed, in_calendar, published, archived]
 *           example: pending
 *         strategyUpdateProposed:
 *           type: object
 *           nullable: true
 *         strategyUpdateAccepted:
 *           type: boolean
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export default router;
