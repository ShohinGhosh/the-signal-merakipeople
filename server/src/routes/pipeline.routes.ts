import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Lead } from '../models/Lead';
import { runAgentCritiqueLoop } from '../services/ai/orchestrator';
import { gatherEvidenceContext } from '../services/ai/evidenceEngine';

const router = Router();

// All pipeline routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/pipeline:
 *   get:
 *     tags:
 *       - Pipeline
 *     summary: List all leads
 *     description: Returns a paginated list of pipeline leads with optional filters for stage, owner, and source.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stage
 *         schema:
 *           type: string
 *           enum: [RADAR, CONTACTED, CONVERSATION, DEMO_DONE, PROPOSAL, NEGOTIATING, SIGNED, LOST]
 *         description: Filter by pipeline stage
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *           enum: [shohini, sanjoy]
 *         description: Filter by lead owner
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [linkedin_content, instagram, referral, event, direct, webinar]
 *         description: Filter by lead source
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
 *           default: 20
 *         description: Number of leads per page
 *     responses:
 *       200:
 *         description: Paginated list of leads
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leads:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lead'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                       example: 1
 *                     limit:
 *                       type: number
 *                       example: 20
 *                     total:
 *                       type: number
 *                       example: 34
 *                     totalPages:
 *                       type: number
 *                       example: 2
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const filter: Record<string, string> = {};
    if (req.query.stage) filter.stage = req.query.stage as string;
    if (req.query.owner) filter.owner = req.query.owner as string;
    if (req.query.source) filter.source = req.query.source as string;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Lead.countDocuments(filter),
    ]);

    res.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/**
 * @openapi
 * /api/pipeline:
 *   post:
 *     tags:
 *       - Pipeline
 *     summary: Add a new lead
 *     description: Creates a new lead in the pipeline with the specified details.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *               - contactName
 *               - owner
 *             properties:
 *               companyName:
 *                 type: string
 *                 example: TechCorp Inc
 *               contactName:
 *                 type: string
 *                 example: Jane Smith
 *               contactRole:
 *                 type: string
 *                 example: VP of Engineering
 *               source:
 *                 type: string
 *                 enum: [linkedin_content, instagram, referral, event, direct, webinar]
 *                 example: linkedin_content
 *               sourcePostId:
 *                 type: string
 *                 description: Post ID that generated this lead
 *               vertical:
 *                 type: string
 *                 example: SaaS
 *               dealValue:
 *                 type: number
 *                 example: 25000
 *               owner:
 *                 type: string
 *                 enum: [shohini, sanjoy]
 *                 example: shohini
 *               stage:
 *                 type: string
 *                 enum: [RADAR, CONTACTED, CONVERSATION, DEMO_DONE, PROPOSAL, NEGOTIATING, SIGNED, LOST]
 *                 default: RADAR
 *               nextAction:
 *                 type: string
 *                 example: Send intro email
 *               nextActionAt:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                     author:
 *                       type: string
 *     responses:
 *       201:
 *         description: Lead created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lead created
 *                 lead:
 *                   $ref: '#/components/schemas/Lead'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: companyName, contactName, and owner are required
 */
router.post('/', async (req: Request, res: Response) => {
  const { companyName, contactName, owner } = req.body;

  if (!companyName || !contactName || !owner) {
    res.status(400).json({ error: 'companyName, contactName, and owner are required' });
    return;
  }

  try {
    const lead = await new Lead({
      ...req.body,
      stage: req.body.stage || 'RADAR',
    }).save();

    res.status(201).json({
      message: 'Lead created',
      lead,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

/**
 * @openapi
 * /api/pipeline/{id}:
 *   get:
 *     tags:
 *       - Pipeline
 *     summary: Get a single lead
 *     description: Returns a single lead by ID with full details including notes history.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Lead details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lead'
 *       404:
 *         description: Lead not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Lead not found
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

/**
 * @openapi
 * /api/pipeline/{id}:
 *   put:
 *     tags:
 *       - Pipeline
 *     summary: Update a lead
 *     description: Updates lead details including stage transitions, notes, and contact information.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *               contactName:
 *                 type: string
 *               contactRole:
 *                 type: string
 *               stage:
 *                 type: string
 *                 enum: [RADAR, CONTACTED, CONVERSATION, DEMO_DONE, PROPOSAL, NEGOTIATING, SIGNED, LOST]
 *               dealValue:
 *                 type: number
 *               nextAction:
 *                 type: string
 *               nextActionAt:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                     author:
 *                       type: string
 *     responses:
 *       200:
 *         description: Lead updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lead updated
 *                 lead:
 *                   $ref: '#/components/schemas/Lead'
 *       404:
 *         description: Lead not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Lead not found
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updateData = { ...req.body };

    // If stage is being changed, set lastContactAt to now
    if (updateData.stage) {
      updateData.lastContactAt = new Date();
    }

    const lead = await Lead.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json({
      message: 'Lead updated',
      lead,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

/**
 * @openapi
 * /api/pipeline/{id}/draft-outreach:
 *   post:
 *     tags:
 *       - Pipeline
 *     summary: AI-generate outreach message for a lead
 *     description: Uses AI to generate a personalized outreach message for a lead based on their profile, the current strategy, and the specified channel (LinkedIn DM or email).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [linkedin_dm, email]
 *                 description: Outreach channel
 *                 example: linkedin_dm
 *     responses:
 *       200:
 *         description: Outreach message generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Outreach draft generated
 *                 outreach:
 *                   type: object
 *                   properties:
 *                     channel:
 *                       type: string
 *                       enum: [linkedin_dm, email]
 *                       example: linkedin_dm
 *                     subject:
 *                       type: string
 *                       description: Email subject line (only for email channel)
 *                       example: Quick question about your team's growth
 *                     body:
 *                       type: string
 *                       example: Hi Jane, I noticed your team at TechCorp has been scaling rapidly...
 *                     aiEvidence:
 *                       type: object
 *                       properties:
 *                         strategyReferences:
 *                           type: array
 *                           items:
 *                             type: string
 *                         reasoning:
 *                           type: string
 *       400:
 *         description: Missing channel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: channel is required and must be linkedin_dm or email
 *       404:
 *         description: Lead not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Lead not found
 */
router.post('/:id/draft-outreach', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { channel } = req.body;

  const validChannels = ['linkedin_dm', 'email'];
  if (!channel || !validChannels.includes(channel)) {
    res.status(400).json({ error: 'channel is required and must be linkedin_dm or email' });
    return;
  }

  try {
    const lead = await Lead.findById(id);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Gather evidence context from the database
    const evidenceContext = await gatherEvidenceContext(req.user?.name);

    // Build context with lead info and evidence
    const context: Record<string, string> = {
      ...evidenceContext,
      LEAD_COMPANY: lead.companyName,
      LEAD_CONTACT: lead.contactName,
      LEAD_ROLE: lead.contactRole,
      LEAD_VERTICAL: lead.vertical,
      LEAD_STAGE: lead.stage,
      LEAD_SOURCE: lead.source,
      LEAD_NOTES: lead.notes.map((n) => n.text).join('\n'),
      CHANNEL: channel,
    };

    // Run the agent-critique loop
    const result = await runAgentCritiqueLoop({
      generatorPrompt: 'outreach-drafter',
      critiquePrompt: 'outreach-critique',
      context,
      operation: 'draft-outreach',
      user: req.user?.name as string | undefined,
      relatedId: id as string,
      relatedCollection: 'Lead',
    });

    // Parse the result
    const parsed = result.parsed || {};

    res.json({
      message: 'Outreach draft generated',
      outreach: {
        channel,
        subject: parsed.subject || undefined,
        body: parsed.body || parsed.message || result.content,
        aiEvidence: {
          strategyReferences: result.evidence.strategyReferences,
          reasoning: result.evidence.claims.map((c) => `${c.claim} [${c.source}: ${c.reference}]`).join('; ') ||
            result.critique.feedback,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate outreach draft' });
  }
});

/**
 * @openapi
 * /api/pipeline/{id}:
 *   delete:
 *     tags:
 *       - Pipeline
 *     summary: Remove a lead
 *     description: Removes a lead from the pipeline.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Lead removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lead removed
 *       404:
 *         description: Lead not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Lead not found
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    res.json({ message: 'Lead removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove lead' });
  }
});

/**
 * @openapi
 * components:
 *   schemas:
 *     Lead:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         companyName:
 *           type: string
 *           example: TechCorp Inc
 *         contactName:
 *           type: string
 *           example: Jane Smith
 *         contactRole:
 *           type: string
 *           example: VP of Engineering
 *         source:
 *           type: string
 *           enum: [linkedin_content, instagram, referral, event, direct, webinar]
 *           example: linkedin_content
 *         sourcePostId:
 *           type: string
 *           nullable: true
 *         vertical:
 *           type: string
 *           example: SaaS
 *         dealValue:
 *           type: number
 *           example: 25000
 *         owner:
 *           type: string
 *           enum: [shohini, sanjoy]
 *           example: shohini
 *         stage:
 *           type: string
 *           enum: [RADAR, CONTACTED, CONVERSATION, DEMO_DONE, PROPOSAL, NEGOTIATING, SIGNED, LOST]
 *           example: RADAR
 *         lastContactAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         nextAction:
 *           type: string
 *           example: Send intro email
 *         nextActionAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         notes:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 example: Had initial call, very interested
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               author:
 *                 type: string
 *                 example: shohini
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export default router;
