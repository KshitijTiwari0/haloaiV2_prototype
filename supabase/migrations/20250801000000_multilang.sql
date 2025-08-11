/*
  # Multi-Language Support Migration
  
  1. Updates to existing tables:
    - Add language_preference to user_profiles table
    - Add language_used to interactions table (already exists from previous migration)
  
  2. Default values:
    - Set default language_preference to 'auto'
    - Existing interactions will have NULL language_used (acceptable)
  
  3. Indexes:
    - Add index for language-based queries
*/

-- Add language_preference column to user_profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'language_preference'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN language_preference text DEFAULT 'auto';
    COMMENT ON COLUMN user_profiles.language_preference IS 'User preferred language: auto, en, hi, ar';
  END IF;
END $$;

-- Verify that language_used column exists in interactions table (from previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interactions' AND column_name = 'language_used'
  ) THEN
    ALTER TABLE interactions ADD COLUMN language_used text;
    COMMENT ON COLUMN interactions.language_used IS 'Language detected/used in this interaction: en, hi, ar';
  END IF;
END $$;

-- Create index for language-based queries on interactions
CREATE INDEX IF NOT EXISTS interactions_language_used_idx 
  ON interactions(language_used) WHERE language_used IS NOT NULL;

-- Create index for user language preferences
CREATE INDEX IF NOT EXISTS user_profiles_language_preference_idx 
  ON user_profiles(language_preference);

-- Add constraint to ensure valid language codes
DO $$
BEGIN
  -- Add check constraint for language_preference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_profiles' 
    AND constraint_name = 'user_profiles_language_preference_check'
  ) THEN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_language_preference_check 
    CHECK (language_preference IN ('auto', 'en', 'hi', 'ar'));
  END IF;
  
  -- Add check constraint for language_used
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'interactions' 
    AND constraint_name = 'interactions_language_used_check'
  ) THEN
    ALTER TABLE interactions 
    ADD CONSTRAINT interactions_language_used_check 
    CHECK (language_used IS NULL OR language_used IN ('en', 'hi', 'ar'));
  END IF;
END $$;

-- Create a view for language usage statistics (optional, for analytics)
CREATE OR REPLACE VIEW language_usage_stats AS
SELECT 
  language_used,
  COUNT(*) as interaction_count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(response_time) as avg_response_time,
  DATE_TRUNC('day', timestamp) as date
FROM interactions 
WHERE language_used IS NOT NULL
GROUP BY language_used, DATE_TRUNC('day', timestamp)
ORDER BY date DESC, interaction_count DESC;

-- Create a view for user language preferences (optional, for analytics)
CREATE OR REPLACE VIEW user_language_preferences AS
SELECT 
  language_preference,
  COUNT(*) as user_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM user_profiles 
WHERE language_preference IS NOT NULL
GROUP BY language_preference
ORDER BY user_count DESC;

-- Update RLS policies to include language fields (policies already exist, just documenting)
-- No changes needed to existing RLS policies as they are based on user_id

-- Add comments for documentation
COMMENT ON TABLE user_profiles IS 'User profile information including language preferences';
COMMENT ON TABLE interactions IS 'User interactions with AI companion including language detection';
COMMENT ON VIEW language_usage_stats IS 'Statistics on language usage across interactions';
COMMENT ON VIEW user_language_preferences IS 'Distribution of user language preferences';