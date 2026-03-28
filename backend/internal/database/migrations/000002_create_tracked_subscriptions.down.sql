DROP TRIGGER IF EXISTS trg_tracked_subscriptions_updated_at ON tracked_subscriptions;
DROP TABLE IF EXISTS tracked_subscriptions;
DROP TYPE IF EXISTS review_priority;
DROP TYPE IF EXISTS subscription_category;
DROP TYPE IF EXISTS billing_cycle;
