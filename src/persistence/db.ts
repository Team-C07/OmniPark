import { Pool } from "pg";

// Configurazione fissa, pensata per le funzioni serverless e per il pooler di Neon:
// poche connessioni per istanza, chiuse presto quando restano inattive.
const MAX_CONNESSIONI = 3;
const INATTIVITA_MAX_MS = 5_000;
const ATTESA_CONNESSIONE_MAX_MS = 10_000;

// In sviluppo il ricaricamento a caldo rivaluta i moduli: la cache in globalThis
// evita di aprire un nuovo pool a ogni modifica.
const cacheGlobale = globalThis as unknown as { omniparkPool?: Pool };

let pool: Pool | undefined;

/**
 * Restituisce il pool di connessioni, creandolo al primo uso.
 * Lancia un errore se DATABASE_URL non è impostata.
 */
export function ottieniPool(): Pool {
  pool ??= cacheGlobale.omniparkPool;
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL non configurata");
  }

  const nuovoPool = creaPool(connectionString);
  pool = nuovoPool;
  if (process.env.NODE_ENV !== "production") {
    cacheGlobale.omniparkPool = nuovoPool;
  }
  return nuovoPool;
}

/**
 * Crea un pool con la configurazione comune. Serve a ottieniPool() e a chi deve collegarsi a un
 * database diverso da DATABASE_URL (per esempio il database di test); chi lo crea lo chiude.
 */
export function creaPool(connectionString: string): Pool {
  const nuovoPool = new Pool({
    connectionString,
    max: MAX_CONNESSIONI,
    idleTimeoutMillis: INATTIVITA_MAX_MS,
    connectionTimeoutMillis: ATTESA_CONNESSIONE_MAX_MS,
  });

  // Senza questo gestore, un client inattivo chiuso dal server farebbe terminare il processo.
  nuovoPool.on("error", (errore) => {
    console.error("Errore su una connessione inattiva del database:", errore.message);
  });

  return nuovoPool;
}

/** Chiude il pool, se è stato creato. Serve agli script da riga di comando. */
export async function chiudiPool(): Promise<void> {
  const daChiudere = pool ?? cacheGlobale.omniparkPool;
  pool = undefined;
  cacheGlobale.omniparkPool = undefined;
  await daChiudere?.end();
}

/** Verifica che il database risponda e restituisce il nome del database collegato. */
export async function verificaConnessione(): Promise<{ database: string }> {
  const risultato = await ottieniPool().query<{ database: string }>(
    "SELECT current_database() AS database",
  );
  return { database: risultato.rows[0].database };
}
