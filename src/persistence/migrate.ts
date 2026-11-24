import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

export interface FileMigrazione {
  nome: string;
  sql: string;
}
export interface RisultatoMigrazione {
  applicate: string[];
  giaPresenti: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const CARTELLA_MIGRAZIONI_DEFAULT = path.join(__dirname, "migrations");
export function leggiFileMigrazioni(cartella = CARTELLA_MIGRAZIONI_DEFAULT): FileMigrazione[] {
  if (!fs.existsSync(cartella)) return [];
  return fs
    .readdirSync(cartella)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((nome) => ({ nome, sql: fs.readFileSync(path.join(cartella, nome), "utf8") }));
}
export async function eseguiMigrazioni(
  client: Pick<PoolClient, "query">,
  migrazioni: FileMigrazione[],
): Promise<RisultatoMigrazione> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  );
  const righe = await client.query<{ version: string }>("SELECT version FROM schema_migrations");
  const eseguite = new Set(righe.rows.map((r) => r.version));
  const applicate: string[] = [];
  const giaPresenti: string[] = [];
  for (const migrazione of migrazioni) {
    if (eseguite.has(migrazione.nome)) {
      giaPresenti.push(migrazione.nome);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(migrazione.sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [migrazione.nome]);
      await client.query("COMMIT");
      applicate.push(migrazione.nome);
    } catch (errore) {
      await client.query("ROLLBACK");
      throw errore;
    }
  }
  return { applicate, giaPresenti };
}
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.trim() === "")
    throw new Error("DATABASE_URL non configurata");
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  const client = await pool.connect();
  try {
    const res = await eseguiMigrazioni(client, leggiFileMigrazioni());
    if (res.applicate.length === 0) console.log("Nessuna nuova migrazione da applicare.");
    else res.applicate.forEach((n) => console.log(`Migrazione applicata: ${n}`));
  } finally {
    client.release();
    await pool.end();
  }
}
const isDirect =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirect)
  main().catch((e: unknown) => {
    console.error("Errore migrazioni:", e);
    process.exitCode = 1;
  });
