import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

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
router.get('/current', (req: Request, res: Response) => {
  // TODO: Replace with Strategy.findOne({ isCurrent: true })
  res.json({
    _id: '507f1f77bcf86cd799439011',
    version: 1,
    northStar: '',
    goal90Day: '',
    icpPrimary: {},
    icpSecondary: {},
    antiIcp: '',
    positioningStatement: '',
    contentPillars: [],
    voiceShohini: '',
    voiceSanjoy: '',
    sharedTone: '',
    bannedPhrases: [],
    platformStrategy: [],
    keyMessages: [],
    metricsTargets: {},
    isCurrent: true,
    isComplete: false,
    onboardingProgress: { currentSection: 0, totalSections: 5, completedSections: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
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
router.post('/onboarding', (req: Request, res: Response) => {
  const { section, answers } = req.body;

  if (section === undefined || !answers) {
    res.status(400).json({ error: 'Section number and answers are required' });
    return;
  }

  // TODO: Replace with AI processing via orchestrator + Strategy update
  res.json({
    message: `Section ${section} processed successfully`,
    extractedData: {},
    onboardingProgress: {
      currentSection: section + 1,
      totalSections: 5,
      completedSections: Array.from({ length: section }, (_, i) => `section_${i + 1}`),
    },
  });
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
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { fields, reason } = req.body;

  if (!fields || !reason) {
    res.status(400).json({ error: 'Fields and reason are required' });
    return;
  }

  // TODO: Replace with Strategy clone + version increment + save
  res.json({
    message: 'Strategy updated to version 2',
    strategy: {
      _id: 'new-strategy-id',
      version: 2,
      isCurrent: true,
      updateReason: reason,
      updatedBy: req.user?.name || 'unknown',
    },
  });
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
router.get('/versions', (req: Request, res: Response) => {
  // TODO: Replace with Strategy.find({}, 'version updatedAt updateReason isCurrent').sort({ version: -1 })
  res.json({
    versions: [
      {
        _id: '507f1f77bcf86cd799439011',
        version: 1,
        updatedAt: new Date().toISOString(),
        updateReason: 'Initial strategy',
        isCurrent: true,
      },
    ],
  });
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
