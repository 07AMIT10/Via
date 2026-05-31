-- Add rich JSON content blob and progressive approach tracking
ALTER TABLE problems ADD COLUMN content_json TEXT;
ALTER TABLE user_progress ADD COLUMN approach_index INTEGER NOT NULL DEFAULT 0;
