ALTER TABLE tracked_subscriptions ADD COLUMN create_operation_id VARCHAR(128);

CREATE TABLE subscription_operation_receipts (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_id VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, operation_id)
);
