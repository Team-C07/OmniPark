import { describe, expect, it } from "vitest";
import { ErroreDominio, traduciErrore, type CodiceErrore } from "./errori";

// Test frame TF-BASE-06…24 di docs/test/cp_persistenza_base.md (OMP-34): traduzione degli errori
// con errori di forma pg costruiti nel test, senza database.

function errorePg(campi: Record<string, string>, messaggio = "errore del database"): Error {
  return Object.assign(new Error(messaggio), campi);
}

function verificaCodice(ingresso: unknown, codice: CodiceErrore): ErroreDominio {
  const tradotto = traduciErrore(ingresso);
  expect(tradotto).toBeInstanceOf(ErroreDominio);
  expect(tradotto.codice).toBe(codice);
  return tradotto;
}

describe("OMP-34 · TCS base della persistenza · traduzione per SQLSTATE e connessione", () => {
  it("ISSUE_5 · TF-BASE-06 · 23505 su sosta_pkey con detail → VALORE_DUPLICATO, messaggio senza detail, cause originale", () => {
    const detail = "Key (id)=(424242) already exists.";
    const ingresso = errorePg(
      { code: "23505", constraint: "sosta_pkey", detail },
      'duplicate key value violates unique constraint "sosta_pkey"',
    );
    const tradotto = verificaCodice(ingresso, "VALORE_DUPLICATO");
    expect(tradotto.messaggio).not.toContain(detail);
    expect(tradotto.messaggio).not.toContain("424242");
    expect(tradotto.message).not.toContain(detail);
    expect(tradotto.cause).toBe(ingresso);
  });

  it("ISSUE_5 · TF-BASE-07 · 23503 su sosta_stallo_id_fkey → RIFERIMENTO_INESISTENTE", () => {
    verificaCodice(
      errorePg({ code: "23503", constraint: "sosta_stallo_id_fkey" }),
      "RIFERIMENTO_INESISTENTE",
    );
  });

  it("ISSUE_5 · TF-BASE-08 · 23514 su sosta_stato_ammesso → DATI_NON_VALIDI", () => {
    verificaCodice(
      errorePg({ code: "23514", constraint: "sosta_stato_ammesso" }),
      "DATI_NON_VALIDI",
    );
  });

  it("ISSUE_5 · TF-BASE-09 · 23502 sulla colonna targa → VALORE_MANCANTE", () => {
    verificaCodice(errorePg({ code: "23502", column: "targa" }), "VALORE_MANCANTE");
  });

  it("ISSUE_5 · TF-BASE-10 · 22003 → VALORE_FUORI_INTERVALLO", () => {
    verificaCodice(errorePg({ code: "22003" }), "VALORE_FUORI_INTERVALLO");
  });

  it("ISSUE_5 · TF-BASE-11 · 40001 → CONFLITTO_DI_CONCORRENZA", () => {
    verificaCodice(errorePg({ code: "40001" }), "CONFLITTO_DI_CONCORRENZA");
  });

  it("ISSUE_5 · TF-BASE-12 · 40P01 → CONFLITTO_DI_CONCORRENZA", () => {
    verificaCodice(errorePg({ code: "40P01" }), "CONFLITTO_DI_CONCORRENZA");
  });

  it("ISSUE_5 · TF-BASE-13 · 08006 → DATABASE_NON_RAGGIUNGIBILE", () => {
    verificaCodice(errorePg({ code: "08006" }), "DATABASE_NON_RAGGIUNGIBILE");
  });

  it("ISSUE_5 · TF-BASE-14 · 57P01 → DATABASE_NON_RAGGIUNGIBILE", () => {
    verificaCodice(errorePg({ code: "57P01" }), "DATABASE_NON_RAGGIUNGIBILE");
  });

  it("ISSUE_5 · TF-BASE-15 · P0001 senza where → ERRORE_DATABASE", () => {
    verificaCodice(errorePg({ code: "P0001" }), "ERRORE_DATABASE");
  });

  it("ISSUE_5 · TF-BASE-16 · 42P01 non previsto → ERRORE_DATABASE", () => {
    verificaCodice(errorePg({ code: "42P01" }), "ERRORE_DATABASE");
  });

  it("ISSUE_5 · TF-BASE-17 · ECONNREFUSED → DATABASE_NON_RAGGIUNGIBILE", () => {
    verificaCodice(
      errorePg({ code: "ECONNREFUSED" }, "connect ECONNREFUSED"),
      "DATABASE_NON_RAGGIUNGIBILE",
    );
  });

  it("ISSUE_5 · TF-BASE-18 · ENOTFOUND → DATABASE_NON_RAGGIUNGIBILE", () => {
    verificaCodice(
      errorePg({ code: "ENOTFOUND" }, "getaddrinfo ENOTFOUND"),
      "DATABASE_NON_RAGGIUNGIBILE",
    );
  });

  it("ISSUE_5 · TF-BASE-19 · ETIMEDOUT → DATABASE_NON_RAGGIUNGIBILE", () => {
    verificaCodice(
      errorePg({ code: "ETIMEDOUT" }, "connect ETIMEDOUT"),
      "DATABASE_NON_RAGGIUNGIBILE",
    );
  });

  it("ISSUE_5 · TF-BASE-20 · timeout del pool senza code → DATABASE_NON_RAGGIUNGIBILE", () => {
    verificaCodice(
      new Error("timeout exceeded when trying to connect"),
      "DATABASE_NON_RAGGIUNGIBILE",
    );
  });

  it("ISSUE_5 · TF-BASE-21 · connessione chiusa senza code → DATABASE_NON_RAGGIUNGIBILE", () => {
    verificaCodice(new Error("Connection terminated unexpectedly"), "DATABASE_NON_RAGGIUNGIBILE");
  });

  it("ISSUE_5 · TF-BASE-22 · ErroreDominio SALDO_INSUFFICIENTE → restituito lo stesso oggetto", () => {
    const ingresso = new ErroreDominio("SALDO_INSUFFICIENTE");
    expect(traduciErrore(ingresso)).toBe(ingresso);
  });

  it("ISSUE_5 · TF-BASE-23 · Error generico senza code → ERRORE_DATABASE, cause originale", () => {
    const ingresso = new Error("qualcosa");
    const tradotto = verificaCodice(ingresso, "ERRORE_DATABASE");
    expect(tradotto.cause).toBe(ingresso);
  });

  it("VD_12 · TF-BASE-24 · P0001 con where che nomina impedisci_modifica_verifica() → VERIFICA_GIA_REGISTRATA", () => {
    verificaCodice(
      errorePg({
        code: "P0001",
        where: "PL/pgSQL function impedisci_modifica_verifica() line 3 at RAISE",
      }),
      "VERIFICA_GIA_REGISTRATA",
    );
  });
});
