import { describe, expect, it } from "vitest";
import { ErroreMigrazione } from "../migrazioni";
import { INDICAZIONE_RIPRISTINO_ANTEPRIMA, indicazionePerAnteprima } from "./messaggi";

const ANTEPRIMA = { VERCEL_ENV: "preview" };

describe("OMP-41 · indicazione di ripristino del branch preview", () => {
  it("OMP-41 · AP-01 · anteprima, MIGRAZIONE_SCONOSCIUTA → indicazione", () => {
    const errore = new ErroreMigrazione("MIGRAZIONE_SCONOSCIUTA", "prova");
    expect(indicazionePerAnteprima(errore, ANTEPRIMA)).toBe(INDICAZIONE_RIPRISTINO_ANTEPRIMA);
  });

  it("OMP-41 · AP-02 · anteprima, MIGRAZIONE_FUORI_ORDINE → indicazione", () => {
    const errore = new ErroreMigrazione("MIGRAZIONE_FUORI_ORDINE", "prova");
    expect(indicazionePerAnteprima(errore, ANTEPRIMA)).toBe(INDICAZIONE_RIPRISTINO_ANTEPRIMA);
  });

  it("OMP-41 · AP-03 · anteprima, CHECKSUM_DIVERSO → indicazione", () => {
    const errore = new ErroreMigrazione("CHECKSUM_DIVERSO", "prova");
    expect(indicazionePerAnteprima(errore, ANTEPRIMA)).toBe(INDICAZIONE_RIPRISTINO_ANTEPRIMA);
  });

  it("OMP-41 · AP-04 · anteprima, NOME_NON_VALIDO → nessuna indicazione", () => {
    const errore = new ErroreMigrazione("NOME_NON_VALIDO", "prova");
    expect(indicazionePerAnteprima(errore, ANTEPRIMA)).toBeNull();
  });

  it("OMP-41 · AP-05 · anteprima, errore che non è di migrazione → nessuna indicazione", () => {
    expect(indicazionePerAnteprima(new Error("connessione rifiutata"), ANTEPRIMA)).toBeNull();
  });

  it("OMP-41 · AP-06 · produzione, CHECKSUM_DIVERSO → nessuna indicazione", () => {
    const errore = new ErroreMigrazione("CHECKSUM_DIVERSO", "prova");
    expect(indicazionePerAnteprima(errore, { VERCEL_ENV: "production" })).toBeNull();
  });

  it("OMP-41 · AP-07 · in locale (VERCEL_ENV assente), MIGRAZIONE_SCONOSCIUTA → nessuna indicazione", () => {
    const errore = new ErroreMigrazione("MIGRAZIONE_SCONOSCIUTA", "prova");
    expect(indicazionePerAnteprima(errore, {})).toBeNull();
  });
});
