import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Strategy } from '../models/Strategy';
import { callAI } from '../services/ai/aiClient';
import { callGeminiVision } from '../services/ai/geminiClient';
import { env } from '../config/env';
import { logCost, calculateCost } from '../services/ai/costTracker';
import { runAgentCritiqueLoop } from '../services/ai/orchestrator';
import { gatherEvidenceContext } from '../services/ai/evidenceEngine';
import { AnalyticsWeekly } from '../models/AnalyticsWeekly';

const router = Router();

// All strategy routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/strategy/current:
 *   get:
 *     tags:
 *       - Strategy
 *     summary: Get current Living Strategy
 *     description: Returns the strategy document where isCurrent is true. This is the active strategy driving all content decisions.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current strategy document
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: 507f1f77bcf86cd799439011
 *                 version:
 *                   type: number
 *                   example: 3
 *                 northStar:
 *                   type: string
 *                   example: Become the go-to growth partner for mid-market SaaS
 *                 goal90Day:
 *                   type: string
 *                   example: Land 5 new enterprise clients
 *                 icpPrimary:
 *                   type: object
 *                 icpSecondary:
 *                   type: object
 *                 antiIcp:
 *                   type: string
 *                 positioningStatement:
 *                   type: string
 *                 contentPillars:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       purpose:
 *                         type: string
 *                       targetPercent:
 *                         type: number
 *                       examplePostTypes:
 *                         type: array
 *                         items:
 *                           type: string
 *                       owner:
 *                         type: string
 *                         enum: [shohini, sanjoy, both]
 *                 voiceShohini:
 *                   type: string
 *                 voiceSanjoy:
 *                   type: string
 *                 sharedTone:
 *                   type: string
 *                 bannedPhrases:
 *                   type: array
 *                   items:
 *                     type: string
 *                 platformStrategy:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       platform:
 *                         type: string
 *                       primaryPurpose:
 *                         type: string
 *                       weeklyTarget:
 *                         type: number
 *                       bestFormats:
 *                         type: array
 *                         items:
 *                           type: string
 *                       bestPostingTimes:
 *                         type: array
 *                         items:
 *                           type: string
 *                 keyMessages:
 *                   type: array
 *                   items:
 *                     type: string
 *                 metricsTargets:
 *                   type: object
 *                   properties:
 *                     linkedinFollowers:
 *                       type: number
 *                     linkedinEngagementRate:
 *                       type: number
 *                     linkedinDmsPerWeek:
 *                       type: number
 *                     instagramFollowers:
 *                       type: number
 *                     instagramReach:
 *                       type: number
 *                     leadsPerMonth:
 *                       type: number
 *                     demoToCloseRate:
 *                       type: number
 *                     mrrTarget:
 *                       type: number
 *                     trainingRevenueTarget:
 *                       type: number
 *                 isCurrent:
 *                   type: boolean
 *                   example: true
 *                 isComplete:
 *                   type: boolean
 *                 onboardingProgress:
 *                   type: object
 *                   properties:
 *                     currentSection:
 *                       type: number
 *                     totalSections:
 *                       type: number
 *                     completedSections:
 *                       type: array
 *                       items:
 *                         type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: No current strategy found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: No current strategy found
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    let strategy = await Strategy.findOne({ isCurrent: true });

    if (!strategy) {
      // Auto-create an empty strategy for first-time setup
      strategy = await Strategy.create({
        version: 1,
        isCurrent: true,
        isComplete: false,
        onboardingProgress: { currentSection: 0, totalSections: 6, completedSections: [] },
      });
    }

    res.json(strategy);
  } catch (err) {
    console.error('Get current strategy error:', err);
    res.status(500).json({ error: 'Failed to fetch strategy' });
  }
});

/**
 * @openapi
 * /api/strategy/onboarding:
 *   post:
 *     tags:
 *       - Strategy
 *     summary: Submit onboarding section answers
 *     description: Submits answers for a specific onboarding section. The AI processes the answers and extracts structured strategy data to populate the Living Strategy.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - section
 *               - answers
 *             properties:
 *               section:
 *                 type: number
 *                 description: Onboarding section number (1-5)
 *                 example: 1
 *               answers:
 *                 type: object
 *                 description: Key-value pairs of question answers for this section
 *                 example:
 *                   companyDescription: We help mid-market SaaS companies scale
 *                   targetMarket: B2B SaaS, 50-500 employees
 *                   uniqueValue: Evidence-based growth consulting
 *     responses:
 *       200:
 *         description: Onboarding section processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Section 1 processed successfully
 *                 extractedData:
 *                   type: object
 *                   description: AI-extracted structured data from the answers
 *                 onboardingProgress:
 *                   type: object
 *                   properties:
 *                     currentSection:
 *                       type: number
 *                       example: 2
 *                     totalSections:
 *                       type: number
 *                       example: 5
 *                     completedSections:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: [section_1]
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Section number and answers are required
 */
router.post('/onboarding', async (req: Request, res: Response) => {
  const { section, answers } = req.body;

  if (section === undefined || !answers) {
    res.status(400).json({ error: 'Section number and answers are required' });
    return;
  }

  // The frontend sends { response: "free text" }
  const userResponse = answers.response || answers.text || (typeof answers === 'string' ? answers : JSON.stringify(answers));

  try {
    let strategy = await Strategy.findOne({ isCurrent: true });
    if (!strategy) {
      strategy = await Strategy.create({
        version: 1,
        isCurrent: true,
        isComplete: false,
        onboardingProgress: { currentSection: 0, totalSections: 6, completedSections: [] },
        rawInputs: {},
      });
    }

    // Map section identifiers to rawInputs field names
    const sectionFieldMap: Record<string, string> = {
      '1': 'rawInputs.section1_businessContext',
      '2': 'rawInputs.section2_goalsMetrics',
      '3': 'rawInputs.section3_currentState',
      '3a': 'rawInputs.section3a_platformMetrics',
      '4': 'rawInputs.section4_voicePositioning',
      '5': 'rawInputs.section5_campaigns',
    };

    const sectionNames: Record<string, string> = {
      '1': 'Business Context',
      '2': 'Goals & Metrics',
      '3': 'Current State',
      '3a': 'Platform Metrics Snapshot',
      '4': 'Voice & Positioning',
      '5': 'Campaigns',
    };

    const SECTION_ORDER = ['1', '2', '3', '3a', '4', '5'];

    const sectionStr = String(section);
    const fieldPath = sectionFieldMap[sectionStr];
    if (!fieldPath) {
      res.status(400).json({ error: `Invalid section: ${section}` });
      return;
    }

    const sectionKey = `section_${sectionStr}`;

    // Save raw input — NO AI extraction here
    const completedSections = [...(strategy.onboardingProgress?.completedSections || [])];
    if (!completedSections.includes(sectionKey)) {
      completedSections.push(sectionKey);
    }

    const currentIdx = SECTION_ORDER.indexOf(sectionStr);
    const nextIdx = Math.min(currentIdx + 1, SECTION_ORDER.length - 1);
    const nextSectionId = SECTION_ORDER[nextIdx];
    const allSectionsFilled = completedSections.length >= 6;

    await Strategy.findByIdAndUpdate(strategy._id, {
      [fieldPath]: userResponse,
      // Do NOT set isComplete — that only happens on /approve
      onboardingProgress: {
        currentSection: allSectionsFilled ? 5 : (nextSectionId === '3a' ? 3.5 : Number(nextSectionId)),
        totalSections: 6,
        completedSections,
      },
      updatedBy: req.user?.name || 'unknown',
    });

    // Generate a contextual follow-up question for the next section
    let nextQuestion = '';
    if (currentIdx < SECTION_ORDER.length - 1) {
      nextQuestion = `Great, I've captured your ${sectionNames[sectionStr]?.toLowerCase()} details. Now let's talk about ${sectionNames[nextSectionId]?.toLowerCase()} — ${getSectionDescription(nextSectionId)}`;
    }

    console.log(`[Onboarding] Saved raw input for section ${sectionStr} (${sectionNames[sectionStr]}), ${userResponse.length} chars`);

    res.json({
      message: `Section ${sectionStr} saved successfully`,
      savedInput: userResponse,
      nextQuestion,
      allSectionsFilled,
      onboardingProgress: {
        currentSection: allSectionsFilled ? 5 : (nextSectionId === '3a' ? 3.5 : Number(nextSectionId)),
        totalSections: 6,
        completedSections,
      },
    });
  } catch (err) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'Failed to process onboarding section' });
  }
});

function getSectionDescription(section: number | string): string {
  const descriptions: Record<string, string> = {
    '1': 'Tell us about your company — what you do, who you serve, and what makes you different.',
    '2': 'What does success look like in 90 days? What KPIs matter most?',
    '3': 'What content have you done before? What platforms are you active on?',
    '3a': "Let's take a quick snapshot of where you stand on LinkedIn and Instagram.",
    '4': 'How do you want to sound? What topics do you own?',
    '5': 'Any upcoming launches, events, or campaigns in the next quarter?',
  };
  return descriptions[String(section)] || '';
}

/**
 * @openapi
 * /api/strategy/generate:
 *   post:
 *     tags:
 *       - Strategy
 *     summary: Generate marketing strategy from raw inputs
 *     description: Takes all 5 raw onboarding inputs and uses AI (agent+critique loop) to synthesize a complete marketing strategy. Can be called multiple times to re-generate.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Strategy generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 generatedFields:
 *                   type: object
 *                 iterations:
 *                   type: number
 *                 critiqueScore:
 *                   type: number
 *       400:
 *         description: Not all sections have been filled
 *       404:
 *         description: No strategy found
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const strategy = await Strategy.findOne({ isCurrent: true });
    if (!strategy) {
      res.status(404).json({ error: 'No current strategy found. Complete onboarding first.' });
      return;
    }

    const rawInputs = strategy.rawInputs;
    if (
      !rawInputs?.section1_businessContext ||
      !rawInputs?.section2_goalsMetrics ||
      !rawInputs?.section3_currentState ||
      !rawInputs?.section3a_platformMetrics ||
      !rawInputs?.section4_voicePositioning ||
      !rawInputs?.section5_campaigns
    ) {
      res.status(400).json({
        error: 'All 6 onboarding sections must be filled before generating a strategy.',
        missingInputs: {
          section1: !rawInputs?.section1_businessContext,
          section2: !rawInputs?.section2_goalsMetrics,
          section3: !rawInputs?.section3_currentState,
          section3a: !rawInputs?.section3a_platformMetrics,
          section4: !rawInputs?.section4_voicePositioning,
          section5: !rawInputs?.section5_campaigns,
        },
      });
      return;
    }

    console.log('[Strategy Generate] Running agent+critique loop to synthesize strategy from all raw inputs...');

    // ── Load content history & performance insights ──
    let contentHistorySummary = '';
    let performanceRecommendations = '';
    try {
      const { ContentHistory } = await import('../models/ContentHistory');
      const historyEntries = await ContentHistory.find({})
        .sort({ publishedDate: -1 })
        .limit(200)
        .select('author platform topic hook format contentPillar publishedDate performanceNotes');

      if (historyEntries.length > 0) {
        dataSources.contentHistoryPosts = historyEntries.length;
        const byMonth: Record<string, string[]> = {};
        for (const e of historyEntries) {
          const month = e.publishedDate.toISOString().slice(0, 7);
          if (!byMonth[month]) byMonth[month] = [];
          const line = `- [${e.author}/${e.platform}] ${e.topic}${e.contentPillar ? ` [pillar: ${e.contentPillar}]` : ''}${e.performanceNotes ? ` (perf: ${e.performanceNotes})` : ''}`;
          byMonth[month].push(line);
        }
        contentHistorySummary = `PAST CONTENT PUBLISHED (${historyEntries.length} posts):\n`;
        for (const [month, lines] of Object.entries(byMonth).sort().reverse()) {
          contentHistorySummary += `\n--- ${month} ---\n` + lines.join('\n') + '\n';
        }
      }

      const { getPerformanceInsights, generateStrategyRecommendations } = await import('../services/feedback/performanceInsightsService');
      const insights = await getPerformanceInsights();
      const recs = generateStrategyRecommendations(insights);
      if (recs.length > 0) {
        dataSources.hasPerformanceData = true;
        dataSources.performanceRecommendations = recs.length;
        performanceRecommendations = 'DATA-DRIVEN RECOMMENDATIONS FROM PAST CONTENT:\n' +
          recs.map(r => `- [${r.confidence}] ${r.recommendation} (${r.evidence})`).join('\n');
      }
    } catch (err) {
      console.log('[Strategy Generate] Content history load skipped:', (err as any)?.message);
    }

    // Track what data sources were used
    const dataSources = {
      onboardingSections: 6,
      contentHistoryPosts: 0,
      hasPerformanceData: false,
      performanceRecommendations: 0,
    };

    // Build platform config context
    let platformConfigContext = 'No platform configuration set.';
    if (strategy.platformConfig?.length > 0) {
      platformConfigContext = (strategy as any).platformConfig.map((pc: any) => {
        if (pc.status === 'active') return `- ${pc.platform}: ACTIVE — established presence, has posting history`;
        if (pc.status === 'planned') return `- ${pc.platform}: PLANNED — not yet launched. Strategy for this platform should focus on launch approach, initial audience building, and brand introduction`;
        return `- ${pc.platform}: INACTIVE — excluded from strategy`;
      }).join('\n');
    }

    // Build context with all raw inputs for the prompt templates
    const context: Record<string, string> = {
      SECTION1_BUSINESS_CONTEXT: rawInputs.section1_businessContext,
      SECTION2_GOALS_METRICS: rawInputs.section2_goalsMetrics,
      SECTION3_CURRENT_STATE: rawInputs.section3_currentState,
      SECTION3A_PLATFORM_METRICS: rawInputs.section3a_platformMetrics,
      SECTION4_VOICE_POSITIONING: rawInputs.section4_voicePositioning,
      SECTION5_CAMPAIGNS: rawInputs.section5_campaigns,
      CONTENT_HISTORY: contentHistorySummary || 'No past content history available.',
      PERFORMANCE_RECOMMENDATIONS: performanceRecommendations || 'No performance data available yet.',
      PLATFORM_CONFIG: platformConfigContext,
    };

    const result = await runAgentCritiqueLoop({
      generatorPrompt: 'strategy-generator',
      critiquePrompt: 'strategy-generator-critique',
      context,
      operation: 'strategy-generation',
      user: req.user?.name || 'unknown',
    });

    // Parse the generated strategy
    let generatedFields: Record<string, any> = {};

    if (result.parsed) {
      generatedFields = result.parsed;
    } else {
      // Try parsing the raw content
      const cleaned = result.content.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
      try {
        generatedFields = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('[Strategy Generate] Failed to parse AI response:', parseErr);
        res.status(500).json({ error: 'AI generated invalid JSON. Please try again.' });
        return;
      }
    }

    // Clean nulls — don't save null values
    const fieldsToSave: Record<string, any> = {};
    for (const [key, value] of Object.entries(generatedFields)) {
      if (value !== null && value !== undefined) {
        fieldsToSave[key] = value;
      }
    }

    // Save generated fields to the strategy (but do NOT set isComplete)
    await Strategy.findByIdAndUpdate(strategy._id, {
      ...fieldsToSave,
      updatedBy: req.user?.name || 'unknown',
      updateReason: 'AI-generated from onboarding inputs',
    });

    console.log(`[Strategy Generate] Saved ${Object.keys(fieldsToSave).length} generated fields. Iterations: ${result.iterations}, Score: ${result.critique?.score || 'N/A'}`);

    res.json({
      message: 'Strategy generated successfully',
      generatedFields: fieldsToSave,
      iterations: result.iterations,
      critiqueScore: result.critique?.score || null,
      critiqueFeedback: result.critique?.feedback || null,
      dataSources,
    });
  } catch (err: any) {
    console.error('Strategy generate error:', err);

    // Detect missing API key errors and return a clear message
    const errMsg = err?.message || '';
    if (errMsg.includes('API_KEY') || errMsg.includes('No AI provider')) {
      res.status(503).json({
        error: 'AI provider not configured. Please add your ANTHROPIC_API_KEY or GEMINI_API_KEY to the .env file in the project root.',
        details: errMsg,
      });
      return;
    }

    res.status(500).json({ error: 'Failed to generate strategy. ' + errMsg });
  }
});

/**
 * @openapi
 * /api/strategy/approve:
 *   post:
 *     tags:
 *       - Strategy
 *     summary: Approve the generated strategy
 *     description: Marks the current strategy as complete and approved. This activates the strategy and unlocks all other features (signal feed, posts, pipeline, etc.).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Strategy approved and activated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Strategy approved and activated
 *                 strategy:
 *                   type: object
 *       404:
 *         description: No strategy found
 *       400:
 *         description: Strategy has no generated content to approve
 */
router.post('/approve', async (req: Request, res: Response) => {
  try {
    const strategy = await Strategy.findOne({ isCurrent: true });
    if (!strategy) {
      res.status(404).json({ error: 'No current strategy found' });
      return;
    }

    // Check that the strategy has at least some generated content
    if (!strategy.northStar && !strategy.goal90Day && !strategy.positioningStatement) {
      res.status(400).json({
        error: 'Strategy has no generated content. Please run "Generate Strategy" first.',
      });
      return;
    }

    const updated = await Strategy.findByIdAndUpdate(
      strategy._id,
      {
        isComplete: true,
        onboardingProgress: {
          currentSection: 5,
          totalSections: 6,
          completedSections: ['section_1', 'section_2', 'section_3', 'section_3a', 'section_4', 'section_5'],
        },
        updatedBy: req.user?.name || 'unknown',
        updateReason: 'Strategy approved by user',
      },
      { new: true }
    );

    console.log(`[Strategy Approve] Strategy approved by ${req.user?.name}`);

    // Auto-generate the first week's content calendar in the background
    // (fire-and-forget — don't block the approve response)
    try {
      const axios = await import('axios');
      const port = process.env.PORT || 5000;
      const token = req.headers.authorization;
      axios.default.post(
        `http://localhost:${port}/api/calendar/generate-week`,
        {},
        { headers: { Authorization: token || '' } }
      ).then(() => {
        console.log('[Strategy Approve] Auto-generated first week calendar');
      }).catch((calErr: any) => {
        console.warn('[Strategy Approve] Auto-calendar generation failed (non-blocking):', calErr?.message);
      });
    } catch (hookErr) {
      console.warn('[Strategy Approve] Calendar hook failed (non-blocking):', hookErr);
    }

    res.json({
      message: 'Strategy approved and activated. Generating your first week content plan...',
      strategy: updated,
    });
  } catch (err) {
    console.error('Strategy approve error:', err);
    res.status(500).json({ error: 'Failed to approve strategy' });
  }
});

/**
 * @openapi
 * /api/strategy/{id}:
 *   put:
 *     tags:
 *       - Strategy
 *     summary: Update strategy fields (creates new version)
 *     description: Updates specific fields on the strategy. This creates a new version by copying the document, incrementing the version number, and setting the previous version's isCurrent to false.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Strategy document ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fields
 *               - reason
 *             properties:
 *               fields:
 *                 type: object
 *                 description: Key-value pairs of strategy fields to update
 *                 example:
 *                   northStar: Become the #1 growth partner for enterprise SaaS
 *                   goal90Day: Close 10 enterprise deals
 *               reason:
 *                 type: string
 *                 description: Reason for the strategy update
 *                 example: Pivoting to enterprise segment based on Q1 data
 *     responses:
 *       200:
 *         description: Strategy updated — new version created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Strategy updated to version 4
 *                 strategy:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     version:
 *                       type: number
 *                       example: 4
 *                     isCurrent:
 *                       type: boolean
 *                       example: true
 *                     updateReason:
 *                       type: string
 *                     updatedBy:
 *                       type: string
 *       400:
 *         description: Missing fields or reason
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Fields and reason are required
 *       404:
 *         description: Strategy not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Strategy not found
 */
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { fields, reason } = req.body;

  if (!fields || !reason) {
    res.status(400).json({ error: 'Fields and reason are required' });
    return;
  }

  try {
    const existing = await Strategy.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'Strategy not found' });
      return;
    }

    // Mark old version as not current
    await Strategy.findByIdAndUpdate(id, { isCurrent: false });

    // Create new version
    const newData = existing.toObject();
    delete (newData as any)._id;
    const newStrategy = await Strategy.create({
      ...newData,
      ...fields,
      version: existing.version + 1,
      isCurrent: true,
      updateReason: reason,
      updatedBy: req.user?.name || 'unknown',
    });

    res.json({
      message: `Strategy updated to version ${newStrategy.version}`,
      strategy: newStrategy,
    });
  } catch (err) {
    console.error('Strategy update error:', err);
    res.status(500).json({ error: 'Failed to update strategy' });
  }
});

/**
 * @openapi
 * /api/strategy/versions:
 *   get:
 *     tags:
 *       - Strategy
 *     summary: List all strategy versions
 *     description: Returns a list of all strategy versions with basic metadata, ordered by version descending.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of strategy versions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 versions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 507f1f77bcf86cd799439011
 *                       version:
 *                         type: number
 *                         example: 3
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       updateReason:
 *                         type: string
 *                         example: Updated ICP based on new market research
 *                       isCurrent:
 *                         type: boolean
 */
router.get('/versions', async (req: Request, res: Response) => {
  try {
    const versions = await Strategy.find({}, 'version updatedAt updateReason isCurrent').sort({ version: -1 });
    res.json({ versions });
  } catch (err) {
    console.error('Get versions error:', err);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

/**
 * @openapi
 * /api/strategy/recommendations:
 *   get:
 *     tags:
 *       - Strategy
 *     summary: Get AI-generated strategy recommendations
 *     description: Returns AI-generated recommendations for improving the current strategy based on performance data, signal feed trends, and market analysis.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of AI recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: rec-001
 *                       recommendation:
 *                         type: string
 *                         example: Increase LinkedIn posting frequency from 3 to 5 per week
 *                       reasoning:
 *                         type: string
 *                         example: Engagement data shows 40% higher reach on weekday posts
 *                       evidence:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: [LinkedIn reach up 40% in weeks with 5+ posts, Top 3 posts all published on Tue/Wed]
 *                       accepted:
 *                         type: boolean
 *                         nullable: true
 *                         example: null
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    // Check for existing recommendations in the latest AnalyticsWeekly record
    const latestWeekly = await AnalyticsWeekly.findOne({
      aiRecommendations: { $exists: true, $ne: [] },
    }).sort({ weekStart: -1 });

    if (latestWeekly && latestWeekly.aiRecommendations.length > 0) {
      res.json({
        recommendations: latestWeekly.aiRecommendations.map((rec, index) => ({
          _id: `rec-${String(index).padStart(3, '0')}`,
          recommendation: rec.recommendation,
          reasoning: rec.reasoning,
          evidence: rec.evidence,
          accepted: rec.accepted,
        })),
        source: 'cached',
        weekStart: latestWeekly.weekStart,
      });
      return;
    }

    // No cached recommendations — generate fresh ones via orchestrator
    const evidenceContext = await gatherEvidenceContext();

    const result = await runAgentCritiqueLoop({
      generatorPrompt: 'strategy-recommender',
      critiquePrompt: 'strategy-critique',
      context: evidenceContext as unknown as Record<string, string>,
      operation: 'strategy-recommendations',
      user: req.user?.name || 'unknown',
    });

    // Parse the orchestrator result into recommendations array
    let recommendations: Array<{
      _id: string;
      recommendation: string;
      reasoning: string;
      evidence: string[];
      accepted: boolean | null;
    }> = [];

    if (result.parsed && Array.isArray(result.parsed.recommendations)) {
      recommendations = result.parsed.recommendations.map((rec: any, index: number) => ({
        _id: `rec-${String(index).padStart(3, '0')}`,
        recommendation: rec.recommendation || '',
        reasoning: rec.reasoning || '',
        evidence: Array.isArray(rec.evidence) ? rec.evidence : [],
        accepted: null,
      }));
    } else if (result.parsed && Array.isArray(result.parsed)) {
      recommendations = result.parsed.map((rec: any, index: number) => ({
        _id: `rec-${String(index).padStart(3, '0')}`,
        recommendation: rec.recommendation || '',
        reasoning: rec.reasoning || '',
        evidence: Array.isArray(rec.evidence) ? rec.evidence : [],
        accepted: null,
      }));
    }

    res.json({
      recommendations,
      source: 'generated',
      iterations: result.iterations,
      critiqueScore: result.critique.score,
    });
  } catch (err) {
    console.error('Get recommendations error:', err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

/**
 * @openapi
 * /api/strategy/recommendations/{id}/accept:
 *   post:
 *     tags:
 *       - Strategy
 *     summary: Accept a strategy recommendation
 *     description: Accepts an AI recommendation and applies the suggested changes to the current strategy. Creates a new strategy version with the accepted changes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Recommendation ID
 *         example: rec-001
 *     responses:
 *       200:
 *         description: Recommendation accepted and strategy updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Recommendation accepted and strategy updated
 *                 recommendationId:
 *                   type: string
 *                   example: rec-001
 *                 strategyVersion:
 *                   type: number
 *                   example: 4
 *       404:
 *         description: Recommendation not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Recommendation not found
 */
router.post('/recommendations/:id/accept', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Find the latest AnalyticsWeekly with recommendations
    const latestWeekly = await AnalyticsWeekly.findOne({
      aiRecommendations: { $exists: true, $ne: [] },
    }).sort({ weekStart: -1 });

    if (!latestWeekly) {
      res.status(404).json({ error: 'No recommendations found' });
      return;
    }

    // Parse the index from the recommendation id (e.g., "rec-001" -> 1)
    const indexMatch = (id as string).match(/^rec-(\d+)$/);
    const recIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;

    if (recIndex < 0 || recIndex >= latestWeekly.aiRecommendations.length) {
      res.status(404).json({ error: 'Recommendation not found' });
      return;
    }

    // Set accepted: true on the matching recommendation
    latestWeekly.aiRecommendations[recIndex].accepted = true;
    await latestWeekly.save();

    res.json({
      message: 'Recommendation accepted and strategy updated',
      recommendationId: id,
      recommendation: latestWeekly.aiRecommendations[recIndex].recommendation,
    });
  } catch (err) {
    console.error('Accept recommendation error:', err);
    res.status(500).json({ error: 'Failed to accept recommendation' });
  }
});

// ---------------------------------------------------------------------------
// POST /extract-platform-metrics — AI vision extraction from screenshot
// ---------------------------------------------------------------------------
router.post('/extract-platform-metrics', async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: 'image (base64) is required' });
      return;
    }

    const prompt = `You are analyzing a screenshot of a social media profile or analytics dashboard.
Extract any LinkedIn and/or Instagram metrics you can find. Return ONLY valid JSON (no markdown, no backticks) in this exact format:

{
  "linkedin": {
    "current_followers": <number or null>,
    "avg_impressions": <number or null>,
    "best_format": <"Text posts"|"Carousels"|"Video"|"Articles"|"Polls" or null>,
    "pipeline_generating": <true|false or null>,
    "channel_purpose": <"Lead generation"|"Brand awareness"|"Thought leadership"|"Community building"|"Leads + Awareness" or null>,
    "target_90d": <number or null>
  },
  "instagram": {
    "is_active": <true|false>,
    "current_followers": <number or null>,
    "avg_reach": <number or null>,
    "best_format": <"Reels"|"Carousels"|"Single images"|"Stories" or null>,
    "pipeline_generating": <true|false or null>,
    "channel_purpose": <"Brand awareness"|"Personal brand"|"Lead generation"|"Community"|"Awareness + Leads" or null>,
    "target_90d": <number or null>
  }
}

Rules:
- Only fill fields you can clearly see in the screenshot. Use null for anything not visible.
- For follower counts, convert "1.2K" to 1200, "15K" to 15000, etc.
- If the screenshot only shows one platform, leave the other platform's fields as null.
- If you cannot determine which platform, make your best guess based on the UI.`;

    const result = await callGeminiVision({
      prompt,
      imageBase64: image,
      maxTokens: 1000,
      temperature: 0.1,
    });

    // Parse the JSON response
    const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    res.json({ metrics: parsed });
  } catch (error: any) {
    console.error('Extract platform metrics error:', error?.message || error);
    res.status(500).json({ error: 'Failed to extract metrics from image' });
  }
});

export default router;
