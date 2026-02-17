/**
 * Express app – middleware, CORS, routes, error handling
 */

import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { setupSwagger } from './swagger';
import * as paymentsController from './controllers/paymentsController';

const app = express();

// Security headers
app.use(helmet());

// CORS – in development allow any origin; in production use env list
const isDev = process.env.NODE_ENV !== 'production';
const corsOrigin = process.env.CORS_ORIGIN || process.env.DASHBOARD_URL || '*';
app.use(
  cors({
    origin: isDev ? true : (corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim())),
    credentials: true,
  })
);

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, error: 'Too many requests', code: 'RATE_LIMIT' },
});
app.use('/api', limiter);

// Stripe webhook needs raw body (must be before express.json())
app.use(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response, next: express.NextFunction) => {
    paymentsController.webhook(req, res, next);
  }
);

// JSON body parser
app.use(express.json({ limit: '1mb' }));

// API routes
app.use('/api', routes);

// Swagger docs (non-production or explicitly enabled)
if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
  setupSwagger(app, '/api-docs');
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
});

// Error handler
app.use(errorHandler);

export default app;
