import { describe, expect, it } from "vitest";
import { descriviDestinazione, verificaResetConsentito } from "./guardiaReset";

describe("OMP-31 · guardia del reset", () => {
  it("OMP-31 · G-01 · OMNIPARK_AMBIENTE assente → reset rifiutato", () => {
    expect(verificaResetConsentito({}).consentito).toBe(false);
  });

  it("OMP-31 · G-02 · OMNIPARK_AMBIENTE=sviluppo → reset consentito", () => {
    expect(verificaResetConsentito({ OMNIPARK_AMBIENTE: "sviluppo" })).toEqual({
      consentito: true,
      ambiente: "sviluppo",
    });
  });

  it("OMP-31 · G-03 · OMNIPARK_AMBIENTE=test → reset consentito", () => {
    expect(verificaResetConsentito({ OMNIPARK_AMBIENTE: "test" })).toEqual({
      consentito: true,
      ambiente: "test",
    });
  });

  it("OMP-31 · G-04 · OMNIPARK_AMBIENTE=produzione → reset rifiutato", () => {
    expect(verificaResetConsentito({ OMNIPARK_AMBIENTE: "produzione" }).consentito).toBe(false);
  });

  it("OMP-31 · G-05 · sviluppo con VERCEL_ENV=preview → reset rifiutato", () => {
    const esito = verificaResetConsentito({ OMNIPARK_AMBIENTE: "sviluppo", VERCEL_ENV: "preview" });
    expect(esito.consentito).toBe(false);
  });

  it("OMP-31 · G-06 · sviluppo con NODE_ENV=production → reset rifiutato", () => {
    const esito = verificaResetConsentito({
      OMNIPARK_AMBIENTE: "sviluppo",
      NODE_ENV: "production",
    });
    expect(esito.consentito).toBe(false);
  });

  it("OMP-31 · G-07 · OMNIPARK_AMBIENTE=Sviluppo (maiuscola) → reset rifiutato", () => {
    expect(verificaResetConsentito({ OMNIPARK_AMBIENTE: "Sviluppo" }).consentito).toBe(false);
  });

  it("OMP-31 · G-08 · OMNIPARK_AMBIENTE vuota → reset rifiutato", () => {
    expect(verificaResetConsentito({ OMNIPARK_AMBIENTE: "" }).consentito).toBe(false);
  });
});

describe("OMP-31 · destinazione del reset", () => {
  it("OMP-31 · D-01 · URL Neon → host e database, senza utente né password", () => {
    const url =
      "postgresql://utente_prova:segreto_prova@ep-prova-pooler.eu-central-1.aws.neon.tech/omnipark?sslmode=verify-full";
    const destinazione = descriviDestinazione(url);

    expect(destinazione).toEqual({
      host: "ep-prova-pooler.eu-central-1.aws.neon.tech",
      database: "omnipark",
    });
    expect(JSON.stringify(destinazione)).not.toMatch(/utente_prova|segreto_prova/);
  });

  it("OMP-31 · D-02 · URL non valido → errore che non contiene la stringa", () => {
    const url = "utente_prova:segreto_prova@senza-protocollo";
    expect(() => descriviDestinazione(url)).toThrow();
    try {
      descriviDestinazione(url);
    } catch (errore) {
      expect((errore as Error).message).not.toContain("segreto_prova");
    }
  });
});
