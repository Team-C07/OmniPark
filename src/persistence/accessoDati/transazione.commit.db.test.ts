import type { Pool, PoolClient } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { chiudiDatabaseDiTest, poolDiTest, preparaDatabaseDiTest } from "../test/databaseDiTest";
import { ErroreDominio } from "./errori";
import { interroga } from "./esecutore";
import { eseguiInTransazione } from "./transazione";

// Test frame TF-BASE-01…04 di docs/test/cp_persistenza_base.md (OMP-34): transazioni con commit
// veri sul database di test; ogni frame parte dallo stato noto del dataset.

const WALLET = 2;
const SOSTA = 2;
const ISTANTE = "2026-11-20 09:00:00+01";

async function inserisciRicarica(
  client: PoolClient,
  importo: number,
  sostaId: number | null = null,
): Promise<string> {
  const risultato = await interroga<{ id: string }>(
    client,
    `INSERT INTO movimento_del_wallet (wallet_virtuale_id, tipo_di_movimento, importo, data_e_ora, sosta_id)
     VALUES ($1, 'RICARICA', $2, $3, $4)
     RETURNING id::text AS id`,
    [WALLET, importo, ISTANTE, sostaId],
  );
  return risultato.rows[0].id;
}

async function saldo(pool: Pool): Promise<number> {
  const risultato = await pool.query<{ saldo: string }>(
    "SELECT saldo FROM saldo_wallet_virtuale WHERE wallet_virtuale_id = $1",
    [WALLET],
  );
  expect(risultato.rows).toHaveLength(1);
  return Number(risultato.rows[0].saldo);
}

async function numeroMovimenti(pool: Pool): Promise<number> {
  const risultato = await pool.query<{ n: string }>(
    "SELECT count(*) AS n FROM movimento_del_wallet WHERE wallet_virtuale_id = $1",
    [WALLET],
  );
  return Number(risultato.rows[0].n);
}

async function erroreDi(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa;
  } catch (errore) {
    return errore;
  }
  throw new Error("era attesa un'eccezione");
}

describe("OMP-34 · TCS base della persistenza · transazione con commit", () => {
  beforeEach(async () => {
    await preparaDatabaseDiTest();
  });

  afterAll(async () => {
    await preparaDatabaseDiTest();
    await chiudiDatabaseDiTest();
  });

  it('ISSUE_5 · TF-BASE-01 · operazione riuscita con due ricariche da 100 → "fatto", righe visibili, saldo 800', async () => {
    const pool = poolDiTest();
    expect(await saldo(pool)).toBe(600);
    const id: string[] = [];

    const esito = await eseguiInTransazione(async (client) => {
      id.push(await inserisciRicarica(client, 100));
      id.push(await inserisciRicarica(client, 100));
      return "fatto";
    }, pool);

    expect(esito).toBe("fatto");
    const righe = await pool.query<{ id: string }>(
      "SELECT id::text AS id FROM movimento_del_wallet WHERE id = ANY($1::bigint[]) ORDER BY id",
      [id],
    );
    expect(righe.rows.map((r) => r.id).sort()).toEqual([...id].sort());
    expect(await saldo(pool)).toBe(800);
  });

  it("ISSUE_5 · TF-BASE-02 · errore applicativo dopo una ricarica → stesso errore rilanciato, nessuna riga, saldo 600", async () => {
    const pool = poolDiTest();
    const movimentiPrima = await numeroMovimenti(pool);
    const errore = new Error("prova");
    let id: string | undefined;

    const ottenuto = await erroreDi(
      eseguiInTransazione(async (client) => {
        id = await inserisciRicarica(client, 100);
        throw errore;
      }, pool),
    );

    expect(ottenuto).toBe(errore);
    expect(ottenuto).not.toBeInstanceOf(ErroreDominio);
    expect(id).toBeDefined();
    const righe = await pool.query("SELECT 1 FROM movimento_del_wallet WHERE id = $1", [id]);
    expect(righe.rows).toHaveLength(0);
    expect(await numeroMovimenti(pool)).toBe(movimentiPrima);
    expect(await saldo(pool)).toBe(600);
  });

  it("VD_4 · TF-BASE-03 · ricarica poi ricarica con sosta_id 2 → MOVIMENTO_NON_COERENTE, prima ricarica annullata, saldo 600", async () => {
    const pool = poolDiTest();
    const movimentiPrima = await numeroMovimenti(pool);
    let id: string | undefined;

    const ottenuto = await erroreDi(
      eseguiInTransazione(async (client) => {
        id = await inserisciRicarica(client, 100);
        await inserisciRicarica(client, 100, SOSTA);
      }, pool),
    );

    expect(ottenuto).toBeInstanceOf(ErroreDominio);
    expect((ottenuto as ErroreDominio).codice).toBe("MOVIMENTO_NON_COERENTE");
    expect(id).toBeDefined();
    const righe = await pool.query("SELECT 1 FROM movimento_del_wallet WHERE id = $1", [id]);
    expect(righe.rows).toHaveLength(0);
    expect(await numeroMovimenti(pool)).toBe(movimentiPrima);
    expect(await saldo(pool)).toBe(600);
  });

  it("ISSUE_5 · TF-BASE-04 · 5 transazioni in sequenza, 3 riuscite e 2 fallite → nessun client trattenuto", async () => {
    const pool = poolDiTest();
    const ricarica = (client: PoolClient) => inserisciRicarica(client, 100);

    await eseguiInTransazione(ricarica, pool);
    await erroreDi(
      eseguiInTransazione(async (client) => {
        await inserisciRicarica(client, 100);
        throw new Error("prova");
      }, pool),
    );
    await eseguiInTransazione(ricarica, pool);
    const nonCoerente = await erroreDi(
      eseguiInTransazione((client) => inserisciRicarica(client, 100, SOSTA), pool),
    );
    expect((nonCoerente as ErroreDominio).codice).toBe("MOVIMENTO_NON_COERENTE");
    await eseguiInTransazione(ricarica, pool);

    expect(pool.totalCount).toBe(pool.idleCount);
    expect(pool.waitingCount).toBe(0);
    expect(pool.totalCount).toBeLessThanOrEqual(3);
  });
});
