import type { Pool, PoolClient } from "pg";
import { ottieniPool } from "../db.ts";
import { traduciErrore } from "./errori.ts";

/**
 * Esegue l'operazione in una transazione: BEGIN, operazione, COMMIT. Su qualsiasi errore esegue
 * ROLLBACK e rilancia l'errore dell'operazione invariato (gli errori del database arrivano già
 * tradotti da `interroga`). Il client è sempre rilasciato; se il ROLLBACK fallisce è scartato.
 * Non usa stato di sessione: è compatibile con il pooler di Neon in modalità transaction.
 */
export async function eseguiInTransazione<T>(
  operazione: (client: PoolClient) => Promise<T>,
  pool: Pool = ottieniPool(),
): Promise<T> {
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (errore) {
    throw traduciErrore(errore);
  }

  let daScartare = false;
  try {
    await eseguiComando(client, "BEGIN");
    const risultato = await operazione(client);
    await eseguiComando(client, "COMMIT");
    return risultato;
  } catch (errore) {
    try {
      await client.query("ROLLBACK");
    } catch {
      daScartare = true;
    }
    throw errore;
  } finally {
    client.release(daScartare);
  }
}

async function eseguiComando(client: PoolClient, comando: "BEGIN" | "COMMIT"): Promise<void> {
  try {
    await client.query(comando);
  } catch (errore) {
    throw traduciErrore(errore);
  }
}
