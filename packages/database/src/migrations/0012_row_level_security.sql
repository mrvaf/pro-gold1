-- 0012_row_level_security.sql
-- Stage 8.3 (ADR-0049): Row-Level Security for every tenant-scoped table.
-- Additive only (no destructive change): enables + forces RLS and installs one
-- conditional tenant-isolation policy per table.
--
-- Enforcement key: the transaction-local GUC `app.tenant_id`
--   (set via set_config('app.tenant_id', <tenant>, true) — see pg/tenant-context.ts).
--
-- Policy shape (matches the repository port contract):
--   * context SET   -> hard isolation: only rows with tenant_id = context are
--                      visible, and writes with a foreign tenant_id are refused
--                      by WITH CHECK (defense in depth against identity spoofing).
--   * context UNSET -> un-scoped operation is deliberate: cross-tenant existence
--                      probes behind 403/404 responses, public marketplace
--                      discovery (listPublicSellers/listPublicListings/findBySlug),
--                      login membership discovery (findAllByUser) and global
--                      counts (pricing rule/result) all run without a tenant
--                      context by design.
--
-- FORCE ROW LEVEL SECURITY makes the policies binding even for the table owner,
-- so single-role development deployments are isolated as well.

CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS varchar(64)
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '') $$;

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores FORCE ROW LEVEL SECURITY;
CREATE POLICY stores_tenant_isolation ON stores
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_memberships_tenant_isolation ON tenant_memberships
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY pricing_rules_tenant_isolation ON pricing_rules
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE pricing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_results FORCE ROW LEVEL SECURITY;
CREATE POLICY pricing_results_tenant_isolation ON pricing_results
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY products_tenant_isolation ON products
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants FORCE ROW LEVEL SECURITY;
CREATE POLICY product_variants_tenant_isolation ON product_variants
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_locations FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_locations_tenant_isolation ON inventory_locations
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_tenant_isolation ON inventory_items
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_movements_tenant_isolation ON inventory_movements
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY seller_profiles_tenant_isolation ON seller_profiles
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE seller_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_listings FORCE ROW LEVEL SECURITY;
CREATE POLICY seller_listings_tenant_isolation ON seller_listings
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());

ALTER TABLE seller_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY seller_workspaces_tenant_isolation ON seller_workspaces
  USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id());
