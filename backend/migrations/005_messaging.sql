
-- REVV Messaging V1
-- Run once against revv_db after confirming the existing table names.

BEGIN;

CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL
        REFERENCES vehicles(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT conversations_distinct_users
        CHECK (buyer_id <> seller_id),

    CONSTRAINT conversations_unique_vehicle_buyer
        UNIQUE (vehicle_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS ix_conversations_buyer
    ON conversations(buyer_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_conversations_seller
    ON conversations(seller_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL
        REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ,

    CONSTRAINT messages_body_length
        CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS ix_messages_thread
    ON messages(conversation_id, id DESC);

CREATE INDEX IF NOT EXISTS ix_messages_sender_recent
    ON messages(sender_id, created_at DESC);

COMMIT;
