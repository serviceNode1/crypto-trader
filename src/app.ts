import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import { initRedis, closeRedis } from './config/redis';
import { testConnection, closePool } from './config/database';
import { runMigrations } from './migrations/run';
import routes from './api/routes';
import { logger } from './utils/logger';
import { initializeJobSystem } from './jobs/scheduler';
import { closeQueues } from './jobs';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

/**
 * Middleware Configuration
 */

// Security headers with relaxed CSP for development
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Allow inline scripts for dashboard
          "https://cdn.jsdelivr.net", // Allow Chart.js CDN
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, etc.)
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Allow inline styles
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net"], // Allow Chart.js source maps
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  })
);

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

/**
 * Static Files - Serve dashboard
 */
app.use(express.static(path.join(__dirname, '../public')));

/**
 * API Routes
 */
app.use('/api', routes);

/**
 * Root route - Serve dashboard
 */
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

/**
 * Error Handling Middleware
 */
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

/**
 * 404 Handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Initialize Application
 */
async function initializeApp(): Promise<void> {
  try {
    logger.info('Initializing Crypto AI Trading System...');

    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    logger.info('✓ Database connected');

    // Run migrations
    logger.info('Running database migrations...');
    await runMigrations();
    logger.info('✓ Migrations completed');

    // Initialize Redis
    logger.info('Initializing Redis...');
    await initRedis();
    logger.info('✓ Redis initialized');

    // Initialize job system
    if (process.env.ENABLE_JOB_SCHEDULER !== 'false') {
      logger.info('Initializing job scheduler...');
      await initializeJobSystem();
      logger.info('✓ Job scheduler initialized');
    } else {
      logger.info('Job scheduler disabled by configuration');
    }

    // Check required environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
    ];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
    if (missingVars.length > 0) {
      logger.warn('Missing environment variables', { missing: missingVars });
      logger.warn('Some features may not work properly');
    }

    logger.info('✓ Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application', { error });
    throw error;
  }
}

/**
 * Graceful Shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Stop accepting new requests
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close job queues
      if (process.env.ENABLE_JOB_SCHEDULER !== 'false') {
        await closeQueues();
        logger.info('Job queues closed');
      }

      // Close Redis connection
      await closeRedis();
      logger.info('Redis connection closed');

      // Close database pool
      await closePool();
      logger.info('Database pool closed');

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

/**
 * Start Server
 */
let server: any;

async function startServer(): Promise<void> {
  try {
    await initializeApp();

    server = app.listen(PORT, () => {
      logger.info(`🚀 Crypto AI Trading System running on port ${PORT}`);
      logger.info(`📊 Dashboard: http://localhost:${PORT}`);
      logger.info(`🔌 API: http://localhost:${PORT}/api`);
      logger.info(`💰 Starting capital: $${process.env.STARTING_CAPITAL || '10000'}`);
      logger.info(`⚠️  PAPER TRADING MODE - No real money at risk`);
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error });
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection', { reason });
      gracefulShutdown('UNHANDLED_REJECTION');
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { app, startServer };
