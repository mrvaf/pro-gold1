-- Stage 16 AI Packaging & Box Studio Foundation Migration
-- Implements packaging specifications table with RLS tenant isolation

CREATE TABLE IF NOT EXISTS packaging_specifications (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  dimensions JSONB NOT NULL,
  material VARCHAR(64) NOT NULL,
  tier VARCHAR(64) NOT NULL,
  primary_color_hex VARCHAR(32) NOT NULL,
  accent_color_hex VARCHAR(32),
  has_custom_dieline BOOLEAN NOT NULL DEFAULT FALSE,
  has_foil_embossing BOOLEAN NOT NULL DEFAULT FALSE,
  dieline JSONB,
  production_cost JSONB NOT NULL,
  ai_preview_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packaging_specifications_tenant_id ON packaging_specifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_packaging_specifications_product_id ON packaging_specifications(product_id);

-- Enable & Force PostgreSQL Row-Level Security
ALTER TABLE packaging_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_specifications FORCE ROW LEVEL SECURITY;

CREATE POLICY packaging_specifications_tenant_isolation ON packaging_specifications
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
