-- Stage 20 Trust, Safety & Seller Verification Foundation Migration
-- Creates guild_licenses, hallmark_audit_records, customer_reviews tables with RLS tenant isolation

CREATE TABLE IF NOT EXISTS guild_licenses (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  seller_profile_id VARCHAR(64) NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  guild_registration_number VARCHAR(128) NOT NULL,
  guild_name VARCHAR(255) NOT NULL,
  issuance_date TIMESTAMPTZ NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  verified_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_licenses_tenant_id ON guild_licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guild_licenses_seller ON guild_licenses(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_guild_licenses_status ON guild_licenses(status);

ALTER TABLE guild_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_licenses FORCE ROW LEVEL SECURITY;

CREATE POLICY guild_licenses_tenant_isolation ON guild_licenses
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

CREATE TABLE IF NOT EXISTS hallmark_audit_records (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inventory_item_id VARCHAR(64),
  product_variant_id VARCHAR(64),
  hallmark_code VARCHAR(64) NOT NULL,
  lab_authority VARCHAR(255) NOT NULL,
  verified_fineness REAL NOT NULL,
  audit_notes TEXT,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hallmark_audits_tenant_id ON hallmark_audit_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hallmark_audits_hallmark_code ON hallmark_audit_records(hallmark_code);

ALTER TABLE hallmark_audit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hallmark_audit_records FORCE ROW LEVEL SECURITY;

CREATE POLICY hallmark_audit_records_tenant_isolation ON hallmark_audit_records
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

CREATE TABLE IF NOT EXISTS customer_reviews (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id VARCHAR(64) NOT NULL,
  customer_id VARCHAR(64) NOT NULL,
  seller_profile_id VARCHAR(64) NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  moderation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
  moderation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_tenant_id ON customer_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_seller ON customer_reviews(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_status ON customer_reviews(moderation_status);

ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY customer_reviews_tenant_isolation ON customer_reviews
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
