import { AgentRun } from '../../models/AgentRun';
import { Post } from '../../models/Post';
import { AGENT_REGISTRY, AgentDefinition } from './agentRegistry';

export interface AgentStatus {
  agent: {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    platform?: string;
    format?: string;
  };
  eligibleCount: number;
  isRunning: boolean;
  lastRun: {
    _id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    itemsProcessed: number;
    itemsFailed: number;
    totalCostUsd: number;
    durationMs: number;
  } | null;
}

/**
 * Check if an agent is currently running (mutex via DB).
 */
async function isAgentRunning(agentId: string): Promise<boolean> {
  const running = await AgentRun.exists({
    agentId,
    status: 'running',
  });
  return !!running;
}

/**
 * Get the status of a single agent including eligible count and last run.
 */
export async function getAgentStatus(agentId: string): Promise<AgentStatus | null> {
  const agentDef = AGENT_REGISTRY.get(agentId);
  if (!agentDef) return null;

  const [eligibleCount, running, lastRun] = await Promise.all([
    agentDef.countEligible(),
    isAgentRunning(agentId),
    AgentRun.findOne({ agentId })
      .sort({ createdAt: -1 })
      .select('_id status startedAt completedAt itemsProcessed itemsFailed totalCostUsd durationMs')
      .lean(),
  ]);

  return {
    agent: {
      id: agentDef.id,
      name: agentDef.name,
      description: agentDef.description,
      icon: agentDef.icon,
      category: agentDef.category,
      platform: agentDef.platform,
      format: agentDef.format,
    },
    eligibleCount,
    isRunning: running,
    lastRun: lastRun
      ? {
          _id: String(lastRun._id),
          status: lastRun.status,
          startedAt: lastRun.startedAt?.toISOString() || '',
          completedAt: lastRun.completedAt?.toISOString() || null,
          itemsProcessed: lastRun.itemsProcessed,
          itemsFailed: lastRun.itemsFailed,
          totalCostUsd: lastRun.totalCostUsd,
          durationMs: lastRun.durationMs,
        }
      : null,
  };
}

/**
 * Get status of all registered agents.
 */
export async function getAllAgentStatuses(): Promise<AgentStatus[]> {
  const statuses: AgentStatus[] = [];
  for (const agentId of AGENT_REGISTRY.keys()) {
    const status = await getAgentStatus(agentId);
    if (status) statuses.push(status);
  }
  return statuses;
}

/**
 * Run an agent. Creates an AgentRun record and executes async (fire-and-forget).
 * Returns the run ID immediately so the caller can poll for status.
 */
export async function runAgent(
  agentId: string,
  triggeredBy: string
): Promise<{ runId: string } | { error: string }> {
  const agentDef = AGENT_REGISTRY.get(agentId);
  if (!agentDef) {
    return { error: `Agent "${agentId}" not found` };
  }

  // Mutex: check if already running
  if (await isAgentRunning(agentId)) {
    return { error: `Agent "${agentDef.name}" is already running` };
  }

  // Create the run record
  const run = await AgentRun.create({
    agentId,
    agentName: agentDef.name,
    status: 'running',
    startedAt: new Date(),
    triggeredBy,
  });

  // Fire-and-forget execution
  executeAgent(agentDef, run).catch((err) => {
    console.error(`[AgentRunner] Unhandled error in agent ${agentId}:`, err);
  });

  return { runId: String(run._id) };
}

/**
 * Internal: execute the agent and update the run record on completion.
 */
async function executeAgent(
  agentDef: AgentDefinition,
  run: InstanceType<typeof AgentRun>
): Promise<void> {
  const startTime = Date.now();

  try {
    console.log(`[AgentRunner] Starting agent: ${agentDef.name} (${agentDef.id})`);
    await agentDef.execute(run, run.triggeredBy);

    run.status = 'completed';
    run.completedAt = new Date();
    run.durationMs = Date.now() - startTime;
    await run.save();

    console.log(
      `[AgentRunner] Agent ${agentDef.name} completed: ${run.itemsProcessed}/${run.itemsFound} items, ` +
        `$${run.totalCostUsd.toFixed(4)}, ${run.durationMs}ms`
    );
  } catch (err: any) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date();
    run.durationMs = Date.now() - startTime;
    await run.save();

    console.error(`[AgentRunner] Agent ${agentDef.name} failed:`, err.message);
  }
}

/**
 * Run multiple agents in sequence (used during calendar week generation).
 * Returns array of run IDs.
 */
export async function runContentAgents(
  postIds: string[],
  triggeredBy: string
): Promise<string[]> {
  // Find the posts that were just created
  const posts = await Post.find({ _id: { $in: postIds } }).lean();

  // Group by platform+format to determine which agents to run
  const agentSet = new Set<string>();
  for (const post of posts) {
    const platform = post.platform === 'both' ? 'linkedin' : post.platform;
    const agentId = `draft-${platform}-${post.format || 'text_post'}`;
    if (AGENT_REGISTRY.has(agentId)) {
      agentSet.add(agentId);
    }
  }

  // Run each agent sequentially (they filter by their own platform+format)
  const runIds: string[] = [];
  for (const agentId of agentSet) {
    const result = await runAgent(agentId, triggeredBy);
    if ('runId' in result) {
      runIds.push(result.runId);
    }
  }

  return runIds;
}
