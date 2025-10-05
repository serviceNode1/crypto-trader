import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Add SSL configuration for production
if (process.env.NODE_ENV === 'production') {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);

// Error handling
pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', err);
});

// Connection testing
pool.on('connect', () => {
  logger.info('Database connection established');
});

/**
 * Execute a query against the database
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Database query error', { text, error });
    throw error;
  }
}

/**
 * Get a client from the pool for transaction support
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction failed', { error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close all database connections
 */
export async function closePool() {
  await pool.end();
  logger.info('Database pool closed');
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    logger.info('Database connection test successful', {
      timestamp: result.rows[0].now,
    });
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error });
    return false;
  }
}

export default pool;
