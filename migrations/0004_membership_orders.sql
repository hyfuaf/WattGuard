ALTER TABLE users ADD COLUMN subscription_plan TEXT;
ALTER TABLE users ADD COLUMN subscription_until INTEGER NOT NULL DEFAULT 0;
UPDATE users SET subscription_plan='monthly', subscription_until=(unixepoch() * 1000 + 2592000000) WHERE subscription_active=1;
CREATE TABLE membership_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),plan TEXT NOT NULL,display_price INTEGER NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,kind TEXT NOT NULL DEFAULT 'demo');
CREATE INDEX membership_orders_user ON membership_orders(user_id,created DESC);
