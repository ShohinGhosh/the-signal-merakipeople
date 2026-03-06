import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All calendar routes require authentication
router.use(authMiddleware);

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
router.get('/', (req: Request, res: Response) => {
  const view = (req.query.view as string) || 'month';
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 7);

  // TODO: Replace with Post.find({ scheduledAt }) grouped by date
  res.json({
    view,
    date,
    days: [],
  });
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
router.get('/gaps', (req: Request, res: Response) => {
  // TODO: Replace with gap detection logic — find 3+ day stretches without posts
  res.json({
    gaps: [],
  });
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
router.get('/alignment', (req: Request, res: Response) => {
  // TODO: Replace with real pillar distribution calculation vs strategy targets
  res.json({
    alignment: [],
    totalPosts: 0,
    period: {
      startDate: req.query.startDate || new Date().toISOString().slice(0, 10),
      endDate: req.query.endDate || new Date().toISOString().slice(0, 10),
    },
  });
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
router.put('/reschedule', (req: Request, res: Response) => {
  const { postId, newDate } = req.body;

  if (!postId || !newDate) {
    res.status(400).json({ error: 'postId and newDate are required' });
    return;
  }

  // TODO: Replace with Post.findByIdAndUpdate(postId, { scheduledAt: newDate, status: 'scheduled' })
  res.json({
    message: 'Post rescheduled',
    post: {
      _id: postId,
      scheduledAt: newDate,
      status: 'scheduled',
    },
  });
});

export default router;
