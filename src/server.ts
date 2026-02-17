/**
 * Entry point – start HTTP server and connect to DB/Redis
 */

import 'dotenv/config';
import app from './app';
import { testConnection } from './config/db';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3000;

async function start(): Promise<void> {
  try {
    await testConnection();
  } catch (err) {
    logger.error('Database connection failed', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.info(`Eco-Relais API listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Server failed to start', err);
  process.exit(1);
});
