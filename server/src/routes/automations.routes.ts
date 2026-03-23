import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AgentRun } from '../models/AgentRun';
import { getAllAgentStatuses, getAgentStatus, runAgent } from '../services/automations/agentRunner';

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/automations/agents
 * List all agents with eligible counts, running status, and last run info.
 */
router.get('/agents', async (_req: Request, res: Response) => {
  try {
    const statuses = await getAllAgentStatuses();
    res.json({ agents: statuses });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch agents: ${error.message}` });
  }
});

/**
 * GET /api/automations/agents/:agentId
 * Get status of a single agent.
 */
router.get('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const status = await getAgentStatus(req.params.agentId as string);
    if (!status) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch agent status: ${error.message}` });
  }
});

/**
 * POST /api/automations/run/:agentId
 * Trigger an agent run. Returns 409 if already running.
 */
router.post('/run/:agentId', async (req: Request, res: Response) => {
  try {
    const triggeredBy = req.user?.name || 'unknown';
    const result = await runAgent(req.params.agentId as string, triggeredBy);

    if ('error' in result) {
      if (result.error.includes('already running')) {
        res.status(409).json({ error: result.error });
      } else {
        res.status(404).json({ error: result.error });
      }
      return;
    }

    res.json({
      message: 'Agent started',
      runId: result.runId,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to start agent: ${error.message}` });
  }
});

/**
 * GET /api/automations/runs
 * Paginated run history. Optional agentId filter.
 */
router.get('/runs', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const filter: Record<string, any> = {};

    if (req.query.agentId) {
      filter.agentId = req.query.agentId;
    }

    const [runs, total] = await Promise.all([
      AgentRun.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-results')
        .lean(),
      AgentRun.countDocuments(filter),
    ]);

    res.json({
      runs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch runs: ${error.message}` });
  }
});

/**
 * GET /api/automations/runs/:runId
 * Single run with full result details.
 */
router.get('/runs/:runId', async (req: Request, res: Response) => {
  try {
    const run = await AgentRun.findById(req.params.runId).lean();
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(run);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch run: ${error.message}` });
  }
});

export default router;
