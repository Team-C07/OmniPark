import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  creaAusiliario,
  creaAutomobilista,
  disattivaAusiliario,
} from "../../persistence/accessoDati/utentiEntiVeicoli";
import {
  chiudiDatabaseDiTest,
  poolDiTest,
  preparaDatabaseDiTest,
} from "../../persistence/test/databaseDiTest";
import { calcolaHashPassword } from "./crittografia";
import {
  creaFacadeUtentiAccessi,
  DURATA_SESSIONE_MS,
  ErroreUtentiAccessi,
  type CodiceErroreUtentiAccessi,
  type FacadeUtentiAccessi,
} from "./facade";

// Test frame TF-01…08 di docs/test/cp_accedi.md (OMP-42).

const ISTANTE = new Date("2026-11-20T09:00:00+01:00");
const PASSWORD = "parola-di-prova-lunga";
const ENTE = 1;
const AMMINISTRATORE = 1;

describe("OMP-42 · cp_accedi", () => {
  let facade: FacadeUtentiAccessi;
  let hashPassword: string;

  beforeAll(async () => {
    await preparaDatabaseDiTest();
    hashPassword = await calcolaHashPassword(PASSWORD);
  });

  afterAll(async () => {
    await chiudiDatabaseDiTest();
  });

  beforeEach(() => {
    facade = creaFacadeUtentiAccessi({ pool: poolDiTest(), orologio: { adesso: () => ISTANTE } });
  });

  async function contaSessioni(): Promise<number> {
    const risultato = await poolDiTest().query<{ n: string }>("SELECT count(*) AS n FROM sessione");
    return Number(risultato.rows[0].n);
  }

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

  function nuovoAusiliario(email: string): Promise<number> {
    return creaAusiliario(poolDiTest(), {
      email,
      hashPassword,
      nome: "Prova",
      cognome: "Ausiliario",
      enteId: ENTE,
      amministratoreId: AMMINISTRATORE,
    });
  }

  it("RF_AUTH_4 · TF-01 · Automobilista con password corretta → sessione aperta AUTOMOBILISTA", async () => {
    const email = "accedi.tf01@test.example";
    const id = await creaAutomobilista(poolDiTest(), { email, hashPassword });

    const sessione = await facade.accedi(email, PASSWORD);

    expect(sessione).toMatchObject({ utenteId: id, ruolo: "AUTOMOBILISTA", enteId: null });
    await expect(
      facade.verificaAutorizzazione(sessione.token, "UC_WALLET_1", null),
    ).resolves.toMatchObject({ utenteId: id });
  });

  it("RF_AUTH_4 · TF-02 · Ausiliario attivo con password corretta → sessione AUSILIARIO_DEL_TRAFFICO con il suo ente", async () => {
    const email = "accedi.tf02@test.example";
    const id = await nuovoAusiliario(email);

    const sessione = await facade.accedi(email, PASSWORD);

    expect(sessione).toMatchObject({
      utenteId: id,
      ruolo: "AUSILIARIO_DEL_TRAFFICO",
      enteId: ENTE,
    });
    await expect(
      facade.verificaAutorizzazione(sessione.token, "UC_OP_1", ENTE),
    ).resolves.toMatchObject({ utenteId: id });
  });

  it("RF_AUTH_4 · TF-03 · Amministratore con password corretta → sessione AMMINISTRATORE", async () => {
    const passwordAmministratore = "amministratore-fittizio-tf03";
    await poolDiTest().query("UPDATE utente SET hash_password = $1 WHERE id = 1", [
      await calcolaHashPassword(passwordAmministratore),
    ]);
    const { rows } = await poolDiTest().query<{ email: string }>(
      "SELECT email FROM utente WHERE id = 1",
    );

    const sessione = await facade.accedi(rows[0].email, passwordAmministratore);

    expect(sessione).toMatchObject({
      utenteId: AMMINISTRATORE,
      ruolo: "AMMINISTRATORE",
      enteId: null,
    });
    expect(sessione.token.length).toBeGreaterThan(0);
    expect(sessione.scadenza.getTime()).toBe(ISTANTE.getTime() + DURATA_SESSIONE_MS);
    await expect(facade.verificaAutorizzazione(sessione.token, "UC_ADM_1", ENTE)).resolves.toEqual({
      utenteId: AMMINISTRATORE,
      ruolo: "AMMINISTRATORE",
      enteId: null,
    });
  });

  it("RF_AUTH_4 · TF-04 · Automobilista con password errata → CREDENZIALI_NON_VALIDE, nessuna sessione", async () => {
    const email = "accedi.tf04@test.example";
    await creaAutomobilista(poolDiTest(), { email, hashPassword });
    const prima = await contaSessioni();

    await rifiutato(facade.accedi(email, "parola-sbagliata"), "CREDENZIALI_NON_VALIDE");

    expect(await contaSessioni()).toBe(prima);
  });

  it("RF_AUTH_4 · TF-05 · account inesistente → CREDENZIALI_NON_VALIDE, nessuna sessione", async () => {
    const prima = await contaSessioni();

    await rifiutato(
      facade.accedi("accedi.tf05.inesistente@test.example", PASSWORD),
      "CREDENZIALI_NON_VALIDE",
    );

    expect(await contaSessioni()).toBe(prima);
  });

  it("RF_AUTH_4 · TF-06 · Ausiliario disattivato con password corretta → ACCOUNT_DISATTIVATO, nessuna sessione", async () => {
    const email = "accedi.tf06@test.example";
    const id = await nuovoAusiliario(email);
    await disattivaAusiliario(poolDiTest(), id);
    const prima = await contaSessioni();

    await rifiutato(facade.accedi(email, PASSWORD), "ACCOUNT_DISATTIVATO");

    expect(await contaSessioni()).toBe(prima);
  });

  it("RF_AUTH_4 · TF-07 · esci con sessione valida → sessione chiusa, poi SESSIONE_NON_VALIDA", async () => {
    const email = "accedi.tf07@test.example";
    await creaAutomobilista(poolDiTest(), { email, hashPassword });
    const sessione = await facade.accedi(email, PASSWORD);

    await facade.esci(sessione.token);

    await rifiutato(
      facade.verificaAutorizzazione(sessione.token, "UC_WALLET_1", null),
      "SESSIONE_NON_VALIDA",
    );
  });

  it("RF_AUTH_4 · TF-08 · esci con sessione inesistente o già chiusa → nessun errore, nessun effetto", async () => {
    const email = "accedi.tf08@test.example";
    const id = await creaAutomobilista(poolDiTest(), { email, hashPassword });
    const chiusa = await facade.accedi(email, PASSWORD);
    await facade.esci(chiusa.token);
    const aperta = await facade.accedi(email, PASSWORD);
    const prima = await contaSessioni();

    await expect(facade.esci("token-inesistente")).resolves.toBeUndefined();
    await expect(facade.esci(chiusa.token)).resolves.toBeUndefined();

    expect(await contaSessioni()).toBe(prima);
    await expect(
      facade.verificaAutorizzazione(aperta.token, "UC_WALLET_1", null),
    ).resolves.toMatchObject({ utenteId: id });
  });
});
