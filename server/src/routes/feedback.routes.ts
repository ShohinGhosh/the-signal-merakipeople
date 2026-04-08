import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import Feedback from '../models/Feedback';
import {
  getDynamicQuickFixes,
  getIntelligenceContext,
} from '../services/feedback/intelligenceService';

const router = Router();

/**
 * POST /api/feedback — Submit feedback (thumbs up/down) for content
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      postId,
      field,
      rating,
      feedbackText,
      quickFixUsed,
      contentBefore,
      contentAfter,
      format,
      platform,
      contentPillar,
      author,
    } = req.body;

    if (!postId || !field || !rating) {
      res.status(400).json({ error: 'postId, field, and rating are required' });
      return;
    }

    const feedback = await Feedback.create({
      postId,
      field,
      rating,
      feedbackText: feedbackText || '',
      quickFixUsed: quickFixUsed || '',
      contentBefore: contentBefore || '',
      contentAfter: contentAfter || '',
      format: format || '',
      platform: platform || '',
      contentPillar: contentPillar || '',
      author: author || '',
    });

    res.json({ success: true, feedback });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/feedback/quick-fixes — Get dynamic quick-fix suggestions
 */
router.get('/quick-fixes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { format, platform, field } = req.query;
    const quickFixes = await getDynamicQuickFixes(
      (format as string) || '',
      (platform as string) || '',
      (field as string) || 'content'
    );
    res.json({ quickFixes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/feedback/intelligence — Get full intelligence context for prompt augmentation
 */
router.get('/intelligence', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { format, platform, contentPillar } = req.query;
    const context = await getIntelligenceContext(
      format as string,
      platform as string,
      contentPillar as string
    );
    res.json(context);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/feedback/stats — Get feedback stats overview
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const total = await Feedback.countDocuments();
    const approvals = await Feedback.countDocuments({ rating: 'up' });
    const rejections = await Feedback.countDocuments({ rating: 'down' });

    // Recent feedback
    const recent = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('postId', 'format platform contentPillar')
      .lean();

    res.json({
      total,
      approvals,
      rejections,
      approvalRate: total > 0 ? Math.round((approvals / total) * 100) : 0,
      recent,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
