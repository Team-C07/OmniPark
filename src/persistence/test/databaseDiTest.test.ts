import { describe, expect, it } from "vitest";
import { verificaDatabaseDiTest } from "./databaseDiTest";

// Stringhe di esempio: host e credenziali fittizi.
const SVILUPPO_POOLED =
  "postgresql://utente_prova:segreto_prova@ep-prova-123-pooler.eu-central-1.aws.neon.tech/omnipark?sslmode=verify-full";
const TEST_POOLED =
  "postgresql://utente_prova:segreto_prova@ep-prova-123-pooler.eu-central-1.aws.neon.tech/omnipark_mario_test?sslmode=verify-full";
const TEST_DIRETTO_SU_SVILUPPO =
  "postgresql://utente_prova:segreto_prova@ep-prova-123.eu-central-1.aws.neon.tech/omnipark_test?sslmode=verify-full";

describe("OMP-33 · controlli del database di test", () => {
  it("OMP-33 · DT-01 · DATABASE_URL_TEST mancante → rifiutato", () => {
    const esito = verificaDatabaseDiTest({ DATABASE_URL: SVILUPPO_POOLED });
    expect(esito.consentito).toBe(false);
  });

  it("OMP-33 · DT-02 · nome del database senza suffisso _test → rifiutato", () => {
    const esito = verificaDatabaseDiTest({ DATABASE_URL_TEST: SVILUPPO_POOLED });
    expect(esito.consentito).toBe(false);
  });

  it("OMP-33 · DT-03 · stesso host e database di DATABASE_URL → rifiutato", () => {
    const esito = verificaDatabaseDiTest({
      DATABASE_URL: TEST_POOLED,
      DATABASE_URL_TEST: TEST_POOLED,
    });
    expect(esito.consentito).toBe(false);
  });

  it("OMP-33 · DT-04 · stesso database, uno con host pooled e uno diretto → rifiutato", () => {
    const sviluppoPooledSuTest = TEST_DIRETTO_SU_SVILUPPO.replace(
      "ep-prova-123.",
      "ep-prova-123-pooler.",
    );
    const esito = verificaDatabaseDiTest({
      DATABASE_URL: sviluppoPooledSuTest,
      DATABASE_URL_TEST: TEST_DIRETTO_SU_SVILUPPO,
    });
    expect(esito.consentito).toBe(false);
  });

  it("OMP-33 · DT-05 · database di test valido e diverso da quello di sviluppo → consentito", () => {
    const esito = verificaDatabaseDiTest({
      DATABASE_URL: SVILUPPO_POOLED,
      DATABASE_URL_TEST: TEST_POOLED,
    });
    expect(esito).toEqual({
      consentito: true,
      databaseUrlTest: TEST_POOLED,
      destinazione: {
        host: "ep-prova-123-pooler.eu-central-1.aws.neon.tech",
        database: "omnipark_mario_test",
      },
    });
  });

  it("OMP-33 · DT-06 · DATABASE_URL assente → consentito", () => {
    const esito = verificaDatabaseDiTest({ DATABASE_URL_TEST: TEST_POOLED });
    expect(esito.consentito).toBe(true);
  });

  it("OMP-33 · DT-07 · DATABASE_URL impostata ma non leggibile → rifiutato", () => {
    const esito = verificaDatabaseDiTest({
      DATABASE_URL: "ostgresql://utente_prova:segreto_prova@senza-database",
      DATABASE_URL_TEST: TEST_POOLED,
    });
    expect(esito.consentito).toBe(false);
  });
});
