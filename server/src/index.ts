import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { connectDB } from './config/db';
import { env, validateEnv } from './config/env';
import { swaggerSpec } from './config/swagger';

// Import routes
import authRoutes from './routes/auth.routes';
import strategyRoutes from './routes/strategy.routes';
import campaignRoutes from './routes/campaign.routes';
import signalFeedRoutes from './routes/signal-feed.routes';
import postsRoutes from './routes/posts.routes';
import calendarRoutes from './routes/calendar.routes';
import pipelineRoutes from './routes/pipeline.routes';
import analyticsRoutes from './routes/analytics.routes';
import costsRoutes from './routes/costs.routes';
import automationsRoutes from './routes/automations.routes';
import journalRoutes from './routes/journal.routes';
import promptsRoutes from './routes/prompts.routes';
import feedbackRoutes from './routes/feedback.routes';
import contentHistoryRoutes from './routes/content-history.routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'The Signal API Docs',
}));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'the-signal-api',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/strategy', strategyRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/signal-feed', signalFeedRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/costs', costsRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/prompts', promptsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/content-history', contentHistoryRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
async function start() {
  validateEnv();
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`\n  The Signal API running on http://localhost:${env.PORT}`);
    console.log(`  Swagger docs: http://localhost:${env.PORT}/api-docs`);
    console.log(`  Environment: ${env.NODE_ENV}\n`);
  });
}

start().catch(console.error);

export default app;
