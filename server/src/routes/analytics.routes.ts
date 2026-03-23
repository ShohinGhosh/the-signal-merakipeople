import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AnalyticsWeekly } from '../models/AnalyticsWeekly';
import { Post } from '../models/Post';
import { Lead } from '../models/Lead';
import { Strategy } from '../models/Strategy';
import { runAgentCritiqueLoop } from '../services/ai/orchestrator';
import { gatherEvidenceContext } from '../services/ai/evidenceEngine';

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
router.post('/post-performance', async (req: Request, res: Response) => {
  try {
    const { postId, likes, comments, shares, dms, reach, saves } = req.body;

    if (!postId || likes === undefined || comments === undefined || shares === undefined ||
        dms === undefined || reach === undefined || saves === undefined) {
      res.status(400).json({ error: 'postId and all metric fields are required' });
      return;
    }

    const engagementRate = reach > 0 ? ((likes + comments + shares + saves) / reach) * 100 : 0;
    const roundedRate = Math.round(engagementRate * 100) / 100;

    const post = await Post.findByIdAndUpdate(
      postId,
      {
        performance: {
          likes,
          comments,
          shares,
          dms,
          reach,
          saves,
          engagementRate: roundedRate,
        },
      },
      { new: true }
    );

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if all published posts for this week now have performance data
    // If so, auto-trigger Monday Brief generation
    let briefTriggered = false;
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const publishedPosts = await Post.find({
        status: 'published',
        publishedAt: { $gte: weekStart, $lt: weekEnd },
      }).lean();

      const pendingCount = publishedPosts.filter(
        (p) => !p.performance || (p.performance.likes === 0 && p.performance.comments === 0 && p.performance.reach === 0)
      ).length;

      // If all performance submitted and no weekly digest yet, auto-trigger
      if (pendingCount === 0 && publishedPosts.length > 0) {
        const existingDigest = await AnalyticsWeekly.findOne({ weekStart });
        if (!existingDigest) {
          briefTriggered = true;
          // Fire-and-forget the weekly generation
          (async () => {
            try {
              const evidenceContext = await gatherEvidenceContext();
              const briefResult = await runAgentCritiqueLoop({
                generatorPrompt: 'monday-brief',
                critiquePrompt: 'monday-brief-critique',
                context: { ...evidenceContext, WEEK_START: weekStart.toISOString().slice(0, 10) },
                operation: 'generate_monday_brief',
                user: 'auto-trigger',
                relatedCollection: 'AnalyticsWeekly',
              });
              console.log('[Analytics] Auto-triggered Monday Brief generation');
            } catch (err) {
              console.error('[Analytics] Auto Monday Brief failed:', err);
            }
          })();
        }
      }
    } catch (checkErr) {
      console.error('[Analytics] Auto-brief check failed:', checkErr);
    }

    res.json({
      message: 'Performance metrics logged',
      briefTriggered,
      performance: {
        postId,
        likes,
        comments,
        shares,
        dms,
        reach,
        saves,
        engagementRate: roundedRate,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log performance metrics' });
  }
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
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    // Get latest AnalyticsWeekly for signal score + breakdown
    const latestAnalytics = await AnalyticsWeekly.findOne().sort({ weekStart: -1 });

    // Calculate week boundaries (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Count posts published this week by platform and author
    const postsThisWeek = await Post.find({
      status: 'published',
      publishedAt: { $gte: weekStart, $lt: weekEnd },
    }).lean();

    const postCounts = {
      linkedin: { shohini: 0, sanjoy: 0 },
      instagram: { shohini: 0, sanjoy: 0 },
    };

    for (const post of postsThisWeek) {
      const platforms = post.platform === 'both' ? ['linkedin', 'instagram'] : [post.platform];
      for (const plat of platforms) {
        if (plat === 'linkedin' || plat === 'instagram') {
          postCounts[plat][post.author]++;
        }
      }
    }

    // Pipeline summary from Lead collection
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const allLeads = await Lead.find({ stage: { $nin: ['LOST'] } }).lean();
    const totalLeads = allLeads.length;
    const totalPipelineValue = allLeads.reduce((sum, l) => sum + (l.dealValue || 0), 0);

    const newThisWeek = await Lead.countDocuments({
      createdAt: { $gte: weekStart, $lt: weekEnd },
    });

    const demosThisWeek = await Lead.countDocuments({
      stage: 'DEMO_DONE',
      updatedAt: { $gte: weekStart, $lt: weekEnd },
    });

    const signedThisMonth = await Lead.countDocuments({
      stage: 'SIGNED',
      updatedAt: { $gte: monthStart },
    });

    // Find top post by engagement rate
    const topPost = await Post.findOne({
      status: 'published',
      'performance.engagementRate': { $gt: 0 },
    })
      .sort({ 'performance.engagementRate': -1 })
      .select('_id platform performance.engagementRate performance.reach')
      .lean();

    // Get platform benchmarks from current strategy
    const currentStrategy = await Strategy.findOne({ isCurrent: true })
      .select('platformBenchmarks')
      .lean();

    res.json({
      signalScore: latestAnalytics?.signalScore ?? 0,
      scoreBreakdown: latestAnalytics?.scoreBreakdown ?? {
        postingConsistency: 0,
        pipelineActivity: 0,
        strategyAlignment: 0,
        engagementHealth: 0,
      },
      postsThisWeek: postCounts,
      pipelineSummary: {
        totalLeads,
        newThisWeek,
        demosThisWeek,
        signedThisMonth,
        totalPipelineValue,
      },
      topPost: topPost
        ? {
            _id: topPost._id,
            platform: topPost.platform,
            engagementRate: topPost.performance?.engagementRate ?? 0,
            reach: topPost.performance?.reach ?? 0,
          }
        : null,
      platformBenchmarks: currentStrategy?.platformBenchmarks || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
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
router.get('/signal-score', async (req: Request, res: Response) => {
  try {
    const latest = await AnalyticsWeekly.findOne().sort({ weekStart: -1 });

    if (!latest) {
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
      return;
    }

    // Compare with previous week for trend
    const previous = await AnalyticsWeekly.findOne({
      weekStart: { $lt: latest.weekStart },
    }).sort({ weekStart: -1 });

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (previous) {
      if (latest.signalScore > previous.signalScore) trend = 'up';
      else if (latest.signalScore < previous.signalScore) trend = 'down';
    }

    res.json({
      signalScore: latest.signalScore,
      breakdown: latest.scoreBreakdown,
      weekStart: latest.weekStart.toISOString().slice(0, 10),
      trend,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load signal score' });
  }
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
router.get('/monday-brief', async (req: Request, res: Response) => {
  try {
    const brief = await AnalyticsWeekly.findOne({ mondayBriefGenerated: true })
      .sort({ weekStart: -1 });

    if (!brief) {
      res.status(404).json({ error: 'No Monday Brief has been generated yet' });
      return;
    }

    // Compute highlights from stored data
    const postsPublished =
      (brief.postsPublished?.linkedin?.shohini ?? 0) +
      (brief.postsPublished?.linkedin?.sanjoy ?? 0) +
      (brief.postsPublished?.instagram?.shohini ?? 0) +
      (brief.postsPublished?.instagram?.sanjoy ?? 0);

    // Get top post reach if available
    let topPostReach = 0;
    if (brief.topPostId) {
      const topPost = await Post.findById(brief.topPostId).lean();
      topPostReach = topPost?.performance?.reach ?? 0;
    }

    res.json({
      weekStart: brief.weekStart.toISOString().slice(0, 10),
      generated: true,
      content: brief.mondayBriefContent,
      signalScore: brief.signalScore,
      highlights: {
        postsPublished,
        newLeads: brief.pipelineNewLeads,
        topPostReach,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load Monday Brief' });
  }
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
router.post('/generate-weekly', async (req: Request, res: Response) => {
  try {
    // Calculate weekStart (most recent Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 7);

    // Check if already exists
    const existing = await AnalyticsWeekly.findOne({ weekStart: monday });
    if (existing) {
      res.status(409).json({ error: 'Weekly digest already generated for this week' });
      return;
    }

    // Gather evidence context
    const evidenceContext = await gatherEvidenceContext();

    // Generate Monday Brief via orchestrator
    const briefResult = await runAgentCritiqueLoop({
      generatorPrompt: 'monday-brief',
      critiquePrompt: 'monday-brief-critique',
      context: {
        ...evidenceContext,
        WEEK_START: monday.toISOString().slice(0, 10),
      },
      operation: 'generate_monday_brief',
      user: (req as any).user?.email || '',
      relatedCollection: 'AnalyticsWeekly',
    });

    // Count posts published this week by platform and author
    const posts = await Post.find({
      status: 'published',
      publishedAt: { $gte: monday, $lt: weekEnd },
    }).lean();

    const postsPublished = {
      linkedin: { shohini: 0, sanjoy: 0 },
      instagram: { shohini: 0, sanjoy: 0 },
    };
    for (const post of posts) {
      const platforms = post.platform === 'both' ? ['linkedin', 'instagram'] : [post.platform];
      for (const plat of platforms) {
        if (plat === 'linkedin' || plat === 'instagram') {
          postsPublished[plat][post.author]++;
        }
      }
    }

    const totalPosts =
      postsPublished.linkedin.shohini + postsPublished.linkedin.sanjoy +
      postsPublished.instagram.shohini + postsPublished.instagram.sanjoy;

    // Lead activity this week
    const newLeads = await Lead.countDocuments({
      createdAt: { $gte: monday, $lt: weekEnd },
    });
    const demos = await Lead.countDocuments({
      stage: 'DEMO_DONE',
      updatedAt: { $gte: monday, $lt: weekEnd },
    });
    const signed = await Lead.countDocuments({
      stage: 'SIGNED',
      updatedAt: { $gte: monday, $lt: weekEnd },
    });

    // Top post by engagement
    const topPost = await Post.findOne({
      status: 'published',
      publishedAt: { $gte: monday, $lt: weekEnd },
      'performance.engagementRate': { $gt: 0 },
    })
      .sort({ 'performance.engagementRate': -1 })
      .lean();

    // Strategy alignment
    const strategy = await Strategy.findOne({ isCurrent: true });
    const targetPillars = strategy?.contentPillars ?? [];

    // Compute pillar performance
    const pillarCounts: Record<string, number> = {};
    const pillarEngagements: Record<string, number[]> = {};
    for (const post of posts) {
      const pillar = post.contentPillar || 'uncategorized';
      pillarCounts[pillar] = (pillarCounts[pillar] || 0) + 1;
      if (post.performance?.engagementRate) {
        if (!pillarEngagements[pillar]) pillarEngagements[pillar] = [];
        pillarEngagements[pillar].push(post.performance.engagementRate);
      }
    }

    const pillarPerformance = targetPillars.map((tp) => {
      const count = pillarCounts[tp.name] || 0;
      const engs = pillarEngagements[tp.name] || [];
      const avgEngagement = engs.length > 0 ? engs.reduce((a, b) => a + b, 0) / engs.length : 0;
      return {
        pillar: tp.name,
        postsCount: count,
        avgEngagement: Math.round(avgEngagement * 100) / 100,
        leadsGenerated: 0,
        actualPercent: totalPosts > 0 ? Math.round((count / totalPosts) * 100) : 0,
        targetPercent: tp.targetPercent,
      };
    });

    // Calculate Signal Score components (each 0-25, total 0-100)
    // Posting consistency: compare total posts against weekly target
    const weeklyTargets = strategy?.platformStrategy ?? [];
    const totalWeeklyTarget = weeklyTargets.reduce((sum, ps) => sum + (ps.weeklyTarget || 0), 0);
    const postingConsistency = totalWeeklyTarget > 0
      ? Math.min(25, Math.round((totalPosts / totalWeeklyTarget) * 25))
      : 0;

    // Pipeline activity: based on new leads + demos + signed
    const pipelineActivity = Math.min(25, (newLeads * 3) + (demos * 5) + (signed * 10));

    // Strategy alignment: compare actual vs target pillar distribution
    let alignmentScore = 25;
    for (const pp of pillarPerformance) {
      const deviation = Math.abs(pp.actualPercent - pp.targetPercent);
      if (deviation > 15) alignmentScore -= 5;
      else if (deviation > 10) alignmentScore -= 3;
      else if (deviation > 5) alignmentScore -= 1;
    }
    const strategyAlignment = Math.max(0, alignmentScore);

    // Engagement health: based on average engagement rate of published posts
    const allEngagements = posts
      .filter((p) => p.performance?.engagementRate)
      .map((p) => p.performance!.engagementRate);
    const avgEngagement = allEngagements.length > 0
      ? allEngagements.reduce((a, b) => a + b, 0) / allEngagements.length
      : 0;
    const engagementHealth = Math.min(25, Math.round(avgEngagement * 5));

    const signalScore = postingConsistency + pipelineActivity + strategyAlignment + engagementHealth;

    // Create AnalyticsWeekly record
    const analyticsRecord = await AnalyticsWeekly.create({
      weekStart: monday,
      signalScore,
      scoreBreakdown: {
        postingConsistency,
        pipelineActivity,
        strategyAlignment,
        engagementHealth,
      },
      postsPublished,
      topPostId: topPost?._id || null,
      pipelineNewLeads: newLeads,
      pipelineDemos: demos,
      pipelineSigned: signed,
      pillarPerformance,
      aiRecommendations: briefResult.parsed?.recommendations || [],
      mondayBriefGenerated: true,
      mondayBriefContent: briefResult.content,
    });

    res.json({
      message: 'Weekly digest generation started',
      weekStart: monday.toISOString().slice(0, 10),
      status: 'completed',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate weekly digest' });
  }
});

/**
 * GET /api/analytics/weekly-performance
 * Returns last-week content performance data for strategy course-correction.
 * Includes top posts, format breakdown, platform summary, week-over-week trends,
 * and content-to-pipeline attribution.
 */
router.get('/weekly-performance', async (req: Request, res: Response) => {
  try {
    // Calculate current week boundaries (Monday–Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 7);

    // Previous week boundaries
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);

    // Fetch published posts for both weeks
    const [thisWeekPosts, lastWeekPosts] = await Promise.all([
      Post.find({
        status: 'published',
        publishedAt: { $gte: thisWeekStart, $lt: thisWeekEnd },
      }).lean(),
      Post.find({
        status: 'published',
        publishedAt: { $gte: lastWeekStart, $lt: lastWeekEnd },
      }).lean(),
    ]);

    // --- Top Performing Posts (top 5 by engagement rate) ---
    const postsWithEngagement = thisWeekPosts
      .filter((p) => p.performance?.engagementRate && p.performance.engagementRate > 0)
      .sort((a, b) => (b.performance?.engagementRate || 0) - (a.performance?.engagementRate || 0))
      .slice(0, 5);

    const topPosts = postsWithEngagement.map((p) => ({
      _id: p._id,
      platform: p.platform,
      format: p.format,
      contentPillar: p.contentPillar || 'uncategorized',
      author: p.author,
      publishedAt: p.publishedAt,
      hookPreview: (p.finalContent || p.draftContent || '').slice(0, 120),
      performance: {
        likes: p.performance?.likes || 0,
        comments: p.performance?.comments || 0,
        shares: p.performance?.shares || 0,
        dms: p.performance?.dms || 0,
        reach: p.performance?.reach || 0,
        saves: p.performance?.saves || 0,
        engagementRate: p.performance?.engagementRate || 0,
      },
    }));

    // --- Format Performance Breakdown ---
    const formatMap: Record<string, { count: number; totalEngagement: number; totalReach: number }> = {};
    for (const p of thisWeekPosts) {
      const fmt = p.format || 'unknown';
      if (!formatMap[fmt]) formatMap[fmt] = { count: 0, totalEngagement: 0, totalReach: 0 };
      formatMap[fmt].count++;
      formatMap[fmt].totalEngagement += p.performance?.engagementRate || 0;
      formatMap[fmt].totalReach += p.performance?.reach || 0;
    }
    const formatBreakdown = Object.entries(formatMap)
      .map(([format, data]) => ({
        format,
        postsCount: data.count,
        avgEngagement: data.count > 0 ? Math.round((data.totalEngagement / data.count) * 100) / 100 : 0,
        totalReach: data.totalReach,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // --- Platform Summary ---
    const buildPlatformSummary = (posts: any[]) => {
      const summary: Record<string, { postsCount: number; totalEngagement: number; totalReach: number; engagedPosts: number }> = {
        linkedin: { postsCount: 0, totalEngagement: 0, totalReach: 0, engagedPosts: 0 },
        instagram: { postsCount: 0, totalEngagement: 0, totalReach: 0, engagedPosts: 0 },
      };
      for (const p of posts) {
        const platforms = p.platform === 'both' ? ['linkedin', 'instagram'] : [p.platform];
        for (const plat of platforms) {
          if (plat === 'linkedin' || plat === 'instagram') {
            summary[plat].postsCount++;
            summary[plat].totalReach += p.performance?.reach || 0;
            if (p.performance?.engagementRate) {
              summary[plat].totalEngagement += p.performance.engagementRate;
              summary[plat].engagedPosts++;
            }
          }
        }
      }
      return {
        linkedin: {
          postsCount: summary.linkedin.postsCount,
          avgEngagement: summary.linkedin.engagedPosts > 0
            ? Math.round((summary.linkedin.totalEngagement / summary.linkedin.engagedPosts) * 100) / 100
            : 0,
          totalReach: summary.linkedin.totalReach,
        },
        instagram: {
          postsCount: summary.instagram.postsCount,
          avgEngagement: summary.instagram.engagedPosts > 0
            ? Math.round((summary.instagram.totalEngagement / summary.instagram.engagedPosts) * 100) / 100
            : 0,
          totalReach: summary.instagram.totalReach,
        },
      };
    };

    const thisWeekSummary = buildPlatformSummary(thisWeekPosts);
    const lastWeekSummary = buildPlatformSummary(lastWeekPosts);

    // --- Week-over-Week Comparison ---
    const calcWoW = (thisVal: number, lastVal: number) => ({
      thisWeek: thisVal,
      lastWeek: lastVal,
      change: lastVal > 0 ? Math.round(((thisVal - lastVal) / lastVal) * 100) : thisVal > 0 ? 100 : 0,
    });

    const thisWeekEngagements = thisWeekPosts
      .filter((p) => p.performance?.engagementRate)
      .map((p) => p.performance!.engagementRate);
    const lastWeekEngagements = lastWeekPosts
      .filter((p) => p.performance?.engagementRate)
      .map((p) => p.performance!.engagementRate);

    const thisAvgEng = thisWeekEngagements.length > 0
      ? Math.round((thisWeekEngagements.reduce((a, b) => a + b, 0) / thisWeekEngagements.length) * 100) / 100
      : 0;
    const lastAvgEng = lastWeekEngagements.length > 0
      ? Math.round((lastWeekEngagements.reduce((a, b) => a + b, 0) / lastWeekEngagements.length) * 100) / 100
      : 0;

    const thisWeekReach = thisWeekPosts.reduce((sum, p) => sum + (p.performance?.reach || 0), 0);
    const lastWeekReach = lastWeekPosts.reduce((sum, p) => sum + (p.performance?.reach || 0), 0);

    // Leads this week vs last week
    const [thisWeekLeads, lastWeekLeads] = await Promise.all([
      Lead.countDocuments({ createdAt: { $gte: thisWeekStart, $lt: thisWeekEnd } }),
      Lead.countDocuments({ createdAt: { $gte: lastWeekStart, $lt: lastWeekEnd } }),
    ]);

    const weekOverWeek = {
      engagementRate: calcWoW(thisAvgEng, lastAvgEng),
      postsPublished: calcWoW(thisWeekPosts.length, lastWeekPosts.length),
      totalReach: calcWoW(thisWeekReach, lastWeekReach),
      leadsGenerated: calcWoW(thisWeekLeads, lastWeekLeads),
    };

    // --- Content-to-Pipeline Attribution ---
    const leadsFromContent = await Lead.find({
      sourcePostId: { $ne: null },
      createdAt: { $gte: thisWeekStart, $lt: thisWeekEnd },
    }).lean();

    const contentToLeads = [];
    for (const lead of leadsFromContent) {
      const sourcePost = await Post.findById(lead.sourcePostId)
        .select('platform format contentPillar draftContent finalContent')
        .lean();
      if (sourcePost) {
        contentToLeads.push({
          postId: sourcePost._id,
          platform: sourcePost.platform,
          format: sourcePost.format,
          contentPillar: sourcePost.contentPillar || 'uncategorized',
          hookPreview: (sourcePost.finalContent || sourcePost.draftContent || '').slice(0, 100),
          leadCompany: lead.companyName,
          leadStage: lead.stage,
          dealValue: lead.dealValue,
        });
      }
    }

    // --- Platform Benchmarks (for follower growth context) ---
    const currentStrategy = await Strategy.findOne({ isCurrent: true })
      .select('platformBenchmarks contentPillars platformStrategy')
      .lean();

    res.json({
      period: {
        start: thisWeekStart.toISOString().slice(0, 10),
        end: thisWeekEnd.toISOString().slice(0, 10),
      },
      topPosts,
      formatBreakdown,
      platformSummary: {
        thisWeek: thisWeekSummary,
        lastWeek: lastWeekSummary,
      },
      weekOverWeek,
      contentToLeads,
      platformBenchmarks: currentStrategy?.platformBenchmarks || null,
      pillarTargets: (currentStrategy?.contentPillars || []).map((p: any) => ({
        name: p.name,
        targetPercent: p.targetPercent,
      })),
    });
  } catch (error) {
    console.error('Weekly performance error:', error);
    res.status(500).json({ error: 'Failed to load weekly performance data' });
  }
});

/**
 * GET /api/analytics/pending-performance
 * Returns published posts this week that are missing performance data.
 */
router.get('/pending-performance', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const publishedPosts = await Post.find({
      status: 'published',
      publishedAt: { $gte: weekStart, $lt: weekEnd },
    })
      .select('_id author platform contentPillar linkedinHook scheduledAt publishedAt performance')
      .lean();

    const pendingPosts = publishedPosts.filter(
      (p) => !p.performance || (p.performance.likes === 0 && p.performance.comments === 0 && p.performance.reach === 0)
    );

    const existingDigest = await AnalyticsWeekly.findOne({ weekStart });

    res.json({
      pendingPosts,
      count: pendingPosts.length,
      briefBlocked: pendingPosts.length > 0 && !existingDigest,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check pending performance' });
  }
});

export default router;
