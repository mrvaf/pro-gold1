-- Stage 19 Social Commerce & Multi-Platform Publishing Foundation Migration
-- Creates publishing_channels and publishing_posts tables with RLS tenant isolation

CREATE TABLE IF NOT EXISTS publishing_channels (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform VARCHAR(32) NOT NULL,
  channel_name VARCHAR(255) NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  account_id VARCHAR(128),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publishing_channels_tenant_id ON publishing_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_publishing_channels_platform ON publishing_channels(platform);

-- Enable and force PostgreSQL Row-Level Security on publishing_channels
ALTER TABLE publishing_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishing_channels FORCE ROW LEVEL SECURITY;

CREATE POLICY publishing_channels_tenant_isolation ON publishing_channels
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

CREATE TABLE IF NOT EXISTS publishing_posts (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id VARCHAR(64) NOT NULL REFERENCES publishing_channels(id) ON DELETE CASCADE,
  content_asset_id VARCHAR(64) REFERENCES content_assets(id) ON DELETE SET NULL,
  caption TEXT NOT NULL,
  media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
  scheduled_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  external_post_id VARCHAR(255),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publishing_posts_tenant_id ON publishing_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_publishing_posts_channel_id ON publishing_posts(channel_id);
CREATE INDEX IF NOT EXISTS idx_publishing_posts_status ON publishing_posts(status);
CREATE INDEX IF NOT EXISTS idx_publishing_posts_scheduled_at ON publishing_posts(scheduled_at);

-- Enable and force PostgreSQL Row-Level Security on publishing_posts
ALTER TABLE publishing_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishing_posts FORCE ROW LEVEL SECURITY;

CREATE POLICY publishing_posts_tenant_isolation ON publishing_posts
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
