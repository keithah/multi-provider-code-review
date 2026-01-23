/**
 * Webhook Server Entry Point
 * HTTP server that listens for GitHub webhook events
 */

import * as http from 'http';
import { logger } from '../utils/logger';
import { WebhookHandler } from './webhook-handler';
import { ReviewOrchestrator } from '../core/orchestrator';
import { setupComponents } from '../setup';

interface ServerConfig {
  port: number;
  host: string;
  secret: string;
  githubToken: string;
}

/**
 * Create and start webhook server
 */
export async function startWebhookServer(config: ServerConfig): Promise<http.Server> {
  logger.info(`Starting webhook server on ${config.host}:${config.port}`);

  // Initialize review components
  const components = await setupComponents({
    githubToken: config.githubToken,
    dryRun: false,
  });

  const orchestrator = new ReviewOrchestrator(components);
  const webhookHandler = new WebhookHandler(
    {
      secret: config.secret,
      autoReviewOnOpen: true,
      autoReviewOnSync: true,
      autoReviewOnReopen: true,
    },
    orchestrator
  );

  const server = http.createServer(async (req, res) => {
    // Health check endpoint
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
      return;
    }

    // Webhook endpoint
    if (req.url === '/webhook' && req.method === 'POST') {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          // Verify signature
          const signature = req.headers['x-hub-signature-256'] as string;
          if (!signature) {
            logger.warn('Webhook request missing signature');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing signature' }));
            return;
          }

          const isValid = webhookHandler.verifySignature(body, signature);
          if (!isValid) {
            logger.warn('Invalid webhook signature');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid signature' }));
            return;
          }

          // Parse payload
          const event = req.headers['x-github-event'] as string;
          const payload = WebhookHandler.parsePayload(body);

          // Handle event (async, don't block response)
          webhookHandler.handleEvent(event, payload).catch(error => {
            logger.error('Error handling webhook event', error as Error);
          });

          // Respond immediately (GitHub requires 2xx within 10s)
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));
        } catch (error) {
          logger.error('Error processing webhook', error as Error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });

      return;
    }

    // 404 for all other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  // Error handling
  server.on('error', error => {
    logger.error('Server error', error);
  });

  // Start listening
  await new Promise<void>((resolve, reject) => {
    server.listen(config.port, config.host, () => {
      logger.info(`Webhook server listening on http://${config.host}:${config.port}`);
      resolve();
    });

    server.on('error', reject);
  });

  return server;
}

/**
 * Main entry point
 */
async function main() {
  const config: ServerConfig = {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    secret: process.env.WEBHOOK_SECRET || '',
    githubToken: process.env.GITHUB_TOKEN || '',
  };

  if (!config.secret) {
    logger.error('WEBHOOK_SECRET environment variable is required');
    process.exit(1);
  }

  if (!config.githubToken) {
    logger.error('GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  try {
    const server = await startWebhookServer(config);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start webhook server', error as Error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
