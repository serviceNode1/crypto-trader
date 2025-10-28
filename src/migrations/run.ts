import fs from 'fs';
import path from 'path';
import { query, testConnection } from '../config/database';
import { logger } from '../utils/logger';

interface Migration {
  filename: string;
  sql: string;
}

/**
 * Run database migrations
 */
async function runMigrations() {
  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Ensure we're using the public schema
    await query(`SET search_path TO public`);

    // Create migrations tracking table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS public.migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Note: ai_review_logs table is created by the migration SQL file
    // to ensure schema consistency

    // Get list of executed migrations
    const executedResult = await query(
      'SELECT filename FROM public.migrations ORDER BY id'
    );
    const executedMigrations = new Set(
      executedResult.rows.map((row) => row.filename)
    );

    // Get migration files
    const migrationsDir = __dirname;
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      logger.info('No migration files found');
      return;
    }

    // Read and prepare migrations
    const migrations: Migration[] = files.map((filename) => ({
      filename,
      sql: fs.readFileSync(path.join(migrationsDir, filename), 'utf-8'),
    }));

    // Execute pending migrations
    let executedCount = 0;
    for (const migration of migrations) {
      if (executedMigrations.has(migration.filename)) {
        logger.info(`Migration already executed: ${migration.filename}`);
        continue;
      }

      logger.info(`Executing migration: ${migration.filename}`);

      try {
        // Split SQL into individual statements, respecting $$ delimiters
        const statements: string[] = [];
        let currentStatement = '';
        let inDollarQuote = false;
        let dollarTag = '';
        
        const lines = migration.sql.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Skip comment-only lines
          if (trimmedLine.startsWith('--') && !inDollarQuote) {
            continue;
          }
          
          currentStatement += line + '\n';
          
          // Check for dollar quote delimiters ($$, $tag$, etc.)
          const dollarMatches = line.match(/\$[a-zA-Z0-9_]*\$/g);
          if (dollarMatches) {
            for (const match of dollarMatches) {
              if (!inDollarQuote) {
                inDollarQuote = true;
                dollarTag = match;
              } else if (match === dollarTag) {
                inDollarQuote = false;
                dollarTag = '';
              }
            }
          }
          
          // Split on semicolons only when not inside dollar quotes
          if (!inDollarQuote && line.includes(';')) {
            const stmt = currentStatement.trim();
            if (stmt.length > 0) {
              statements.push(stmt);
            }
            currentStatement = '';
          }
        }
        
        // Add any remaining statement
        if (currentStatement.trim().length > 0) {
          statements.push(currentStatement.trim());
        }

        // Execute each statement individually
        for (const statement of statements) {
          if (statement && statement.length > 0) {
            try {
              await query(statement);
            } catch (error: any) {
              // Skip errors for objects that already exist
              // 42P07: relation already exists (tables, indexes, constraints)
              // 42723: function already exists
              // This allows IF NOT EXISTS to work and handles partial migrations
              if (error.code === '42P07' || error.code === '42723') {
                logger.debug('Skipping duplicate object creation', { 
                  code: error.code,
                  statement: statement.substring(0, 100) 
                });
                continue;
              }
              throw error;
            }
          }
        }

        // Record migration
        await query(
          'INSERT INTO public.migrations (filename) VALUES ($1)',
          [migration.filename]
        );

        logger.info(`Migration completed: ${migration.filename}`);
        executedCount++;
      } catch (error) {
        logger.error(`Migration failed: ${migration.filename}`, { error });
        throw error;
      }
    }

    if (executedCount === 0) {
      logger.info('All migrations are up to date');
    } else {
      logger.info(`Successfully executed ${executedCount} migration(s)`);
    }
  } catch (error) {
    logger.error('Migration process failed', { error });
    throw error;
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration process failed', { error });
      process.exit(1);
    });
}

export { runMigrations };
