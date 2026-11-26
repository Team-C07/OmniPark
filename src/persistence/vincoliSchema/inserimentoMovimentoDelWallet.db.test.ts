import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  annullaTransazioneDiTest,
  chiudiDatabaseDiTest,
  iniziaTransazioneDiTest,
  preparaDatabaseDiTest,
} from "../test/databaseDiTest";

// Test frame di docs/test/cp_inserimento_movimento_del_wallet.md (OMP-33): vincoli dello schema
// sull'INSERT in movimento_del_wallet e saldo della vista saldo_wallet_virtuale.

type Movimento = {
  walletVirtualeId: number;
  tipoDiMovimento: string;
  importo: number;
  dataEOra: string | null;
  sostaId: number | null;
};

const ID_INESISTENTE = 999999;
const WALLET = 2;
const SOSTA = 2;

const PREDEFINITO: Movimento = {
  walletVirtualeId: WALLET,
  tipoDiMovimento: "RICARICA",
  importo: 500,
  dataEOra: "2026-11-20 09:00:00+01",
  sostaId: null,
};

function movimento(differenze: Partial<Movimento> = {}): Movimento {
  return { ...PREDEFINITO, ...differenze };
}

async function inserisciMovimento(client: PoolClient, valori: Movimento): Promise<string> {
  const risultato = await client.query<{ id: string }>(
    `INSERT INTO movimento_del_wallet (wallet_virtuale_id, tipo_di_movimento, importo, data_e_ora, sosta_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id::text AS id`,
    [
      valori.walletVirtualeId,
      valori.tipoDiMovimento,
      valori.importo,
      valori.dataEOra,
      valori.sostaId,
    ],
  );
  return risultato.rows[0].id;
}

async function saldo(client: PoolClient, walletId: number): Promise<number> {
  const risultato = await client.query<{ saldo: string }>(
    "SELECT saldo::text AS saldo FROM saldo_wallet_virtuale WHERE wallet_virtuale_id = $1",
    [walletId],
  );
  expect(risultato.rows).toHaveLength(1);
  return Number(risultato.rows[0].saldo);
}

// Esito accettato: la riga si ritrova con i valori inseriti.
async function verificaMovimentoRitrovato(
  client: PoolClient,
  id: string,
  atteso: Movimento,
): Promise<void> {
  const risultato = await client.query(
    `SELECT wallet_virtuale_id::int AS wallet_virtuale_id, tipo_di_movimento, importo::int AS importo,
            data_e_ora, sosta_id::int AS sosta_id
     FROM movimento_del_wallet WHERE id = $1`,
    [id],
  );
  expect(risultato.rows).toHaveLength(1);
  expect(risultato.rows[0]).toEqual({
    wallet_virtuale_id: atteso.walletVirtualeId,
    tipo_di_movimento: atteso.tipoDiMovimento,
    importo: atteso.importo,
    data_e_ora: new Date("2026-11-20T09:00:00+01:00"),
    sosta_id: atteso.sostaId,
  });
}

describe("OMP-33 · TCS inserimento del movimento del wallet", () => {
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

  async function rifiutato(valori: Movimento, atteso: Record<string, string>): Promise<void> {
    await expect(inserisciMovimento(client, valori)).rejects.toMatchObject(atteso);
  }

  it("SCHEMA · TF-MOV-01 · wallet inesistente → movimento_del_wallet_wallet_virtuale_id_fkey", async () => {
    await rifiutato(movimento({ walletVirtualeId: ID_INESISTENTE }), {
      code: "23503",
      constraint: "movimento_del_wallet_wallet_virtuale_id_fkey",
    });
  });

  it("SCHEMA · TF-MOV-02 · tipo non ammesso RIMBORSO → tipo_ammesso o sosta_coerente_con_tipo", async () => {
    // Per un tipo non ammesso entrambi i CHECK sono violati e PostgreSQL ne riporta uno solo,
    // senza un ordine garantito: l'esito atteso della TCS accetta entrambi i nomi.
    await expect(
      inserisciMovimento(client, movimento({ tipoDiMovimento: "RIMBORSO" })),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: expect.stringMatching(
        /^(movimento_del_wallet_tipo_ammesso|movimento_del_wallet_sosta_coerente_con_tipo)$/,
      ),
    });
  });

  it("SCHEMA · TF-MOV-03 · importo 0 → movimento_del_wallet_importo_positivo", async () => {
    await rifiutato(movimento({ importo: 0 }), {
      code: "23514",
      constraint: "movimento_del_wallet_importo_positivo",
    });
  });

  it("SCHEMA · TF-MOV-04 · importo negativo → movimento_del_wallet_importo_positivo", async () => {
    await rifiutato(movimento({ importo: -500 }), {
      code: "23514",
      constraint: "movimento_del_wallet_importo_positivo",
    });
  });

  it("SCHEMA · TF-MOV-05 · importo oltre il massimo di integer → 22003", async () => {
    await rifiutato(movimento({ importo: 2_147_483_648 }), { code: "22003" });
  });

  it("SCHEMA · TF-MOV-06 · addebito per una sosta inesistente → movimento_del_wallet_sosta_id_fkey", async () => {
    await rifiutato(movimento({ tipoDiMovimento: "ADDEBITO", sostaId: ID_INESISTENTE }), {
      code: "23503",
      constraint: "movimento_del_wallet_sosta_id_fkey",
    });
  });

  it("SCHEMA · TF-MOV-07 · data e ora NULL → 23502 data_e_ora", async () => {
    await rifiutato(movimento({ dataEOra: null }), { code: "23502", column: "data_e_ora" });
  });

  it("SCHEMA · TF-MOV-08 · ricarica di 1 centesimo → accettato", async () => {
    const valori = movimento({ importo: 1 });
    const id = await inserisciMovimento(client, valori);
    await verificaMovimentoRitrovato(client, id, valori);
  });

  it("RF_WALLET_1 · TF-MOV-09 · ricarica senza sosta → accettato, saldo da 600 a 1100", async () => {
    expect(await saldo(client, WALLET)).toBe(600);
    const valori = movimento();
    const id = await inserisciMovimento(client, valori);
    await verificaMovimentoRitrovato(client, id, valori);
    expect(await saldo(client, WALLET)).toBe(1100);
  });

  it("VD_4 · TF-MOV-10 · ricarica collegata a una sosta → movimento_del_wallet_sosta_coerente_con_tipo", async () => {
    await rifiutato(movimento({ sostaId: SOSTA }), {
      code: "23514",
      constraint: "movimento_del_wallet_sosta_coerente_con_tipo",
    });
  });

  it("RF_WALLET_2 · TF-MOV-11 · addebito di 300 per la sosta 2 → accettato, saldo da 600 a 300", async () => {
    expect(await saldo(client, WALLET)).toBe(600);
    const valori = movimento({ tipoDiMovimento: "ADDEBITO", sostaId: SOSTA, importo: 300 });
    const id = await inserisciMovimento(client, valori);
    await verificaMovimentoRitrovato(client, id, valori);
    expect(await saldo(client, WALLET)).toBe(300);
  });

  it("VD_4 · TF-MOV-12 · addebito senza sosta → movimento_del_wallet_sosta_coerente_con_tipo", async () => {
    await rifiutato(movimento({ tipoDiMovimento: "ADDEBITO" }), {
      code: "23514",
      constraint: "movimento_del_wallet_sosta_coerente_con_tipo",
    });
  });
});
