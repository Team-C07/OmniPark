// Forma normalizzata e formato valido della targa (AB123CD, docs/test/cp_registraAutomobilista.md).

const FORMATO_TARGA = /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/;

/** Maiuscole e senza spazi. */
export function normalizzaTarga(targa: string): string {
  return targa.replace(/\s+/g, "").toUpperCase();
}

/** Vero se la targa, già normalizzata, ha il formato valido (SD_AUTH_5, 4.1). */
export function verificaFormato(targa: string): boolean {
  return FORMATO_TARGA.test(targa);
}
