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
  impostaStatoStallo,
  preferiti,
  registraRilevazione,
  salvaAreaPreferita,
  salvaStalloPreferito,
  stalliModificatiDopo,
  stalliNellaZona,
  stalliSenzaRilevazioniDa,
  trovaStallo,
  type StalloMappa,
  type Zona,
} from "./stalliTariffe";

// Test frame TF-STA-01…31 di docs/test/cp_persistenza_stalli_tariffe.md (OMP-34).

const ID_INESISTENTE = 999999;
const ISTANTE_DATASET = new Date("2026-11-15T08:00:00+01:00");
const UN_SECONDO_PRIMA = new Date("2026-11-15T07:59:59+01:00");
const UN_MINUTO_DOPO = new Date("2026-11-15T08:01:00+01:00");
const ISTANTE_DI_PROVA = new Date("2026-11-20T09:00:00+01:00");

const PIAZZA_AUBRY: Zona = { latMin: 40.688, latMax: 40.689, lonMin: 14.522, lonMax: 14.5223 };
const STALLO_13_ESATTO: Zona = {
  latMin: 40.69149,
  latMax: 40.69149,
  lonMin: 14.51616,
  lonMax: 14.51616,
};
const MARE: Zona = { latMin: 40.0, latMax: 40.1, lonMin: 14.0, lonMax: 14.1 };

const STALLI_AUBRY = [14, 15, 16, 17, 18, 19, 20, 21];

function ids(stalli: StalloMappa[]): number[] {
  return stalli.map((s) => s.id);
}

function daUnoATrentaTranne(...esclusi: number[]): number[] {
  return Array.from({ length: 30 }, (_, i) => i + 1).filter((id) => !esclusi.includes(id));
}

describe("OMP-34 · TCS persistenza · stalli, tariffe e rilevazioni", () => {
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

  // stalliNellaZona

  it("RF_STALLI_1 · TF-STA-01 · zona Piazza Aubry → stalli 14…21 in ordine, il 14 DISABILI LIBERO", async () => {
    const stalli = await stalliNellaZona(client, PIAZZA_AUBRY);
    expect(ids(stalli)).toEqual(STALLI_AUBRY);
    expect(stalli[0]).toMatchObject({
      id: 14,
      tipoDiStallo: "DISABILI",
      stato: "LIBERO",
      latitudine: 40.68824,
      longitudine: 14.52214,
    });
  });

  it("RF_STALLI_1 · TF-STA-02 · zona ridotta alle coordinate dello stallo 13 → solo lo stallo 13", async () => {
    expect(ids(await stalliNellaZona(client, STALLO_13_ESATTO))).toEqual([13]);
  });

  it("RF_STALLI_1 · TF-STA-03 · zona senza stalli → elenco vuoto", async () => {
    expect(await stalliNellaZona(client, MARE)).toEqual([]);
  });

  // stalliModificatiDopo

  it("NRF_PER_3 · TF-STA-04 · istante precedente alle modifiche → stalli 14…21, cursore all'istante del dataset", async () => {
    const risultato = await stalliModificatiDopo(client, PIAZZA_AUBRY, UN_SECONDO_PRIMA);
    expect(ids(risultato.stalli)).toEqual(STALLI_AUBRY);
    expect(risultato.cursore?.getTime()).toBe(ISTANTE_DATASET.getTime());
  });

  it("NRF_PER_3 · TF-STA-05 · istante uguale all'ultima modifica → nessuno stallo, cursore null", async () => {
    expect(await stalliModificatiDopo(client, PIAZZA_AUBRY, ISTANTE_DATASET)).toEqual({
      stalli: [],
      cursore: null,
    });
  });

  it("NRF_PER_3 · TF-STA-06 · stallo 16 modificato dopo l'istante → solo il 16 NON_DISPONIBILE, cursore alla sua ultima modifica", async () => {
    expect(await impostaStatoStallo(client, 16, "NON_DISPONIBILE")).toBe(true);
    const risultato = await stalliModificatiDopo(client, PIAZZA_AUBRY, ISTANTE_DATASET);
    expect(ids(risultato.stalli)).toEqual([16]);
    expect(risultato.stalli[0].stato).toBe("NON_DISPONIBILE");
    expect(risultato.cursore).not.toBeNull();
    expect(risultato.cursore?.getTime()).toBe(risultato.stalli[0].ultimaModifica.getTime());
    expect(risultato.cursore!.getTime()).toBeGreaterThan(ISTANTE_DATASET.getTime());
  });

  // trovaStallo

  it("RF_STALLI_2 · TF-STA-07 · stallo 14 rilevato → dettaglio con area, ente e tariffa 1", async () => {
    const stallo = await trovaStallo(client, 14);
    expect(stallo).toMatchObject({
      id: 14,
      numero: 1,
      tipoDiStallo: "DISABILI",
      stato: "LIBERO",
      occupazioneRilevata: "NESSUN_VEICOLO",
      areaDiSosta: { id: 5, nome: "Piazza Aubry" },
      enteId: 1,
      tariffa: {
        id: 1,
        costoOrario: 150,
        orarioInizioVigenza: "08:00:00",
        orarioFineVigenza: "20:00:00",
        durataMassima: 180,
      },
    });
    expect(stallo?.dataEOraUltimaRilevazione?.getTime()).toBe(ISTANTE_DATASET.getTime());
  });

  it("RF_STALLI_2 · TF-STA-08 · stallo 25 mai rilevato → SCONOSCIUTO senza rilevazione, ente 2", async () => {
    expect(await trovaStallo(client, 25)).toMatchObject({
      id: 25,
      stato: "SCONOSCIUTO",
      occupazioneRilevata: null,
      dataEOraUltimaRilevazione: null,
      enteId: 2,
    });
  });

  it("RF_STALLI_2 · TF-STA-09 · stallo inesistente → null", async () => {
    expect(await trovaStallo(client, ID_INESISTENTE)).toBeNull();
  });

  // registraRilevazione

  it("RF_IOT_1 · TF-STA-10 · rilevazione coerente VEICOLO_PRESENTE sullo stallo 16 → true, OCCUPATO", async () => {
    expect(
      await registraRilevazione(client, 16, {
        occupazioneRilevata: "VEICOLO_PRESENTE",
        dataEOra: ISTANTE_DI_PROVA,
        stato: "OCCUPATO",
      }),
    ).toBe(true);
    const stallo = await trovaStallo(client, 16);
    expect(stallo).toMatchObject({ stato: "OCCUPATO", occupazioneRilevata: "VEICOLO_PRESENTE" });
    expect(stallo?.dataEOraUltimaRilevazione?.getTime()).toBe(ISTANTE_DI_PROVA.getTime());
  });

  it("VD_20 · TF-STA-11 · rilevazione incoerente con lo stato → STATO_STALLO_NON_VALIDO", async () => {
    await rifiutato(
      registraRilevazione(client, 16, {
        occupazioneRilevata: "VEICOLO_PRESENTE",
        dataEOra: ISTANTE_DI_PROVA,
        stato: "LIBERO",
      }),
      "STATO_STALLO_NON_VALIDO",
    );
  });

  it("VD_20 · TF-STA-12 · rilevazione NESSUN_VEICOLO con stallo NON_DISPONIBILE → true", async () => {
    expect(
      await registraRilevazione(client, 17, {
        occupazioneRilevata: "NESSUN_VEICOLO",
        dataEOra: ISTANTE_DI_PROVA,
        stato: "NON_DISPONIBILE",
      }),
    ).toBe(true);
    expect(await trovaStallo(client, 17)).toMatchObject({
      stato: "NON_DISPONIBILE",
      occupazioneRilevata: "NESSUN_VEICOLO",
    });
  });

  it("RF_IOT_1 · TF-STA-13 · stallo inesistente → false", async () => {
    expect(
      await registraRilevazione(client, ID_INESISTENTE, {
        occupazioneRilevata: "NESSUN_VEICOLO",
        dataEOra: ISTANTE_DI_PROVA,
        stato: "LIBERO",
      }),
    ).toBe(false);
  });

  // impostaStatoStallo

  it("RF_SOSTA_6 · TF-STA-14 · stallo 17 portato a NON_DISPONIBILE → true", async () => {
    expect(await impostaStatoStallo(client, 17, "NON_DISPONIBILE")).toBe(true);
    expect((await trovaStallo(client, 17))?.stato).toBe("NON_DISPONIBILE");
  });

  it("VD_20 · TF-STA-15 · stallo 16 con NESSUN_VEICOLO portato a OCCUPATO → STATO_STALLO_NON_VALIDO", async () => {
    await rifiutato(impostaStatoStallo(client, 16, "OCCUPATO"), "STATO_STALLO_NON_VALIDO");
  });

  it("VD_20 · TF-STA-16 · stallo 25 mai rilevato portato a LIBERO → STATO_STALLO_NON_VALIDO", async () => {
    await rifiutato(impostaStatoStallo(client, 25, "LIBERO"), "STATO_STALLO_NON_VALIDO");
  });

  it("RF_IOT_2 · TF-STA-17 · stallo inesistente → false", async () => {
    expect(await impostaStatoStallo(client, ID_INESISTENTE, "SCONOSCIUTO")).toBe(false);
  });

  // stalliSenzaRilevazioniDa

  it("RF_IOT_2 · TF-STA-18 · limite uguale all'ultima rilevazione → nessuno stallo", async () => {
    expect(await stalliSenzaRilevazioniDa(client, ISTANTE_DATASET)).toEqual([]);
  });

  it("RF_IOT_2 · TF-STA-19 · limite successivo all'ultima rilevazione → 28 stalli tranne 13 e 25", async () => {
    expect(await stalliSenzaRilevazioniDa(client, UN_MINUTO_DOPO)).toEqual(
      daUnoATrentaTranne(13, 25),
    );
  });

  it("RF_SOSTA_6 · TF-STA-20 · stallo 17 NON_DISPONIBILE escluso → 27 stalli", async () => {
    expect(await impostaStatoStallo(client, 17, "NON_DISPONIBILE")).toBe(true);
    expect(await stalliSenzaRilevazioniDa(client, UN_MINUTO_DOPO)).toEqual(
      daUnoATrentaTranne(13, 17, 25),
    );
  });

  // salvaStalloPreferito

  it("RF_STALLI_3 · TF-STA-21 · nuovo stallo preferito (10, 16) → preferiti(10).stalli è solo il 16", async () => {
    await salvaStalloPreferito(client, 10, 16);
    expect(ids((await preferiti(client, 10)).stalli)).toEqual([16]);
  });

  it("RF_STALLI_3 · TF-STA-22 · stallo già tra i preferiti → GIA_TRA_I_PREFERITI", async () => {
    await rifiutato(salvaStalloPreferito(client, 8, 11), "GIA_TRA_I_PREFERITI");
  });

  it("SCHEMA · TF-STA-23 · stallo inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(salvaStalloPreferito(client, 8, ID_INESISTENTE), "RIFERIMENTO_INESISTENTE");
  });

  // salvaAreaPreferita

  it("RF_STALLI_3 · TF-STA-24 · nuova area preferita (8, 5) → preferiti(8).aree con l'area 5 e gli stalli 14…21", async () => {
    await salvaAreaPreferita(client, 8, 5);
    const aree = (await preferiti(client, 8)).aree;
    const area = aree.find((a) => a.id === 5);
    expect(area).toBeDefined();
    expect(area?.nome).toBe("Piazza Aubry");
    expect(ids(area!.stalli)).toEqual(STALLI_AUBRY);
  });

  it("RF_STALLI_3 · TF-STA-25 · area già tra i preferiti → GIA_TRA_I_PREFERITI", async () => {
    await rifiutato(salvaAreaPreferita(client, 10, 5), "GIA_TRA_I_PREFERITI");
  });

  it("SCHEMA · TF-STA-26 · area inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(salvaAreaPreferita(client, 8, ID_INESISTENTE), "RIFERIMENTO_INESISTENTE");
  });

  // preferiti

  it("RF_STALLI_5 · TF-STA-27 · solo stalli preferiti → stallo 11, nessuna area", async () => {
    const risultato = await preferiti(client, 8);
    expect(ids(risultato.stalli)).toEqual([11]);
    expect(risultato.aree).toEqual([]);
  });

  it("RF_STALLI_5 · TF-STA-28 · solo aree preferite → Piazza Aubry con 14…21, liberi 14 e 16", async () => {
    const risultato = await preferiti(client, 10);
    expect(risultato.stalli).toEqual([]);
    expect(risultato.aree.map((a) => ({ id: a.id, nome: a.nome }))).toEqual([
      { id: 5, nome: "Piazza Aubry" },
    ]);
    const stalli = risultato.aree[0].stalli;
    expect(ids(stalli)).toEqual(STALLI_AUBRY);
    expect(stalli.filter((s) => s.stato === "LIBERO").map((s) => s.id)).toEqual([14, 16]);
  });

  it("RF_STALLI_5 · TF-STA-29 · nessun preferito → stalli e aree vuoti", async () => {
    expect(await preferiti(client, 9)).toEqual({ stalli: [], aree: [] });
  });

  it("RF_STALLI_5 · TF-STA-30 · più stalli preferiti → 11 e 16 in ordine", async () => {
    await salvaStalloPreferito(client, 8, 16);
    expect(ids((await preferiti(client, 8)).stalli)).toEqual([11, 16]);
  });

  it("VD_1 · TF-STA-31 · preferito per un ausiliario (utente 2) → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(salvaStalloPreferito(client, 2, 16), "RIFERIMENTO_INESISTENTE");
  });

  it("RF_STALLI_5 · TF-STA-32 · area preferita senza stalli → preferiti(9) con l'area e stalli vuoti", async () => {
    const area = await client.query<{ id: string }>(
      `INSERT INTO area_di_sosta (ente_preposto_id, nome)
       VALUES (1, 'Area di prova senza stalli') RETURNING id`,
    );
    const areaId = Number(area.rows[0].id);
    await client.query(
      "INSERT INTO area_di_sosta_preferita (automobilista_id, area_di_sosta_id) VALUES (9, $1)",
      [areaId],
    );
    expect(await preferiti(client, 9)).toEqual({
      stalli: [],
      aree: [{ id: areaId, nome: "Area di prova senza stalli", stalli: [] }],
    });
  });
});
