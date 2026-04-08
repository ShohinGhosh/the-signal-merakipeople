import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../middleware/auth';
import { listPrompts, loadPrompt } from '../services/ai/promptManager';

const router = Router();
const PROMPTS_DIR = path.resolve(__dirname, '../prompts');

// List all prompts (name + description)
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const names = listPrompts();
    const prompts = names.map((name) => {
      try {
        const t = loadPrompt(name);
        return {
          name,
          description: t.description || '',
          model: t.model || '',
          version: t.version || '',
        };
      } catch {
        return { name, description: 'Error loading prompt', model: '', version: '' };
      }
    });
    res.json(prompts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get full prompt YAML content
router.get('/:name', authMiddleware, async (req: Request, res: Response) => {
  try {
    const filePath = path.join(PROMPTS_DIR, `${req.params.name}.yaml`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ name: req.params.name, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update prompt YAML content
router.put('/:name', authMiddleware, async (req: Request, res: Response) => {
  try {
    const filePath = path.join(PROMPTS_DIR, `${req.params.name}.yaml`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'content field is required' });
      return;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ success: true, name: req.params.name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
