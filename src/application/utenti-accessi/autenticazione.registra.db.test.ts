import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  creaAutomobilista,
  targheDelProfilo,
  trovaUtentePerEmail,
} from "../../persistence/accessoDati/utentiEntiVeicoli";
import { trovaWalletDiAutomobilista } from "../../persistence/accessoDati/walletSoste";
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

// Test frame TF-01…09 di docs/test/cp_registraAutomobilista.md (OMP-42).

const ISTANTE = new Date("2026-11-20T09:00:00+01:00");
const PASSWORD = "parola-di-prova-lunga";

type Conteggi = { utenti: number; associazioni: number; wallet: number; sessioni: number };

describe("OMP-42 · cp_registraAutomobilista", () => {
  let facade: FacadeUtentiAccessi;

  beforeAll(async () => {
    await preparaDatabaseDiTest();
  });

  afterAll(async () => {
    await chiudiDatabaseDiTest();
  });

  beforeEach(() => {
    facade = creaFacadeUtentiAccessi({ pool: poolDiTest(), orologio: { adesso: () => ISTANTE } });
  });

  async function conta(tabella: string): Promise<number> {
    const risultato = await poolDiTest().query<{ n: string }>(
      `SELECT count(*) AS n FROM ${tabella}`,
    );
    return Number(risultato.rows[0].n);
  }

  async function conteggi(): Promise<Conteggi> {
    return {
      utenti: await conta("utente"),
      associazioni: await conta("automobilista_veicolo"),
      wallet: await conta("wallet_virtuale"),
      sessioni: await conta("sessione"),
    };
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

  it("RF_AUTH_1 · TF-01 · email nuova, password oltre 8, targa mai registrata → account, targa, wallet a 0 e sessione", async () => {
    const email = "registra.tf01@test.example";

    const sessione = await facade.registraAutomobilista(email, PASSWORD, "ZR101AA");

    expect(sessione.token.length).toBeGreaterThan(0);
    expect(sessione.ruolo).toBe("AUTOMOBILISTA");
    expect(sessione.enteId).toBeNull();
    expect(sessione.scadenza.getTime()).toBe(ISTANTE.getTime() + DURATA_SESSIONE_MS);

    const utente = await trovaUtentePerEmail(poolDiTest(), email);
    expect(utente).toMatchObject({ id: sessione.utenteId, ruolo: "AUTOMOBILISTA" });
    expect(utente?.hashPassword).not.toBe(PASSWORD);

    const targhe = await targheDelProfilo(poolDiTest(), sessione.utenteId);
    expect(targhe.map((t) => t.targa)).toEqual(["ZR101AA"]);

    const wallet = await trovaWalletDiAutomobilista(poolDiTest(), sessione.utenteId);
    expect(wallet?.saldo).toBe(0);

    await expect(
      facade.verificaAutorizzazione(sessione.token, "UC_WALLET_1", null),
    ).resolves.toEqual({ utenteId: sessione.utenteId, ruolo: "AUTOMOBILISTA", enteId: null });
  });

  it("RF_AUTH_1 · TF-02 · password di esattamente 8 caratteri → account creato", async () => {
    const email = "registra.tf02@test.example";

    const sessione = await facade.registraAutomobilista(email, "abcd1234", "ZR102AA");

    const utente = await trovaUtentePerEmail(poolDiTest(), email);
    expect(utente).toMatchObject({ id: sessione.utenteId, ruolo: "AUTOMOBILISTA" });
  });

  it("RF_AUTH_5 · TF-03 · targa con minuscole e spazi → account creato, targa normalizzata", async () => {
    const sessione = await facade.registraAutomobilista(
      "registra.tf03@test.example",
      PASSWORD,
      " zr 103 aa ",
    );

    const targhe = await targheDelProfilo(poolDiTest(), sessione.utenteId);
    expect(targhe.map((t) => t.targa)).toEqual(["ZR103AA"]);
  });

  it("RF_AUTH_5 · TF-04 · targa già di un altro Automobilista → account creato, stesso veicolo nei due profili", async () => {
    const primo = await facade.registraAutomobilista(
      "registra.tf04a@test.example",
      PASSWORD,
      "ZR104AA",
    );

    const secondo = await facade.registraAutomobilista(
      "registra.tf04b@test.example",
      PASSWORD,
      "ZR104AA",
    );

    const targhePrimo = await targheDelProfilo(poolDiTest(), primo.utenteId);
    const targheSecondo = await targheDelProfilo(poolDiTest(), secondo.utenteId);
    expect(secondo.utenteId).not.toBe(primo.utenteId);
    expect(targhePrimo).toHaveLength(1);
    expect(targheSecondo).toEqual(targhePrimo);
  });

  it("RF_AUTH_1 · TF-05 · email già registrata → EMAIL_GIA_REGISTRATA, nessun dato scritto", async () => {
    const email = "registra.tf05@test.example";
    await creaAutomobilista(poolDiTest(), {
      email,
      hashPassword: await calcolaHashPassword(PASSWORD),
    });
    const prima = await conteggi();

    await rifiutato(
      facade.registraAutomobilista(email, PASSWORD, "ZR105AA"),
      "EMAIL_GIA_REGISTRATA",
    );

    expect(await conteggi()).toEqual(prima);
  });

  it("RF_AUTH_1 · TF-06 · email di formato non valido → EMAIL_NON_VALIDA, nessun dato scritto", async () => {
    const prima = await conteggi();

    await rifiutato(
      facade.registraAutomobilista("registra.tf06-senza-chiocciola", PASSWORD, "ZR106AA"),
      "EMAIL_NON_VALIDA",
    );

    expect(await conteggi()).toEqual(prima);
  });

  it("RF_AUTH_1 · TF-07 · password di meno di 8 caratteri → PASSWORD_TROPPO_CORTA, nessun dato scritto", async () => {
    const email = "registra.tf07@test.example";
    const prima = await conteggi();

    await rifiutato(
      facade.registraAutomobilista(email, "abc1234", "ZR107AA"),
      "PASSWORD_TROPPO_CORTA",
    );

    expect(await conteggi()).toEqual(prima);
    expect(await trovaUtentePerEmail(poolDiTest(), email)).toBeNull();
  });

  it("RF_AUTH_1 · TF-08 · targa non valida → TARGA_NON_VALIDA, nessun dato scritto", async () => {
    const email = "registra.tf08@test.example";
    const prima = await conteggi();

    await rifiutato(facade.registraAutomobilista(email, PASSWORD, "ZR10AA"), "TARGA_NON_VALIDA");

    expect(await conteggi()).toEqual(prima);
    expect(await trovaUtentePerEmail(poolDiTest(), email)).toBeNull();
  });

  it("RF_AUTH_1 · TF-09 · scrittura del wallet fallita → errore del database, nessun dato scritto", async () => {
    const email = "registra.tf09@test.example";
    const prima = await conteggi();

    try {
      await poolDiTest().query(`
        CREATE FUNCTION test_tf09_blocca_wallet() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'scrittura del wallet fallita (TF-09)';
        END;
        $$ LANGUAGE plpgsql
      `);
      await poolDiTest().query(`
        CREATE TRIGGER test_tf09_blocca_wallet
        BEFORE INSERT ON wallet_virtuale
        FOR EACH ROW EXECUTE FUNCTION test_tf09_blocca_wallet()
      `);

      await expect(facade.registraAutomobilista(email, PASSWORD, "ZR109AA")).rejects.toThrow();
    } finally {
      await poolDiTest().query("DROP TRIGGER IF EXISTS test_tf09_blocca_wallet ON wallet_virtuale");
      await poolDiTest().query("DROP FUNCTION IF EXISTS test_tf09_blocca_wallet()");
    }

    expect(await conteggi()).toEqual(prima);
    expect(await trovaUtentePerEmail(poolDiTest(), email)).toBeNull();
  });
});
