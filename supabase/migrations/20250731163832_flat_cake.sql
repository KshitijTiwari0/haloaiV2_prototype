/*
  # Add user mood tracking to interactions

  1. Schema Changes
    - Add `user_mood` column to `interactions` table
    - Column stores detected emotional state/mood for each interaction
  
  2. Security
    - No changes needed to existing RLS policies
    - New column inherits existing security rules
*/

-- Add user_mood column to interactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interactions' AND column_name = 'user_mood'
  ) THEN
    ALTER TABLE interactions ADD COLUMN user_mood text;
  END IF;
END $$;