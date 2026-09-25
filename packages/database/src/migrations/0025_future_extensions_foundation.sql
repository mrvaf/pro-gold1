-- 0025_future_extensions_foundation.sql
-- Stage 26: Future Platform Extensions - Digital Jewelry Passports & Style DNA

CREATE TABLE IF NOT EXISTS digital_jewelry_passports (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serial_number VARCHAR(128) NOT NULL,
  digital_certificate_number VARCHAR(128) NOT NULL,
  style_dna JSONB NOT NULL,
  provenance_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passports_tenant ON digital_jewelry_passports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_passports_product ON digital_jewelry_passports(tenant_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_passports_serial ON digital_jewelry_passports(tenant_id, serial_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_passports_certificate ON digital_jewelry_passports(tenant_id, digital_certificate_number);

ALTER TABLE digital_jewelry_passports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'digital_jewelry_passports' AND policyname = 'tenant_isolation_passports'
  ) THEN
    CREATE POLICY tenant_isolation_passports ON digital_jewelry_passports
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
  END IF;
END
$$;
