import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { CostLog } from '../models/CostLog';
import { getCostSummary } from '../services/ai/costTracker';

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
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    // Build filter
    const filter: Record<string, any> = {};

    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) {
        filter.timestamp.$gte = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate as string);
        endDate.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = endDate;
      }
    }

    if (req.query.operation) {
      filter.operation = req.query.operation;
    }

    if (req.query.user) {
      filter.user = req.query.user;
    }

    const total = await CostLog.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const costs = await CostLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      costs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cost logs' });
  }
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
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const startDateStr = (req.query.startDate as string) || new Date().toISOString().slice(0, 10);
    const endDateStr = (req.query.endDate as string) || new Date().toISOString().slice(0, 10);

    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    const summary = await getCostSummary(startDate, endDate);

    // Also aggregate by model and agent type from raw logs
    const logs = await CostLog.find({
      timestamp: { $gte: startDate, $lte: endDate },
    }).lean();

    // Build byModel
    const modelMap: Record<string, { count: number; costUsd: number }> = {};
    // Build byAgentType
    const agentTypeMap: Record<string, { count: number; costUsd: number }> = {
      generator: { count: 0, costUsd: 0 },
      critique: { count: 0, costUsd: 0 },
    };

    for (const log of logs) {
      // By model
      const model = log.aiModel;
      if (!modelMap[model]) modelMap[model] = { count: 0, costUsd: 0 };
      modelMap[model].count++;
      modelMap[model].costUsd += log.costUsd;

      // By agent type
      if (log.agentType === 'generator' || log.agentType === 'critique') {
        agentTypeMap[log.agentType].count++;
        agentTypeMap[log.agentType].costUsd += log.costUsd;
      }
    }

    const byModel = Object.entries(modelMap).map(([model, data]) => ({
      model,
      count: data.count,
      costUsd: Math.round(data.costUsd * 10000) / 10000,
    }));

    const byOperation = Object.entries(summary.byOperation).map(([operation, data]) => ({
      operation,
      count: data.calls,
      costUsd: Math.round(data.cost * 10000) / 10000,
    }));

    const totalRequests = summary.totalCalls;
    const averageCostPerRequest = totalRequests > 0
      ? Math.round((summary.totalCost / totalRequests) * 10000) / 10000
      : 0;

    res.json({
      period: { startDate: startDateStr, endDate: endDateStr },
      totalCostUsd: Math.round(summary.totalCost * 10000) / 10000,
      totalRequests,
      totalInputTokens: summary.totalInputTokens,
      totalOutputTokens: summary.totalOutputTokens,
      byOperation,
      byModel,
      byAgentType: {
        generator: {
          count: agentTypeMap.generator.count,
          costUsd: Math.round(agentTypeMap.generator.costUsd * 10000) / 10000,
        },
        critique: {
          count: agentTypeMap.critique.count,
          costUsd: Math.round(agentTypeMap.critique.costUsd * 10000) / 10000,
        },
      },
      averageCostPerRequest,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate cost summary' });
  }
});

/**
 * @openapi
 * /api/costs/daily:
 *   get:
 *     tags:
 *       - Costs
 *     summary: Get daily aggregated cost data
 *     description: Returns day-by-day aggregated cost data for time-series charts. Groups all AI calls by date.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start of date range (defaults to 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End of date range (defaults to today)
 */
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startDateStr = (req.query.startDate as string) || thirtyDaysAgo.toISOString().slice(0, 10);
    const endDateStr = (req.query.endDate as string) || now.toISOString().slice(0, 10);

    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    const daily = await CostLog.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          calls: { $sum: 1 },
          costUsd: { $sum: '$costUsd' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          calls: 1,
          costUsd: { $round: ['$costUsd', 6] },
          inputTokens: 1,
          outputTokens: 1,
        },
      },
    ]);

    res.json({ daily });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily cost data' });
  }
});

export default router;
