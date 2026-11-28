// Servizio Autenticazione: registrazione, accesso e uscita (UC_AUTH_1, UC_AUTH_4).
import type { Pool } from "pg";
import { ErroreDominio } from "../../persistence/accessoDati/errori.ts";
import type { Esecutore } from "../../persistence/accessoDati/esecutore.ts";
import { eseguiInTransazione } from "../../persistence/accessoDati/transazione.ts";
import {
  associaVeicolo,
  creaAutomobilista,
  creaSessione,
  eliminaSessione,
  trovaAusiliario,
  trovaOCreaVeicolo,
  trovaUtentePerEmail,
  type Ruolo,
} from "../../persistence/accessoDati/utentiEntiVeicoli.ts";
import { creaWallet } from "../../persistence/accessoDati/walletSoste.ts";
import type { Orologio } from "../orologio.ts";
import {
  calcolaHashPassword,
  calcolaHashToken,
  generaToken,
  HASH_FITTIZIO,
  verificaPassword,
} from "./crittografia.ts";
import { ErroreUtentiAccessi } from "./errori.ts";
import { normalizzaTarga, verificaFormato } from "./targa.ts";

export const DURATA_SESSIONE_MS = 8 * 60 * 60 * 1000;

const LUNGHEZZA_MINIMA_PASSWORD = 8;
// Stessa regola del vincolo utente_email_formato dello schema.
const FORMATO_EMAIL = /^[^@\s]+@[^@\s]+$/;

export type ContestoUtentiAccessi = {
  pool: Pool;
  orologio: Orologio;
};

export type SessioneAperta = {
  token: string;
  scadenza: Date;
  utenteId: number;
  ruolo: Ruolo;
  enteId: number | null;
};

async function avviaSessione(
  es: Esecutore,
  orologio: Orologio,
  utente: { utenteId: number; ruolo: Ruolo; enteId: number | null },
): Promise<SessioneAperta> {
  const token = generaToken();
  const scadenza = new Date(orologio.adesso().getTime() + DURATA_SESSIONE_MS);
  await creaSessione(es, {
    utenteId: utente.utenteId,
    hashToken: calcolaHashToken(token),
    scadenza,
  });
  return { token, scadenza, ...utente };
}

/** Crea account, prima targa, wallet e sessione in un'unica transazione (SD_AUTH_1). */
export async function registraAutomobilista(
  contesto: ContestoUtentiAccessi,
  email: string,
  password: string,
  targa: string,
): Promise<SessioneAperta> {
  const { pool, orologio } = contesto;
  if (!FORMATO_EMAIL.test(email)) {
    throw new ErroreUtentiAccessi("EMAIL_NON_VALIDA");
  }
  if ([...password].length < LUNGHEZZA_MINIMA_PASSWORD) {
    throw new ErroreUtentiAccessi("PASSWORD_TROPPO_CORTA");
  }
  if (await trovaUtentePerEmail(pool, email)) {
    throw new ErroreUtentiAccessi("EMAIL_GIA_REGISTRATA");
  }
  const targaNormalizzata = normalizzaTarga(targa);
  if (!verificaFormato(targaNormalizzata)) {
    throw new ErroreUtentiAccessi("TARGA_NON_VALIDA");
  }

  // L'hash è lento: si calcola prima di aprire la transazione per non occupare la connessione.
  const hashPassword = await calcolaHashPassword(password);
  try {
    return await eseguiInTransazione(async (client) => {
      const utenteId = await creaAutomobilista(client, { email, hashPassword });
      const veicoloId = await trovaOCreaVeicolo(client, targaNormalizzata);
      await associaVeicolo(client, utenteId, veicoloId);
      await creaWallet(client, utenteId);
      return avviaSessione(client, orologio, { utenteId, ruolo: "AUTOMOBILISTA", enteId: null });
    }, pool);
  } catch (errore) {
    // Due registrazioni concorrenti con la stessa email: la seconda la ferma il vincolo.
    if (errore instanceof ErroreDominio && errore.codice === "EMAIL_GIA_REGISTRATA") {
      throw new ErroreUtentiAccessi("EMAIL_GIA_REGISTRATA", { cause: errore });
    }
    throw errore;
  }
}

/** Verifica le credenziali e poi lo stato dell'account, quindi apre la sessione (SD_AUTH_4). */
export async function accedi(
  contesto: ContestoUtentiAccessi,
  email: string,
  password: string,
): Promise<SessioneAperta> {
  const { pool, orologio } = contesto;
  const utente = await trovaUtentePerEmail(pool, email);
  const passwordCorretta = await verificaPassword(password, utente?.hashPassword ?? HASH_FITTIZIO);
  if (!utente || !passwordCorretta) {
    throw new ErroreUtentiAccessi("CREDENZIALI_NON_VALIDE");
  }
  if (utente.statoDellAccount === "DISATTIVATO") {
    throw new ErroreUtentiAccessi("ACCOUNT_DISATTIVATO");
  }

  const enteId =
    utente.ruolo === "AUSILIARIO_DEL_TRAFFICO"
      ? ((await trovaAusiliario(pool, utente.id))?.enteId ?? null)
      : null;
  return avviaSessione(pool, orologio, { utenteId: utente.id, ruolo: utente.ruolo, enteId });
}

/** Chiude la sessione; una sessione inesistente o già chiusa non ha effetti. */
export async function esci(contesto: ContestoUtentiAccessi, sessione: string): Promise<void> {
  await eliminaSessione(contesto.pool, calcolaHashToken(sessione));
}
