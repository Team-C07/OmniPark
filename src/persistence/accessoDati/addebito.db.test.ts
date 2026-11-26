import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  annullaTransazioneDiTest,
  chiudiDatabaseDiTest,
  iniziaTransazioneDiTest,
  preparaDatabaseDiTest,
} from "../test/databaseDiTest";
import { ErroreDominio, type CodiceErrore } from "./errori";
import { addebita } from "./walletSoste";

// Test frame TF-BASE-37…42 di docs/test/cp_persistenza_base.md (OMP-34): addebito con blocco del
// wallet, nella transazione del test annullata alla fine di ogni frame.

const WALLET = 2;
const SOSTA = 2;
const ID_INESISTENTE = 999999;
const DATA_E_ORA = new Date("2026-11-20T09:00:00+01:00");

describe("OMP-34 · TCS base della persistenza · addebito", () => {
  let client: PoolClient;

  beforeAll(async () => {
    await preparaDatabaseDiTest();
  });

  afterAll(async () => {
    await chiudiDatabaseDiTest();
  });

  beforeEach(async () => {
    client = await iniziaTransazioneDiTest();
  });

  afterEach(async () => {
    await annullaTransazioneDiTest();
  });

  async function saldo(): Promise<number> {
    const risultato = await client.query<{ saldo: string }>(
      "SELECT saldo FROM saldo_wallet_virtuale WHERE wallet_virtuale_id = $1",
      [WALLET],
    );
    expect(risultato.rows).toHaveLength(1);
    return Number(risultato.rows[0].saldo);
  }

  async function numeroMovimenti(): Promise<number> {
    const risultato = await client.query<{ n: string }>(
      "SELECT count(*) AS n FROM movimento_del_wallet WHERE wallet_virtuale_id = $1",
      [WALLET],
    );
    return Number(risultato.rows[0].n);
  }

  async function rifiutato(
    dati: { walletVirtualeId: number; sostaId: number; importo: number },
    codice: CodiceErrore,
  ): Promise<void> {
    let ottenuto: unknown;
    try {
      await addebita(client, { ...dati, dataEOra: DATA_E_ORA });
    } catch (errore) {
      ottenuto = errore;
    }
    expect(ottenuto).toBeInstanceOf(ErroreDominio);
    expect((ottenuto as ErroreDominio).codice).toBe(codice);
  }

  async function accettato(importo: number): Promise<void> {
    const movimento = await addebita(client, {
      walletVirtualeId: WALLET,
      sostaId: SOSTA,
      importo,
      dataEOra: DATA_E_ORA,
    });
    expect(movimento).toMatchObject({
      walletVirtualeId: WALLET,
      tipoDiMovimento: "ADDEBITO",
      importo,
      dataEOra: DATA_E_ORA,
      sostaId: SOSTA,
    });
    const riga = await client.query(
      `SELECT wallet_virtuale_id::int AS wallet_virtuale_id, tipo_di_movimento, importo::int AS importo,
              data_e_ora, sosta_id::int AS sosta_id
       FROM movimento_del_wallet WHERE id = $1`,
      [movimento.id],
    );
    expect(riga.rows).toEqual([
      {
        wallet_virtuale_id: WALLET,
        tipo_di_movimento: "ADDEBITO",
        importo,
        data_e_ora: DATA_E_ORA,
        sosta_id: SOSTA,
      },
    ]);
  }

  it("RF_WALLET_2 · TF-BASE-37 · addebito di 300 sul wallet 2 per la sosta 2 → movimento ADDEBITO, saldo da 600 a 300", async () => {
    expect(await saldo()).toBe(600);
    await accettato(300);
    expect(await saldo()).toBe(300);
  });

  it("RF_WALLET_2 · TF-BASE-38 · addebito di 600 uguale al saldo → movimento creato, saldo 0", async () => {
    expect(await saldo()).toBe(600);
    await accettato(600);
    expect(await saldo()).toBe(0);
  });

  it("RF_WALLET_2 · TF-BASE-39 · addebito di 601 oltre il saldo → SALDO_INSUFFICIENTE, nessun movimento, saldo 600", async () => {
    const movimentiPrima = await numeroMovimenti();
    expect(await saldo()).toBe(600);
    await rifiutato(
      { walletVirtualeId: WALLET, sostaId: SOSTA, importo: 601 },
      "SALDO_INSUFFICIENTE",
    );
    expect(await numeroMovimenti()).toBe(movimentiPrima);
    expect(await saldo()).toBe(600);
  });

  it("ISSUE_5 · TF-BASE-40 · wallet 999999 inesistente → WALLET_INESISTENTE", async () => {
    await rifiutato(
      { walletVirtualeId: ID_INESISTENTE, sostaId: SOSTA, importo: 100 },
      "WALLET_INESISTENTE",
    );
  });

  it("SCHEMA · TF-BASE-41 · sosta 999999 inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(
      { walletVirtualeId: WALLET, sostaId: ID_INESISTENTE, importo: 100 },
      "RIFERIMENTO_INESISTENTE",
    );
  });

  it("SCHEMA · TF-BASE-42 · importo 0 → IMPORTO_NON_VALIDO", async () => {
    await rifiutato({ walletVirtualeId: WALLET, sostaId: SOSTA, importo: 0 }, "IMPORTO_NON_VALIDO");
  });
});
