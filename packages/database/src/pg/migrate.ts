import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

/**
 * Stage 8.3 — ADR-0048: safe sequential SQL migration runner.
 *
 * Contract:
 * - Only additive/forward SQL files (`NNNN_description.sql`) are applied, in
 *   ascending filename order, each inside its own transaction together with its
 *   ledger entry (atomic apply+record).
 * - Applied files are recorded in the `schema_migrations` ledger table
 *   (created additively by the runner itself).
 * - Re-running is idempotent (applied files are skipped).
 * - Out-of-order states (an unapplied file that sorts before an already-applied
 *   file) are refused loudly — never guessed, never skipped.
 */
export interface MigrationRunResult {
  applied: string[];
  alreadyApplied: string[];
}

export const DEFAULT_MIGRATIONS_DIR: string = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations'
);

const isSqlFile = (file: string): boolean => file.endsWith('.sql');

export async function runMigrations(
  pool: Pool,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR
): Promise<MigrationRunResult> {
  const files = readdirSync(migrationsDir).filter(isSqlFile).sort();
  if (files.length === 0) {
    throw new Error(`No migration files found in ${migrationsDir}`);
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
    );
    const { rows } = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    const appliedSet = new Set(rows.map((row) => row.filename));

    const appliedList = files.filter((file) => appliedSet.has(file));
    const maxApplied = appliedList[appliedList.length - 1];
    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }
      if (maxApplied !== undefined && file < maxApplied) {
        throw new Error(
          `Migration out of order: ${file} is unapplied but ${maxApplied} is already applied. Refusing to guess.`
        );
      }
    }

    const applied: string[] = [];
    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }
      const sqlText = readFileSync(join(migrationsDir, file), 'utf8');
      const txClient = await pool.connect();
      try {
        await txClient.query('BEGIN');
        await txClient.query(sqlText);
        await txClient.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await txClient.query('COMMIT');
        applied.push(file);
      } catch (error) {
        await txClient.query('ROLLBACK');
        throw error;
      } finally {
        txClient.release();
      }
    }

    return { applied, alreadyApplied: files.filter((file) => appliedSet.has(file)) };
  } finally {
    client.release();
  }
}
