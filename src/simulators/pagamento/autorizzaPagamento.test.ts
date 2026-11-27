import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorePagamento, type EsitoPagamento } from "./pagamentoSimulato";
import { SimulatorePagamento, type ConfigurazioneSimulatorePagamento } from "./simulatorePagamento";

// Configurazione d'ambiente della specifica docs/test/cp_autorizzaPagamento.md.
const AMBIENTE: ConfigurazioneSimulatorePagamento = {
  sogliaMassima: 10000,
  automobilistiDiProva: ["9999"],
  latenzaMs: 0,
};

const AUTOMOBILISTA_ORDINARIO = "1";
const AUTOMOBILISTA_DI_PROVA = "9999";

function simulatore(latenzaMs: number = AMBIENTE.latenzaMs): SimulatorePagamento {
  return new SimulatorePagamento({ ...AMBIENTE, latenzaMs });
}

async function attendiErroreImportoNonValido(esito: Promise<EsitoPagamento>): Promise<void> {
  await expect(esito).rejects.toBeInstanceOf(ErrorePagamento);
  await expect(esito).rejects.toMatchObject({ codice: "IMPORTO_NON_VALIDO" });
}

describe("autorizzaPagamento", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("RF_WALLET_1 · TF-01 · importo zero → IMPORTO_NON_VALIDO", async () => {
    await attendiErroreImportoNonValido(
      simulatore().autorizzaPagamento(AUTOMOBILISTA_ORDINARIO, 0),
    );
  });

  it("RF_WALLET_1 · TF-02 · importo negativo → IMPORTO_NON_VALIDO", async () => {
    await attendiErroreImportoNonValido(
      simulatore().autorizzaPagamento(AUTOMOBILISTA_ORDINARIO, -500),
    );
  });

  it("RF_WALLET_1 · TF-03 · importo non intero → IMPORTO_NON_VALIDO", async () => {
    await attendiErroreImportoNonValido(
      simulatore().autorizzaPagamento(AUTOMOBILISTA_ORDINARIO, 150.5),
    );
  });

  it("RF_WALLET_1 · TF-04 · importo di 1 centesimo → APPROVATO", async () => {
    await expect(simulatore().autorizzaPagamento(AUTOMOBILISTA_ORDINARIO, 1)).resolves.toBe(
      "APPROVATO",
    );
  });

  it("RF_WALLET_1 · TF-05 · importo intermedio (20 €) → APPROVATO", async () => {
    await expect(simulatore().autorizzaPagamento(AUTOMOBILISTA_ORDINARIO, 2000)).resolves.toBe(
      "APPROVATO",
    );
  });

  it("RF_WALLET_1 · TF-06 · importo uguale alla soglia → APPROVATO", async () => {
    await expect(simulatore().autorizzaPagamento(AUTOMOBILISTA_ORDINARIO, 10000)).resolves.toBe(
      "APPROVATO",
    );
  });

  it("RF_WALLET_1 · TF-07 · importo oltre la soglia → RIFIUTATO", async () => {
    await expect(simulatore().autorizzaPagamento(AUTOMOBILISTA_ORDINARIO, 10001)).resolves.toBe(
      "RIFIUTATO",
    );
  });

  it("RF_WALLET_1 · TF-08 · automobilista di prova → RIFIUTATO", async () => {
    await expect(simulatore().autorizzaPagamento(AUTOMOBILISTA_DI_PROVA, 1000)).resolves.toBe(
      "RIFIUTATO",
    );
  });

  it("RF_WALLET_1 · TF-09 · latenza configurata di 500 ms → APPROVATO non prima di 500 ms", async () => {
    vi.useFakeTimers();
    try {
      let esito: EsitoPagamento | undefined;
      let risolta = false;
      const promessa = simulatore(500)
        .autorizzaPagamento(AUTOMOBILISTA_ORDINARIO, 1000)
        .then((valore) => {
          esito = valore;
          risolta = true;
          return valore;
        });

      await vi.advanceTimersByTimeAsync(499);
      expect(risolta).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(risolta).toBe(true);
      expect(esito).toBe("APPROVATO");
      await expect(promessa).resolves.toBe("APPROVATO");
    } finally {
      vi.useRealTimers();
    }
  });
});
