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
  chiudiSegnalazione,
  contaSegnalazioniPreseInCarico,
  creaSegnalazioneDaLettura,
  creaSegnalazioneDaVerifica,
  dettaglioSegnalazione,
  esisteSegnalazioneNonChiusa,
  permessiDaVerificare,
  prendiInCarico,
  registraVerifica,
  segnalazioniModificateDopo,
  segnalazioniNonChiuseDellEnte,
  type Esito,
  type EsitoVerifica,
  type Motivo,
  type SegnalazioneMappa,
} from "./segnalazioniVerifiche";

// Test frame TF-SV-01…50 di docs/test/cp_persistenza_segnalazioni_verifiche.md (OMP-34).

const ID_INESISTENTE = 999999;
const ISTANTE_DATASET = new Date("2026-11-15T08:00:00+01:00");
const UN_SECONDO_PRIMA = new Date("2026-11-15T07:59:59+01:00");
const I = new Date("2026-11-20T09:00:00+01:00");
const I_PIU_1H = new Date("2026-11-20T10:00:00+01:00");
const DICHIARAZIONE = "Dichiaro di esporre il permesso previsto per lo stallo";

function fotoCompleta(): Buffer {
  return Buffer.alloc(1024, 0xff);
}

function ids(segnalazioni: SegnalazioneMappa[]): number[] {
  return segnalazioni.map((s) => s.id);
}

describe("OMP-34 · TCS persistenza · segnalazioni, letture delle targhe e verifiche", () => {
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

  async function sostaAttiva(dati: {
    automobilistaId: number;
    veicoloId: number;
    stalloId: number;
    pagamento: "PAGATA" | "GRATUITA";
    conPermesso: boolean;
  }): Promise<number> {
    const risultato = await client.query<{ id: string }>(
      `INSERT INTO sosta (automobilista_id, veicolo_id, stallo_id, stato, orario_di_avvio,
                          orario_di_scadenza, pagamento, dichiarazione_di_permesso, foto_del_permesso)
       VALUES ($1, $2, $3, 'ATTIVA', $4, $5, $6, $7, $8) RETURNING id`,
      [
        dati.automobilistaId,
        dati.veicoloId,
        dati.stalloId,
        I,
        I_PIU_1H,
        dati.pagamento,
        dati.conPermesso ? DICHIARAZIONE : null,
        dati.conPermesso ? fotoCompleta() : null,
      ],
    );
    return Number(risultato.rows[0].id);
  }

  // Sosta ATTIVA (7, 1, 15) con permesso completo, sullo stallo ROSA dell'ente 1.
  function sostaConPermessoSul15(): Promise<number> {
    return sostaAttiva({
      automobilistaId: 7,
      veicoloId: 1,
      stalloId: 15,
      pagamento: "PAGATA",
      conPermesso: true,
    });
  }

  // esisteSegnalazioneNonChiusa

  it("VD_16 · TF-SV-01 · targa con segnalazione APERTA → true", async () => {
    expect(await esisteSegnalazioneNonChiusa(client, "HB204KM")).toBe(true);
  });

  it("VD_16 · TF-SV-02 · targa con segnalazione PRESA_IN_CARICO → true", async () => {
    expect(await esisteSegnalazioneNonChiusa(client, "PB905LX")).toBe(true);
  });

  it("VD_16 · TF-SV-03 · targa con sole segnalazioni chiuse → false", async () => {
    expect(await esisteSegnalazioneNonChiusa(client, "FG482KL")).toBe(false);
  });

  it("VD_16 · TF-SV-04 · targa senza segnalazioni → false", async () => {
    expect(await esisteSegnalazioneNonChiusa(client, "ZZ000ZZ")).toBe(false);
  });

  // creaSegnalazioneDaLettura

  it("RF_ANPR_1 · TF-SV-05 · lettura valida sullo stallo 16 → segnalazione APERTA non assegnata", async () => {
    const id = await creaSegnalazioneDaLettura(client, {
      stalloId: 16,
      targa: "ZZ999ZZ",
      dataEOra: I,
      motivo: "SOSTA_ASSENTE",
    });
    expect(typeof id).toBe("number");
    const dettaglio = await dettaglioSegnalazione(client, id);
    expect(dettaglio).toMatchObject({
      id,
      stato: "APERTA",
      stalloId: 16,
      targaRilevata: "ZZ999ZZ",
      motivo: "SOSTA_ASSENTE",
      ausiliarioId: null,
      assegnatario: null,
    });
    expect(dettaglio?.dataEOraDellaLettura?.getTime()).toBe(I.getTime());
  });

  it("VD_16 · TF-SV-06 · targa con una segnalazione non chiusa → SEGNALAZIONE_NON_CHIUSA_GIA_PRESENTE", async () => {
    await rifiutato(
      creaSegnalazioneDaLettura(client, {
        stalloId: 16,
        targa: "HB204KM",
        dataEOra: I,
        motivo: "SOSTA_ASSENTE",
      }),
      "SEGNALAZIONE_NON_CHIUSA_GIA_PRESENTE",
    );
  });

  it("VD_16 · TF-SV-07 · targa con sole segnalazioni chiuse → nuova segnalazione APERTA", async () => {
    const id = await creaSegnalazioneDaLettura(client, {
      stalloId: 16,
      targa: "FG482KL",
      dataEOra: I,
      motivo: "SOSTA_SCADUTA",
    });
    expect(typeof id).toBe("number");
    expect((await dettaglioSegnalazione(client, id))?.stato).toBe("APERTA");
  });

  it("SCHEMA · TF-SV-08 · stallo inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(
      creaSegnalazioneDaLettura(client, {
        stalloId: ID_INESISTENTE,
        targa: "ZZ999ZZ",
        dataEOra: I,
        motivo: "SOSTA_ASSENTE",
      }),
      "RIFERIMENTO_INESISTENTE",
    );
  });

  it("SCHEMA · TF-SV-09 · targa non normalizzata zz999zz → TARGA_NON_VALIDA", async () => {
    await rifiutato(
      creaSegnalazioneDaLettura(client, {
        stalloId: 16,
        targa: "zz999zz",
        dataEOra: I,
        motivo: "SOSTA_ASSENTE",
      }),
      "TARGA_NON_VALIDA",
    );
  });

  it("SCHEMA · TF-SV-10 · motivo non ammesso ALTRO → DATI_NON_VALIDI", async () => {
    await rifiutato(
      creaSegnalazioneDaLettura(client, {
        stalloId: 16,
        targa: "ZZ999ZZ",
        dataEOra: I,
        motivo: "ALTRO" as unknown as Motivo,
      }),
      "DATI_NON_VALIDI",
    );
  });

  // segnalazioniNonChiuseDellEnte

  it("RF_OP_1 · TF-SV-11 · ente 1 con più segnalazioni non chiuse → 4, 5, 10, 11", async () => {
    const elenco = await segnalazioniNonChiuseDellEnte(client, 1);
    expect(ids(elenco)).toEqual([4, 5, 10, 11]);
    const undici = elenco[3];
    expect(undici).toMatchObject({
      id: 11,
      stalloId: 3,
      numeroStallo: 14,
      latitudine: 40.68976,
      longitudine: 14.52018,
      stato: "APERTA",
      motivo: "SOSTA_ASSENTE",
      targaRilevata: "HB204KM",
      ausiliarioId: null,
    });
    expect(undici.dataEOraDellaLettura?.getTime()).toBe(
      new Date("2026-11-10T10:00:00+01:00").getTime(),
    );
  });

  it("RF_OP_1 · TF-SV-12 · ente 2 con una segnalazione non chiusa → solo la 12", async () => {
    expect(ids(await segnalazioniNonChiuseDellEnte(client, 2))).toEqual([12]);
  });

  it("RF_OP_1 · TF-SV-13 · ente 3 senza segnalazioni → elenco vuoto", async () => {
    expect(await segnalazioniNonChiuseDellEnte(client, 3)).toEqual([]);
  });

  it("RF_OP_1 · TF-SV-14 · ente inesistente → elenco vuoto", async () => {
    expect(await segnalazioniNonChiuseDellEnte(client, ID_INESISTENTE)).toEqual([]);
  });

  // segnalazioniModificateDopo

  it("RF_OP_1 · TF-SV-15 · istante precedente → segnalazioni 1…11, cursore all'istante del dataset", async () => {
    const risultato = await segnalazioniModificateDopo(client, 1, UN_SECONDO_PRIMA);
    expect(ids(risultato.segnalazioni)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(risultato.cursore?.getTime()).toBe(ISTANTE_DATASET.getTime());
  });

  it("RF_OP_1 · TF-SV-16 · istante uguale all'ultima modifica → nessuna segnalazione, cursore null", async () => {
    expect(await segnalazioniModificateDopo(client, 1, ISTANTE_DATASET)).toEqual({
      segnalazioni: [],
      cursore: null,
    });
  });

  it("RF_OP_1 · TF-SV-17 · segnalazione 11 presa in carico dopo l'istante → solo la 11, cursore alla sua ultima modifica", async () => {
    expect(await prendiInCarico(client, 11, 2, I)).toBe(true);
    const risultato = await segnalazioniModificateDopo(client, 1, ISTANTE_DATASET);
    expect(ids(risultato.segnalazioni)).toEqual([11]);
    expect(risultato.segnalazioni[0]).toMatchObject({ stato: "PRESA_IN_CARICO", ausiliarioId: 2 });
    expect(risultato.cursore?.getTime()).toBe(risultato.segnalazioni[0].ultimaModifica.getTime());
  });

  it("RF_OP_1 · TF-SV-18 · segnalazione 5 chiusa dopo l'istante → solo la 5, CHIUSA", async () => {
    expect(await chiudiSegnalazione(client, 5, 2, "NON_CONFERMATA", I)).toBe(true);
    const risultato = await segnalazioniModificateDopo(client, 1, ISTANTE_DATASET);
    expect(ids(risultato.segnalazioni)).toEqual([5]);
    expect(risultato.segnalazioni[0].stato).toBe("CHIUSA");
  });

  // permessiDaVerificare

  it("RF_OP_2 · TF-SV-19 · nessuna sosta attiva → elenco vuoto", async () => {
    expect(await permessiDaVerificare(client, 1)).toEqual([]);
  });

  it("RF_OP_2 · TF-SV-20 · una sosta con permesso e una senza → solo quella sullo stallo 15", async () => {
    const conPermesso = await sostaConPermessoSul15();
    await sostaAttiva({
      automobilistaId: 8,
      veicoloId: 3,
      stalloId: 16,
      pagamento: "PAGATA",
      conPermesso: false,
    });
    expect(await permessiDaVerificare(client, 1)).toEqual([
      {
        sostaId: conPermesso,
        stalloId: 15,
        tipoDiStallo: "ROSA",
        latitudine: 40.68829,
        longitudine: 14.52214,
        targa: "EF456GH",
      },
    ]);
  });

  it("RF_OP_2 · TF-SV-21 · sosta con permesso già verificata → elenco vuoto", async () => {
    const sostaId = await sostaConPermessoSul15();
    await client.query(
      `INSERT INTO verifica_del_permesso (sosta_id, ausiliario_del_traffico_id, esito, data_e_ora)
       VALUES ($1, 3, 'CONFORME', $2)`,
      [sostaId, I],
    );
    expect(await permessiDaVerificare(client, 1)).toEqual([]);
  });

  it("RF_OP_2 · TF-SV-22 · sosta con permesso nell'ente 2 → vuoto per l'ente 1, stallo 24 per l'ente 2", async () => {
    const sostaId = await sostaAttiva({
      automobilistaId: 9,
      veicoloId: 4,
      stalloId: 24,
      pagamento: "GRATUITA",
      conPermesso: true,
    });
    expect(await permessiDaVerificare(client, 1)).toEqual([]);
    const ente2 = await permessiDaVerificare(client, 2);
    expect(ente2).toHaveLength(1);
    expect(ente2[0]).toMatchObject({
      sostaId,
      stalloId: 24,
      tipoDiStallo: "DISABILI",
      targa: "IJ789KL",
    });
  });

  // dettaglioSegnalazione

  it("RF_OP_1 · TF-SV-23 · segnalazione 4 da lettura presa in carico → dettaglio con assegnataria Sara Galli", async () => {
    const dettaglio = await dettaglioSegnalazione(client, 4);
    expect(dettaglio).toMatchObject({
      id: 4,
      stalloId: 7,
      tipoDiStallo: "ORDINARIO_A_PAGAMENTO",
      enteId: 1,
      stato: "PRESA_IN_CARICO",
      motivo: "SOSTA_ASSENTE",
      targaRilevata: "PB905LX",
      assegnatario: { id: 3, nome: "Sara", cognome: "Galli" },
      esito: null,
      dataEOraDellaChiusura: null,
      verificaDelPermessoId: null,
    });
    expect(dettaglio?.dataEOraDellaLettura?.getTime()).toBe(
      new Date("2026-11-04T09:18:00+01:00").getTime(),
    );
    expect(dettaglio?.dataEOraDellaPresaInCarico?.getTime()).toBe(
      new Date("2026-11-04T09:19:00+01:00").getTime(),
    );
  });

  it("RF_OP_5 · TF-SV-24 · segnalazione 6 da verifica → CHIUSA, verifica 2, senza dati di lettura", async () => {
    const dettaglio = await dettaglioSegnalazione(client, 6);
    expect(dettaglio).toMatchObject({
      id: 6,
      stalloId: 2,
      stato: "CHIUSA",
      esito: "SOSTA_IRREGOLARE_ACCERTATA",
      verificaDelPermessoId: 2,
      assegnatario: { id: 2, nome: "Paolo", cognome: "Ferri" },
      motivo: null,
      targaRilevata: null,
      dataEOraDellaLettura: null,
    });
    expect(dettaglio?.dataEOraDellaChiusura?.getTime()).toBe(
      new Date("2026-11-05T11:30:00+01:00").getTime(),
    );
  });

  it("RF_OP_1 · TF-SV-25 · segnalazione inesistente → null", async () => {
    expect(await dettaglioSegnalazione(client, ID_INESISTENTE)).toBeNull();
  });

  // prendiInCarico

  it("RF_OP_3 · TF-SV-26 · segnalazione 11 APERTA → true, PRESA_IN_CARICO dall'ausiliario 2", async () => {
    expect(await prendiInCarico(client, 11, 2, I)).toBe(true);
    const dettaglio = await dettaglioSegnalazione(client, 11);
    expect(dettaglio).toMatchObject({ stato: "PRESA_IN_CARICO", ausiliarioId: 2 });
    expect(dettaglio?.assegnatario?.id).toBe(2);
    expect(dettaglio?.dataEOraDellaPresaInCarico?.getTime()).toBe(I.getTime());
  });

  it("RF_OP_3 · TF-SV-27 · presa in carico di una segnalazione già presa → false, resta a 3", async () => {
    expect(await prendiInCarico(client, 4, 2, I)).toBe(false);
    const dettaglio = await dettaglioSegnalazione(client, 4);
    expect(dettaglio).toMatchObject({ stato: "PRESA_IN_CARICO", ausiliarioId: 3 });
  });

  it("RF_OP_3 · TF-SV-28 · segnalazione CHIUSA → false", async () => {
    expect(await prendiInCarico(client, 1, 2, I)).toBe(false);
  });

  it("RF_OP_3 · TF-SV-29 · segnalazione inesistente → false", async () => {
    expect(await prendiInCarico(client, ID_INESISTENTE, 2, I)).toBe(false);
  });

  it("SCHEMA · TF-SV-30 · ausiliario inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(prendiInCarico(client, 11, ID_INESISTENTE, I), "RIFERIMENTO_INESISTENTE");
  });

  it("SCHEMA · TF-SV-31 · presa in carico prima della lettura → STATO_SEGNALAZIONE_NON_VALIDO", async () => {
    await rifiutato(
      prendiInCarico(client, 11, 2, new Date("2026-11-10T09:00:00+01:00")),
      "STATO_SEGNALAZIONE_NON_VALIDO",
    );
  });

  // chiudiSegnalazione

  it("RF_OP_6 · TF-SV-32 · chiusura diretta della segnalazione 11 APERTA → true, CHIUSA e assegnata a 2", async () => {
    expect(await chiudiSegnalazione(client, 11, 2, "SOSTA_IRREGOLARE_ACCERTATA", I)).toBe(true);
    const dettaglio = await dettaglioSegnalazione(client, 11);
    expect(dettaglio).toMatchObject({
      stato: "CHIUSA",
      ausiliarioId: 2,
      esito: "SOSTA_IRREGOLARE_ACCERTATA",
      dataEOraDellaPresaInCarico: null,
    });
    expect(dettaglio?.assegnatario?.id).toBe(2);
    expect(dettaglio?.dataEOraDellaChiusura?.getTime()).toBe(I.getTime());
  });

  it("RF_OP_6 · TF-SV-33 · chiusura della 4 da parte di chi l'ha presa (3) → true, NON_CONFERMATA", async () => {
    expect(await chiudiSegnalazione(client, 4, 3, "NON_CONFERMATA", I)).toBe(true);
    const dettaglio = await dettaglioSegnalazione(client, 4);
    expect(dettaglio).toMatchObject({
      stato: "CHIUSA",
      esito: "NON_CONFERMATA",
      ausiliarioId: 3,
    });
    expect(dettaglio?.assegnatario?.id).toBe(3);
  });

  it("RF_OP_6 · TF-SV-34 · chiusura della 4 da parte di un altro ausiliario → false, resta presa da 3", async () => {
    expect(await chiudiSegnalazione(client, 4, 2, "NON_CONFERMATA", I)).toBe(false);
    expect(await dettaglioSegnalazione(client, 4)).toMatchObject({
      stato: "PRESA_IN_CARICO",
      ausiliarioId: 3,
    });
  });

  it("RF_OP_6 · TF-SV-35 · segnalazione già CHIUSA → false", async () => {
    expect(await chiudiSegnalazione(client, 1, 2, "NON_CONFERMATA", I)).toBe(false);
  });

  it("RF_OP_6 · TF-SV-36 · segnalazione inesistente → false", async () => {
    expect(await chiudiSegnalazione(client, ID_INESISTENTE, 2, "NON_CONFERMATA", I)).toBe(false);
  });

  it("SCHEMA · TF-SV-37 · esito non ammesso ALTRO → DATI_NON_VALIDI", async () => {
    await rifiutato(
      chiudiSegnalazione(client, 11, 2, "ALTRO" as unknown as Esito, I),
      "DATI_NON_VALIDI",
    );
  });

  // contaSegnalazioniPreseInCarico

  it("VD_19 · TF-SV-38 · ausiliario 3 con più segnalazioni prese in carico → 2", async () => {
    expect(await contaSegnalazioniPreseInCarico(client, 3)).toBe(2);
  });

  it("VD_19 · TF-SV-39 · ausiliario 2 con una segnalazione presa in carico → 1", async () => {
    expect(await contaSegnalazioniPreseInCarico(client, 2)).toBe(1);
  });

  it("VD_19 · TF-SV-40 · ausiliario 4 con sole segnalazioni chiuse → 0", async () => {
    expect(await contaSegnalazioniPreseInCarico(client, 4)).toBe(0);
  });

  it("VD_19 · TF-SV-41 · ausiliario inesistente → 0", async () => {
    expect(await contaSegnalazioniPreseInCarico(client, ID_INESISTENTE)).toBe(0);
  });

  // registraVerifica

  it("RF_OP_5 · TF-SV-42 · sosta senza verifica → verifica CONFORME dell'ausiliario 3 registrata", async () => {
    const sostaId = await sostaConPermessoSul15();
    const id = await registraVerifica(client, {
      sostaId,
      ausiliarioId: 3,
      esito: "CONFORME",
      dataEOra: I,
    });
    expect(typeof id).toBe("number");
    const riga = await client.query<{
      sosta_id: string;
      ausiliario_del_traffico_id: string;
      esito: string;
      data_e_ora: Date;
    }>(
      `SELECT sosta_id, ausiliario_del_traffico_id, esito, data_e_ora
       FROM verifica_del_permesso WHERE id = $1`,
      [id],
    );
    expect(riga.rows).toHaveLength(1);
    expect(Number(riga.rows[0].sosta_id)).toBe(sostaId);
    expect(Number(riga.rows[0].ausiliario_del_traffico_id)).toBe(3);
    expect(riga.rows[0].esito).toBe("CONFORME");
    expect(riga.rows[0].data_e_ora.getTime()).toBe(I.getTime());
  });

  it("VD_12 · TF-SV-43 · seconda verifica della stessa sosta → VERIFICA_GIA_REGISTRATA", async () => {
    const sostaId = await sostaConPermessoSul15();
    await registraVerifica(client, { sostaId, ausiliarioId: 3, esito: "CONFORME", dataEOra: I });
    await rifiutato(
      registraVerifica(client, { sostaId, ausiliarioId: 2, esito: "NON_CONFORME", dataEOra: I }),
      "VERIFICA_GIA_REGISTRATA",
    );
  });

  it("VD_12 · TF-SV-44 · sosta 4 con verifica nel dataset → VERIFICA_GIA_REGISTRATA", async () => {
    await rifiutato(
      registraVerifica(client, { sostaId: 4, ausiliarioId: 2, esito: "NON_CONFORME", dataEOra: I }),
      "VERIFICA_GIA_REGISTRATA",
    );
  });

  it("SCHEMA · TF-SV-45 · sosta inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(
      registraVerifica(client, {
        sostaId: ID_INESISTENTE,
        ausiliarioId: 3,
        esito: "CONFORME",
        dataEOra: I,
      }),
      "RIFERIMENTO_INESISTENTE",
    );
  });

  it("SCHEMA · TF-SV-46 · esito non ammesso DUBBIO → DATI_NON_VALIDI", async () => {
    const sostaId = await sostaConPermessoSul15();
    await rifiutato(
      registraVerifica(client, {
        sostaId,
        ausiliarioId: 3,
        esito: "DUBBIO" as unknown as EsitoVerifica,
        dataEOra: I,
      }),
      "DATI_NON_VALIDI",
    );
  });

  // creaSegnalazioneDaVerifica

  async function verificaNonConformeDi2(): Promise<number> {
    const sostaId = await sostaConPermessoSul15();
    return registraVerifica(client, {
      sostaId,
      ausiliarioId: 2,
      esito: "NON_CONFORME",
      dataEOra: I,
    });
  }

  it("RF_OP_5 · TF-SV-47 · verifica non conforme → segnalazione CHIUSA con SOSTA_IRREGOLARE_ACCERTATA", async () => {
    const verificaId = await verificaNonConformeDi2();
    const id = await creaSegnalazioneDaVerifica(client, {
      verificaId,
      stalloId: 15,
      ausiliarioId: 2,
      dataEOra: I,
    });
    expect(typeof id).toBe("number");
    const dettaglio = await dettaglioSegnalazione(client, id);
    expect(dettaglio).toMatchObject({
      id,
      stalloId: 15,
      stato: "CHIUSA",
      esito: "SOSTA_IRREGOLARE_ACCERTATA",
      ausiliarioId: 2,
      verificaDelPermessoId: verificaId,
      motivo: null,
      targaRilevata: null,
      dataEOraDellaLettura: null,
    });
    expect(dettaglio?.assegnatario?.id).toBe(2);
    expect(dettaglio?.dataEOraDellaChiusura?.getTime()).toBe(I.getTime());
  });

  it("VD_13 · TF-SV-48 · verifica 1 conforme → STATO_SEGNALAZIONE_NON_VALIDO", async () => {
    await rifiutato(
      creaSegnalazioneDaVerifica(client, {
        verificaId: 1,
        stalloId: 15,
        ausiliarioId: 3,
        dataEOra: I,
      }),
      "STATO_SEGNALAZIONE_NON_VALIDO",
    );
  });

  it("SCHEMA · TF-SV-49 · verifica 2 che ha già generato la segnalazione 6 → SEGNALAZIONE_GIA_GENERATA", async () => {
    await rifiutato(
      creaSegnalazioneDaVerifica(client, {
        verificaId: 2,
        stalloId: 2,
        ausiliarioId: 2,
        dataEOra: I,
      }),
      "SEGNALAZIONE_GIA_GENERATA",
    );
  });

  it("VD_13 · TF-SV-50 · ausiliario diverso da chi ha verificato → STATO_SEGNALAZIONE_NON_VALIDO", async () => {
    const verificaId = await verificaNonConformeDi2();
    await rifiutato(
      creaSegnalazioneDaVerifica(client, {
        verificaId,
        stalloId: 15,
        ausiliarioId: 3,
        dataEOra: I,
      }),
      "STATO_SEGNALAZIONE_NON_VALIDO",
    );
  });
});
