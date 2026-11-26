// Supporto ai test sul database (npm run test:db). Riporta il database di test a uno stato noto
// (schema e dati di esempio) e dà a ogni test una transazione propria, annullata alla fine.
import type { Pool, PoolClient } from "pg";
import { creaPool } from "../db.ts";
import { resettaDatabase } from "../esecutoreMigrazioni.ts";
import { descriviDestinazione } from "../guardiaReset.ts";

export type DestinazioneDatabase = { host: string; database: string };

export type EsitoVerificaDatabaseDiTest =
  | { consentito: true; databaseUrlTest: string; destinazione: DestinazioneDatabase }
  | { consentito: false; motivo: string };

const PORTA_PREDEFINITA = "5432";

/**
 * Controlla che DATABASE_URL_TEST indichi un database di test e mai il database di sviluppo:
 * la variabile deve esserci, il nome del database deve finire con "_test" e host e database
 * devono essere diversi da quelli di DATABASE_URL.
 */
export function verificaDatabaseDiTest(
  env: Record<string, string | undefined>,
): EsitoVerificaDatabaseDiTest {
  const databaseUrlTest = env.DATABASE_URL_TEST;
  if (!databaseUrlTest) {
    return {
      consentito: false,
      motivo: "DATABASE_URL_TEST non configurata: i test sul database non possono partire.",
    };
  }

  let destinazione: DestinazioneDatabase;
  try {
    destinazione = descriviDestinazione(databaseUrlTest);
  } catch (errore) {
    // Il messaggio di descriviDestinazione non contiene mai la stringa di connessione.
    const dettaglio = errore instanceof Error ? errore.message : "";
    return { consentito: false, motivo: `DATABASE_URL_TEST non valida. ${dettaglio}`.trim() };
  }
  if (!destinazione.database.endsWith("_test")) {
    return {
      consentito: false,
      motivo: `Il database di test deve avere un nome che finisce con "_test" (attuale: "${destinazione.database}").`,
    };
  }

  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl) {
    const sviluppo = destinazioneOppureNull(databaseUrl);
    if (!sviluppo) {
      return {
        consentito: false,
        motivo:
          "DATABASE_URL non è valida: impossibile verificare che il database di test sia diverso.",
      };
    }
    if (stessoDatabase(sviluppo, destinazione)) {
      return {
        consentito: false,
        motivo:
          "DATABASE_URL_TEST indica lo stesso database di DATABASE_URL: i test non possono usarlo.",
      };
    }
  }

  return { consentito: true, databaseUrlTest, destinazione };
}

let pool: Pool | undefined;
let clientInTransazione: PoolClient | undefined;

/** Da chiamare nel beforeAll: verifica la destinazione, ricrea lo schema e carica il dataset. */
export async function preparaDatabaseDiTest(): Promise<void> {
  const esito = verificaDatabaseDiTest(process.env);
  if (!esito.consentito) {
    throw new Error(esito.motivo);
  }
  pool ??= creaPool(esito.databaseUrlTest);
  // OMNIPARK_AMBIENTE=test abilita il reset; i blocchi su VERCEL_ENV e NODE_ENV restano attivi.
  await resettaDatabase(pool, { ...process.env, OMNIPARK_AMBIENTE: "test" });
}

/** Da chiamare nel beforeEach: apre una transazione e restituisce il client da usare nel test. */
export async function iniziaTransazioneDiTest(): Promise<PoolClient> {
  if (!pool) {
    throw new Error(
      "Chiama preparaDatabaseDiTest() nel beforeAll prima di aprire una transazione.",
    );
  }
  if (clientInTransazione) {
    throw new Error(
      "Una transazione di test è già aperta: chiama annullaTransazioneDiTest() nell'afterEach.",
    );
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
  } catch (errore) {
    client.release(true);
    throw errore;
  }
  clientInTransazione = client;
  return client;
}

/** Da chiamare nell'afterEach: annulla la transazione del test e rilascia il client. */
export async function annullaTransazioneDiTest(): Promise<void> {
  const client = clientInTransazione;
  clientInTransazione = undefined;
  if (!client) {
    return;
  }
  try {
    await client.query("ROLLBACK");
    client.release();
  } catch (errore) {
    client.release(true);
    throw errore;
  }
}

/** Da chiamare nell'afterAll: annulla un'eventuale transazione aperta e chiude il pool. */
export async function chiudiDatabaseDiTest(): Promise<void> {
  await annullaTransazioneDiTest();
  const daChiudere = pool;
  pool = undefined;
  await daChiudere?.end();
}

function destinazioneOppureNull(url: string): DestinazioneDatabase | null {
  try {
    return descriviDestinazione(url);
  } catch {
    return null;
  }
}

// Confronta host (senza "-pooler", porta predefinita esplicita) e nome del database,
// senza distinguere maiuscole e minuscole: l'URL diretto e quello pooled dello stesso
// endpoint Neon indicano lo stesso database.
function stessoDatabase(a: DestinazioneDatabase, b: DestinazioneDatabase): boolean {
  return (
    normalizzaHost(a.host) === normalizzaHost(b.host) &&
    a.database.toLowerCase() === b.database.toLowerCase()
  );
}

function normalizzaHost(host: string): string {
  const [nome, porta = PORTA_PREDEFINITA] = host.toLowerCase().split(":");
  const [primo, ...resto] = nome.split(".");
  return [[primo.replace(/-pooler$/, ""), ...resto].join("."), porta].join(":");
}
