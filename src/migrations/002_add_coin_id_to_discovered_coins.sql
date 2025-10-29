-- Add coin_id column to discovered_coins to prevent symbol collision issues
-- This ensures we track the exact CoinGecko coin ID for each discovered coin

ALTER TABLE public.discovered_coins 
ADD COLUMN IF NOT EXISTS coin_id VARCHAR(100);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_discovered_coins_coin_id ON public.discovered_coins USING btree (coin_id);

-- Add comment
COMMENT ON COLUMN public.discovered_coins.coin_id IS 'CoinGecko coin ID to prevent symbol collision (e.g., multiple TRUMP coins)';
