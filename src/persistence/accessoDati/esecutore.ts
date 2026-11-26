import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { traduciErrore } from "./errori.ts";

/**
 * Chi esegue le query: il pool, per un'operazione singola, oppure il client di una transazione
 * (eseguiInTransazione), così la stessa funzione di accesso si usa da sola o dentro una transazione.
 */
export type Esecutore = Pool | PoolClient;

/** Esegue una query parametrizzata; un errore del database è rilanciato come ErroreDominio. */
export async function interroga<R extends QueryResultRow = QueryResultRow>(
  esecutore: Esecutore,
  sql: string,
  parametri: unknown[] = [],
): Promise<QueryResult<R>> {
  try {
    return await esecutore.query<R>(sql, parametri);
  } catch (errore) {
    throw traduciErrore(errore);
  }
}
