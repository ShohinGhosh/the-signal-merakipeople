import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All cost routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/costs:
 *   get:
 *     tags:
 *       - Costs
 *     summary: Get cost logs
 *     description: Returns a paginated list of AI cost log entries with optional filters for date range, operation type, and user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter costs on or after this date
 *         example: '2026-03-01'
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter costs on or before this date
 *         example: '2026-03-31'
 *       - in: query
 *         name: operation
 *         schema:
 *           type: string
 *         description: Filter by operation type (e.g., classify_signal, generate_post, critique_post)
 *         example: generate_post
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Filter by user who triggered the operation
 *         example: shohini
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
 *           default: 50
 *         description: Number of entries per page
 *     responses:
 *       200:
 *         description: Paginated cost log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 costs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       operation:
 *                         type: string
 *                         example: generate_post
 *                       model:
 *                         type: string
 *                         example: claude-sonnet-4-5
 *                       inputTokens:
 *                         type: number
 *                         example: 2500
 *                       outputTokens:
 *                         type: number
 *                         example: 800
 *                       costUsd:
 *                         type: number
 *                         example: 0.0195
 *                       iteration:
 *                         type: number
 *                         example: 1
 *                       totalIterations:
 *                         type: number
 *                         example: 3
 *                       agentType:
 *                         type: string
 *                         enum: [generator, critique]
 *                         example: generator
 *                       user:
 *                         type: string
 *                         example: shohini
 *                       relatedId:
 *                         type: string
 *                       relatedCollection:
 *                         type: string
 *                         example: Post
 *                       promptName:
 *                         type: string
 *                         example: generate_linkedin_post
 *                       durationMs:
 *                         type: number
 *                         example: 3200
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                       example: 1
 *                     limit:
 *                       type: number
 *                       example: 50
 *                     total:
 *                       type: number
 *                       example: 230
 *                     totalPages:
 *                       type: number
 *                       example: 5
 */
router.get('/', (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  // TODO: Replace with CostLog.find() with filters + pagination
  res.json({
    costs: [],
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
 * /api/costs/summary:
 *   get:
 *     tags:
 *       - Costs
 *     summary: Get aggregated cost summary
 *     description: Returns aggregated cost data for the specified date range, broken down by operation type, model, and agent type. Useful for tracking AI spending and identifying cost optimization opportunities.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start of date range
 *         example: '2026-03-01'
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End of date range
 *         example: '2026-03-31'
 *     responses:
 *       200:
 *         description: Aggregated cost summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: object
 *                   properties:
 *                     startDate:
 *                       type: string
 *                       format: date
 *                       example: '2026-03-01'
 *                     endDate:
 *                       type: string
 *                       format: date
 *                       example: '2026-03-31'
 *                 totalCostUsd:
 *                   type: number
 *                   description: Total cost in USD for the period
 *                   example: 12.45
 *                 totalRequests:
 *                   type: number
 *                   description: Total number of AI requests
 *                   example: 230
 *                 totalInputTokens:
 *                   type: number
 *                   example: 580000
 *                 totalOutputTokens:
 *                   type: number
 *                   example: 195000
 *                 byOperation:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       operation:
 *                         type: string
 *                         example: generate_post
 *                       count:
 *                         type: number
 *                         example: 45
 *                       costUsd:
 *                         type: number
 *                         example: 4.25
 *                 byModel:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       model:
 *                         type: string
 *                         example: claude-sonnet-4-5
 *                       count:
 *                         type: number
 *                         example: 180
 *                       costUsd:
 *                         type: number
 *                         example: 10.20
 *                 byAgentType:
 *                   type: object
 *                   properties:
 *                     generator:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: number
 *                           example: 120
 *                         costUsd:
 *                           type: number
 *                           example: 8.50
 *                     critique:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: number
 *                           example: 110
 *                         costUsd:
 *                           type: number
 *                           example: 3.95
 *                 averageCostPerRequest:
 *                   type: number
 *                   description: Average cost per AI request in USD
 *                   example: 0.054
 */
router.get('/summary', (req: Request, res: Response) => {
  const startDate = (req.query.startDate as string) || new Date().toISOString().slice(0, 10);
  const endDate = (req.query.endDate as string) || new Date().toISOString().slice(0, 10);

  // TODO: Replace with CostLog.aggregate() pipeline
  res.json({
    period: { startDate, endDate },
    totalCostUsd: 0,
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    byOperation: [],
    byModel: [],
    byAgentType: {
      generator: { count: 0, costUsd: 0 },
      critique: { count: 0, costUsd: 0 },
    },
    averageCostPerRequest: 0,
  });
});

export default router;
