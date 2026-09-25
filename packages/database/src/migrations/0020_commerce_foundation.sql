-- Stage 17 Commerce, Orders & Payments Foundation Migration
-- Creates carts, orders, and stock_reservations tables with RLS tenant isolation

CREATE TABLE IF NOT EXISTS carts (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_tenant_id ON carts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAYMENT',
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  currency VARCHAR(10) NOT NULL,
  subtotal JSONB NOT NULL,
  tax_amount JSONB NOT NULL,
  total_amount JSONB NOT NULL,
  idempotency_key VARCHAR(128),
  payment_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);

CREATE TABLE IF NOT EXISTS stock_reservations (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id VARCHAR(64),
  sku VARCHAR(64) NOT NULL,
  quantity INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_committed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_tenant_id ON stock_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_sku ON stock_reservations(sku);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order_id ON stock_reservations(order_id);

-- Enable and force PostgreSQL Row-Level Security
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts FORCE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations FORCE ROW LEVEL SECURITY;

CREATE POLICY carts_tenant_isolation ON carts
  AS RESTRICTIVE
  FOR ALL
  TO vgold_app
  USING (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND tenant_id = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND tenant_id = current_setting('app.tenant_id', true)
  );

CREATE POLICY orders_tenant_isolation ON orders
  AS RESTRICTIVE
  FOR ALL
  TO vgold_app
  USING (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND tenant_id = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND tenant_id = current_setting('app.tenant_id', true)
  );

CREATE POLICY stock_reservations_tenant_isolation ON stock_reservations
  AS RESTRICTIVE
  FOR ALL
  TO vgold_app
  USING (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND tenant_id = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND tenant_id = current_setting('app.tenant_id', true)
  );
