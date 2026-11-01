-- Heartside Stitch Sandbox order records. Apply to a Cloudflare D1 database.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  square_payment_id TEXT NOT NULL UNIQUE,
  environment TEXT NOT NULL CHECK(environment='sandbox'),
  payment_status TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL DEFAULT 'test_only',
  items_json TEXT NOT NULL,
  merchandise_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  tax_cents INTEGER,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
