import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

const PATTERN_PRODUZIONE = /(\b|[-_.])(prod|production)(\b|[-_.])/i;

export function verificaSicurezzaReset(
  connectionString = process.env.DATABASE_URL,
  env: Record<string, string | undefined> = process.env,
): void {
  if (
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.APP_ENV === "production"
  ) {
    throw new Error(
      "Operazione bloccata: il reset del database non è consentito in ambiente di produzione.",
    );
  }
  if (!connectionString || connectionString.trim() === "")
    throw new Error("DATABASE_URL non configurata");
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL non valida");
  }
  const host = url.hostname.toLowerCase();
  const nomeDb = url.pathname.replace(/^\//, "").toLowerCase();
  if (PATTERN_PRODUZIONE.test(host) || PATTERN_PRODUZIONE.test(nomeDb)) {
    throw new Error("Operazione bloccata: la connessione punta a un database di produzione.");
  }
}
export async function eseguiResetSchema(client: Pick<PoolClient, "query">): Promise<void> {
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.query("GRANT ALL ON SCHEMA public TO CURRENT_USER");
  await client.query("GRANT ALL ON SCHEMA public TO public");
}
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  verificaSicurezzaReset(connectionString, process.env);
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  const client = await pool.connect();
  try {
    await eseguiResetSchema(client);
    console.log("Schema public eliminato e ricreato correttamente.");
  } finally {
    client.release();
    await pool.end();
  }
}
const __filename = fileURLToPath(import.meta.url);
const isDirect =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirect)
  main().catch((e: unknown) => {
    console.error("Errore reset database:", e);
    process.exitCode = 1;
  });
