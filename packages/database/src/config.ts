export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password?: string;
  readonly database: string;
  readonly ssl?: boolean;
  readonly maxConnections?: number;
}

export const createDatabaseConfigFromEnv = (
  env: Record<string, string | undefined> = process.env
): DatabaseConfig => {
  const host = env['DATABASE_HOST'] ?? 'localhost';
  const port = Number.parseInt(env['DATABASE_PORT'] ?? '5432', 10);
  const user = env['DATABASE_USER'] ?? 'postgres';
  const password = env['DATABASE_PASSWORD'];
  const database = env['DATABASE_NAME'] ?? 'vgold';
  const ssl = env['DATABASE_SSL'] === 'true';
  const maxConnections = Number.parseInt(env['DATABASE_MAX_CONNECTIONS'] ?? '10', 10);

  return {
    host,
    port,
    user,
    ...(password !== undefined ? { password } : {}),
    database,
    ssl,
    maxConnections,
  };
};
