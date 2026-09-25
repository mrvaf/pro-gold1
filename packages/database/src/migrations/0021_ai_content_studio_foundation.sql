-- Stage 18 AI Content Studio Foundation Migration
-- Creates content_assets table with RLS tenant isolation

CREATE TABLE IF NOT EXISTS content_assets (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE SET NULL,
  content_type VARCHAR(64) NOT NULL,
  language VARCHAR(32) NOT NULL DEFAULT 'fa-IR',
  headline VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  tags JSONB,
  grounding_attributes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_assets_tenant_id ON content_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_assets_product_id ON content_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_content_assets_content_type ON content_assets(content_type);

-- Enable and force PostgreSQL Row-Level Security
ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_assets FORCE ROW LEVEL SECURITY;

CREATE POLICY content_assets_tenant_isolation ON content_assets
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
