import { Router, Request, Response } from 'express';
import { FoundationDocument } from '../models/FoundationDocument';
import { callClaude } from '../services/ai/claudeClient';
import { logCost } from '../services/ai/costTracker';
import { Strategy } from '../models/Strategy';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * Extract text from a file buffer based on its MIME type.
 */
async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || fileName.endsWith('.md') || fileName.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (err) {
      console.error('[foundationDocs] PDF parse error:', err);
      return '[PDF text extraction failed]';
    }
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (err) {
      console.error('[foundationDocs] DOCX parse error:', err);
      return '[DOCX text extraction failed]';
    }
  }

  return '[Unsupported file type — text extraction not available]';
}

/**
 * Run AI intelligence extraction on a document's text against the strategy.
 * Produces a structured summary of how this document is useful for content generation.
 */
async function extractIntelligence(extractedText: string, fileName: string, docType: string): Promise<{
  intelligence: Record<string, any>;
  aiCost: { inputTokens: number; outputTokens: number; costUsd: number; model: string };
}> {
  // Get current strategy for context
  const strategy = await Strategy.findOne({ isCurrent: true }).lean();
  const strategySnippet = strategy
    ? JSON.stringify({
        northStar: strategy.northStar,
        contentPillars: (strategy as any).contentPillars?.map((p: any) => p.name),
        icpPrimary: (strategy as any).icpPrimary,
        keyMessages: (strategy as any).keyMessages,
      })
    : 'No strategy loaded.';

  // Truncate very long documents for the AI call
  const textForAI = extractedText.substring(0, 8000);

  const systemPrompt = `You are a marketing strategist analyzing a company document to extract intelligence useful for content creation.

Current marketing strategy context:
${strategySnippet}

Analyze the document and return a JSON object with these fields:
{
  "summary": "2-3 sentence summary of what this document is about",
  "keyThemes": ["theme1", "theme2", ...],
  "messagingAnchors": ["specific phrases, value props, or proof points that should be echoed in content"],
  "icpInsights": "How this document relates to the target ICP — pain points addressed, language used, objections handled",
  "contentPillarFit": ["which content pillars from the strategy this document supports"],
  "proofPoints": ["specific stats, case study results, client wins, or data points that can be referenced"],
  "toneAndVoice": "Notable tone, language style, or vocabulary patterns in this document",
  "suggestedUses": ["how this document's content could be repurposed — e.g. 'carousel about the ROI stat on page 3', 'hook from the client testimonial'"]
}

Return ONLY valid JSON, no markdown fencing.`;

  const userPrompt = `Document: "${fileName}" (type: ${docType})

Content:
${textForAI}`;

  const startMs = Date.now();
  const result = await callClaude({
    systemPrompt,
    userPrompt,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1500,
    temperature: 0.3,
  });
  const durationMs = Date.now() - startMs;

  // Parse intelligence JSON
  let intelligence: Record<string, any> = {};
  try {
    // Strip any markdown fencing if present
    let cleaned = result.content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    intelligence = JSON.parse(cleaned);
  } catch {
    intelligence = { summary: result.content, parseError: true };
  }

  // Log cost
  const { calculateCost } = require('../services/ai/costTracker');
  const costUsd = calculateCost(result.model, result.inputTokens, result.outputTokens);

  await logCost({
    operation: 'foundation-doc-intelligence',
    model: result.model,
    provider: 'claude',
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    iteration: 1,
    totalIterations: 1,
    agentType: 'generator',
    relatedCollection: 'FoundationDocument',
    promptName: 'foundation-doc-intelligence',
    durationMs,
  });

  return {
    intelligence,
    aiCost: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd,
      model: result.model,
    },
  };
}

/**
 * POST /api/foundation-docs
 * Upload a foundation document. Expects JSON: { fileName, mimeType, fileBase64, title?, description?, docType? }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { fileName, mimeType, fileBase64, title, description, docType } = req.body;

    if (!fileName || !fileBase64) {
      return res.status(400).json({ error: 'fileName and fileBase64 are required' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const fileSize = buffer.length;

    // Extract text
    const extractedText = await extractText(buffer, mimeType || '', fileName);
    console.log(`[foundationDocs] Extracted ${extractedText.length} chars from "${fileName}"`);

    // Store file locally
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'foundation-docs');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const localName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const localPath = path.join(uploadsDir, localName);
    fs.writeFileSync(localPath, buffer);

    // Create document entry (intelligence will be added async)
    const doc = await FoundationDocument.create({
      title: title || fileName.replace(/\.[^.]+$/, ''),
      description: description || '',
      docType: docType || 'other',
      fileName,
      fileSize,
      mimeType: mimeType || '',
      blobUrl: `/uploads/foundation-docs/${localName}`,
      extractedText,
      isActive: true,
      uploadedBy: (req as any).user?.name || '',
    });

    console.log(`[foundationDocs] Saved "${fileName}" — starting intelligence extraction...`);

    // Return immediately, then run intelligence extraction in background
    res.status(201).json({
      document: {
        ...doc.toObject(),
        extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''),
      },
      extractedChars: extractedText.length,
    });

    // Background: extract intelligence
    try {
      const { intelligence, aiCost } = await extractIntelligence(
        extractedText,
        fileName,
        docType || 'other'
      );
      await FoundationDocument.findByIdAndUpdate(doc._id, { intelligence, aiCost });
      console.log(`[foundationDocs] Intelligence extracted for "${fileName}"`);
    } catch (err) {
      console.error(`[foundationDocs] Intelligence extraction failed for "${fileName}":`, err);
    }
  } catch (err: any) {
    console.error('[foundationDocs] Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/foundation-docs/:id/reanalyse
 * Re-run intelligence extraction on an existing document.
 */
router.post('/:id/reanalyse', async (req: Request, res: Response) => {
  try {
    const doc = await FoundationDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    res.json({ status: 'analysing' });

    // Background extraction
    try {
      const { intelligence, aiCost } = await extractIntelligence(
        doc.extractedText || '',
        doc.fileName,
        doc.docType || 'other'
      );
      await FoundationDocument.findByIdAndUpdate(doc._id, { intelligence, aiCost });
      console.log(`[foundationDocs] Re-analysed "${doc.fileName}"`);
    } catch (err) {
      console.error(`[foundationDocs] Re-analysis failed:`, err);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/foundation-docs
 * List all foundation documents (with intelligence, without full extracted text).
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const docs = await FoundationDocument.find()
      .select('-extractedText')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ documents: docs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/foundation-docs/:id
 * Get a single document including extracted text and intelligence.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await FoundationDocument.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: doc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/foundation-docs/:id
 * Update document metadata (title, description, docType, isActive).
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, docType, isActive } = req.body;
    const update: Record<string, any> = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (docType !== undefined) update.docType = docType;
    if (isActive !== undefined) update.isActive = isActive;

    const doc = await FoundationDocument.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('-extractedText')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: doc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/foundation-docs/:id
 * Permanently delete a foundation document.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await FoundationDocument.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
