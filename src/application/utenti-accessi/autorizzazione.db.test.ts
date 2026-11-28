import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  aggiornaAusiliario,
  ausiliari,
  creaAusiliario,
  creaAutomobilista,
  creaSessione,
  disattivaAusiliario,
} from "../../persistence/accessoDati/utentiEntiVeicoli";
import {
  chiudiDatabaseDiTest,
  poolDiTest,
  preparaDatabaseDiTest,
} from "../../persistence/test/databaseDiTest";
import { calcolaHashPassword, calcolaHashToken, generaToken } from "./crittografia";
import {
  creaFacadeUtentiAccessi,
  DURATA_SESSIONE_MS,
  ErroreUtentiAccessi,
  type CodiceErroreUtentiAccessi,
  type FacadeUtentiAccessi,
} from "./facade";

// Test frame TF-01…09 di docs/test/cp_verificaAutorizzazione.md (OMP-42).

const ISTANTE = new Date("2026-11-20T09:00:00+01:00");
const PASSWORD = "parola-di-prova-lunga";
const AMMINISTRATORE = 1;
const ENTE_1 = 1;
const ENTE_2 = 2;
const ENTE_3 = 3;

describe("OMP-42 · cp_verificaAutorizzazione", () => {
  let facade: FacadeUtentiAccessi;
  let hashPassword: string;
  let istante: Date;

  beforeAll(async () => {
    await preparaDatabaseDiTest();
    hashPassword = await calcolaHashPassword(PASSWORD);
  });

  afterAll(async () => {
    await chiudiDatabaseDiTest();
  });

  beforeEach(() => {
    istante = ISTANTE;
    facade = creaFacadeUtentiAccessi({ pool: poolDiTest(), orologio: { adesso: () => istante } });
  });

  async function rifiutato(
    operazione: Promise<unknown>,
    codice: CodiceErroreUtentiAccessi,
  ): Promise<void> {
    let ottenuto: unknown;
    try {
      await operazione;
    } catch (errore) {
      ottenuto = errore;
    }
    expect(ottenuto).toBeInstanceOf(ErroreUtentiAccessi);
    expect((ottenuto as ErroreUtentiAccessi).codice).toBe(codice);
  }

  function nuovoAusiliario(email: string, enteId: number): Promise<number> {
    return creaAusiliario(poolDiTest(), {
      email,
      hashPassword,
      nome: "Prova",
      cognome: "Ausiliario",
      enteId,
      amministratoreId: AMMINISTRATORE,
    });
  }

  it("NRF_SIC_1 · TF-01 · Automobilista ammesso, ente non applicabile → autorizzato", async () => {
    const email = "autorizza.tf01@test.example";
    const id = await creaAutomobilista(poolDiTest(), { email, hashPassword });
    const { token } = await facade.accedi(email, PASSWORD);

    await expect(facade.verificaAutorizzazione(token, "UC_WALLET_1", null)).resolves.toEqual({
      utenteId: id,
      ruolo: "AUTOMOBILISTA",
      enteId: null,
    });
  });

  it("NRF_SIC_1 · TF-02 · Ausiliario ammesso sul proprio ente → autorizzato", async () => {
    const email = "autorizza.tf02@test.example";
    const id = await nuovoAusiliario(email, ENTE_1);
    const { token } = await facade.accedi(email, PASSWORD);

    await expect(facade.verificaAutorizzazione(token, "UC_OP_1", ENTE_1)).resolves.toEqual({
      utenteId: id,
      ruolo: "AUSILIARIO_DEL_TRAFFICO",
      enteId: ENTE_1,
    });
  });

  it("NRF_SIC_1 · TF-03 · Ausiliario ammesso su un altro ente → ENTE_NON_AMMESSO", async () => {
    const email = "autorizza.tf03@test.example";
    await nuovoAusiliario(email, ENTE_1);
    const { token } = await facade.accedi(email, PASSWORD);

    await rifiutato(facade.verificaAutorizzazione(token, "UC_OP_1", ENTE_2), "ENTE_NON_AMMESSO");
  });

  it("NRF_SIC_1 · TF-04 · Automobilista non ammesso → RUOLO_NON_AMMESSO", async () => {
    const email = "autorizza.tf04@test.example";
    await creaAutomobilista(poolDiTest(), { email, hashPassword });
    const { token } = await facade.accedi(email, PASSWORD);

    await rifiutato(facade.verificaAutorizzazione(token, "UC_ADM_1", null), "RUOLO_NON_AMMESSO");
  });

  it("NRF_SIC_1 · TF-05 · Amministratore ammesso su qualsiasi ente → autorizzato", async () => {
    const token = generaToken();
    await creaSessione(poolDiTest(), {
      utenteId: AMMINISTRATORE,
      hashToken: calcolaHashToken(token),
      scadenza: new Date(ISTANTE.getTime() + DURATA_SESSIONE_MS),
    });
    const atteso = { utenteId: AMMINISTRATORE, ruolo: "AMMINISTRATORE", enteId: null };

    await expect(facade.verificaAutorizzazione(token, "UC_ADM_1", ENTE_1)).resolves.toEqual(atteso);
    await expect(facade.verificaAutorizzazione(token, "UC_ADM_2", ENTE_2)).resolves.toEqual(atteso);
  });

  it("NRF_SIC_1 · TF-06 · sessione scaduta → SESSIONE_NON_VALIDA", async () => {
    const email = "autorizza.tf06@test.example";
    await creaAutomobilista(poolDiTest(), { email, hashPassword });
    const { token } = await facade.accedi(email, PASSWORD);

    istante = new Date(ISTANTE.getTime() + DURATA_SESSIONE_MS + 1);

    await rifiutato(
      facade.verificaAutorizzazione(token, "UC_WALLET_1", null),
      "SESSIONE_NON_VALIDA",
    );
  });

  it("NRF_SIC_1 · TF-07 · sessione inesistente → SESSIONE_NON_VALIDA", async () => {
    await rifiutato(
      facade.verificaAutorizzazione("token-inesistente", "UC_WALLET_1", null),
      "SESSIONE_NON_VALIDA",
    );
  });

  it("NRF_SIC_1 · TF-08 · ente con Ausiliari → solo gli attivi dell'ente, escluso il disattivato", async () => {
    const attivo = await nuovoAusiliario("autorizza.tf08a@test.example", ENTE_1);
    const disattivato = await nuovoAusiliario("autorizza.tf08b@test.example", ENTE_1);
    await disattivaAusiliario(poolDiTest(), disattivato);
    const altroEnte = await nuovoAusiliario("autorizza.tf08c@test.example", ENTE_2);
    const attesi = (await ausiliari(poolDiTest()))
      .filter((a) => a.enteId === ENTE_1 && a.statoDellAccount === "ATTIVO")
      .map((a) => a.id)
      .sort((a, b) => a - b);

    const elenco = await facade.ausiliariDellEntePreposto(ENTE_1);
    const ottenuti = elenco.map((a) => a.id).sort((a, b) => a - b);

    expect(ottenuti).toEqual(attesi);
    expect(ottenuti).toContain(attivo);
    expect(ottenuti).not.toContain(disattivato);
    expect(ottenuti).not.toContain(altroEnte);
  });

  it("NRF_SIC_1 · TF-09 · ente senza Ausiliari → elenco vuoto", async () => {
    // Nessuna funzione di persistenza crea un ente: l'ente 3 resta senza Ausiliari spostandoli.
    const dellEnte = (await ausiliari(poolDiTest())).filter((a) => a.enteId === ENTE_3);
    for (const ausiliario of dellEnte) {
      await aggiornaAusiliario(poolDiTest(), ausiliario.id, {
        email: ausiliario.email,
        nome: ausiliario.nome,
        cognome: ausiliario.cognome,
        enteId: ENTE_2,
      });
    }
    expect((await ausiliari(poolDiTest())).filter((a) => a.enteId === ENTE_3)).toEqual([]);

    await expect(facade.ausiliariDellEntePreposto(ENTE_3)).resolves.toEqual([]);
  });
});
