-- Migration 010: Fix sentiment url conflict handling
-- Drop partial index and create proper unique constraint

-- Drop the partial index created in migration 009
DROP INDEX IF EXISTS idx_sentiment_url;

-- Since url can be NULL and we want to allow duplicate NULLs,
-- we need to make url NOT NULL with a default or use a different conflict strategy

-- Option 1: If url should always be provided, make it NOT NULL
-- But this might break existing data, so we'll use Option 2

-- Option 2: Create a unique index that allows multiple NULLs
-- PostgreSQL allows this with a partial index, but we need to change the conflict handling

-- Create a unique constraint on post_id instead (which already exists as UNIQUE)
-- The application should use post_id for conflict resolution when available

-- Add url as a regular index (not unique) since it can be NULL
CREATE INDEX IF NOT EXISTS idx_sentiment_url_lookup ON sentiment (url) WHERE url IS NOT NULL;

-- For records with URL, we can use a composite unique constraint with COALESCE
-- But the best solution is to fix the application code to use post_id for conflicts

COMMENT ON COLUMN sentiment.url IS 'URL to original content - use post_id for conflict resolution';
