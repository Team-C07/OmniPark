// Interfaccia «Pagamento simulato» del sottosistema Simulatori (SDD, par. 3.2).
// Il Wallet dipende solo da questo file: sostituire il simulatore con un circuito
// di pagamento reale significa fornire un'altra implementazione (DG_10).

export type EsitoPagamento = "APPROVATO" | "RIFIUTATO";

export interface PagamentoSimulato {
  /**
   * Autorizza un pagamento di `importo` centesimi per l'automobilista indicato.
   * Rifiuta la promise con `ErrorePagamento` (`IMPORTO_NON_VALIDO`) se l'importo
   * non è un intero positivo.
   */
  autorizzaPagamento(automobilista: string, importo: number): Promise<EsitoPagamento>;
}

export type CodiceErrorePagamento = "IMPORTO_NON_VALIDO";

export class ErrorePagamento extends Error {
  readonly codice: CodiceErrorePagamento;

  constructor(codice: CodiceErrorePagamento, messaggio: string) {
    super(messaggio);
    this.name = "ErrorePagamento";
    this.codice = codice;
  }
}
