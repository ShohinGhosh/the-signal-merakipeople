import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ContentHistory } from '../models/ContentHistory';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/content-history/upload
 * Upload past content as JSON array (parsed from CSV on the client).
 * Each entry: { author, platform, topic, hook, format, contentPillar, publishedDate, performanceNotes }
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { entries } = req.body;
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'entries array is required' });
      return;
    }

    const docs = entries.map((e: any) => ({
      author: (e.author || 'shohini').toLowerCase(),
      platform: (e.platform || 'linkedin').toLowerCase(),
      topic: e.topic || e.title || e.subject || '',
      hook: e.hook || e.opening || '',
      format: (e.format || 'text_post').toLowerCase(),
      contentPillar: e.contentPillar || e.pillar || '',
      publishedDate: (() => {
        const raw = e.publishedDate || e.date || e.published_date;
        const d = raw ? new Date(raw) : null;
        return (d && !isNaN(d.getTime())) ? d : new Date(); // fallback to today if no valid date
      })(),
      performanceNotes: e.performanceNotes || e.notes || '',
      source: 'upload' as const,
    })).filter((d: any) => d.topic);

    if (docs.length === 0) {
      res.status(400).json({ error: 'No valid entries found. Each entry needs at least a "topic" and valid "publishedDate".' });
      return;
    }

    const inserted = await ContentHistory.insertMany(docs);
    console.log(`[Content History] Uploaded ${inserted.length} entries`);

    res.status(201).json({
      message: `Successfully uploaded ${inserted.length} past content entries`,
      count: inserted.length,
    });
  } catch (error) {
    console.error('Content history upload error:', error);
    res.status(500).json({ error: 'Failed to upload content history' });
  }
});

/**
 * GET /api/content-history
 * List all content history entries, newest first.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { author, limit = 100 } = req.query;

    const filter: any = {};
    if (author) filter.author = author;

    const entries = await ContentHistory.find(filter)
      .sort({ publishedDate: -1 })
      .limit(Number(limit));

    res.json(entries);
  } catch (error) {
    console.error('Content history list error:', error);
    res.status(500).json({ error: 'Failed to list content history' });
  }
});

/**
 * GET /api/content-history/summary
 * Returns a condensed text summary of past topics for prompt injection.
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const entries = await ContentHistory.find({})
      .sort({ publishedDate: -1 })
      .limit(200)
      .select('author platform topic hook format contentPillar publishedDate');

    if (entries.length === 0) {
      res.json({ summary: '', count: 0 });
      return;
    }

    // Build condensed summary grouped by month
    const byMonth: Record<string, string[]> = {};
    for (const e of entries) {
      const month = e.publishedDate.toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth[month]) byMonth[month] = [];
      const line = `- [${e.author}] ${e.topic}${e.hook ? ` (hook: "${e.hook.slice(0, 80)}")` : ''}${e.contentPillar ? ` [pillar: ${e.contentPillar}]` : ''}`;
      byMonth[month].push(line);
    }

    let summary = 'PAST CONTENT PUBLISHED (do NOT repeat these topics):\n';
    for (const [month, lines] of Object.entries(byMonth).sort().reverse()) {
      summary += `\n--- ${month} ---\n`;
      summary += lines.join('\n') + '\n';
    }

    res.json({ summary, count: entries.length });
  } catch (error) {
    console.error('Content history summary error:', error);
    res.status(500).json({ error: 'Failed to get content history summary' });
  }
});

/**
 * DELETE /api/content-history
 * Clear all uploaded content history.
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const result = await ContentHistory.deleteMany({ source: 'upload' });
    res.json({ message: `Deleted ${result.deletedCount} entries` });
  } catch (error) {
    console.error('Content history delete error:', error);
    res.status(500).json({ error: 'Failed to delete content history' });
  }
});

/**
 * GET /api/content-history/insights
 * Performance insights + strategy recommendations from engagement data.
 */
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const { getPerformanceInsights, generateStrategyRecommendations } = await import('../services/feedback/performanceInsightsService');
    const { author } = req.query;
    const insights = await getPerformanceInsights(author as string | undefined);
    const recommendations = generateStrategyRecommendations(insights);
    res.json({ insights, recommendations });
  } catch (error) {
    console.error('Content history insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

export default router;
