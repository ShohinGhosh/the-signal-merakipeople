import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Post } from '../models/Post';
import { Strategy } from '../models/Strategy';
import { Campaign } from '../models/Campaign';
import { SignalFeed } from '../models/SignalFeed';
import { runAgentCritiqueLoop } from '../services/ai/orchestrator';
import { runContentAgents, runAgent } from '../services/automations/agentRunner';
import { getIntelligenceContext } from '../services/feedback/intelligenceService';

const router = Router();

/**
 * Format a Date to YYYY-MM-DD in local timezone (avoids UTC shift issues for IST users).
 */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Generation progress tracker (in-memory)
let generationProgress: { active: boolean; step: string; startedAt: Date | null } = {
  active: false, step: '', startedAt: null,
};

function setProgress(step: string) {
  generationProgress = { active: true, step, startedAt: generationProgress.startedAt || new Date() };
}

function clearProgress() {
  generationProgress = { active: false, step: '', startedAt: null };
}

// All calendar routes require authentication
router.use(authMiddleware);

// GET /api/calendar/generation-progress — poll for generation status
router.get('/generation-progress', (req: Request, res: Response) => {
  res.json(generationProgress);
});

/**
 * @openapi
 * /api/calendar:
 *   get:
 *     tags:
 *       - Calendar
 *     summary: Get calendar data
 *     description: Returns scheduled posts organized by date for the specified view (month or week). Each date slot contains the posts scheduled for that date with their platform, author, pillar, and status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: view
 *         schema:
 *           type: string
 *           enum: [month, week]
 *           default: month
 *         description: Calendar view type
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *         description: Date for the view — YYYY-MM for month view, YYYY-MM-DD for week view
 *         example: '2026-03'
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *           enum: [shohini, sanjoy]
 *         description: Filter by author
 *     responses:
 *       200:
 *         description: Calendar data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 view:
 *                   type: string
 *                   enum: [month, week]
 *                   example: month
 *                 date:
 *                   type: string
 *                   example: '2026-03'
 *                 days:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                         example: '2026-03-06'
 *                       posts:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             author:
 *                               type: string
 *                               enum: [shohini, sanjoy]
 *                             platform:
 *                               type: string
 *                               enum: [linkedin, instagram, both]
 *                             contentPillar:
 *                               type: string
 *                             format:
 *                               type: string
 *                             status:
 *                               type: string
 *                               enum: [draft, scheduled, ready, published, archived]
 *                             scheduledAt:
 *                               type: string
 *                               format: date-time
 *                             linkedinHook:
 *                               type: string
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const view = (req.query.view as string) || 'month';
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 7);
    const author = req.query.author as string | undefined;

    // Calculate date range based on view
    let rangeStart: Date;
    let rangeEnd: Date;

    if (view === 'week') {
      const baseDate = new Date(date);
      const dayOfWeek = baseDate.getDay();
      rangeStart = new Date(baseDate);
      rangeStart.setDate(baseDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeStart.getDate() + 7);
    } else {
      // month view — date is YYYY-MM
      const [year, month] = date.split('-').map(Number);
      rangeStart = new Date(year, month - 1, 1);
      rangeEnd = new Date(year, month, 1);
    }

    // Build query
    const query: Record<string, any> = {
      scheduledAt: { $gte: rangeStart, $lt: rangeEnd },
    };
    if (author) {
      query.author = author;
    }

    const posts = await Post.find(query)
      .select('_id author platform contentPillar format status scheduledAt linkedinHook instagramHook notes cta draftContent draftCarouselOutline imageUrl imagePrompt imageType imageVariations carouselPdfUrl aiEvidence hashtags approved finalContent')
      .sort({ scheduledAt: 1 })
      .lean();

    // Group posts by date
    const dayMap: Record<string, any[]> = {};
    for (const post of posts) {
      if (!post.scheduledAt) continue;
      const dateKey = toLocalDateStr(new Date(post.scheduledAt));
      if (!dayMap[dateKey]) dayMap[dateKey] = [];
      dayMap[dateKey].push(post);
    }

    // Convert to sorted days array
    const days = Object.keys(dayMap)
      .sort()
      .map((dateKey) => ({
        date: dateKey,
        posts: dayMap[dateKey],
      }));

    res.json({
      view,
      date,
      days,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load calendar data' });
  }
});

/**
 * @openapi
 * /api/calendar/gaps:
 *   get:
 *     tags:
 *       - Calendar
 *     summary: Detect calendar gaps
 *     description: Analyzes the content calendar and identifies gaps where no posts are scheduled for 3 or more consecutive days per author. Returns the gap periods and suggested actions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *           enum: [shohini, sanjoy]
 *         description: Check gaps for a specific author
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start of date range to check
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End of date range to check
 *     responses:
 *       200:
 *         description: List of detected gaps
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gaps:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       author:
 *                         type: string
 *                         enum: [shohini, sanjoy]
 *                         example: shohini
 *                       startDate:
 *                         type: string
 *                         format: date
 *                         example: '2026-03-10'
 *                       endDate:
 *                         type: string
 *                         format: date
 *                         example: '2026-03-14'
 *                       daysWithoutPosts:
 *                         type: number
 *                         example: 5
 *                       platform:
 *                         type: string
 *                         example: linkedin
 *                       suggestion:
 *                         type: string
 *                         example: Consider scheduling a thought_leadership post on LinkedIn
 */
router.get('/gaps', async (req: Request, res: Response) => {
  try {
    const authorFilter = req.query.author as string | undefined;
    const now = new Date();
    const rangeStart = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeEnd = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);

    const authors: string[] = authorFilter ? [authorFilter] : ['shohini', 'sanjoy'];

    const gaps: any[] = [];

    for (const author of authors) {
      // Get all scheduled posts for this author in the range
      const posts = await Post.find({
        author,
        scheduledAt: { $gte: rangeStart, $lte: rangeEnd },
        status: { $nin: ['archived'] },
      })
        .select('scheduledAt platform')
        .sort({ scheduledAt: 1 })
        .lean();

      // Build set of dates that have posts
      const datesWithPosts = new Set<string>();
      for (const post of posts) {
        if (post.scheduledAt) {
          datesWithPosts.add(new Date(post.scheduledAt).toISOString().slice(0, 10));
        }
      }

      // Walk through each day in the range and detect 3+ day gaps
      let gapStart: Date | null = null;
      let gapDays = 0;

      const current = new Date(rangeStart);
      while (current <= rangeEnd) {
        const dateKey = current.toISOString().slice(0, 10);
        if (!datesWithPosts.has(dateKey)) {
          if (!gapStart) gapStart = new Date(current);
          gapDays++;
        } else {
          if (gapStart && gapDays >= 3) {
            const gapEnd = new Date(current);
            gapEnd.setDate(gapEnd.getDate() - 1);
            gaps.push({
              author,
              startDate: gapStart.toISOString().slice(0, 10),
              endDate: gapEnd.toISOString().slice(0, 10),
              daysWithoutPosts: gapDays,
              platform: 'linkedin',
              suggestion: `Consider scheduling a thought_leadership post on LinkedIn`,
            });
          }
          gapStart = null;
          gapDays = 0;
        }
        current.setDate(current.getDate() + 1);
      }

      // Handle trailing gap
      if (gapStart && gapDays >= 3) {
        gaps.push({
          author,
          startDate: gapStart.toISOString().slice(0, 10),
          endDate: rangeEnd.toISOString().slice(0, 10),
          daysWithoutPosts: gapDays,
          platform: 'linkedin',
          suggestion: `Consider scheduling a thought_leadership post on LinkedIn`,
        });
      }
    }

    res.json({ gaps });
  } catch (error) {
    res.status(500).json({ error: 'Failed to detect calendar gaps' });
  }
});

/**
 * @openapi
 * /api/calendar/alignment:
 *   get:
 *     tags:
 *       - Calendar
 *     summary: Get pillar distribution alignment
 *     description: Compares the actual content pillar distribution in the calendar against the strategy-defined target percentages. Identifies over- and under-represented pillars.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start of date range to analyze
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End of date range to analyze
 *     responses:
 *       200:
 *         description: Pillar distribution vs strategy targets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alignment:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       pillar:
 *                         type: string
 *                         example: thought_leadership
 *                       targetPercent:
 *                         type: number
 *                         example: 30
 *                       actualPercent:
 *                         type: number
 *                         example: 22
 *                       postCount:
 *                         type: number
 *                         example: 4
 *                       status:
 *                         type: string
 *                         enum: [on_track, under, over]
 *                         example: under
 *                       deviation:
 *                         type: number
 *                         description: Percentage point deviation from target (positive = over, negative = under)
 *                         example: -8
 *                 totalPosts:
 *                   type: number
 *                   example: 18
 *                 period:
 *                   type: object
 *                   properties:
 *                     startDate:
 *                       type: string
 *                       format: date
 *                     endDate:
 *                       type: string
 *                       format: date
 */
router.get('/alignment', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startDate = (req.query.startDate as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = (req.query.endDate as string) || now.toISOString().slice(0, 10);

    const rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);

    // Get strategy to find content pillar targets
    const strategy = await Strategy.findOne({ isCurrent: true });
    const targetPillars = strategy?.contentPillars ?? [];

    // Count posts per contentPillar in the range
    const posts = await Post.find({
      scheduledAt: { $gte: rangeStart, $lte: rangeEnd },
      status: { $nin: ['archived'] },
    })
      .select('contentPillar')
      .lean();

    const totalPosts = posts.length;

    const pillarCounts: Record<string, number> = {};
    for (const post of posts) {
      const pillar = post.contentPillar || 'uncategorized';
      pillarCounts[pillar] = (pillarCounts[pillar] || 0) + 1;
    }

    // Compare actual vs target
    const alignment = targetPillars.map((tp) => {
      const postCount = pillarCounts[tp.name] || 0;
      const actualPercent = totalPosts > 0 ? Math.round((postCount / totalPosts) * 100) : 0;
      const deviation = actualPercent - tp.targetPercent;

      let status: 'on_track' | 'under' | 'over' = 'on_track';
      if (deviation < -5) status = 'under';
      else if (deviation > 5) status = 'over';

      return {
        pillar: tp.name,
        targetPercent: tp.targetPercent,
        actualPercent,
        postCount,
        status,
        deviation,
      };
    });

    res.json({
      alignment,
      totalPosts,
      period: {
        startDate,
        endDate,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate alignment' });
  }
});

/**
 * @openapi
 * /api/calendar/reschedule:
 *   put:
 *     tags:
 *       - Calendar
 *     summary: Reschedule a post
 *     description: Moves a scheduled post to a new date on the content calendar.
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
 *               - newDate
 *             properties:
 *               postId:
 *                 type: string
 *                 description: The ID of the post to reschedule
 *                 example: 507f1f77bcf86cd799439011
 *               newDate:
 *                 type: string
 *                 format: date-time
 *                 description: The new scheduled date and time
 *                 example: '2026-03-15T10:00:00.000Z'
 *     responses:
 *       200:
 *         description: Post rescheduled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post rescheduled
 *                 post:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     scheduledAt:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                       example: scheduled
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: postId and newDate are required
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
router.put('/reschedule', async (req: Request, res: Response) => {
  try {
    const { postId, newDate } = req.body;

    if (!postId || !newDate) {
      res.status(400).json({ error: 'postId and newDate are required' });
      return;
    }

    // Preserve the post's current time when rescheduling to a new date
    const existingPost = await Post.findById(postId);
    if (!existingPost) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const oldDate = existingPost.scheduledAt ? new Date(existingPost.scheduledAt) : new Date();
    const newDateObj = new Date(newDate);
    // Keep the original time, just change the date
    newDateObj.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0);

    const post = await Post.findByIdAndUpdate(
      postId,
      { scheduledAt: newDateObj },
      { new: true }
    );

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({
      message: 'Post rescheduled',
      post: {
        _id: post._id,
        scheduledAt: post.scheduledAt,
        status: post.status,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reschedule post' });
  }
});

// ============ NEW ENDPOINTS: Weekly Planner ============

/**
 * Helper: get the Monday of the current week (or next Monday if today is weekend)
 */
function getNextMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 6 ? 2 : (8 - dayOfWeek));
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getCurrentMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * @openapi
 * /api/calendar/generate-week:
 *   post:
 *     tags:
 *       - Calendar
 *     summary: Generate a weekly content plan using AI
 *     description: Uses the current marketing strategy to generate an AI-powered 1-week content calendar with specific post tasks, topics, and strategy evidence.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weekStart:
 *                 type: string
 *                 format: date
 *                 description: Monday of the target week (defaults to current/next Monday)
 *                 example: '2026-03-09'
 *     responses:
 *       200:
 *         description: Weekly plan generated and posts created
 *       400:
 *         description: No approved strategy found
 *       503:
 *         description: AI provider not configured
 */
router.post('/generate-week', async (req: Request, res: Response) => {
  try {
    // 1. Get the current strategy
    const strategy = await Strategy.findOne({ isCurrent: true, isComplete: true });
    if (!strategy) {
      res.status(400).json({
        error: 'No approved strategy found. Please complete and approve your strategy first.',
      });
      return;
    }

    // 2. Determine week start and platforms
    let weekStart: Date;
    if (req.body.weekStart) {
      weekStart = new Date(req.body.weekStart);
    } else {
      weekStart = getCurrentMonday();
    }

    // Platforms filter — defaults to all platforms from strategy if not specified
    const requestedPlatforms: string[] = req.body.platforms || [];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().slice(0, 10);

    setProgress('Preparing strategy...');
    console.log(`[Calendar Generate] Generating week plan for ${weekStartStr}...`);

    // 3. Delete old AI-generated posts for this week (regenerate = full replace)
    //    Keep ONLY published posts (those were actually posted by the user)
    const deleteResult = await Post.deleteMany({
      scheduledAt: { $gte: weekStart, $lte: weekEnd },
      status: { $in: ['draft', 'ready', 'scheduled'] },
    });
    if (deleteResult.deletedCount > 0) {
      console.log(`[Calendar Generate] Cleared ${deleteResult.deletedCount} old posts for regeneration (kept published only)`);
    }

    // 3b. Restore signals that were marked 'in_calendar' back to 'confirmed'
    //     so they can be re-used in the new generation (especially Journal entries)
    const restoredSignals = await SignalFeed.updateMany(
      {
        status: 'in_calendar',
        createdAt: { $gte: new Date(weekStart.getTime() - 14 * 24 * 60 * 60 * 1000), $lte: weekEnd },
      },
      { status: 'confirmed' }
    );
    if (restoredSignals.modifiedCount > 0) {
      console.log(`[Calendar Generate] Restored ${restoredSignals.modifiedCount} signals back to confirmed for regeneration`);
    }

    // 4. Get remaining posts (scheduled/published) to avoid duplication
    const existingPosts = await Post.find({
      scheduledAt: { $gte: weekStart, $lte: weekEnd },
      status: { $nin: ['archived'] },
    })
      .select('author platform contentPillar format scheduledAt linkedinHook notes')
      .lean();

    const existingPostsSummary = existingPosts.length > 0
      ? existingPosts.map((p) =>
        `${new Date(p.scheduledAt!).toISOString().slice(0, 10)} | ${p.author} | ${p.platform} | ${p.contentPillar} | ${p.linkedinHook || p.notes || 'untitled'}`
      ).join('\n')
      : 'None — this is a fresh week.';

    // 4. Get active campaigns
    const activeCampaigns = await Campaign.find({
      status: 'active',
      startDate: { $lte: weekEnd },
      endDate: { $gte: weekStart },
    }).lean();

    const campaignsSummary = activeCampaigns.length > 0
      ? activeCampaigns.map((c) =>
        `[${c._id}] ${c.name} — Goal: ${c.goal} | Brief: ${c.contentBrief} | Platforms: ${c.platforms.join(', ')}`
      ).join('\n')
      : 'No active campaigns this week.';

    // 5. Fetch confirmed signal feed entries — include this week + recent unused from past 2 weeks
    //    This ensures Journal entries and other signals are always picked up, even if created earlier
    const signalLookbackStart = new Date(weekStart.getTime() - 14 * 24 * 60 * 60 * 1000);
    const confirmedSignals = await SignalFeed.find({
      status: 'confirmed',
      routing: { $in: ['content_seed', 'campaign_fuel'] },
      createdAt: { $gte: signalLookbackStart, $lte: weekEnd },
    }).lean();

    const signalsSummary = confirmedSignals.length > 0
      ? confirmedSignals.map((s: any) => {
        const isPriority = (s.tags || []).includes('priority_signal');
        const prefix = isPriority ? '🔥 PRIORITY — MUST CREATE A POST FOR THIS: ' : '';
        return `${prefix}[ID:${s._id}] [${s.author}] [${s.routing}] [tags: ${(s.tags || []).join(', ')}] ${s.rawText.substring(0, 300)}${s.urlReference ? ' | URL: ' + s.urlReference : ''}`;
      }).join('\n')
      : 'No confirmed signals this week.';

    // 5b. Fetch viral/trending signals (market_observation, inspired_by) from last 2 weeks
    const twoWeeksAgo = new Date(weekStart.getTime() - 14 * 24 * 60 * 60 * 1000);
    const viralSignals = await SignalFeed.find({
      tags: { $in: ['market_observation', 'inspired_by'] },
      createdAt: { $gte: twoWeeksAgo, $lte: weekEnd },
    }).lean();

    const viralSummary = viralSignals.length > 0
      ? viralSignals.map((s: any) =>
        `[${s.author}] [tags: ${(s.tags || []).join(', ')}] ${s.rawText.substring(0, 300)}${s.urlReference ? ' | URL: ' + s.urlReference : ''}`
      ).join('\n')
      : 'No viral/trending signals captured recently.';

    setProgress('Loading signals...');
    console.log(`[Calendar Generate] Found ${confirmedSignals.length} confirmed signals, ${viralSignals.length} viral signals for week ${weekStartStr}`);
    if (confirmedSignals.length > 0) {
      console.log(`[Calendar Generate] Signals being sent to AI:\n${signalsSummary}`);
    }

    // 5c. Build context first (needed for research call)
    const pillarsSummary = (strategy.contentPillars || []).map((p) =>
      `- ${p.name} (${p.targetPercent}% target, owner: ${p.owner}) — ${p.purpose}. Formats: ${p.examplePostTypes.join(', ')}`
    ).join('\n');

    // Filter platform strategy to only requested platforms (if specified)
    const strategyPlatforms = strategy.platformStrategy || [];
    const activePlatforms = requestedPlatforms.length > 0
      ? strategyPlatforms.filter((p) => requestedPlatforms.includes(p.platform.toLowerCase()))
      : strategyPlatforms;

    // If a requested platform isn't in the strategy, add a default entry
    const knownPlatformNames = activePlatforms.map((p) => p.platform.toLowerCase());
    const extraPlatforms = requestedPlatforms
      .filter((rp) => !knownPlatformNames.includes(rp))
      .map((rp) => `- ${rp}: 3 posts/week, purpose: brand awareness & engagement. Best formats: text_post, carousel, video_caption. Best times: 9:00 AM, 12:00 PM`);

    const platformSummary = [
      ...activePlatforms.map((p) =>
        `- ${p.platform}: ${p.weeklyTarget} posts/week, purpose: ${p.primaryPurpose}. Best formats: ${p.bestFormats.join(', ')}. Best times: ${p.bestPostingTimes.join(', ')}`
      ),
      ...extraPlatforms,
    ].join('\n');

    const platformSelectionNote = requestedPlatforms.length > 0
      ? `\nIMPORTANT: The user has selected these platforms for this week: ${requestedPlatforms.join(', ')}. ONLY create posts for these platforms. Do NOT create posts for any other platform.`
      : '';

    // Build platform config context (new channel launch awareness)
    let platformConfigNote = '';
    if (strategy.platformConfig?.length > 0) {
      const configLines = strategy.platformConfig.map((pc: any) => {
        if (pc.status === 'active') return `- ${pc.platform}: ACTIVE (established presence)`;
        if (pc.status === 'planned') return `- ${pc.platform}: PLANNED (not yet launched — if included, treat as NEW CHANNEL LAUNCH: introduce the brand, build initial audience, establish voice)`;
        return `- ${pc.platform}: INACTIVE (do not create content)`;
      });
      platformConfigNote = '\n\nCHANNEL STATUS:\n' + configLines.join('\n');
    }

    console.log(`[Calendar Generate] Platforms: ${requestedPlatforms.length > 0 ? requestedPlatforms.join(', ') : 'all from strategy'}`);

    // 5d. Research special dates & trending topics for this week (INPUT 3 & 4)
    setProgress('Researching dates...');
    let specialDatesResearch = 'No special dates research available.';
    try {
      const weekEndStr = weekEnd.toISOString().slice(0, 10);
      const researchResult = await runAgentCritiqueLoop({
        generatorPrompt: 'calendar-week-research',
        critiquePrompt: 'calendar-week-research-critique',
        context: {
          WEEK_START_DATE: weekStartStr,
          WEEK_END_DATE: weekEndStr,
          ICP_PRIMARY: strategy.icpPrimary ? JSON.stringify(strategy.icpPrimary) : 'Not set',
          ICP_SECONDARY: strategy.icpSecondary ? JSON.stringify(strategy.icpSecondary) : 'Not set',
          POSITIONING: strategy.positioningStatement || '',
          CONTENT_PILLARS: pillarsSummary,
          INDUSTRY_CONTEXT: strategy.competitiveIntelligence || '',
        },
        operation: 'calendar-week-research',
        user: (req as any).user?.name || 'unknown',
        maxIterations: 2,
        acceptThreshold: 7,
      });
      // Post-process: strip out any special dates that are outside the week range
      // (AI sometimes hallucates dates despite instructions)
      try {
        const parsed = researchResult.parsed || JSON.parse(researchResult.content);
        if (parsed.specialDates && Array.isArray(parsed.specialDates)) {
          const weekStartTime = weekStart.getTime();
          const weekEndTime = weekEnd.getTime();
          const before = parsed.specialDates.length;
          parsed.specialDates = parsed.specialDates.filter((d: any) => {
            const dateTime = new Date(d.date).getTime();
            return dateTime >= weekStartTime && dateTime <= weekEndTime;
          });
          if (parsed.specialDates.length < before) {
            console.log(`[Calendar Generate] Stripped ${before - parsed.specialDates.length} out-of-range special dates`);
          }
        }
        specialDatesResearch = JSON.stringify(parsed, null, 2);
      } catch {
        specialDatesResearch = researchResult.content;
      }
      console.log(`[Calendar Generate] Special dates research completed (score: ${researchResult.critique?.score || 'N/A'})`);
    } catch (researchErr) {
      console.error('[Calendar Generate] Special dates research failed (non-blocking):', researchErr);
    }

    // 5e. Gather past content history (avoid topic repetition)
    let contentHistorySummary = '';
    try {
      const { ContentHistory } = await import('../models/ContentHistory');
      const pastEntries = await ContentHistory.find({})
        .sort({ publishedDate: -1 })
        .limit(200)
        .select('author platform topic hook contentPillar publishedDate');

      if (pastEntries.length > 0) {
        const byMonth: Record<string, string[]> = {};
        for (const e of pastEntries) {
          const month = e.publishedDate.toISOString().slice(0, 7);
          if (!byMonth[month]) byMonth[month] = [];
          byMonth[month].push(`- [${e.author}] ${e.topic}${e.hook ? ` ("${e.hook.slice(0, 60)}")` : ''}${e.contentPillar ? ` [${e.contentPillar}]` : ''}`);
        }
        contentHistorySummary = 'PAST CONTENT PUBLISHED — DO NOT REPEAT THESE TOPICS:\n';
        for (const [month, lines] of Object.entries(byMonth).sort().reverse()) {
          contentHistorySummary += `\n--- ${month} ---\n${lines.join('\n')}\n`;
        }
        console.log(`[Calendar Generate] Loaded ${pastEntries.length} past content entries for de-duplication`);
      }
    } catch (err) {
      console.error('[Calendar Generate] Content history load failed (non-blocking):', err);
    }

    // 5f. Gather feedback intelligence (self-learning from user feedback)
    let feedbackIntelligence = '';
    try {
      const intelligence = await getIntelligenceContext();
      feedbackIntelligence = intelligence.promptAugmentation || '';
      if (feedbackIntelligence) {
        console.log(`[Calendar Generate] Injecting feedback intelligence (${intelligence.stats.totalFeedback} feedback points, ${intelligence.stats.approvalRate}% approval rate)`);
      }
    } catch (err) {
      console.error('[Calendar Generate] Feedback intelligence failed (non-blocking):', err);
    }

    // 5g. Gather performance-based strategy recommendations
    let performanceRecommendations = '';
    try {
      const { getPerformanceRecommendationsText } = await import('../services/feedback/performanceInsightsService');
      performanceRecommendations = await getPerformanceRecommendationsText();
      if (performanceRecommendations) {
        console.log(`[Calendar Generate] Injecting performance recommendations`);
      }
    } catch (err) {
      console.error('[Calendar Generate] Performance recommendations failed (non-blocking):', err);
    }

    // 6. Build full context for the AI prompt (all 4 inputs + feedback intelligence)
    const weekEndStr2 = weekEnd.toISOString().slice(0, 10);
    const context: Record<string, string> = {
      WEEK_START_DATE: weekStartStr,
      WEEK_END_DATE: weekEndStr2,
      NORTH_STAR: strategy.northStar || 'Not set',
      GOAL_90_DAY: strategy.goal90Day || 'Not set',
      POSITIONING: strategy.positioningStatement || 'Not set',
      ICP_PRIMARY: strategy.icpPrimary ? JSON.stringify(strategy.icpPrimary) : 'Not set',
      ICP_SECONDARY: strategy.icpSecondary ? JSON.stringify(strategy.icpSecondary) : 'Not set',
      CONTENT_PILLARS: pillarsSummary || 'No pillars defined',
      PLATFORM_STRATEGY: (platformSummary || 'No platform strategy defined') + platformSelectionNote + platformConfigNote,
      VOICE_SHOHINI: strategy.voiceShohini || 'Not defined',
      VOICE_SANJOY: strategy.voiceSanjoy || 'Not defined',
      SHARED_TONE: strategy.sharedTone || 'Not defined',
      KEY_MESSAGES: (strategy.keyMessages || []).join('\n') || 'None',
      ACTIVE_CAMPAIGNS: campaignsSummary,
      EXISTING_POSTS: existingPostsSummary,
      // 4-input additions
      WEEK_SIGNALS: signalsSummary,
      VIRAL_TRENDS: viralSummary,
      SPECIAL_DATES_RESEARCH: specialDatesResearch,
      // Self-learning feedback intelligence
      FEEDBACK_INTELLIGENCE: feedbackIntelligence,
      // Past content history for de-duplication
      CONTENT_HISTORY: contentHistorySummary,
      // Performance-based strategy recommendations
      PERFORMANCE_RECOMMENDATIONS: performanceRecommendations,
    };

    // 6. Run AI generation with critique loop
    setProgress('Planning content...');

    // Progress sub-steps timer (AI call takes 30-60s, cycle through thinking phases)
    const thinkingSteps = ['Planning content...', 'Matching pillars...', 'Writing hooks...', 'Critiquing plan...', 'Refining topics...', 'Finalizing plan...'];
    let stepIdx = 0;
    const thinkingTimer = setInterval(() => {
      stepIdx = (stepIdx + 1) % thinkingSteps.length;
      setProgress(thinkingSteps[stepIdx]);
    }, 8000);
    const result = await runAgentCritiqueLoop({
      generatorPrompt: 'calendar-week-planner',
      critiquePrompt: 'calendar-week-critique',
      context,
      operation: 'calendar-week-generation',
      user: req.user?.name || 'unknown',
      maxIterations: 3,
      acceptThreshold: 7,
    });

    clearInterval(thinkingTimer);
    setProgress('Processing results...');

    // 7. Parse the generated plan
    let plan: any[] = [];
    if (result.parsed) {
      plan = Array.isArray(result.parsed) ? result.parsed : (result.parsed.tasks || result.parsed.posts || []);
    } else {
      const cleaned = result.content.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
      try {
        const parsed = JSON.parse(cleaned);
        plan = Array.isArray(parsed) ? parsed : (parsed.tasks || parsed.posts || []);
      } catch (parseErr) {
        console.error('[Calendar Generate] Failed to parse AI response:', parseErr);
        res.status(500).json({ error: 'AI generated an invalid plan. Please try again.' });
        return;
      }
    }

    if (!Array.isArray(plan) || plan.length === 0) {
      res.status(500).json({ error: 'AI returned an empty plan. Please try again.' });
      return;
    }

    // 7b. Post-process: remove posts with out-of-range dates and clean up stale special_date posts
    const weekStartTime = weekStart.getTime();
    const weekEndTime = weekEnd.getTime();
    const beforeFilter = plan.length;
    plan = plan.filter((task: any) => {
      if (!task.scheduledDate) return true;
      const taskDate = new Date(task.scheduledDate).getTime();
      // Remove posts scheduled outside the week
      if (taskDate < weekStartTime || taskDate > weekEndTime) {
        console.log(`[Calendar Generate] Stripped out-of-range post: ${task.scheduledDate} - ${task.topicBrief?.substring(0, 60)}`);
        return false;
      }
      // Remove special_date posts referencing stale/hallucinated holidays
      // Check ALL text fields — AI sometimes puts the holiday name in brief instead of sourceDetail
      if (task.sourceType === 'special_date') {
        const allText = [task.sourceDetail, task.topicBrief, task.hook, task.cta].filter(Boolean).join(' ').toLowerCase();
        const staleHolidays = ['holi', 'diwali', 'eid', 'christmas', 'new year', 'easter', 'pongal', 'navratri', 'durga puja', 'ganesh'];
        for (const holiday of staleHolidays) {
          if (allText.includes(holiday)) {
            console.log(`[Calendar Generate] Stripped hallucinated holiday post: "${holiday}" found in: ${task.topicBrief?.substring(0, 80)}`);
            return false;
          }
        }
      }
      return true;
    });
    if (plan.length < beforeFilter) {
      console.log(`[Calendar Generate] Post-processing removed ${beforeFilter - plan.length} invalid posts, ${plan.length} remaining`);
    }

    // 8. Create Post documents from the plan
    setProgress('Saving posts...');
    const createdPosts = [];
    for (const task of plan) {
      try {
        // Build scheduledAt from date + time
        const scheduledAt = new Date(`${task.scheduledDate}T${task.scheduledTime || '09:00'}:00`);

        // Map campaignId if provided
        let campaignId = null;
        if (task.campaignId && task.campaignId !== 'null') {
          const campaign = activeCampaigns.find((c) => String(c._id) === task.campaignId);
          if (campaign) campaignId = campaign._id;
        }

        // Link signal feed entry if AI referenced one
        let signalFeedId = null;
        if (task.signalFeedId && task.signalFeedId !== 'null') {
          const matchedSignal = confirmedSignals.find((s: any) => String(s._id) === task.signalFeedId);
          if (matchedSignal) signalFeedId = matchedSignal._id;
        }

        // Build notes with source attribution
        const sourcePrefix = task.sourceType && task.sourceType !== 'strategy'
          ? `[Source: ${task.sourceType}${task.sourceDetail ? ' — ' + task.sourceDetail : ''}]\n`
          : '';

        // Normalize author name (AI sometimes misspells 'sanjoy' as 'sanjay')
        let normalizedAuthor = (task.author || 'shohini').toLowerCase().trim();
        if (normalizedAuthor === 'sanjay' || normalizedAuthor === 'sanjoi') normalizedAuthor = 'sanjoy';
        if (!['shohini', 'sanjoy'].includes(normalizedAuthor)) normalizedAuthor = 'shohini';

        const post = await Post.create({
          author: normalizedAuthor as 'shohini' | 'sanjoy',
          platform: task.platform || 'linkedin',
          format: task.format || 'text_post',
          contentPillar: task.contentPillar || '',
          scheduledAt,
          status: 'draft',
          notes: sourcePrefix + (task.topicBrief || ''),
          linkedinHook: task.platform === 'linkedin' || task.platform === 'facebook' || task.platform === 'both' ? (task.hook || '') : '',
          instagramHook: task.platform === 'instagram' || task.platform === 'both' ? (task.hook || '') : '',
          cta: task.cta || '',
          draftContent: '',
          finalContent: '',
          hashtags: [],
          campaignId,
          signalFeedId,
          aiEvidence: {
            strategyReferences: [
              task.strategyEvidence?.pillarMatch || '',
              task.strategyEvidence?.icpRelevance || '',
              task.strategyEvidence?.goalAlignment || '',
            ].filter(Boolean),
            dataPoints: task.sourceType ? [`sourceType:${task.sourceType}`] : [],
            signalFeedSources: signalFeedId ? [String(signalFeedId)] : [],
            confidenceScore: result.critique?.score ? result.critique.score / 10 : 0.7,
            critiqueIterations: result.iterations,
            finalCritiqueScore: result.critique?.score || 0,
          },
        });

        createdPosts.push(post);
      } catch (postErr) {
        console.error('[Calendar Generate] Failed to create post for task:', task, postErr);
        // Continue creating other posts
      }
    }

    // 9. Mark used signals as in_calendar
    const usedSignalIds = confirmedSignals.map((s: any) => s._id);
    if (usedSignalIds.length > 0) {
      await SignalFeed.updateMany(
        { _id: { $in: usedSignalIds } },
        { status: 'in_calendar' }
      );
      console.log(`[Calendar Generate] Marked ${usedSignalIds.length} signals as in_calendar`);
    }

    console.log(`[Calendar Generate] Created ${createdPosts.length}/${plan.length} posts for week ${weekStartStr}. AI iterations: ${result.iterations}, score: ${result.critique?.score || 'N/A'}`);

    // 10. Fire-and-forget: trigger content drafting agents for the created posts
    const postIds = createdPosts.map((p: any) => String(p._id));
    const agentTriggeredBy = req.user?.name || 'calendar-generate';
    runContentAgents(postIds, agentTriggeredBy).then((runIds) => {
      if (runIds.length > 0) {
        console.log(`[Calendar Generate] Triggered ${runIds.length} content agents for ${postIds.length} posts`);
      }
    }).catch((err) => {
      console.error('[Calendar Generate] Failed to trigger content agents:', err.message);
    });

    res.json({
      message: `Generated ${createdPosts.length} content tasks for the week of ${weekStartStr}`,
      weekStart: weekStartStr,
      weekEnd: weekEnd.toISOString().slice(0, 10),
      posts: createdPosts,
      aiMetadata: {
        iterations: result.iterations,
        critiqueScore: result.critique?.score || null,
        critiqueFeedback: result.critique?.feedback || null,
      },
      inputs: {
        signalsUsed: confirmedSignals.length,
        viralSignals: viralSignals.length,
        specialDatesResearched: true,
        campaigns: activeCampaigns.length,
      },
      contentAgentsTriggered: true,
    });
    clearProgress();
  } catch (err: any) {
    clearProgress();
    console.error('Calendar generate-week error:', err);
    const errMsg = err?.message || '';
    if (errMsg.includes('API_KEY') || errMsg.includes('No AI provider')) {
      res.status(503).json({
        error: 'AI provider not configured. Please add your ANTHROPIC_API_KEY or GEMINI_API_KEY to the .env file.',
        details: errMsg,
      });
      return;
    }
    res.status(500).json({ error: 'Failed to generate weekly plan. ' + errMsg });
  }
});

/**
 * @openapi
 * /api/calendar/week:
 *   get:
 *     tags:
 *       - Calendar
 *     summary: Get enriched weekly calendar data
 *     description: Returns all posts for a specific week, grouped by day, with summary statistics for the task tracker view.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: weekStart
 *         schema:
 *           type: string
 *           format: date
 *         description: Monday of the target week (defaults to current week)
 *     responses:
 *       200:
 *         description: Weekly calendar data with stats
 */
router.get('/week', async (req: Request, res: Response) => {
  try {
    let weekStart: Date;
    if (req.query.weekStart) {
      weekStart = new Date(req.query.weekStart as string);
    } else {
      weekStart = getCurrentMonday();
    }
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Fetch all posts for the week (with full data for task cards)
    const posts = await Post.find({
      scheduledAt: { $gte: weekStart, $lte: weekEnd },
      status: { $nin: ['archived'] },
    })
      .populate('signalFeedId', 'rawText routing tags')
      .sort({ scheduledAt: 1 })
      .lean();

    // Fetch strategy context for evidence display
    const strategy = await Strategy.findOne({ isCurrent: true })
      .select('platformStrategy contentPillars')
      .lean();

    const strategyContext = strategy ? {
      platformTargets: (strategy.platformStrategy || []).map((ps: any) => ({
        platform: ps.platform,
        weeklyTarget: ps.weeklyTarget,
        bestFormats: ps.bestFormats || [],
        bestPostingTimes: ps.bestPostingTimes || [],
      })),
      contentPillars: (strategy.contentPillars || []).map((cp: any) => ({
        name: cp.name,
        targetPercent: cp.targetPercent,
        owner: cp.owner,
      })),
    } : null;

    // Group posts by day
    const days: Record<string, any[]> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days[toLocalDateStr(d)] = [];
    }

    for (const post of posts) {
      if (post.scheduledAt) {
        const dateKey = toLocalDateStr(new Date(post.scheduledAt));
        if (days[dateKey]) {
          days[dateKey].push(post);
        }
      }
    }

    // Compute stats
    const stats = {
      total: posts.length,
      byStatus: {} as Record<string, number>,
      byPlatform: {} as Record<string, number>,
      byAuthor: {} as Record<string, number>,
      byPillar: {} as Record<string, number>,
    };

    for (const post of posts) {
      stats.byStatus[post.status] = (stats.byStatus[post.status] || 0) + 1;
      stats.byPlatform[post.platform] = (stats.byPlatform[post.platform] || 0) + 1;
      stats.byAuthor[post.author] = (stats.byAuthor[post.author] || 0) + 1;
      if (post.contentPillar) {
        stats.byPillar[post.contentPillar] = (stats.byPillar[post.contentPillar] || 0) + 1;
      }
    }

    res.json({
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      days,
      posts,
      stats,
      strategyContext,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load weekly calendar data' });
  }
});

/**
 * @openapi
 * /api/calendar/task/{postId}/status:
 *   put:
 *     tags:
 *       - Calendar
 *     summary: Update a task's status
 *     description: Quick status update for content task tracking. Updates the post's workflow status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, ready, scheduled, published]
 *     responses:
 *       200:
 *         description: Task status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Post not found
 */
router.put('/task/:postId/status', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'ready', 'scheduled', 'published'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const updateFields: Record<string, any> = { status };
    if (status === 'published') {
      updateFields.publishedAt = new Date();
    }

    const post = await Post.findByIdAndUpdate(postId, updateFields, { new: true });
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Auto-log to ContentHistory when marked as published
    if (status === 'published') {
      try {
        const { ContentHistory } = await import('../models/ContentHistory');
        // Upsert — avoid duplicates if toggled back and forth
        await ContentHistory.findOneAndUpdate(
          { postId: post._id, source: 'system' },
          {
            postId: post._id,
            author: post.author,
            platform: post.platform,
            topic: (post as any).linkedinHook
              ? `${post.contentPillar}: ${(post as any).linkedinHook}`
              : (post.draftContent || post.contentPillar || 'Untitled').substring(0, 200),
            hook: (post as any).linkedinHook || (post as any).instagramHook || '',
            format: post.format || 'text_post',
            contentPillar: post.contentPillar || '',
            publishedDate: new Date(),
            performanceNotes: '',
            source: 'system',
          },
          { upsert: true, new: true }
        );
        console.log(`[Auto-log] Published post ${postId} added to content history`);
      } catch (err) {
        console.error('[Auto-log] Failed to log published post (non-blocking):', err);
      }
    }

    res.json({
      message: `Task status updated to ${status}`,
      post,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// ============ Approve Week Plan ============

/**
 * POST /api/calendar/approve-week
 * Approve the generated week plan — transitions posts from draft to scheduled
 * and fires content drafting + image generation agents automatically.
 */
router.post('/approve-week', async (req: Request, res: Response) => {
  try {
    const { weekStart: weekStartStr } = req.body;
    if (!weekStartStr) {
      res.status(400).json({ error: 'weekStart is required' });
      return;
    }

    const weekStart = new Date(weekStartStr);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Find all draft posts for this week
    const draftPosts = await Post.find({
      scheduledAt: { $gte: weekStart, $lte: weekEnd },
      status: 'draft',
    });

    if (draftPosts.length === 0) {
      res.status(400).json({ error: 'No draft posts found for this week to approve' });
      return;
    }

    // Approve all draft posts
    const now = new Date();
    const postIds = draftPosts.map((p) => String(p._id));
    await Post.updateMany(
      { _id: { $in: postIds } },
      { status: 'scheduled', approvedAt: now }
    );

    console.log(`[Calendar Approve] Approved ${postIds.length} posts for week ${weekStartStr}`);

    // Content is now generated per-post (via POST /api/posts/:id/generate-content)
    // This keeps approve fast and lets users generate content one post at a time.
    // Image generation also happens per-post after content is generated.

    res.json({
      message: `Approved ${postIds.length} posts for the week. Generate content for each post individually.`,
      postsApproved: postIds.length,
      weekStart: weekStart.toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error('Calendar approve-week error:', error);
    res.status(500).json({ error: 'Failed to approve week plan' });
  }
});

/**
 * GET /api/calendar/approve-progress
 * Poll for auto-generation progress after approving a week plan.
 */
router.get('/approve-progress', async (req: Request, res: Response) => {
  try {
    const weekStartStr = req.query.weekStart as string;
    if (!weekStartStr) {
      res.status(400).json({ error: 'weekStart query parameter is required' });
      return;
    }

    const weekStart = new Date(weekStartStr);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const posts = await Post.find({
      scheduledAt: { $gte: weekStart, $lte: weekEnd },
      status: { $nin: ['archived'] },
    })
      .select('_id status draftContent imagePrompt imageUrl')
      .lean();

    const total = posts.length;
    const contentReady = posts.filter((p) => p.draftContent && p.draftContent.trim() !== '').length;
    const imagesReady = posts.filter((p) => p.imagePrompt && p.imagePrompt.trim() !== '').length;

    res.json({
      total,
      contentReady,
      imagesReady,
      allDone: contentReady >= total && imagesReady >= total,
      posts: posts.map((p) => ({
        _id: p._id,
        status: p.status,
        hasDraft: !!(p.draftContent && p.draftContent.trim() !== ''),
        hasImage: !!(p.imagePrompt && p.imagePrompt.trim() !== ''),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check approve progress' });
  }
});

export default router;
