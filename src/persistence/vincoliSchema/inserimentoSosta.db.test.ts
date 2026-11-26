import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  annullaTransazioneDiTest,
  chiudiDatabaseDiTest,
  iniziaTransazioneDiTest,
  preparaDatabaseDiTest,
} from "../test/databaseDiTest";

// Test frame di docs/test/cp_inserimento_sosta.md (OMP-33): vincoli dello schema sull'INSERT in sosta.

type Sosta = {
  automobilistaId: number;
  veicoloId: number;
  stalloId: number;
  stato: string;
  orarioDiAvvio: string;
  orarioDiScadenza: string;
  pagamento: string;
  dichiarazioneDiPermesso: string | null;
  fotoDelPermesso: Buffer | null;
};

const ID_INESISTENTE = 999999;
const AVVIO = "2026-11-20 09:00:00+01";
const SCADENZA = "2026-11-20 10:00:00+01";
const DICHIARAZIONE = "Dichiaro di esporre il permesso previsto per lo stallo";
const MASSIMO_FOTO = 2_097_152;

const PREDEFINITA: Sosta = {
  automobilistaId: 8,
  veicoloId: 3,
  stalloId: 16,
  stato: "ATTIVA",
  orarioDiAvvio: AVVIO,
  orarioDiScadenza: SCADENZA,
  pagamento: "PAGATA",
  dichiarazioneDiPermesso: null,
  fotoDelPermesso: null,
};

function foto(byte: number): Buffer {
  return Buffer.alloc(byte, 0xff);
}

function permessoCompleto(): Pick<Sosta, "dichiarazioneDiPermesso" | "fotoDelPermesso"> {
  return { dichiarazioneDiPermesso: DICHIARAZIONE, fotoDelPermesso: foto(1024) };
}

function sosta(differenze: Partial<Sosta> = {}): Sosta {
  return { ...PREDEFINITA, ...differenze };
}

async function inserisciSosta(client: PoolClient, valori: Sosta): Promise<string> {
  const risultato = await client.query<{ id: string }>(
    `INSERT INTO sosta (automobilista_id, veicolo_id, stallo_id, stato, orario_di_avvio,
                        orario_di_scadenza, pagamento, dichiarazione_di_permesso, foto_del_permesso)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id::text AS id`,
    [
      valori.automobilistaId,
      valori.veicoloId,
      valori.stalloId,
      valori.stato,
      valori.orarioDiAvvio,
      valori.orarioDiScadenza,
      valori.pagamento,
      valori.dichiarazioneDiPermesso,
      valori.fotoDelPermesso,
    ],
  );
  return risultato.rows[0].id;
}

// Esito accettato: la riga si ritrova con i valori inseriti.
async function verificaSostaRitrovata(
  client: PoolClient,
  id: string,
  attesa: Sosta,
): Promise<void> {
  const risultato = await client.query(
    `SELECT automobilista_id::int AS automobilista_id, veicolo_id::int AS veicolo_id,
            stallo_id::int AS stallo_id, stato, orario_di_avvio, orario_di_scadenza, pagamento,
            dichiarazione_di_permesso, octet_length(foto_del_permesso) AS byte_foto
     FROM sosta WHERE id = $1`,
    [id],
  );
  expect(risultato.rows).toHaveLength(1);
  expect(risultato.rows[0]).toEqual({
    automobilista_id: attesa.automobilistaId,
    veicolo_id: attesa.veicoloId,
    stallo_id: attesa.stalloId,
    stato: attesa.stato,
    orario_di_avvio: new Date("2026-11-20T09:00:00+01:00"),
    orario_di_scadenza: new Date("2026-11-20T10:00:00+01:00"),
    pagamento: attesa.pagamento,
    dichiarazione_di_permesso: attesa.dichiarazioneDiPermesso,
    byte_foto: attesa.fotoDelPermesso === null ? null : attesa.fotoDelPermesso.length,
  });
}

describe("OMP-33 · TCS inserimento della sosta", () => {
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

  async function accettata(valori: Sosta): Promise<void> {
    const id = await inserisciSosta(client, valori);
    await verificaSostaRitrovata(client, id, valori);
  }

  async function rifiutata(valori: Sosta, code: string, constraint: string): Promise<void> {
    await expect(inserisciSosta(client, valori)).rejects.toMatchObject({ code, constraint });
  }

  it("SCHEMA · TF-SOSTA-01 · automobilista inesistente → sosta_automobilista_id_fkey", async () => {
    await rifiutata(
      sosta({ automobilistaId: ID_INESISTENTE }),
      "23503",
      "sosta_automobilista_id_fkey",
    );
  });

  it("SCHEMA · TF-SOSTA-02 · veicolo inesistente → sosta_veicolo_id_fkey", async () => {
    await rifiutata(sosta({ veicoloId: ID_INESISTENTE }), "23503", "sosta_veicolo_id_fkey");
  });

  it("SCHEMA · TF-SOSTA-03 · stallo inesistente → sosta_stallo_id_fkey", async () => {
    await rifiutata(sosta({ stalloId: ID_INESISTENTE }), "23503", "sosta_stallo_id_fkey");
  });

  it("SCHEMA · TF-SOSTA-04 · stato non ammesso IN_CORSO → sosta_stato_ammesso", async () => {
    await rifiutata(sosta({ stato: "IN_CORSO" }), "23514", "sosta_stato_ammesso");
  });

  it("SCHEMA · TF-SOSTA-05 · scadenza uguale all'avvio → sosta_scadenza_dopo_avvio", async () => {
    await rifiutata(sosta({ orarioDiScadenza: AVVIO }), "23514", "sosta_scadenza_dopo_avvio");
  });

  it("SCHEMA · TF-SOSTA-06 · pagamento non ammesso SCONTATA → sosta_pagamento_ammesso", async () => {
    await rifiutata(sosta({ pagamento: "SCONTATA" }), "23514", "sosta_pagamento_ammesso");
  });

  it("RF_SOSTA_5 · TF-SOSTA-07 · solo dichiarazione, foto assente → sosta_permesso_completo", async () => {
    await rifiutata(
      sosta({ stalloId: 15, dichiarazioneDiPermesso: DICHIARAZIONE, fotoDelPermesso: null }),
      "23514",
      "sosta_permesso_completo",
    );
  });

  it("RF_SOSTA_5 · TF-SOSTA-08 · solo foto, dichiarazione assente → sosta_permesso_completo", async () => {
    await rifiutata(
      sosta({ stalloId: 15, dichiarazioneDiPermesso: null, fotoDelPermesso: foto(1024) }),
      "23514",
      "sosta_permesso_completo",
    );
  });

  it("SCHEMA · TF-SOSTA-09 · dichiarazione di soli spazi → sosta_dichiarazione_non_vuota", async () => {
    await rifiutata(
      sosta({ stalloId: 15, dichiarazioneDiPermesso: "   ", fotoDelPermesso: foto(1024) }),
      "23514",
      "sosta_dichiarazione_non_vuota",
    );
  });

  it("SCHEMA · TF-SOSTA-10 · foto di 0 byte → sosta_foto_dimensione", async () => {
    await rifiutata(
      sosta({ stalloId: 15, dichiarazioneDiPermesso: DICHIARAZIONE, fotoDelPermesso: foto(0) }),
      "23514",
      "sosta_foto_dimensione",
    );
  });

  it("SCHEMA · TF-SOSTA-11 · foto di 2 097 153 byte → sosta_foto_dimensione", async () => {
    await rifiutata(
      sosta({
        stalloId: 15,
        dichiarazioneDiPermesso: DICHIARAZIONE,
        fotoDelPermesso: foto(MASSIMO_FOTO + 1),
      }),
      "23514",
      "sosta_foto_dimensione",
    );
  });

  it("SCHEMA · TF-SOSTA-12 · foto di 2 097 152 byte → accettata", async () => {
    await accettata(
      sosta({
        stalloId: 15,
        dichiarazioneDiPermesso: DICHIARAZIONE,
        fotoDelPermesso: foto(MASSIMO_FOTO),
      }),
    );
  });

  it("RF_SOSTA_1 · TF-SOSTA-13 · ATTIVA, PAGATA, permesso assente → accettata", async () => {
    await accettata(sosta());
  });

  it("RF_SOSTA_5 · TF-SOSTA-14 · ATTIVA, PAGATA, permesso completo → accettata", async () => {
    await accettata(sosta({ stalloId: 15, ...permessoCompleto() }));
  });

  it("VD_10 · TF-SOSTA-15 · ATTIVA, GRATUITA, permesso assente → sosta_gratuita_con_permesso", async () => {
    await rifiutata(
      sosta({ stalloId: 14, pagamento: "GRATUITA" }),
      "23514",
      "sosta_gratuita_con_permesso",
    );
  });

  it("VD_10 · TF-SOSTA-16 · ATTIVA, GRATUITA, permesso completo → accettata", async () => {
    await accettata(sosta({ stalloId: 14, pagamento: "GRATUITA", ...permessoCompleto() }));
  });

  it("RF_SOSTA_7 · TF-SOSTA-17 · SCADUTA, PAGATA, permesso assente → accettata", async () => {
    await accettata(sosta({ stato: "SCADUTA" }));
  });

  it("NRF_LEG_2 · TF-SOSTA-18 · SCADUTA, PAGATA, permesso completo → accettata", async () => {
    await accettata(sosta({ stato: "SCADUTA", stalloId: 15, ...permessoCompleto() }));
  });

  it("VD_10 · TF-SOSTA-19 · SCADUTA, GRATUITA, permesso assente → sosta_gratuita_con_permesso", async () => {
    await rifiutata(
      sosta({ stato: "SCADUTA", stalloId: 14, pagamento: "GRATUITA" }),
      "23514",
      "sosta_gratuita_con_permesso",
    );
  });

  it("VD_10 · TF-SOSTA-20 · SCADUTA, GRATUITA, permesso completo → accettata", async () => {
    await accettata(
      sosta({ stato: "SCADUTA", stalloId: 14, pagamento: "GRATUITA", ...permessoCompleto() }),
    );
  });

  it("NRF_LEG_2 · TF-SOSTA-21 · TERMINATA, PAGATA, permesso assente → accettata", async () => {
    await accettata(sosta({ stato: "TERMINATA" }));
  });

  it("NRF_LEG_2 · TF-SOSTA-22 · TERMINATA, PAGATA, permesso completo → sosta_permesso_eliminato_al_termine", async () => {
    await rifiutata(
      sosta({ stato: "TERMINATA", stalloId: 15, ...permessoCompleto() }),
      "23514",
      "sosta_permesso_eliminato_al_termine",
    );
  });

  it("NRF_LEG_2 · TF-SOSTA-23 · TERMINATA, GRATUITA, permesso assente → accettata", async () => {
    await accettata(sosta({ stato: "TERMINATA", stalloId: 14, pagamento: "GRATUITA" }));
  });

  it("NRF_LEG_2 · TF-SOSTA-24 · TERMINATA, GRATUITA, permesso completo → sosta_permesso_eliminato_al_termine", async () => {
    await rifiutata(
      sosta({ stato: "TERMINATA", stalloId: 14, pagamento: "GRATUITA", ...permessoCompleto() }),
      "23514",
      "sosta_permesso_eliminato_al_termine",
    );
  });

  it("RF_SOSTA_1 · TF-SOSTA-25 · seconda sosta attiva per lo stesso veicolo → sosta_una_attiva_per_veicolo", async () => {
    await inserisciSosta(client, sosta({ stalloId: 17 }));
    await rifiutata(sosta({ stalloId: 16 }), "23505", "sosta_una_attiva_per_veicolo");
  });

  it("RF_SOSTA_1 · TF-SOSTA-26 · sosta SCADUTA con una ATTIVA dello stesso veicolo → accettata", async () => {
    await inserisciSosta(client, sosta({ stalloId: 17 }));
    await accettata(sosta({ stato: "SCADUTA", stalloId: 16 }));
  });

  it("RF_SOSTA_1 · TF-SOSTA-27 · sosta ATTIVA con una SCADUTA dello stesso veicolo → accettata", async () => {
    await inserisciSosta(client, sosta({ stato: "SCADUTA", stalloId: 17 }));
    await accettata(sosta({ stalloId: 16 }));
  });

  it("RF_SOSTA_1 · TF-SOSTA-28 · sosta ATTIVA con la sosta 2 TERMINATA dello stesso veicolo → accettata", async () => {
    const preesistente = await client.query<{ stato: string; veicolo_id: number }>(
      "SELECT stato, veicolo_id::int AS veicolo_id FROM sosta WHERE id = 2",
    );
    expect(preesistente.rows).toEqual([{ stato: "TERMINATA", veicolo_id: 3 }]);
    await accettata(sosta());
  });

  it("SCHEMA · TF-SOSTA-29 · seconda sosta attiva sullo stesso stallo → sosta_una_attiva_per_stallo", async () => {
    await inserisciSosta(client, sosta({ automobilistaId: 7, veicoloId: 1, stalloId: 16 }));
    await rifiutata(sosta(), "23505", "sosta_una_attiva_per_stallo");
  });

  it("SCHEMA · TF-SOSTA-30 · sosta ATTIVA con una SCADUTA sullo stesso stallo → accettata", async () => {
    await inserisciSosta(
      client,
      sosta({ stato: "SCADUTA", automobilistaId: 7, veicoloId: 1, stalloId: 16 }),
    );
    await accettata(sosta());
  });
});
