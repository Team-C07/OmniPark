import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  associaVeicolo,
  creaAutomobilista,
  targheDelProfilo,
  trovaOCreaVeicolo,
} from "../../persistence/accessoDati/utentiEntiVeicoli";
import { creaSosta } from "../../persistence/accessoDati/walletSoste";
import {
  chiudiDatabaseDiTest,
  poolDiTest,
  preparaDatabaseDiTest,
} from "../../persistence/test/databaseDiTest";
import { calcolaHashPassword } from "./crittografia";
import {
  creaFacadeUtentiAccessi,
  ErroreUtentiAccessi,
  type CodiceErroreUtentiAccessi,
  type FacadeUtentiAccessi,
} from "./facade";

// Test frame TF-01…09 di docs/test/cp_targhe.md (OMP-42).

const ISTANTE = new Date("2026-11-20T09:00:00+01:00");
const UN_ORA_DOPO = new Date("2026-11-20T10:00:00+01:00");
const STALLO = 16;

describe("OMP-42 · cp_targhe", () => {
  let facade: FacadeUtentiAccessi;
  let hashPassword: string;

  beforeAll(async () => {
    await preparaDatabaseDiTest();
    hashPassword = await calcolaHashPassword("parola-di-prova-lunga");
  });

  afterAll(async () => {
    await chiudiDatabaseDiTest();
  });

  beforeEach(() => {
    facade = creaFacadeUtentiAccessi({ pool: poolDiTest(), orologio: { adesso: () => ISTANTE } });
  });

  async function creaProfilo(email: string, targhe: string[]): Promise<number> {
    const id = await creaAutomobilista(poolDiTest(), { email, hashPassword });
    for (const targa of targhe) {
      await associaVeicolo(poolDiTest(), id, await trovaOCreaVeicolo(poolDiTest(), targa));
    }
    return id;
  }

  async function targhe(automobilista: number): Promise<string[]> {
    const profilo = await targheDelProfilo(poolDiTest(), automobilista);
    return profilo.map((t) => t.targa);
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

  it("RF_AUTH_5 · TF-01 · aggiungiTarga mai registrata → targa aggiunta al profilo", async () => {
    const id = await creaProfilo("targhe.tf01@test.example", ["ZT101AA"]);

    await facade.aggiungiTarga(id, "ZT101AB");

    expect(await targhe(id)).toEqual(["ZT101AA", "ZT101AB"]);
  });

  it("RF_AUTH_5 · TF-02 · aggiungiTarga con minuscole e spazi → targa aggiunta normalizzata", async () => {
    const id = await creaProfilo("targhe.tf02@test.example", ["ZT102AA"]);

    await facade.aggiungiTarga(id, " zt 102 ab ");

    expect(await targhe(id)).toEqual(["ZT102AA", "ZT102AB"]);
  });

  it("RF_AUTH_5 · TF-03 · aggiungiTarga di un altro Automobilista → aggiunta, il veicolo resta nell'altro profilo", async () => {
    const altro = await creaProfilo("targhe.tf03a@test.example", ["ZT103AC"]);
    const id = await creaProfilo("targhe.tf03b@test.example", ["ZT103AA"]);

    await facade.aggiungiTarga(id, "ZT103AC");

    expect(await targhe(id)).toEqual(["ZT103AA", "ZT103AC"]);
    expect(await targhe(altro)).toEqual(["ZT103AC"]);
    const profiloAltro = await targheDelProfilo(poolDiTest(), altro);
    const profilo = await targheDelProfilo(poolDiTest(), id);
    expect(profilo.find((t) => t.targa === "ZT103AC")?.veicoloId).toBe(profiloAltro[0].veicoloId);
  });

  it("RF_AUTH_5 · TF-04 · aggiungiTarga già nel proprio profilo → TARGA_GIA_PRESENTE, profilo invariato", async () => {
    const id = await creaProfilo("targhe.tf04@test.example", ["ZT104AA"]);

    await rifiutato(facade.aggiungiTarga(id, "ZT104AA"), "TARGA_GIA_PRESENTE");

    expect(await targhe(id)).toEqual(["ZT104AA"]);
  });

  it("RF_AUTH_5 · TF-05 · aggiungiTarga non valida → TARGA_NON_VALIDA, profilo invariato", async () => {
    const id = await creaProfilo("targhe.tf05@test.example", ["ZT105AA"]);

    await rifiutato(facade.aggiungiTarga(id, "ZT10AB"), "TARGA_NON_VALIDA");

    expect(await targhe(id)).toEqual(["ZT105AA"]);
  });

  it("RF_AUTH_5 · TF-06 · rimuoviTarga presente e non unica → tolta dal profilo, il veicolo resta nel database", async () => {
    const id = await creaProfilo("targhe.tf06@test.example", ["ZT106AA", "ZT106AB"]);
    const profilo = await targheDelProfilo(poolDiTest(), id);
    const veicoloRimosso = profilo.find((t) => t.targa === "ZT106AB")?.veicoloId;

    await facade.rimuoviTarga(id, "ZT106AB");

    expect(await targhe(id)).toEqual(["ZT106AA"]);
    expect(await trovaOCreaVeicolo(poolDiTest(), "ZT106AB")).toBe(veicoloRimosso);
  });

  it("RF_AUTH_5 · TF-07 · rimuoviTarga unica del profilo → ULTIMA_TARGA, profilo invariato", async () => {
    const id = await creaProfilo("targhe.tf07@test.example", ["ZT107AA"]);

    await rifiutato(facade.rimuoviTarga(id, "ZT107AA"), "ULTIMA_TARGA");

    expect(await targhe(id)).toEqual(["ZT107AA"]);
  });

  it("RF_AUTH_5 · TF-08 · rimuoviTarga non presente → TARGA_NON_PRESENTE, profilo invariato", async () => {
    const id = await creaProfilo("targhe.tf08@test.example", ["ZT108AA", "ZT108AB"]);

    await rifiutato(facade.rimuoviTarga(id, "ZT108AC"), "TARGA_NON_PRESENTE");

    expect(await targhe(id)).toEqual(["ZT108AA", "ZT108AB"]);
  });

  it("RF_AUTH_5 · TF-09 · rimuoviTarga con sosta Attiva avviata da un altro Automobilista → TARGA_CON_SOSTA_ATTIVA, profilo invariato", async () => {
    const id = await creaProfilo("targhe.tf09a@test.example", ["ZT109AA", "ZT109AB"]);
    const altro = await creaProfilo("targhe.tf09b@test.example", ["ZT109AB"]);
    await creaSosta(poolDiTest(), {
      automobilistaId: altro,
      veicoloId: await trovaOCreaVeicolo(poolDiTest(), "ZT109AB"),
      stalloId: STALLO,
      orarioDiAvvio: ISTANTE,
      orarioDiScadenza: UN_ORA_DOPO,
      pagamento: "PAGATA",
    });

    await rifiutato(facade.rimuoviTarga(id, "ZT109AB"), "TARGA_CON_SOSTA_ATTIVA");

    expect(await targhe(id)).toEqual(["ZT109AA", "ZT109AB"]);
  });
});
