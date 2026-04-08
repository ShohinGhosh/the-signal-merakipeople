import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Journal } from '../models/Journal';
import { SignalFeed } from '../models/SignalFeed';
import { Post } from '../models/Post';
import { runAgentCritiqueLoop } from '../services/ai/orchestrator';
import { gatherEvidenceContext } from '../services/ai/evidenceEngine';
import axios from 'axios';

const router = Router();

// Track auto-regeneration status (in-memory, resets on server restart)
let autoRegenStatus: { active: boolean; triggeredBy: string; startedAt: Date | null; error: string | null } = {
  active: false, triggeredBy: '', startedAt: null, error: null,
};

// Expose status endpoint
router.get('/auto-regen-status', authMiddleware, (_req: Request, res: Response) => {
  res.json(autoRegenStatus);
});

// Reset status
router.post('/auto-regen-reset', authMiddleware, (_req: Request, res: Response) => {
  autoRegenStatus = { active: false, triggeredBy: '', startedAt: null, error: null };
  res.json({ message: 'Reset' });
});

router.use(authMiddleware);

// Helper: run AI analysis on a journal entry (used by create and re-analyse)
async function analyseEntry(entryId: string, rawText: string, author: string, entryType: string | null) {
  try {
    const evidenceContext = await gatherEvidenceContext(author);

    // Gather calendar context: find upcoming open slots
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const scheduledPosts = await Post.find({
      scheduledAt: { $gte: now, $lte: weekFromNow },
    }).select('scheduledAt author platform contentPillar').lean();

    const calendarSlots = scheduledPosts.map(p =>
      `${new Date(p.scheduledAt!).toISOString().slice(0, 10)} - ${p.author} - ${p.platform} - ${p.contentPillar}`
    ).join('\n') || 'No posts scheduled in the next 7 days — all slots are open.';

    const startTime = Date.now();

    const result = await runAgentCritiqueLoop({
      generatorPrompt: 'journal-analyser',
      critiquePrompt: 'journal-critique',
      context: {
        ...evidenceContext,
        JOURNAL_ENTRY: rawText,
        ENTRY_TYPE: entryType || 'not specified',
        ENTRY_AUTHOR: author,
        CALENDAR_CONTEXT: `Already scheduled this week:\n${calendarSlots}`,
      },
      operation: 'analyse-journal',
      user: author,
      relatedId: entryId,
      relatedCollection: 'Journal',
    });

    const durationMs = Date.now() - startTime;
    const parsed = result.parsed || {};

    await Journal.findByIdAndUpdate(entryId, {
      status: 'analysed',
      recommendation: {
        contentPillar: parsed.contentPillar || '',
        pillarWeight: parsed.pillarWeight || '',
        format: parsed.format || 'text_post',
        calendarSlot: parsed.calendarSlot || null,
        owner: parsed.owner || author,
        signalStrength: parsed.signalStrength || 'moderate',
        draftHook: parsed.draftHook || '',
        icpResonance: parsed.icpResonance || '',
        keyMessageMatch: parsed.keyMessageMatch || '',
        ninetyDayRelevance: parsed.ninetyDayRelevance || '',
      },
      aiCost: {
        inputTokens: result.totalInputTokens,
        outputTokens: result.totalOutputTokens,
        costUsd: result.totalCostUsd,
        model: result.providers?.generator?.model || 'claude-3-5-sonnet',
        durationMs,
      },
    });
  } catch (err) {
    console.error(`Journal analysis failed for entry ${entryId}:`, err);
    // Entry remains at pending_analysis — no data loss
  }
}

// POST /api/journal — Create a journal entry and trigger AI analysis
router.post('/', async (req: Request, res: Response) => {
  const { rawText, author, entryType, priority } = req.body;

  if (!rawText || !author) {
    res.status(400).json({ error: 'rawText and author are required' });
    return;
  }

  try {
    const entry = await new Journal({
      author,
      rawText,
      entryType: entryType || null,
      priority: priority || 'normal',
      status: 'pending_analysis',
    }).save();

    res.status(201).json({ message: 'Journal entry created', entry });

    // Background AI analysis (non-blocking)
    analyseEntry(entry._id.toString(), rawText, author, entryType || null);
  } catch (err: any) {
    console.error('Failed to create journal entry:', err);
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

// POST /api/journal/:id/analyse — Re-analyse an existing entry
router.post('/:id/analyse', async (req: Request, res: Response) => {
  try {
    const entry = await Journal.findById(req.params.id);
    if (!entry) { res.status(404).json({ error: 'Journal entry not found' }); return; }

    await Journal.findByIdAndUpdate(entry._id, { status: 'pending_analysis', recommendation: null });
    res.json({ message: 'Re-analysis triggered' });

    analyseEntry(entry._id.toString(), entry.rawText, entry.author, entry.entryType);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/journal/:id/accept — Accept recommendation and create Signal Feed entry
router.put('/:id/accept', async (req: Request, res: Response) => {
  try {
    const entry = await Journal.findById(req.params.id);
    if (!entry) { res.status(404).json({ error: 'Journal entry not found' }); return; }
    if (!entry.recommendation) { res.status(400).json({ error: 'Entry has no recommendation to accept' }); return; }

    const rec = entry.recommendation;

    // Create a Signal Feed entry from the journal recommendation
    const isHighPriority = entry.priority === 'high';
    const signal = await new SignalFeed({
      author: rec.owner || entry.author,
      rawText: entry.rawText,
      tags: [
        entry.entryType || 'journal_entry',
        ...(isHighPriority ? ['priority_signal', 'stop_press'] : []),
      ].filter(Boolean),
      urlReference: '',
      status: 'confirmed',
      routing: 'content_seed',
      aiClassification: {
        insightType: entry.entryType || 'founder_reflection',
        contentPillar: rec.contentPillar,
        timeliness: isHighPriority ? 'breaking' : 'evergreen',
        strategyRelevance: isHighPriority ? '10' : rec.signalStrength === 'strong' ? '9' : rec.signalStrength === 'moderate' ? '6' : '3',
        contradictions: [],
        confidence: isHighPriority ? 1.0 : rec.signalStrength === 'strong' ? 0.9 : rec.signalStrength === 'moderate' ? 0.7 : 0.4,
        evidence: {
          strategyReferences: [rec.contentPillar, rec.keyMessageMatch].filter(Boolean),
          reasoning: `${isHighPriority ? '🔥 PRIORITY SIGNAL — ' : ''}Journal entry accepted. ICP: ${rec.icpResonance}. 90-day: ${rec.ninetyDayRelevance}`,
        },
        critiqueScore: 0,
        critiqueIterations: 0,
        critiqueFeedback: '',
      },
    }).save();

    await Journal.findByIdAndUpdate(entry._id, {
      founderDecision: 'accepted',
      status: 'accepted',
      signalFeedEntryId: signal._id,
    });

    const updated = await Journal.findById(entry._id).lean();
    res.json({ message: 'Journal entry accepted and saved to Signal Feed', entry: updated, signalFeedEntry: signal, autoRegenerating: true });

    // Fire-and-forget: auto-regenerate calendar with new signal
    if (!autoRegenStatus.active) {
      autoRegenStatus = { active: true, triggeredBy: `Journal: ${entry.rawText.substring(0, 60)}...`, startedAt: new Date(), error: null };
      console.log(`[Journal Auto-Regen] Triggering calendar regeneration after journal accept`);

      const token = req.headers.authorization;
      const port = process.env.PORT || 5001;
      axios.post(`http://localhost:${port}/api/calendar/generate-week`, {}, {
        headers: { Authorization: token || '' },
        timeout: 120000,
      }).then(() => {
        console.log(`[Journal Auto-Regen] Calendar regeneration completed`);
        autoRegenStatus = { ...autoRegenStatus, active: false };
      }).catch((err: any) => {
        console.error(`[Journal Auto-Regen] Calendar regeneration failed:`, err.message);
        autoRegenStatus = { ...autoRegenStatus, active: false, error: err.message };
      });
    }
  } catch (err: any) {
    console.error('Failed to accept journal entry:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/journal/:id/edit — Edit recommendation then accept
router.put('/:id/edit', async (req: Request, res: Response) => {
  try {
    const entry = await Journal.findById(req.params.id);
    if (!entry) { res.status(404).json({ error: 'Journal entry not found' }); return; }

    const editedRec = req.body;

    // Create Signal Feed entry with the edited recommendation
    const rec = { ...entry.recommendation?.toObject?.() || entry.recommendation || {}, ...editedRec };

    const signal = await new SignalFeed({
      author: rec.owner || entry.author,
      rawText: entry.rawText,
      tags: [entry.entryType || 'journal_entry'].filter(Boolean),
      urlReference: '',
      status: 'confirmed',
      routing: 'content_seed',
      aiClassification: {
        insightType: entry.entryType || 'founder_reflection',
        contentPillar: rec.contentPillar || '',
        timeliness: 'evergreen',
        strategyRelevance: rec.signalStrength === 'strong' ? '9' : rec.signalStrength === 'moderate' ? '6' : '3',
        contradictions: [],
        confidence: 0.7,
        evidence: {
          strategyReferences: [rec.contentPillar, rec.keyMessageMatch].filter(Boolean),
          reasoning: `Journal entry edited and accepted. ICP: ${rec.icpResonance || ''}. Format: ${rec.format || ''}`,
        },
        critiqueScore: 0,
        critiqueIterations: 0,
        critiqueFeedback: '',
      },
    }).save();

    await Journal.findByIdAndUpdate(entry._id, {
      editedRecommendation: rec,
      founderDecision: 'edited',
      status: 'edited',
      signalFeedEntryId: signal._id,
    });

    const updated = await Journal.findById(entry._id).lean();
    res.json({ message: 'Journal entry edited and saved to Signal Feed', entry: updated, signalFeedEntry: signal, autoRegenerating: true });

    // Fire-and-forget: auto-regenerate calendar
    if (!autoRegenStatus.active) {
      autoRegenStatus = { active: true, triggeredBy: `Journal (edited): ${entry.rawText.substring(0, 60)}...`, startedAt: new Date(), error: null };
      console.log(`[Journal Auto-Regen] Triggering calendar regeneration after journal edit-accept`);

      const token = req.headers.authorization;
      const port = process.env.PORT || 5001;
      axios.post(`http://localhost:${port}/api/calendar/generate-week`, {}, {
        headers: { Authorization: token || '' },
        timeout: 120000,
      }).then(() => {
        console.log(`[Journal Auto-Regen] Calendar regeneration completed`);
        autoRegenStatus = { ...autoRegenStatus, active: false };
      }).catch((err: any) => {
        console.error(`[Journal Auto-Regen] Calendar regeneration failed:`, err.message);
        autoRegenStatus = { ...autoRegenStatus, active: false, error: err.message };
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/journal/:id/discard — Discard entry (kept in history)
router.put('/:id/discard', async (req: Request, res: Response) => {
  try {
    const entry = await Journal.findByIdAndUpdate(
      req.params.id,
      { founderDecision: 'discarded', status: 'discarded' },
      { new: true }
    );
    if (!entry) { res.status(404).json({ error: 'Journal entry not found' }); return; }
    res.json({ message: 'Journal entry discarded', entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/journal/:id/archive — Archive entry (hidden from default list)
router.put('/:id/archive', async (req: Request, res: Response) => {
  try {
    const entry = await Journal.findByIdAndUpdate(
      req.params.id,
      { status: 'archived' },
      { new: true }
    );
    if (!entry) { res.status(404).json({ error: 'Journal entry not found' }); return; }
    res.json({ message: 'Journal entry archived', entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/journal — List journal entries with filters and pagination
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const filter: Record<string, any> = {};

    if (req.query.author) filter.author = req.query.author;
    if (req.query.status) {
      filter.status = req.query.status;
    } else {
      // Exclude archived entries by default
      filter.status = { $ne: 'archived' };
    }
    if (req.query.entryType) filter.entryType = req.query.entryType;
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate as string);
      if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate as string);
    }

    const [entries, total] = await Promise.all([
      Journal.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Journal.countDocuments(filter),
    ]);

    res.json({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/journal/:id — Get a single journal entry
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const entry = await Journal.findById(req.params.id).lean();
    if (!entry) { res.status(404).json({ error: 'Journal entry not found' }); return; }
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
