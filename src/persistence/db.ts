import { Pool, type PoolConfig } from "pg";

export const SERVERLESS_POOL_CONFIG: Omit<PoolConfig, "connectionString"> = {
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
};

export function creaConfigurazionePool(connectionString = process.env.DATABASE_URL): PoolConfig {
  if (!connectionString || connectionString.trim() === "") {
    throw new Error("DATABASE_URL non configurata");
  }
  return { connectionString, ...SERVERLESS_POOL_CONFIG };
}

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export function getPool(): Pool {
  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool(creaConfigurazionePool());
  }
  return globalForPg.pgPool;
}

export async function verificaConnessioneDatabase(): Promise<string> {
  const result = await getPool().query<{ database: string }>(
    "SELECT current_database() AS database",
  );
  return result.rows[0]?.database ?? "sconosciuto";
}

export async function chiudiPool(): Promise<void> {
  if (globalForPg.pgPool) {
    const poolDaChiudere = globalForPg.pgPool;
    globalForPg.pgPool = undefined;
    await poolDaChiudere.end();
  }
}
