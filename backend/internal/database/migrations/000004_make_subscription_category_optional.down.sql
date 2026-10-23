UPDATE tracked_subscriptions
SET category = 'other'
WHERE category IS NULL;

ALTER TABLE tracked_subscriptions
  ALTER COLUMN category SET DEFAULT 'other',
  ALTER COLUMN category SET NOT NULL;
