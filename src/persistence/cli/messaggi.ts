import type { EsitoMigrazioni } from "../esecutoreMigrazioni.ts";
import { ErroreMigrazione, type CodiceErroreMigrazione } from "../migrazioni.ts";

// Errori che sul database condiviso delle anteprime indicano, quasi sempre, che una PR non
// integrata ha già migrato il branch preview: il rimedio è ripristinarlo da production.
const CODICI_DA_RIPRISTINO: readonly CodiceErroreMigrazione[] = [
  "MIGRAZIONE_SCONOSCIUTA",
  "MIGRAZIONE_FUORI_ORDINE",
  "CHECKSUM_DIVERSO",
];

export const INDICAZIONE_RIPRISTINO_ANTEPRIMA =
  "Database delle anteprime: probabilmente una PR non integrata ha già migrato il branch preview. " +
  "Un PM lo ripristina da production (README, «Ambienti e pubblicazione») e rilancia la build.";

/**
 * Riga da aggiungere al log di una migrazione fallita: solo sulle anteprime di Vercel
 * (VERCEL_ENV=preview) e solo per gli errori che richiedono il ripristino del branch preview.
 */
export function indicazionePerAnteprima(
  errore: unknown,
  env: Record<string, string | undefined>,
): string | null {
  if (env.VERCEL_ENV !== "preview" || !(errore instanceof ErroreMigrazione)) {
    return null;
  }
  return CODICI_DA_RIPRISTINO.includes(errore.codice) ? INDICAZIONE_RIPRISTINO_ANTEPRIMA : null;
}

export function descriviEsito(esito: EsitoMigrazioni): string {
  if (esito.applicate.length === 0) {
    return `Nessuna migrazione da applicare: il database è aggiornato (${esito.giaPresenti} già applicate).`;
  }
  return [
    `Migrazioni applicate: ${esito.applicate.length} (già presenti: ${esito.giaPresenti}).`,
    ...esito.applicate.map((nome) => `  - ${nome}`),
  ].join("\n");
}

export function messaggioDi(errore: unknown): string {
  return errore instanceof Error ? errore.message : String(errore);
}
