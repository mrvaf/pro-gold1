import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createDatabaseConfigFromEnv, type DatabaseConfig } from '../config.js';
import * as schema from '../schema/index.js';

/**
 * Stage 8.3 — ADR-0047: the real PostgreSQL connection (`pg` driver + Drizzle).
 * This is the first wiring of a live database driver in the project's history;
 * previously only the Drizzle schema definitions and SQL DDL files existed.
 */
export type AppDatabase = NodePgDatabase<typeof schema>;

export interface PgConnection {
  readonly pool: Pool;
  readonly db: AppDatabase;
  close(): Promise<void>;
}

export const createPgPool = (config: DatabaseConfig = createDatabaseConfigFromEnv()): Pool => {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    user: config.user,
    ...(config.password !== undefined ? { password: config.password } : {}),
    database: config.database,
    ...(config.ssl ? { ssl: true } : {}),
    max: config.maxConnections ?? 10,
  };
  return new Pool(poolConfig);
};

export const createPgConnection = (
  config: DatabaseConfig = createDatabaseConfigFromEnv()
): PgConnection => {
  const pool = createPgPool(config);
  const db = drizzle(pool, { schema });
  return {
    pool,
    db,
    close: async (): Promise<void> => {
      await pool.end();
    },
  };
};
