
BEGIN;

-- Buyers can save vehicles to their watchlist.
CREATE TABLE vehicle_watchlists (
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id INTEGER NOT NULL
        REFERENCES vehicles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, vehicle_id)
);

CREATE INDEX idx_watchlists_vehicle
    ON vehicle_watchlists(vehicle_id);

-- One counted view per signed-in visitor,
-- per vehicle, per NZ-local calendar day.
CREATE TABLE vehicle_view_events (
    vehicle_id INTEGER NOT NULL
        REFERENCES vehicles(id) ON DELETE CASCADE,
    viewer_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    viewed_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (vehicle_id, viewer_id, viewed_on)
);

CREATE INDEX idx_vehicle_views_vehicle
    ON vehicle_view_events(vehicle_id, viewed_on);

-- A negotiation between one buyer and one seller.
CREATE TABLE vehicle_offers (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL
        REFERENCES vehicles(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    current_amount_nzd INTEGER NOT NULL
        CHECK (current_amount_nzd > 0),
    conditions TEXT NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'pending_seller'
        CHECK (status IN (
            'pending_seller',
            'pending_buyer',
            'accepted',
            'declined',
            'withdrawn'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (buyer_id <> seller_id),
    UNIQUE (vehicle_id, buyer_id)
);

CREATE INDEX idx_vehicle_offers_seller
    ON vehicle_offers(seller_id, status, updated_at DESC);

CREATE INDEX idx_vehicle_offers_buyer
    ON vehicle_offers(buyer_id, status, updated_at DESC);

-- Immutable negotiation events.
-- Each proposal and decision has its own record.
CREATE TABLE vehicle_offer_events (
    id BIGSERIAL PRIMARY KEY,
    offer_id BIGINT NOT NULL
        REFERENCES vehicle_offers(id) ON DELETE CASCADE,
    actor_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL
        CHECK (action IN (
            'offer',
            'counter',
            'accept',
            'decline',
            'withdraw'
        )),
    amount_nzd INTEGER NOT NULL
        CHECK (amount_nzd > 0),
    conditions TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_offer_events_history
    ON vehicle_offer_events(offer_id, id);

COMMIT;
