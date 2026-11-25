import { Pool, type PoolConfig } from 'pg';

let pool: Pool | null = null;

export function isPostgresConfigured(): boolean {
  return Boolean(String(process.env.DATABASE_URL || '').trim());
}

function buildPoolConfig(): PoolConfig {
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured for the backend service.');
  }

  const production = process.env.NODE_ENV === 'production';
  const sslMode = String(process.env.PGSSLMODE || (production ? 'require' : 'prefer')).toLowerCase();
  const ssl = sslMode === 'disable'
    ? false
    : sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full'
      ? { rejectUnauthorized: true }
      : undefined;

  return {
    connectionString,
    application_name: 'swanaya-media-academy-api',
    max: Number(process.env.PGPOOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: false,
    ...(ssl ? { ssl } : {}),
  };
}

/**
 * Lazy, server-only Railway PostgreSQL pool.
 * This module performs no connection or schema changes at import time.
 */
export function getPostgresPool(): Pool {
  if (!pool) pool = new Pool(buildPoolConfig());
  return pool;
}

/** Read-only connectivity probe. Does not create schemas or mutate records. */
export async function checkPostgresConnection(): Promise<boolean> {
  const client = await getPostgresPool().connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}
