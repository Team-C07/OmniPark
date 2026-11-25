// Logica pura del comando di reset: nessun accesso al database.

export type AmbienteResettabile = "sviluppo" | "test";

export type EsitoGuardiaReset =
  { consentito: true; ambiente: AmbienteResettabile } | { consentito: false; motivo: string };

const AMBIENTI_RESETTABILI: readonly string[] = ["sviluppo", "test"];

/**
 * Il reset è vietato per default: è consentito solo con OMNIPARK_AMBIENTE uguale a
 * "sviluppo" o "test", e mai se è impostata VERCEL_ENV o se NODE_ENV vale "production".
 */
export function verificaResetConsentito(
  env: Record<string, string | undefined>,
): EsitoGuardiaReset {
  if (env.VERCEL_ENV !== undefined) {
    return {
      consentito: false,
      motivo: "Reset rifiutato: VERCEL_ENV è impostata, il comando non può girare su Vercel.",
    };
  }
  if (env.NODE_ENV === "production") {
    return { consentito: false, motivo: "Reset rifiutato: NODE_ENV vale production." };
  }
  const ambiente = env.OMNIPARK_AMBIENTE;
  if (ambiente === undefined || !AMBIENTI_RESETTABILI.includes(ambiente)) {
    return {
      consentito: false,
      motivo:
        'Reset rifiutato: OMNIPARK_AMBIENTE deve valere "sviluppo" o "test" ' +
        `(valore attuale: ${ambiente === undefined ? "non impostata" : `"${ambiente}"`}).`,
    };
  }
  return { consentito: true, ambiente: ambiente as AmbienteResettabile };
}

/**
 * Ricava host e nome del database dalla stringa di connessione, da mostrare prima del reset.
 * Non restituisce mai utente o password; in caso di errore il messaggio non contiene la stringa.
 */
export function descriviDestinazione(databaseUrl: string): { host: string; database: string } {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL non è una stringa di connessione valida.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!/^postgres(ql)?:$/.test(url.protocol) || !url.host || !database) {
    throw new Error(
      "DATABASE_URL non è una stringa di connessione PostgreSQL valida (servono host e database).",
    );
  }
  return { host: url.host, database };
}
