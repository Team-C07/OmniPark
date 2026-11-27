import { ErrorePagamento, type EsitoPagamento, type PagamentoSimulato } from "./pagamentoSimulato";

// Simulatore del circuito di pagamento (RF_WALLET_1, RD_04): nessuna transazione
// reale e nessun dato di carta. Esiti deterministici, valutati in quest'ordine:
// 1. importo non intero o non positivo → errore IMPORTO_NON_VALIDO;
// 2. automobilista di prova → RIFIUTATO;
// 3. importo oltre la soglia massima → RIFIUTATO;
// 4. altrimenti → APPROVATO.

export type ConfigurazioneSimulatorePagamento = {
  /** Importo massimo autorizzabile, in centesimi. */
  sogliaMassima: number;
  /** Identificativi degli automobilisti i cui pagamenti sono sempre rifiutati. */
  automobilistiDiProva: readonly string[];
  /** Ritardo simulato della risposta, in millisecondi; 0 lo disattiva. */
  latenzaMs: number;
};

export const CONFIGURAZIONE_PREDEFINITA: Readonly<ConfigurazioneSimulatorePagamento> =
  Object.freeze({
    sogliaMassima: 10_000,
    automobilistiDiProva: Object.freeze([]),
    latenzaMs: 500,
  });

export class SimulatorePagamento implements PagamentoSimulato {
  private readonly sogliaMassima: number;
  private readonly automobilistiDiProva: ReadonlySet<string>;
  private readonly latenzaMs: number;

  constructor(configurazione: Partial<ConfigurazioneSimulatorePagamento> = {}) {
    // Un campo assente o undefined prende il valore predefinito.
    this.sogliaMassima = configurazione.sogliaMassima ?? CONFIGURAZIONE_PREDEFINITA.sogliaMassima;
    this.automobilistiDiProva = new Set(
      configurazione.automobilistiDiProva ?? CONFIGURAZIONE_PREDEFINITA.automobilistiDiProva,
    );
    this.latenzaMs = configurazione.latenzaMs ?? CONFIGURAZIONE_PREDEFINITA.latenzaMs;
  }

  async autorizzaPagamento(automobilista: string, importo: number): Promise<EsitoPagamento> {
    if (!Number.isInteger(importo) || importo <= 0) {
      throw new ErrorePagamento(
        "IMPORTO_NON_VALIDO",
        "L'importo del pagamento deve essere un numero intero positivo di centesimi.",
      );
    }

    if (this.latenzaMs > 0) {
      await new Promise<void>((risolvi) => setTimeout(risolvi, this.latenzaMs));
    }

    if (this.automobilistiDiProva.has(automobilista)) {
      return "RIFIUTATO";
    }
    if (importo > this.sogliaMassima) {
      return "RIFIUTATO";
    }
    return "APPROVATO";
  }
}
