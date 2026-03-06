import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All analytics routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/analytics/post-performance:
 *   post:
 *     tags:
 *       - Analytics
 *     summary: Log post performance metrics
 *     description: Records performance metrics for a published post including likes, comments, shares, DMs, reach, and saves. Calculates and stores the engagement rate.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *               - likes
 *               - comments
 *               - shares
 *               - dms
 *               - reach
 *               - saves
 *             properties:
 *               postId:
 *                 type: string
 *                 description: The post to log metrics for
 *                 example: 507f1f77bcf86cd799439011
 *               likes:
 *                 type: number
 *                 example: 45
 *               comments:
 *                 type: number
 *                 example: 12
 *               shares:
 *                 type: number
 *                 example: 8
 *               dms:
 *                 type: number
 *                 example: 3
 *               reach:
 *                 type: number
 *                 example: 2500
 *               saves:
 *                 type: number
 *                 example: 15
 *     responses:
 *       200:
 *         description: Performance metrics logged
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Performance metrics logged
 *                 performance:
 *                   type: object
 *                   properties:
 *                     postId:
 *                       type: string
 *                     likes:
 *                       type: number
 *                     comments:
 *                       type: number
 *                     shares:
 *                       type: number
 *                     dms:
 *                       type: number
 *                     reach:
 *                       type: number
 *                     saves:
 *                       type: number
 *                     engagementRate:
 *                       type: number
 *                       description: Calculated engagement rate as a percentage
 *                       example: 3.32
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: postId and all metric fields are required
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
router.post('/post-performance', (req: Request, res: Response) => {
  const { postId, likes, comments, shares, dms, reach, saves } = req.body;

  if (!postId || likes === undefined || comments === undefined || shares === undefined ||
      dms === undefined || reach === undefined || saves === undefined) {
    res.status(400).json({ error: 'postId and all metric fields are required' });
    return;
  }

  const engagementRate = reach > 0 ? ((likes + comments + shares + saves) / reach) * 100 : 0;

  // TODO: Replace with Post.findByIdAndUpdate(postId, { performance: { ... } })
  res.json({
    message: 'Performance metrics logged',
    performance: {
      postId,
      likes,
      comments,
      shares,
      dms,
      reach,
      saves,
      engagementRate: Math.round(engagementRate * 100) / 100,
    },
  });
});

/**
 * @openapi
 * /api/analytics/dashboard:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get dashboard data
 *     description: Returns aggregated analytics data for the dashboard including Signal Score, posting stats, pipeline summary, and top-performing content.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signalScore:
 *                   type: number
 *                   description: Current Signal Score (0-100)
 *                   example: 72
 *                 scoreBreakdown:
 *                   type: object
 *                   properties:
 *                     postingConsistency:
 *                       type: number
 *                       example: 80
 *                     pipelineActivity:
 *                       type: number
 *                       example: 65
 *                     strategyAlignment:
 *                       type: number
 *                       example: 75
 *                     engagementHealth:
 *                       type: number
 *                       example: 68
 *                 postsThisWeek:
 *                   type: object
 *                   properties:
 *                     linkedin:
 *                       type: object
 *                       properties:
 *                         shohini:
 *                           type: number
 *                         sanjoy:
 *                           type: number
 *                     instagram:
 *                       type: object
 *                       properties:
 *                         shohini:
 *                           type: number
 *                         sanjoy:
 *                           type: number
 *                 pipelineSummary:
 *                   type: object
 *                   properties:
 *                     totalLeads:
 *                       type: number
 *                       example: 34
 *                     newThisWeek:
 *                       type: number
 *                       example: 5
 *                     demosThisWeek:
 *                       type: number
 *                       example: 2
 *                     signedThisMonth:
 *                       type: number
 *                       example: 1
 *                     totalPipelineValue:
 *                       type: number
 *                       example: 185000
 *                 topPost:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     _id:
 *                       type: string
 *                     platform:
 *                       type: string
 *                     engagementRate:
 *                       type: number
 *                     reach:
 *                       type: number
 */
router.get('/dashboard', (req: Request, res: Response) => {
  // TODO: Replace with aggregated analytics from AnalyticsWeekly, Post, Lead collections
  res.json({
    signalScore: 0,
    scoreBreakdown: {
      postingConsistency: 0,
      pipelineActivity: 0,
      strategyAlignment: 0,
      engagementHealth: 0,
    },
    postsThisWeek: {
      linkedin: { shohini: 0, sanjoy: 0 },
      instagram: { shohini: 0, sanjoy: 0 },
    },
    pipelineSummary: {
      totalLeads: 0,
      newThisWeek: 0,
      demosThisWeek: 0,
      signedThisMonth: 0,
      totalPipelineValue: 0,
    },
    topPost: null,
  });
});

/**
 * @openapi
 * /api/analytics/signal-score:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get current Signal Score
 *     description: Returns the current Signal Score with its breakdown across four dimensions — posting consistency, pipeline activity, strategy alignment, and engagement health.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current Signal Score
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signalScore:
 *                   type: number
 *                   description: Composite score from 0-100
 *                   example: 72
 *                 breakdown:
 *                   type: object
 *                   properties:
 *                     postingConsistency:
 *                       type: number
 *                       description: Score for posting frequency vs targets (0-25)
 *                       example: 20
 *                     pipelineActivity:
 *                       type: number
 *                       description: Score for pipeline movement and lead generation (0-25)
 *                       example: 16
 *                     strategyAlignment:
 *                       type: number
 *                       description: Score for content alignment with strategy (0-25)
 *                       example: 19
 *                     engagementHealth:
 *                       type: number
 *                       description: Score for engagement metrics performance (0-25)
 *                       example: 17
 *                 weekStart:
 *                   type: string
 *                   format: date
 *                   example: '2026-03-02'
 *                 trend:
 *                   type: string
 *                   enum: [up, down, stable]
 *                   description: Score trend compared to previous week
 *                   example: up
 */
router.get('/signal-score', (req: Request, res: Response) => {
  // TODO: Replace with latest AnalyticsWeekly record
  res.json({
    signalScore: 0,
    breakdown: {
      postingConsistency: 0,
      pipelineActivity: 0,
      strategyAlignment: 0,
      engagementHealth: 0,
    },
    weekStart: new Date().toISOString().slice(0, 10),
    trend: 'stable',
  });
});

/**
 * @openapi
 * /api/analytics/monday-brief:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get latest Monday Brief
 *     description: Returns the most recent Monday Brief — a weekly summary generated by AI that covers the previous week's performance, upcoming priorities, and strategic recommendations.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Latest Monday Brief
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 weekStart:
 *                   type: string
 *                   format: date
 *                   example: '2026-03-02'
 *                 generated:
 *                   type: boolean
 *                   example: true
 *                 content:
 *                   type: string
 *                   description: Full Monday Brief content in markdown format
 *                   example: '# Monday Brief — Week of March 2, 2026\n\n## Signal Score: 72/100...'
 *                 signalScore:
 *                   type: number
 *                   example: 72
 *                 highlights:
 *                   type: object
 *                   properties:
 *                     postsPublished:
 *                       type: number
 *                       example: 8
 *                     newLeads:
 *                       type: number
 *                       example: 5
 *                     topPostReach:
 *                       type: number
 *                       example: 3200
 *       404:
 *         description: No Monday Brief found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: No Monday Brief has been generated yet
 */
router.get('/monday-brief', (req: Request, res: Response) => {
  // TODO: Replace with AnalyticsWeekly.findOne({ mondayBriefGenerated: true }).sort({ weekStart: -1 })
  res.json({
    weekStart: new Date().toISOString().slice(0, 10),
    generated: false,
    content: '',
    signalScore: 0,
    highlights: {
      postsPublished: 0,
      newLeads: 0,
      topPostReach: 0,
    },
  });
});

/**
 * @openapi
 * /api/analytics/generate-weekly:
 *   post:
 *     tags:
 *       - Analytics
 *     summary: Trigger weekly digest generation
 *     description: Triggers the generation of the weekly analytics digest including Signal Score calculation, pillar performance analysis, AI recommendations, and the Monday Brief. This is typically run automatically but can be triggered manually.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Weekly digest generation triggered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Weekly digest generation started
 *                 weekStart:
 *                   type: string
 *                   format: date
 *                   example: '2026-03-02'
 *                 status:
 *                   type: string
 *                   enum: [processing, completed]
 *                   example: processing
 *       409:
 *         description: Weekly digest already generated for this week
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Weekly digest already generated for this week
 */
router.post('/generate-weekly', (req: Request, res: Response) => {
  // TODO: Replace with weekly digest generation logic via orchestrator
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  res.json({
    message: 'Weekly digest generation started',
    weekStart: monday.toISOString().slice(0, 10),
    status: 'processing',
  });
});

export default router;
