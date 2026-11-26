import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  annullaTransazioneDiTest,
  chiudiDatabaseDiTest,
  iniziaTransazioneDiTest,
  preparaDatabaseDiTest,
} from "../test/databaseDiTest";
import { ErroreDominio, type CodiceErrore } from "./errori";
import {
  aggiornaScadenza,
  creaSosta,
  creaWallet,
  impostaSostaScaduta,
  movimenti,
  registraRicarica,
  sostaAttivaPerVeicolo,
  sostaAttivaSuStallo,
  sostaPerTargaSuStallo,
  sosteAttiveDiAutomobilista,
  sosteDaScadere,
  terminaSosteScaduteDelloStallo,
  trovaSosta,
  trovaWalletDiAutomobilista,
} from "./walletSoste";

// Test frame TF-WS-01…43 di docs/test/cp_persistenza_wallet_soste.md (OMP-34).

const ID_INESISTENTE = 999999;
const I = new Date("2026-11-20T09:00:00+01:00");
const I_PIU_1H = new Date("2026-11-20T10:00:00+01:00");
const DICHIARAZIONE = "Dichiaro di esporre il permesso previsto per lo stallo";

function fotoCompleta(): Buffer {
  return Buffer.alloc(1024, 0xff);
}

type SostaSql = {
  automobilistaId: number;
  veicoloId: number;
  stalloId: number;
  stato: "ATTIVA" | "SCADUTA" | "TERMINATA";
  orarioDiAvvio: Date;
  orarioDiScadenza: Date;
  pagamento?: "PAGATA" | "GRATUITA";
  dichiarazioneDiPermesso?: string | null;
  fotoDelPermesso?: Buffer | null;
};

describe("OMP-34 · TCS persistenza · wallet, movimenti e soste", () => {
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

  async function rifiutato(operazione: Promise<unknown>, codice: CodiceErrore): Promise<void> {
    let ottenuto: unknown;
    try {
      await operazione;
    } catch (errore) {
      ottenuto = errore;
    }
    expect(ottenuto).toBeInstanceOf(ErroreDominio);
    expect((ottenuto as ErroreDominio).codice).toBe(codice);
  }

  async function automobilistaSenzaWallet(): Promise<number> {
    const utente = await client.query<{ id: string }>(
      `INSERT INTO utente (email, hash_password, ruolo)
       VALUES ('senza.wallet@omnipark.example', 'hash-di-prova', 'AUTOMOBILISTA') RETURNING id`,
    );
    const id = Number(utente.rows[0].id);
    await client.query("INSERT INTO automobilista (id) VALUES ($1)", [id]);
    return id;
  }

  async function saldo(walletId: number): Promise<number> {
    const risultato = await client.query<{ saldo: string }>(
      "SELECT saldo FROM saldo_wallet_virtuale WHERE wallet_virtuale_id = $1",
      [walletId],
    );
    expect(risultato.rows).toHaveLength(1);
    return Number(risultato.rows[0].saldo);
  }

  async function inserisciSosta(sosta: SostaSql): Promise<number> {
    const risultato = await client.query<{ id: string }>(
      `INSERT INTO sosta (automobilista_id, veicolo_id, stallo_id, stato, orario_di_avvio,
                          orario_di_scadenza, pagamento, dichiarazione_di_permesso, foto_del_permesso)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        sosta.automobilistaId,
        sosta.veicoloId,
        sosta.stalloId,
        sosta.stato,
        sosta.orarioDiAvvio,
        sosta.orarioDiScadenza,
        sosta.pagamento ?? "PAGATA",
        sosta.dichiarazioneDiPermesso ?? null,
        sosta.fotoDelPermesso ?? null,
      ],
    );
    return Number(risultato.rows[0].id);
  }

  function sostaAttiva8Su16(): Promise<number> {
    return inserisciSosta({
      automobilistaId: 8,
      veicoloId: 3,
      stalloId: 16,
      stato: "ATTIVA",
      orarioDiAvvio: I,
      orarioDiScadenza: I_PIU_1H,
    });
  }

  function creaSosta8Su16(): Promise<number> {
    return creaSosta(client, {
      automobilistaId: 8,
      veicoloId: 3,
      stalloId: 16,
      orarioDiAvvio: I,
      orarioDiScadenza: I_PIU_1H,
      pagamento: "PAGATA",
    });
  }

  // creaWallet

  it("RF_WALLET_1 · TF-WS-01 · automobilista senza wallet → wallet creato con saldo 0", async () => {
    const automobilistaId = await automobilistaSenzaWallet();
    const id = await creaWallet(client, automobilistaId);
    expect(typeof id).toBe("number");
    expect(await trovaWalletDiAutomobilista(client, automobilistaId)).toEqual({ id, saldo: 0 });
  });

  it("SCHEMA · TF-WS-02 · automobilista con wallet → WALLET_GIA_PRESENTE", async () => {
    await rifiutato(creaWallet(client, 8), "WALLET_GIA_PRESENTE");
  });

  it("VD_1 · TF-WS-03 · utente ausiliario → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(creaWallet(client, 2), "RIFERIMENTO_INESISTENTE");
  });

  // trovaWalletDiAutomobilista

  it("RF_WALLET_3 · TF-WS-04 · automobilista 8 con movimenti → wallet 2, saldo 600", async () => {
    expect(await trovaWalletDiAutomobilista(client, 8)).toEqual({ id: 2, saldo: 600 });
  });

  it("RF_WALLET_3 · TF-WS-05 · wallet senza movimenti → saldo 0", async () => {
    const automobilistaId = await automobilistaSenzaWallet();
    await creaWallet(client, automobilistaId);
    expect((await trovaWalletDiAutomobilista(client, automobilistaId))?.saldo).toBe(0);
  });

  it("RF_WALLET_3 · TF-WS-06 · automobilista inesistente → null", async () => {
    expect(await trovaWalletDiAutomobilista(client, ID_INESISTENTE)).toBeNull();
  });

  // registraRicarica

  it("RF_WALLET_1 · TF-WS-07 · ricarica di 1000 sul wallet 3 → movimento RICARICA, saldo da 500 a 1500", async () => {
    expect(await saldo(3)).toBe(500);
    const movimento = await registraRicarica(client, {
      walletVirtualeId: 3,
      importo: 1000,
      dataEOra: I,
    });
    expect(movimento).toMatchObject({
      walletVirtualeId: 3,
      tipoDiMovimento: "RICARICA",
      importo: 1000,
      sostaId: null,
    });
    expect(movimento.dataEOra.getTime()).toBe(I.getTime());
    expect(await saldo(3)).toBe(1500);
  });

  it("SCHEMA · TF-WS-08 · wallet inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(
      registraRicarica(client, { walletVirtualeId: ID_INESISTENTE, importo: 1000, dataEOra: I }),
      "RIFERIMENTO_INESISTENTE",
    );
  });

  it("SCHEMA · TF-WS-09 · importo zero → IMPORTO_NON_VALIDO", async () => {
    await rifiutato(
      registraRicarica(client, { walletVirtualeId: 3, importo: 0, dataEOra: I }),
      "IMPORTO_NON_VALIDO",
    );
  });

  // movimenti

  it("RF_WALLET_3 · TF-WS-10 · cronologia del wallet 2 → 6 movimenti dal più recente", async () => {
    const elenco = await movimenti(client, 2);
    expect(
      elenco.map((m) => ({
        id: m.id,
        walletVirtualeId: m.walletVirtualeId,
        tipoDiMovimento: m.tipoDiMovimento,
        importo: m.importo,
        sostaId: m.sostaId,
        targa: m.targa,
        dataEOra: m.dataEOra.getTime(),
      })),
    ).toEqual([
      {
        id: 6,
        walletVirtualeId: 2,
        tipoDiMovimento: "ADDEBITO",
        importo: 300,
        sostaId: 9,
        targa: "MN234PQ",
        dataEOra: new Date("2026-11-09T16:00:00+01:00").getTime(),
      },
      {
        id: 5,
        walletVirtualeId: 2,
        tipoDiMovimento: "ADDEBITO",
        importo: 150,
        sostaId: 2,
        targa: "MN234PQ",
        dataEOra: new Date("2026-11-02T10:20:00+01:00").getTime(),
      },
      {
        id: 4,
        walletVirtualeId: 2,
        tipoDiMovimento: "RICARICA",
        importo: 1000,
        sostaId: null,
        targa: null,
        dataEOra: new Date("2026-11-02T10:18:00+01:00").getTime(),
      },
      {
        id: 3,
        walletVirtualeId: 2,
        tipoDiMovimento: "ADDEBITO",
        importo: 300,
        sostaId: 2,
        targa: "MN234PQ",
        dataEOra: new Date("2026-11-02T08:42:00+01:00").getTime(),
      },
      {
        id: 2,
        walletVirtualeId: 2,
        tipoDiMovimento: "ADDEBITO",
        importo: 150,
        sostaId: 1,
        targa: "MN234PQ",
        dataEOra: new Date("2026-10-31T09:00:00+01:00").getTime(),
      },
      {
        id: 1,
        walletVirtualeId: 2,
        tipoDiMovimento: "RICARICA",
        importo: 500,
        sostaId: null,
        targa: null,
        dataEOra: new Date("2026-10-31T08:30:00+01:00").getTime(),
      },
    ]);
  });

  it("RF_WALLET_3 · TF-WS-11 · wallet 3 con un movimento → ricarica 10 da 500", async () => {
    const elenco = await movimenti(client, 3);
    expect(elenco).toHaveLength(1);
    expect(elenco[0]).toMatchObject({
      id: 10,
      walletVirtualeId: 3,
      tipoDiMovimento: "RICARICA",
      importo: 500,
      sostaId: null,
      targa: null,
    });
    expect(elenco[0].dataEOra.getTime()).toBe(new Date("2026-11-01T09:30:00+01:00").getTime());
  });

  it("RF_WALLET_3 · TF-WS-12 · wallet appena creato → nessun movimento", async () => {
    const automobilistaId = await automobilistaSenzaWallet();
    const walletId = await creaWallet(client, automobilistaId);
    expect(await movimenti(client, walletId)).toEqual([]);
  });

  // creaSosta

  it("RF_SOSTA_1 · TF-WS-13 · sosta senza permesso → ATTIVA con targa MN234PQ, permesso null", async () => {
    const id = await creaSosta8Su16();
    expect(typeof id).toBe("number");
    const sosta = await trovaSosta(client, id);
    expect(sosta).toMatchObject({
      id,
      automobilistaId: 8,
      veicoloId: 3,
      targa: "MN234PQ",
      stalloId: 16,
      stato: "ATTIVA",
      pagamento: "PAGATA",
      dichiarazioneDiPermesso: null,
      fotoDelPermesso: null,
    });
    expect(sosta?.orarioDiAvvio.getTime()).toBe(I.getTime());
    expect(sosta?.orarioDiScadenza.getTime()).toBe(I_PIU_1H.getTime());
  });

  it("RF_SOSTA_5 · TF-WS-14 · sosta con permesso completo sullo stallo 15 → dichiarazione e foto di 1024 byte", async () => {
    const id = await creaSosta(client, {
      automobilistaId: 7,
      veicoloId: 1,
      stalloId: 15,
      orarioDiAvvio: I,
      orarioDiScadenza: I_PIU_1H,
      pagamento: "PAGATA",
      dichiarazioneDiPermesso: DICHIARAZIONE,
      fotoDelPermesso: fotoCompleta(),
    });
    const sosta = await trovaSosta(client, id);
    expect(sosta?.dichiarazioneDiPermesso).toBe(DICHIARAZIONE);
    expect(sosta?.fotoDelPermesso).toBeInstanceOf(Buffer);
    expect(sosta?.fotoDelPermesso?.length).toBe(1024);
    expect(sosta?.fotoDelPermesso?.equals(fotoCompleta())).toBe(true);
  });

  it("RF_SOSTA_1 · TF-WS-15 · veicolo con sosta attiva → SOSTA_GIA_ATTIVA_PER_VEICOLO", async () => {
    await creaSosta(client, {
      automobilistaId: 8,
      veicoloId: 3,
      stalloId: 17,
      orarioDiAvvio: I,
      orarioDiScadenza: I_PIU_1H,
      pagamento: "PAGATA",
    });
    await rifiutato(creaSosta8Su16(), "SOSTA_GIA_ATTIVA_PER_VEICOLO");
  });

  it("SCHEMA · TF-WS-16 · scadenza uguale all'avvio → DURATA_NON_VALIDA", async () => {
    await rifiutato(
      creaSosta(client, {
        automobilistaId: 8,
        veicoloId: 3,
        stalloId: 16,
        orarioDiAvvio: I,
        orarioDiScadenza: I,
        pagamento: "PAGATA",
      }),
      "DURATA_NON_VALIDA",
    );
  });

  it("RF_SOSTA_5 · TF-WS-17 · sola dichiarazione senza foto sullo stallo 15 → PERMESSO_NON_VALIDO", async () => {
    await rifiutato(
      creaSosta(client, {
        automobilistaId: 7,
        veicoloId: 1,
        stalloId: 15,
        orarioDiAvvio: I,
        orarioDiScadenza: I_PIU_1H,
        pagamento: "PAGATA",
        dichiarazioneDiPermesso: DICHIARAZIONE,
      }),
      "PERMESSO_NON_VALIDO",
    );
  });

  it("SCHEMA · TF-WS-18 · stallo inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(
      creaSosta(client, {
        automobilistaId: 8,
        veicoloId: 3,
        stalloId: ID_INESISTENTE,
        orarioDiAvvio: I,
        orarioDiScadenza: I_PIU_1H,
        pagamento: "PAGATA",
      }),
      "RIFERIMENTO_INESISTENTE",
    );
  });

  // trovaSosta

  it("RF_OP_4 · TF-WS-19 · sosta 2 esistente → TERMINATA PAGATA sullo stallo 11, permesso null", async () => {
    const sosta = await trovaSosta(client, 2);
    expect(sosta).toMatchObject({
      id: 2,
      automobilistaId: 8,
      veicoloId: 3,
      targa: "MN234PQ",
      stalloId: 11,
      stato: "TERMINATA",
      pagamento: "PAGATA",
      dichiarazioneDiPermesso: null,
      fotoDelPermesso: null,
    });
    expect(sosta?.orarioDiAvvio.getTime()).toBe(new Date("2026-11-02T08:42:00+01:00").getTime());
    expect(sosta?.orarioDiScadenza.getTime()).toBe(new Date("2026-11-02T11:42:00+01:00").getTime());
  });

  it("RF_OP_4 · TF-WS-20 · sosta inesistente → null", async () => {
    expect(await trovaSosta(client, ID_INESISTENTE)).toBeNull();
  });

  // sostaAttivaPerVeicolo

  it("RF_SOSTA_1 · TF-WS-21 · veicolo 3 con sosta attiva → quella sosta", async () => {
    const id = await creaSosta8Su16();
    const sosta = await sostaAttivaPerVeicolo(client, 3);
    expect(sosta).toMatchObject({ id, veicoloId: 3, stalloId: 16, stato: "ATTIVA" });
  });

  it("RF_SOSTA_1 · TF-WS-22 · veicolo 3 con sole soste terminate → null", async () => {
    expect(await sostaAttivaPerVeicolo(client, 3)).toBeNull();
  });

  it("RF_SOSTA_1 · TF-WS-23 · veicolo inesistente → null", async () => {
    expect(await sostaAttivaPerVeicolo(client, ID_INESISTENTE)).toBeNull();
  });

  // sostaAttivaSuStallo

  it("RF_SOSTA_6 · TF-WS-24 · stallo 16 con sosta attiva → quella sosta con targa MN234PQ", async () => {
    const id = await sostaAttiva8Su16();
    expect(await sostaAttivaSuStallo(client, 16)).toMatchObject({
      id,
      stalloId: 16,
      stato: "ATTIVA",
      targa: "MN234PQ",
    });
  });

  it("RF_SOSTA_6 · TF-WS-25 · stallo 11 con sole soste terminate → null", async () => {
    expect(await sostaAttivaSuStallo(client, 11)).toBeNull();
  });

  it("RF_SOSTA_6 · TF-WS-26 · stallo 17 senza soste → null", async () => {
    expect(await sostaAttivaSuStallo(client, 17)).toBeNull();
  });

  // sostaPerTargaSuStallo

  it("RF_OP_4 · TF-WS-27 · più soste di MN234PQ sullo stallo 11 → la più recente, sosta 9", async () => {
    expect((await sostaPerTargaSuStallo(client, "MN234PQ", 11))?.id).toBe(9);
  });

  it("RF_OP_4 · TF-WS-28 · una sosta di CD330PL sullo stallo 6 → sosta 7", async () => {
    expect((await sostaPerTargaSuStallo(client, "CD330PL", 6))?.id).toBe(7);
  });

  it("RF_OP_4 · TF-WS-29 · nessuna sosta di FG482KL sullo stallo 3 → null", async () => {
    expect(await sostaPerTargaSuStallo(client, "FG482KL", 3)).toBeNull();
  });

  // sosteAttiveDiAutomobilista

  it("RF_SOSTA_2 · TF-WS-30 · due soste attive dell'automobilista 11 → stallo 16 poi 17", async () => {
    const prima = await inserisciSosta({
      automobilistaId: 11,
      veicoloId: 6,
      stalloId: 16,
      stato: "ATTIVA",
      orarioDiAvvio: I,
      orarioDiScadenza: I_PIU_1H,
    });
    const seconda = await inserisciSosta({
      automobilistaId: 11,
      veicoloId: 7,
      stalloId: 17,
      stato: "ATTIVA",
      orarioDiAvvio: new Date("2026-11-20T09:30:00+01:00"),
      orarioDiScadenza: new Date("2026-11-20T10:30:00+01:00"),
    });
    const elenco = await sosteAttiveDiAutomobilista(client, 11);
    expect(elenco.map((s) => [s.id, s.stalloId])).toEqual([
      [prima, 16],
      [seconda, 17],
    ]);
  });

  it("RF_SOSTA_2 · TF-WS-31 · automobilista 8 senza soste attive → elenco vuoto", async () => {
    expect(await sosteAttiveDiAutomobilista(client, 8)).toEqual([]);
  });

  // aggiornaScadenza

  it("RF_SOSTA_2 · TF-WS-32 · sosta attiva prolungata alle 11:00 → true, nuova scadenza", async () => {
    const id = await sostaAttiva8Su16();
    const nuovaScadenza = new Date("2026-11-20T11:00:00+01:00");
    expect(await aggiornaScadenza(client, id, nuovaScadenza)).toBe(true);
    expect((await trovaSosta(client, id))?.orarioDiScadenza.getTime()).toBe(
      nuovaScadenza.getTime(),
    );
  });

  it("RF_SOSTA_2 · TF-WS-33 · sosta 2 terminata → false, scadenza invariata", async () => {
    expect(await aggiornaScadenza(client, 2, new Date("2026-11-02T12:42:00+01:00"))).toBe(false);
    expect((await trovaSosta(client, 2))?.orarioDiScadenza.getTime()).toBe(
      new Date("2026-11-02T11:42:00+01:00").getTime(),
    );
  });

  it("RF_SOSTA_2 · TF-WS-34 · sosta inesistente → false", async () => {
    expect(await aggiornaScadenza(client, ID_INESISTENTE, I_PIU_1H)).toBe(false);
  });

  it("SCHEMA · TF-WS-35 · nuova scadenza uguale all'avvio → DURATA_NON_VALIDA", async () => {
    const id = await sostaAttiva8Su16();
    await rifiutato(aggiornaScadenza(client, id, I), "DURATA_NON_VALIDA");
  });

  // sosteDaScadere

  it("RF_SOSTA_7 · TF-WS-36 · scadenza uguale all'istante → [id]", async () => {
    const id = await sostaAttiva8Su16();
    expect(await sosteDaScadere(client, I_PIU_1H)).toEqual([id]);
  });

  it("RF_SOSTA_7 · TF-WS-37 · scadenza successiva all'istante → elenco vuoto", async () => {
    await sostaAttiva8Su16();
    expect(await sosteDaScadere(client, new Date("2026-11-20T09:59:59+01:00"))).toEqual([]);
  });

  it("RF_SOSTA_7 · TF-WS-38 · sole soste terminate → elenco vuoto", async () => {
    expect(await sosteDaScadere(client, new Date("2026-12-31T00:00:00+01:00"))).toEqual([]);
  });

  // impostaSostaScaduta

  it("RF_SOSTA_7 · TF-WS-39 · sosta attiva → true, SCADUTA", async () => {
    const id = await creaSosta8Su16();
    expect(await impostaSostaScaduta(client, id)).toBe(true);
    expect((await trovaSosta(client, id))?.stato).toBe("SCADUTA");
  });

  it("RF_SOSTA_7 · TF-WS-40 · sosta 2 terminata → false, resta TERMINATA", async () => {
    expect(await impostaSostaScaduta(client, 2)).toBe(false);
    expect((await trovaSosta(client, 2))?.stato).toBe("TERMINATA");
  });

  it("RF_SOSTA_7 · TF-WS-41 · sosta inesistente → false", async () => {
    expect(await impostaSostaScaduta(client, ID_INESISTENTE)).toBe(false);
  });

  // terminaSosteScaduteDelloStallo

  it("NRF_LEG_2 · TF-WS-42 · due soste scadute con permesso sullo stallo 15 → 2, TERMINATA senza permesso", async () => {
    const ids = [
      await inserisciSosta({
        automobilistaId: 7,
        veicoloId: 1,
        stalloId: 15,
        stato: "SCADUTA",
        orarioDiAvvio: I,
        orarioDiScadenza: I_PIU_1H,
        dichiarazioneDiPermesso: DICHIARAZIONE,
        fotoDelPermesso: fotoCompleta(),
      }),
      await inserisciSosta({
        automobilistaId: 8,
        veicoloId: 3,
        stalloId: 15,
        stato: "SCADUTA",
        orarioDiAvvio: I,
        orarioDiScadenza: I_PIU_1H,
        dichiarazioneDiPermesso: DICHIARAZIONE,
        fotoDelPermesso: fotoCompleta(),
      }),
    ];
    expect(await terminaSosteScaduteDelloStallo(client, 15)).toBe(2);
    for (const id of ids) {
      expect(await trovaSosta(client, id)).toMatchObject({
        stato: "TERMINATA",
        dichiarazioneDiPermesso: null,
        fotoDelPermesso: null,
      });
    }
  });

  it("NRF_LEG_2 · TF-WS-43 · solo una sosta attiva sul 16 e nessuna sul 17 → 0 e 0, resta ATTIVA", async () => {
    const id = await sostaAttiva8Su16();
    expect(await terminaSosteScaduteDelloStallo(client, 16)).toBe(0);
    expect(await terminaSosteScaduteDelloStallo(client, 17)).toBe(0);
    expect((await trovaSosta(client, id))?.stato).toBe("ATTIVA");
  });
});
