import type { EsitoMigrazioni } from "../esecutoreMigrazioni.ts";

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
