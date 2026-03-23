import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { SignalFeed } from '../models/SignalFeed';
import { Post } from '../models/Post';
import { runAgentCritiqueLoop } from '../services/ai/orchestrator';
import { gatherEvidenceContext } from '../services/ai/evidenceEngine';

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
router.post('/', async (req: Request, res: Response) => {
  const { rawText, author, tags, urlReference } = req.body;

  if (!rawText || !author || !tags) {
    res.status(400).json({ error: 'rawText, author, and tags are required' });
    return;
  }

  try {
    const entry = await new SignalFeed({
      author,
      rawText,
      tags,
      urlReference: urlReference || '',
      status: 'pending',
    }).save();

    // Return 201 immediately; AI classification runs in background
    res.status(201).json({ message: 'Signal feed entry created', entry });

    // --- Background AI classification (non-blocking) ---
    (async () => {
      try {
        const evidenceContext = await gatherEvidenceContext(author);

        const result = await runAgentCritiqueLoop({
          generatorPrompt: 'signal-feed-classifier',
          critiquePrompt: 'signal-feed-critique',
          context: {
            ...evidenceContext,
            SIGNAL_TEXT: rawText,
            SIGNAL_TAGS: tags.join(', '),
            SIGNAL_AUTHOR: author,
          },
          operation: 'classify-signal',
          user: author,
          relatedId: entry._id.toString(),
          relatedCollection: 'SignalFeed',
        });

        // Build update payload from parsed AI result
        const parsed = result.parsed || {};
        const updateFields: Record<string, any> = {
          aiClassification: {
            insightType: parsed.insightType || '',
            contentPillar: parsed.contentPillar || '',
            timeliness: parsed.timeliness || 'evergreen',
            strategyRelevance: parsed.strategyRelevance || '',
            contradictions: parsed.contradictions || [],
            confidence: parsed.confidence ?? result.critique.score / 10,
            evidence: {
              strategyReferences: result.evidence.strategyReferences || [],
              reasoning: parsed.reasoning || result.evidence.claims?.map((c: any) => c.claim).join('; ') || '',
            },
            critiqueScore: result.critique.score,
            critiqueIterations: result.iterations,
            critiqueFeedback: result.critique.feedback,
          },
          routing: parsed.routing || 'content_seed',
        };

        if (parsed.strategyUpdateProposed) {
          updateFields.strategyUpdateProposed = parsed.strategyUpdateProposed;
        }

        await SignalFeed.findByIdAndUpdate(entry._id, updateFields);
      } catch (aiErr) {
        console.error(`AI classification failed for signal ${entry._id}:`, aiErr);
        // Entry remains with status 'pending' — no data loss
      }
    })();
  } catch (err) {
    console.error('Failed to create signal feed entry:', err);
    res.status(500).json({ error: 'Failed to create signal feed entry' });
  }
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
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const filter: Record<string, any> = {};

    if (req.query.author) {
      filter.author = req.query.author;
    }
    if (req.query.tag) {
      filter.tags = { $in: [req.query.tag] };
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.routing) {
      filter.routing = req.query.routing;
    }
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate as string);
      }
    }

    const [entries, total] = await Promise.all([
      SignalFeed.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SignalFeed.countDocuments(filter),
    ]);

    // Enrich entries with impact summary (which posts were created from each signal)
    const entryIds = entries.map((e: any) => e._id);
    const impactPosts = await Post.find({
      signalFeedId: { $in: entryIds },
    })
      .select('signalFeedId scheduledAt status')
      .sort({ scheduledAt: -1 })
      .lean();

    // Build impact map
    const impactMap: Record<string, { postCount: number; latestPostDate: string | null; latestPostStatus: string | null }> = {};
    for (const post of impactPosts) {
      const sid = String(post.signalFeedId);
      if (!impactMap[sid]) {
        impactMap[sid] = {
          postCount: 0,
          latestPostDate: post.scheduledAt ? post.scheduledAt.toISOString() : null,
          latestPostStatus: post.status,
        };
      }
      impactMap[sid].postCount++;
    }

    // Attach impact summary to each entry
    const enrichedEntries = entries.map((entry: any) => ({
      ...entry,
      impactSummary: impactMap[String(entry._id)] || null,
    }));

    res.json({
      entries: enrichedEntries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Failed to list signal feed entries:', err);
    res.status(500).json({ error: 'Failed to list signal feed entries' });
  }
});

// ============ Quick Add (diary-style capture) ============

/**
 * @openapi
 * /api/signal-feed/quick:
 *   post:
 *     tags:
 *       - Signal Feed
 *     summary: Quick-add a diary entry
 *     description: Minimal-friction endpoint for diary-style signal capture. Only rawText is required — author is auto-detected from JWT, tags and URL are optional.
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
 *             properties:
 *               rawText:
 *                 type: string
 *                 example: Spotted a viral LinkedIn post about AI replacing recruiters — 50k impressions in 2 hours
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [market_observation, inspired_by]
 *               urlReference:
 *                 type: string
 *                 example: https://linkedin.com/post/viral-ai-post
 *     responses:
 *       201:
 *         description: Signal captured and AI classification triggered
 *       400:
 *         description: rawText is required
 */
router.post('/quick', async (req: Request, res: Response) => {
  const { rawText, tags, urlReference } = req.body;
  const author = (req as any).user?.role || req.body.author;

  if (!rawText) {
    res.status(400).json({ error: 'rawText is required' });
    return;
  }

  try {
    const entry = await new SignalFeed({
      author: author || 'shohini',
      rawText,
      tags: tags || [],
      urlReference: urlReference || '',
      status: 'pending',
    }).save();

    res.status(201).json({ message: 'Signal captured', entry });

    // Background AI classification (reuse same logic as POST /)
    (async () => {
      try {
        const evidenceContext = await gatherEvidenceContext(entry.author);

        const result = await runAgentCritiqueLoop({
          generatorPrompt: 'signal-feed-classifier',
          critiquePrompt: 'signal-feed-critique',
          context: {
            ...evidenceContext,
            SIGNAL_TEXT: rawText,
            SIGNAL_TAGS: (tags || []).join(', '),
            SIGNAL_AUTHOR: entry.author,
          },
          operation: 'classify-signal',
          user: entry.author,
          relatedId: entry._id.toString(),
          relatedCollection: 'SignalFeed',
        });

        const parsed = result.parsed || {};
        const updateFields: Record<string, any> = {
          aiClassification: {
            insightType: parsed.insightType || '',
            contentPillar: parsed.contentPillar || '',
            timeliness: parsed.timeliness || 'evergreen',
            strategyRelevance: parsed.strategyRelevance || '',
            contradictions: parsed.contradictions || [],
            confidence: parsed.confidence ?? result.critique.score / 10,
            evidence: {
              strategyReferences: result.evidence.strategyReferences || [],
              reasoning: parsed.reasoning || result.evidence.claims?.map((c: any) => c.claim).join('; ') || '',
            },
            critiqueScore: result.critique.score,
            critiqueIterations: result.iterations,
            critiqueFeedback: result.critique.feedback,
          },
          routing: parsed.routing || 'content_seed',
        };

        if (parsed.strategyUpdateProposed) {
          updateFields.strategyUpdateProposed = parsed.strategyUpdateProposed;
        }

        await SignalFeed.findByIdAndUpdate(entry._id, updateFields);
      } catch (aiErr) {
        console.error(`AI classification failed for quick signal ${entry._id}:`, aiErr);
      }
    })();
  } catch (err) {
    console.error('Failed to create quick signal entry:', err);
    res.status(500).json({ error: 'Failed to create signal entry' });
  }
});

// ============ Week Summary (for calendar generation) ============

/**
 * @openapi
 * /api/signal-feed/week-summary:
 *   get:
 *     tags:
 *       - Signal Feed
 *     summary: Get week's signal summary for calendar generation
 *     description: Returns confirmed signal feed entries for a given week, categorized by routing type and viral signals. Used as input for content calendar generation.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: weekStart
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Monday of the target week (YYYY-MM-DD)
 *         example: '2026-03-09'
 *     responses:
 *       200:
 *         description: Week's signal summary
 *       400:
 *         description: weekStart is required
 */
router.get('/week-summary', async (req: Request, res: Response) => {
  const weekStart = req.query.weekStart as string;
  if (!weekStart) {
    res.status(400).json({ error: 'weekStart query parameter is required' });
    return;
  }

  try {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    // Fetch confirmed content_seed and campaign_fuel signals for the week
    const entries = await SignalFeed.find({
      status: 'confirmed',
      routing: { $in: ['content_seed', 'campaign_fuel'] },
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Also fetch market_observation / inspired_by tagged entries as viral signals
    const viralSignals = await SignalFeed.find({
      tags: { $in: ['market_observation', 'inspired_by'] },
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      weekStart: start.toISOString().slice(0, 10),
      weekEnd: end.toISOString().slice(0, 10),
      contentSeeds: entries.filter((e: any) => e.routing === 'content_seed'),
      campaignFuel: entries.filter((e: any) => e.routing === 'campaign_fuel'),
      viralSignals,
      totalCount: entries.length,
    });
  } catch (err) {
    console.error('Failed to get week summary:', err);
    res.status(500).json({ error: 'Failed to get week summary' });
  }
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
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const entry = await SignalFeed.findById(id);
    if (!entry) {
      res.status(404).json({ error: 'Signal feed entry not found' });
      return;
    }
    res.json(entry);
  } catch (err) {
    console.error('Failed to get signal feed entry:', err);
    res.status(500).json({ error: 'Failed to get signal feed entry' });
  }
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
router.put('/:id/confirm', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const entry = await SignalFeed.findByIdAndUpdate(
      id,
      { status: 'confirmed' },
      { new: true }
    );
    if (!entry) {
      res.status(404).json({ error: 'Signal feed entry not found' });
      return;
    }
    res.json({ message: 'Routing confirmed', entry });
  } catch (err) {
    console.error('Failed to confirm signal feed entry:', err);
    res.status(500).json({ error: 'Failed to confirm signal feed entry' });
  }
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
router.put('/:id/override', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { routing, campaignId } = req.body;

  const validRoutings = ['strategy_update', 'content_seed', 'campaign_fuel', 'archive'];
  if (!routing || !validRoutings.includes(routing)) {
    res.status(400).json({
      error: 'Invalid routing. Must be one of strategy_update, content_seed, campaign_fuel, archive',
    });
    return;
  }

  try {
    const entry = await SignalFeed.findByIdAndUpdate(
      id,
      { routing, campaignId: campaignId || null, status: 'confirmed' },
      { new: true }
    );
    if (!entry) {
      res.status(404).json({ error: 'Signal feed entry not found' });
      return;
    }
    res.json({ message: `Routing overridden to ${routing}`, entry });
  } catch (err) {
    console.error('Failed to override signal feed entry:', err);
    res.status(500).json({ error: 'Failed to override signal feed entry' });
  }
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
