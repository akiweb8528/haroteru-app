ALTER TABLE tracked_subscriptions
  ALTER COLUMN category DROP NOT NULL,
  ALTER COLUMN category DROP DEFAULT;
