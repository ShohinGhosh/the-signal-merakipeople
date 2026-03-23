import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Campaign } from '../models/Campaign';

const router = Router();

// All campaign routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/campaigns:
 *   get:
 *     tags:
 *       - Campaigns
 *     summary: List all campaigns
 *     description: Returns all campaigns, optionally filtered by status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, paused, complete]
 *         description: Filter by campaign status
 *     responses:
 *       200:
 *         description: List of campaigns
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query: Record<string, any> = {};
    if (req.query.status) {
      query.status = req.query.status;
    }

    const campaigns = await Campaign.find(query).sort({ createdAt: -1 });
    res.json({ campaigns });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

/**
 * @openapi
 * /api/campaigns:
 *   post:
 *     tags:
 *       - Campaigns
 *     summary: Create a new campaign
 *     description: Creates a new marketing campaign with the specified details.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - goal
 *               - startDate
 *               - endDate
 *             properties:
 *               name:
 *                 type: string
 *                 example: Q2 Brand Awareness
 *               goal:
 *                 type: string
 *                 enum: [new_clients, vertical_push, product_launch, event_promotion, brand_awareness, training_launch]
 *                 example: brand_awareness
 *               targetSegment:
 *                 type: string
 *                 example: HR leaders in tech companies
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: '2026-04-01T00:00:00.000Z'
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: '2026-06-30T00:00:00.000Z'
 *               contentBrief:
 *                 type: string
 *                 example: Thought leadership content targeting HR decision makers
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [linkedin]
 *               budget:
 *                 type: number
 *                 example: 3000
 *               successMetric:
 *                 type: string
 *                 example: 20% increase in LinkedIn followers
 *     responses:
 *       201:
 *         description: Campaign created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Campaign created
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Name, goal, startDate, and endDate are required
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, goal, startDate, endDate } = req.body;

    if (!name || !goal || !startDate || !endDate) {
      res.status(400).json({ error: 'Name, goal, startDate, and endDate are required' });
      return;
    }

    const campaign = await new Campaign(req.body).save();
    res.status(201).json({
      message: 'Campaign created',
      campaign,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

/**
 * @openapi
 * /api/campaigns/{id}:
 *   put:
 *     tags:
 *       - Campaigns
 *     summary: Update a campaign
 *     description: Updates an existing campaign with the provided fields.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               goal:
 *                 type: string
 *                 enum: [new_clients, vertical_push, product_launch, event_promotion, brand_awareness, training_launch]
 *               targetSegment:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               contentBrief:
 *                 type: string
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *               budget:
 *                 type: number
 *               successMetric:
 *                 type: string
 *     responses:
 *       200:
 *         description: Campaign updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Campaign updated
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Campaign not found
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByIdAndUpdate(id, req.body, { new: true });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json({
      message: 'Campaign updated',
      campaign,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

/**
 * @openapi
 * /api/campaigns/{id}:
 *   delete:
 *     tags:
 *       - Campaigns
 *     summary: Delete a campaign
 *     description: Deletes a campaign by ID. Only draft campaigns can be deleted.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Campaign deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Campaign deleted
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Campaign not found
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByIdAndDelete(id);

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json({ message: 'Campaign deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

/**
 * @openapi
 * /api/campaigns/{id}/status:
 *   put:
 *     tags:
 *       - Campaigns
 *     summary: Change campaign status
 *     description: Updates the status of a campaign (e.g., activate, pause, complete).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, active, paused, complete]
 *                 example: active
 *     responses:
 *       200:
 *         description: Campaign status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Campaign status updated to active
 *                 campaign:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [draft, active, paused, complete]
 *       400:
 *         description: Invalid status value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid status. Must be one of draft, active, paused, complete
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Campaign not found
 */
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'active', 'paused', 'complete'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be one of draft, active, paused, complete' });
      return;
    }

    const campaign = await Campaign.findByIdAndUpdate(id, { status }, { new: true });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json({
      message: `Campaign status updated to ${status}`,
      campaign: { _id: campaign._id, status: campaign.status },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update campaign status' });
  }
});

/**
 * @openapi
 * components:
 *   schemas:
 *     Campaign:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           example: Q1 Product Launch
 *         goal:
 *           type: string
 *           enum: [new_clients, vertical_push, product_launch, event_promotion, brand_awareness, training_launch]
 *           example: product_launch
 *         targetSegment:
 *           type: string
 *           example: Mid-market SaaS CTOs
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         contentBrief:
 *           type: string
 *         platforms:
 *           type: array
 *           items:
 *             type: string
 *           example: [linkedin, instagram]
 *         budget:
 *           type: number
 *           example: 5000
 *         successMetric:
 *           type: string
 *           example: 50 demo requests
 *         status:
 *           type: string
 *           enum: [draft, active, paused, complete]
 *           example: draft
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export default router;
