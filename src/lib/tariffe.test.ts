import { describe, expect, it } from "vitest";
import { calcolaCostoSosta } from "./tariffe";

describe("Calcolo costo sosta - esempio", () => {
  it("calcola il costo di un'ora", () => {
    expect(calcolaCostoSosta(60, 2)).toBe(2);
  });

  it("calcola il costo di mezz'ora", () => {
    expect(calcolaCostoSosta(30, 2)).toBe(1);
  });

  it("restituisce zero per una sosta di zero minuti", () => {
    expect(calcolaCostoSosta(0, 2)).toBe(0);
  });

  it("rifiuta una durata negativa", () => {
    expect(() => calcolaCostoSosta(-10, 2)).toThrow();
  });

  it("rifiuta una tariffa negativa", () => {
    expect(() => calcolaCostoSosta(60, -2)).toThrow();
  });
});
