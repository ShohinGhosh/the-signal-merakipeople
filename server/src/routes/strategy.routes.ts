import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Strategy } from '../models/Strategy';
import { callAI } from '../services/ai/aiClient';
import { env } from '../config/env';

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
        onboardingProgress: { currentSection: 0, totalSections: 5, completedSections: [] },
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
        onboardingProgress: { currentSection: 0, totalSections: 5, completedSections: [] },
      });
    }

    const sectionKey = `section_${section}`;

    // Section names and extraction schemas
    const sectionConfig: Record<number, { name: string; schema: string; fallbackMap: (text: string) => Record<string, any> }> = {
      1: {
        name: 'Business Context',
        schema: `{
  "northStar": "string - The company's north star / overarching mission or purpose",
  "positioningStatement": "string - How the company positions itself, its unique value proposition",
  "icpPrimary": { "description": "string - Primary ideal customer profile description", "industry": "string or null", "companySize": "string or null", "role": "string or null", "painPoints": ["string"] },
  "icpSecondary": { "description": "string or null - Secondary customer profile if mentioned" },
  "antiIcp": "string or null - Who they do NOT want to serve"
}`,
        fallbackMap: (text: string) => ({
          northStar: text.substring(0, 500),
          positioningStatement: '',
          icpPrimary: { description: text.substring(0, 300) },
        }),
      },
      2: {
        name: 'Goals & Metrics',
        schema: `{
  "goal90Day": "string - The primary 90-day goal",
  "metricsTargets": {
    "linkedinFollowers": "number or null",
    "linkedinEngagementRate": "number or null - as percentage",
    "linkedinDmsPerWeek": "number or null",
    "instagramFollowers": "number or null",
    "instagramReach": "number or null",
    "leadsPerMonth": "number or null",
    "demoToCloseRate": "number or null - as percentage",
    "mrrTarget": "number or null",
    "trainingRevenueTarget": "number or null"
  }
}`,
        fallbackMap: (text: string) => ({
          goal90Day: text.substring(0, 500),
          metricsTargets: {},
        }),
      },
      3: {
        name: 'Current State',
        schema: `{
  "contentPillars": [{ "name": "string - pillar topic name", "purpose": "string - why this pillar matters", "targetPercent": "number - percentage of content (all should sum to ~100)", "examplePostTypes": ["string"], "owner": "string - shohini, sanjoy, or both" }],
  "platformStrategy": [{ "platform": "string - e.g. LinkedIn, Instagram, Twitter", "primaryPurpose": "string", "weeklyTarget": "number - posts per week", "bestFormats": ["string"], "bestPostingTimes": ["string"] }],
  "keyMessages": ["string - core messages or themes they want to communicate"]
}`,
        fallbackMap: (text: string) => ({
          contentPillars: [],
          platformStrategy: [],
          keyMessages: [text.substring(0, 300)],
        }),
      },
      4: {
        name: 'Voice & Positioning',
        schema: `{
  "voiceShohini": "string - Shohini's personal voice/tone description",
  "voiceSanjoy": "string - Sanjoy's personal voice/tone description",
  "sharedTone": "string - The shared brand tone they both use",
  "bannedPhrases": ["string - words or phrases they want to avoid"],
  "keyMessages": ["string - additional key messages about their voice/positioning"]
}`,
        fallbackMap: (text: string) => ({
          voiceShohini: text.substring(0, 300),
          voiceSanjoy: '',
          sharedTone: '',
          bannedPhrases: [],
        }),
      },
      5: {
        name: 'Campaigns',
        schema: `{
  "keyMessages": ["string - campaign-related key messages or priorities"],
  "competitiveIntelligence": "string or null - any competitive landscape info mentioned"
}`,
        fallbackMap: (text: string) => ({
          keyMessages: [text.substring(0, 300)],
          competitiveIntelligence: '',
        }),
      },
    };

    const config = sectionConfig[section];
    if (!config) {
      res.status(400).json({ error: `Invalid section number: ${section}` });
      return;
    }

    let fieldsToUpdate: Record<string, any> = {};
    let nextQuestion = '';

    // Try AI extraction if any AI key is available
    let aiProvider: string | undefined;
    if (env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY) {
      try {
        const provider = env.ANTHROPIC_API_KEY ? 'claude' : 'gemini';
        console.log(`[Onboarding] Using ${provider} AI to extract section ${section} data...`);

        const extractionResult = await callAI({
          systemPrompt: `You are a strategy data extraction engine for MerakiPeople. Extract structured data from the user's free-text onboarding response. Return ONLY valid JSON, no markdown fences, no commentary.`,
          userPrompt: `Section ${section}: ${config.name}\n\nUser's response:\n"""\n${userResponse}\n"""\n\nExtract these fields as JSON:\n${config.schema}\n\nReturn ONLY the JSON object. Use null for fields you cannot determine.`,
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 2000,
          temperature: 0.3,
          provider: provider as any,
          enableFallback: true,
        });

        aiProvider = extractionResult.provider;

        // Parse the AI response
        let parsed: Record<string, any>;
        const cleaned = extractionResult.content.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
        try {
          parsed = JSON.parse(cleaned);
        } catch (parseErr) {
          console.warn(`[Onboarding] AI response parse failed, using fallback. Response: ${extractionResult.content.substring(0, 200)}`);
          parsed = config.fallbackMap(userResponse);
        }

        // Clean nulls — don't overwrite existing data with null
        for (const [key, value] of Object.entries(parsed)) {
          if (value !== null && value !== undefined) {
            fieldsToUpdate[key] = value;
          }
        }

        // Also generate a follow-up question for the next section
        if (section < 5) {
          const nextConfig = sectionConfig[section + 1];
          nextQuestion = `Great, I've captured your ${config.name.toLowerCase()} details. Now let's talk about ${nextConfig.name.toLowerCase()} - ${getSectionDescription(section + 1)}`;
        }

        console.log(`[Onboarding] Extracted ${Object.keys(fieldsToUpdate).length} fields from section ${section} via ${extractionResult.provider}/${extractionResult.model}`);
      } catch (aiErr) {
        console.warn(`[Onboarding] AI extraction failed, using fallback:`, aiErr);
        fieldsToUpdate = config.fallbackMap(userResponse);
      }
    } else {
      // No API key — use simple fallback mapping
      console.log(`[Onboarding] No AI API key configured, using fallback extraction for section ${section}`);
      fieldsToUpdate = config.fallbackMap(userResponse);
    }

    // For section 3 and 5 which may add to keyMessages, merge with existing
    if ((section === 3 || section === 5) && fieldsToUpdate.keyMessages) {
      const existing = strategy.keyMessages || [];
      const newMessages = fieldsToUpdate.keyMessages.filter(
        (msg: string) => !existing.includes(msg)
      );
      fieldsToUpdate.keyMessages = [...existing, ...newMessages];
    }

    const completedSections = [...(strategy.onboardingProgress?.completedSections || [])];
    if (!completedSections.includes(sectionKey)) {
      completedSections.push(sectionKey);
    }

    const nextSection = Math.min(section + 1, 5);
    const isComplete = completedSections.length >= 5;

    await Strategy.findByIdAndUpdate(strategy._id, {
      ...fieldsToUpdate,
      isComplete,
      onboardingProgress: {
        currentSection: isComplete ? 5 : nextSection,
        totalSections: 5,
        completedSections,
      },
      updatedBy: req.user?.name || 'unknown',
    });

    res.json({
      message: `Section ${section} processed successfully`,
      extractedData: fieldsToUpdate,
      nextQuestion,
      evidence: {
        source: 'user_onboarding_response',
        provider: aiProvider || 'fallback',
        fieldsExtracted: Object.keys(fieldsToUpdate),
      },
      onboardingProgress: {
        currentSection: isComplete ? 5 : nextSection,
        totalSections: 5,
        completedSections,
      },
    });
  } catch (err) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'Failed to process onboarding section' });
  }
});

function getSectionDescription(section: number): string {
  const descriptions: Record<number, string> = {
    1: 'What MerakiPeople does and who it serves',
    2: 'What does success look like in 90 days? What KPIs matter most?',
    3: 'What content have you done before? What platforms are you active on?',
    4: 'How do you want to sound? What topics do you own?',
    5: 'Any upcoming launches, events, or campaigns in the next quarter?',
  };
  return descriptions[section] || '';
}

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
router.get('/recommendations', (req: Request, res: Response) => {
  // TODO: Replace with AI-generated recommendations from analytics + strategy analysis
  res.json({
    recommendations: [
      {
        _id: 'rec-001',
        recommendation: 'Increase LinkedIn posting frequency from 3 to 5 per week',
        reasoning: 'Engagement data shows 40% higher reach on weekday posts',
        evidence: ['LinkedIn reach up 40% in weeks with 5+ posts'],
        accepted: null,
      },
    ],
  });
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
router.post('/recommendations/:id/accept', (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Replace with recommendation lookup + strategy update + version creation
  res.json({
    message: 'Recommendation accepted and strategy updated',
    recommendationId: id,
    strategyVersion: 2,
  });
});

export default router;
