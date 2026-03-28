CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE subscription_category AS ENUM ('video', 'music', 'productivity', 'learning', 'shopping', 'lifestyle', 'utilities', 'other');
CREATE TYPE review_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE IF NOT EXISTS tracked_subscriptions (
    id              UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID                  NOT NULL,
    name            TEXT                  NOT NULL,
    amount_yen      INTEGER               NOT NULL,
    billing_cycle   billing_cycle         NOT NULL DEFAULT 'monthly',
    category        subscription_category NOT NULL DEFAULT 'other',
    review_priority review_priority       NOT NULL DEFAULT 'medium',
    locked          BOOLEAN               NOT NULL DEFAULT FALSE,
    billing_day     SMALLINT,
    note            TEXT                  NOT NULL DEFAULT '',
    position        INTEGER               NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    CONSTRAINT tracked_subscriptions_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
    CONSTRAINT tracked_subscriptions_amount_range CHECK (amount_yen BETWEEN 1 AND 1000000),
    CONSTRAINT tracked_subscriptions_note_length CHECK (char_length(note) <= 500),
    CONSTRAINT tracked_subscriptions_billing_day_range CHECK (billing_day IS NULL OR billing_day BETWEEN 1 AND 31),
    CONSTRAINT tracked_subscriptions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracked_subscriptions_user_id ON tracked_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_subscriptions_user_priority ON tracked_subscriptions(user_id, review_priority);
CREATE INDEX IF NOT EXISTS idx_tracked_subscriptions_user_locked ON tracked_subscriptions(user_id, locked);
CREATE INDEX IF NOT EXISTS idx_tracked_subscriptions_user_cycle ON tracked_subscriptions(user_id, billing_cycle);

CREATE TRIGGER trg_tracked_subscriptions_updated_at
    BEFORE UPDATE ON tracked_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
