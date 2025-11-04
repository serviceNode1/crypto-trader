-- Add AI model preference to user settings
-- Date: 2025-11-04 15:46

DO $$
BEGIN
  -- Add ai_model column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' 
    AND column_name = 'ai_model'
  ) THEN
    ALTER TABLE public.user_settings 
    ADD COLUMN ai_model VARCHAR(20) DEFAULT 'anthropic';
    
    -- Add constraint to ensure valid values
    ALTER TABLE public.user_settings
    ADD CONSTRAINT user_settings_ai_model_check 
    CHECK (ai_model IN ('local', 'openai', 'anthropic', 'both'));
    
    RAISE NOTICE '✅ Added ai_model column to user_settings';
  ELSE
    RAISE NOTICE '⏭️  ai_model column already exists';
  END IF;
END $$;

COMMENT ON COLUMN public.user_settings.ai_model IS 'Preferred AI model for analysis: local, openai, anthropic, or both';
