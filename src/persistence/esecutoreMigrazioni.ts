import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";
import { verificaResetConsentito } from "./guardiaReset.ts";
import {
  calcolaPendenti,
  ErroreMigrazione,
  preparaMigrazioni,
  type FileMigrazione,
  type MigrazioneRegistrata,
} from "./migrazioni.ts";

// Usato da più esecuzioni contemporanee (sviluppatori, CI, anteprime) sullo stesso database:
// il lock di transazione le serializza ed è compatibile con il pooler in modalità transaction.
const CHIAVE_LOCK_MIGRAZIONI = 7_310_031;
const SQL_LOCK = `SELECT pg_advisory_xact_lock(${CHIAVE_LOCK_MIGRAZIONI})`;

const SQL_CREA_REGISTRO = `
CREATE TABLE IF NOT EXISTS registro_migrazioni (
  versione     integer     PRIMARY KEY CHECK (versione > 0),
  nome         text        NOT NULL,
  checksum     char(64)    NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  applicata_il timestamptz NOT NULL DEFAULT now()
)`;

// Ricrea lo schema public con proprietario e privilegi predefiniti di PostgreSQL 15+.
const SQL_RICREA_SCHEMA = `
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
ALTER SCHEMA public OWNER TO pg_database_owner;
GRANT USAGE ON SCHEMA public TO PUBLIC;`;

const CARTELLA_PREDEFINITA = fileURLToPath(new URL("./migrations/", import.meta.url));

export type EsitoMigrazioni = {
  /** Nomi dei file applicati in questa esecuzione, in ordine. */
  applicate: string[];
  /** Migrazioni che risultavano già applicate. */
  giaPresenti: number;
};

/** Legge e valida i file SQL della cartella delle migrazioni, ordinati per versione. */
export async function leggiMigrazioni(
  cartella: string = CARTELLA_PREDEFINITA,
): Promise<FileMigrazione[]> {
  const voci = await readdir(cartella, { withFileTypes: true });
  const file = await Promise.all(
    voci
      .filter((voce) => voce.isFile())
      .map(async (voce) => ({
        nomeFile: voce.name,
        contenuto: await readFile(join(cartella, voce.name), "utf8"),
      })),
  );
  return preparaMigrazioni(file);
}

/**
 * Applica in ordine le migrazioni non ancora registrate. Ogni migrazione gira in una
 * transazione propria insieme alla riga che la registra.
 */
export async function applicaMigrazioni(
  pool: Pool,
  opzioni: { cartella?: string } = {},
): Promise<EsitoMigrazioni> {
  const file = await leggiMigrazioni(opzioni.cartella);

  const pendenti = await inTransazione(pool, async (client) => {
    await client.query(SQL_CREA_REGISTRO);
    const registro = await client.query<MigrazioneRegistrata>(
      "SELECT versione, nome, checksum FROM registro_migrazioni ORDER BY versione",
    );
    return calcolaPendenti(file, registro.rows);
  });

  const applicate: string[] = [];
  for (const migrazione of pendenti) {
    const applicata = await inTransazione(pool, (client) => applicaUna(client, migrazione));
    if (applicata) {
      applicate.push(migrazione.nomeFile);
    }
  }

  return { applicate, giaPresenti: file.length - applicate.length };
}

/**
 * Elimina e ricrea lo schema public, poi applica tutte le migrazioni.
 * Rifiuta l'esecuzione se la guardia del reset non lo consente.
 */
export async function resettaDatabase(
  pool: Pool,
  env: Record<string, string | undefined> = process.env,
  opzioni: { cartella?: string } = {},
): Promise<EsitoMigrazioni> {
  const guardia = verificaResetConsentito(env);
  if (!guardia.consentito) {
    throw new Error(guardia.motivo);
  }

  // Valida i file prima di eliminare lo schema, per non lasciare il database vuoto.
  await leggiMigrazioni(opzioni.cartella);

  await inTransazione(pool, async (client) => {
    await client.query(SQL_RICREA_SCHEMA);
  });
  return applicaMigrazioni(pool, opzioni);
}

async function applicaUna(client: PoolClient, migrazione: FileMigrazione): Promise<boolean> {
  // Un'altra esecuzione può averla applicata mentre questa attendeva il lock.
  const esistente = await client.query<{ checksum: string }>(
    "SELECT checksum FROM registro_migrazioni WHERE versione = $1",
    [migrazione.versione],
  );
  if (esistente.rows.length > 0) {
    if (esistente.rows[0].checksum !== migrazione.checksum) {
      throw new ErroreMigrazione(
        "CHECKSUM_DIVERSO",
        `La migrazione "${migrazione.nomeFile}" è stata registrata con un contenuto diverso.`,
      );
    }
    return false;
  }

  await client.query(migrazione.sql);
  await client.query(
    "INSERT INTO registro_migrazioni (versione, nome, checksum) VALUES ($1, $2, $3)",
    [migrazione.versione, migrazione.nome, migrazione.checksum],
  );
  return true;
}

async function inTransazione<T>(
  pool: Pool,
  operazione: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let connessioneDaScartare = false;
  try {
    await client.query("BEGIN");
    await client.query(SQL_LOCK);
    const risultato = await operazione(client);
    await client.query("COMMIT");
    return risultato;
  } catch (errore) {
    try {
      await client.query("ROLLBACK");
    } catch {
      connessioneDaScartare = true;
    }
    throw errore;
  } finally {
    client.release(connessioneDaScartare);
  }
}
