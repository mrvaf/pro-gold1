-- Stage 22 Performance Optimization & Scaling Migration
-- Compound indexing for multi-tenant query acceleration and bounded pagination

-- Orders compound index (tenant_id, created_at DESC) for fast tenant order histories
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON orders(tenant_id, created_at DESC);

-- Inventory items compound index (tenant_id, status) for fast stock aggregation
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_status_fast ON inventory_items(tenant_id, status);

-- Seller listings compound index (tenant_id, status, created_at DESC) for catalog retrieval
CREATE INDEX IF NOT EXISTS idx_seller_listings_tenant_status_created ON seller_listings(tenant_id, status, created_at DESC);

-- Product variants index on tenant_id, product_id
CREATE INDEX IF NOT EXISTS idx_product_variants_tenant_product ON product_variants(tenant_id, product_id);

-- Customer reviews compound index (tenant_id, seller_profile_id, moderation_status)
CREATE INDEX IF NOT EXISTS idx_customer_reviews_tenant_seller_status ON customer_reviews(tenant_id, seller_profile_id, moderation_status);

-- Stock reservations index for active reservations checking
CREATE INDEX IF NOT EXISTS idx_stock_reservations_tenant_expires ON stock_reservations(tenant_id, expires_at);
