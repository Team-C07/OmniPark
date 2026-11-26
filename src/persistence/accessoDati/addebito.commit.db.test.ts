import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { chiudiDatabaseDiTest, poolDiTest, preparaDatabaseDiTest } from "../test/databaseDiTest";
import { ErroreDominio } from "./errori";
import { interroga } from "./esecutore";
import { eseguiInTransazione } from "./transazione";
import { addebita } from "./walletSoste";

// Test frame TF-BASE-43, 44 di docs/test/cp_persistenza_base.md (OMP-34): due addebiti
// simultanei sullo stesso wallet, con commit veri; ogni frame parte dallo stato noto del dataset.

const WALLET = 2;
const SOSTA = 2;
const DATA_E_ORA = new Date("2026-11-20T09:00:00+01:00");

async function saldo(): Promise<number> {
  const risultato = await poolDiTest().query<{ saldo: string }>(
    "SELECT saldo FROM saldo_wallet_virtuale WHERE wallet_virtuale_id = $1",
    [WALLET],
  );
  expect(risultato.rows).toHaveLength(1);
  return Number(risultato.rows[0].saldo);
}

async function numeroAddebiti(): Promise<number> {
  const risultato = await poolDiTest().query<{ n: string }>(
    "SELECT count(*) AS n FROM movimento_del_wallet WHERE wallet_virtuale_id = $1 AND tipo_di_movimento = 'ADDEBITO'",
    [WALLET],
  );
  return Number(risultato.rows[0].n);
}

// Avvia insieme due transazioni con un addebito ciascuna; quella che ottiene per prima il blocco
// resta aperta 500 ms dopo l'addebito prima del commit.
function dueAddebitiSimultanei(importo: number) {
  let bloccoGiaOttenuto = false;
  const transazione = () =>
    eseguiInTransazione(async (client) => {
      const movimento = await addebita(client, {
        walletVirtualeId: WALLET,
        sostaId: SOSTA,
        importo,
        dataEOra: DATA_E_ORA,
      });
      if (!bloccoGiaOttenuto) {
        bloccoGiaOttenuto = true;
        await interroga(client, "SELECT pg_sleep(0.5)");
      }
      return movimento;
    }, poolDiTest());
  return Promise.allSettled([transazione(), transazione()]);
}

describe("OMP-34 · TCS base della persistenza · addebiti simultanei con commit", () => {
  beforeEach(async () => {
    await preparaDatabaseDiTest();
  });

  afterAll(async () => {
    await preparaDatabaseDiTest();
    await chiudiDatabaseDiTest();
  });

  it("RF_WALLET_2 · TF-BASE-43 · due addebiti simultanei di 400 su saldo 600 → uno riesce, l'altro SALDO_INSUFFICIENTE, saldo 200", async () => {
    expect(await saldo()).toBe(600);
    const addebitiPrima = await numeroAddebiti();

    const esiti = await dueAddebitiSimultanei(400);

    const riusciti = esiti.filter((e) => e.status === "fulfilled");
    const falliti = esiti.filter((e): e is PromiseRejectedResult => e.status === "rejected");
    expect(riusciti).toHaveLength(1);
    expect(falliti).toHaveLength(1);
    expect(falliti[0].reason).toBeInstanceOf(ErroreDominio);
    expect((falliti[0].reason as ErroreDominio).codice).toBe("SALDO_INSUFFICIENTE");
    expect(await numeroAddebiti()).toBe(addebitiPrima + 1);
    const saldoFinale = await saldo();
    expect(saldoFinale).toBeGreaterThanOrEqual(0);
    expect(saldoFinale).toBe(200);
  });

  it("RF_WALLET_2 · TF-BASE-44 · due addebiti simultanei di 300 su saldo 600 → entrambi riescono, saldo 0", async () => {
    expect(await saldo()).toBe(600);
    const addebitiPrima = await numeroAddebiti();

    const esiti = await dueAddebitiSimultanei(300);

    expect(esiti.map((e) => e.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await numeroAddebiti()).toBe(addebitiPrima + 2);
    expect(await saldo()).toBe(0);
  });
});
