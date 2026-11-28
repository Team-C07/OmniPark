// Servizio Targhe: targhe del profilo dell'Automobilista (UC_AUTH_5, SD_AUTH_5).
import { ErroreDominio } from "../../persistence/accessoDati/errori.ts";
import { eseguiInTransazione } from "../../persistence/accessoDati/transazione.ts";
import {
  associaVeicolo,
  bloccaAutomobilista,
  rimuoviVeicoloDalProfilo,
  targheDelProfilo,
  trovaOCreaVeicolo,
} from "../../persistence/accessoDati/utentiEntiVeicoli.ts";
import { sostaAttivaPerVeicolo } from "../../persistence/accessoDati/walletSoste.ts";
import type { ContestoUtentiAccessi } from "./autenticazione.ts";
import { ErroreUtentiAccessi } from "./errori.ts";
import { normalizzaTarga, verificaFormato } from "./targa.ts";

export async function aggiungiTarga(
  contesto: ContestoUtentiAccessi,
  automobilista: number,
  targa: string,
): Promise<void> {
  const targaNormalizzata = normalizzaTarga(targa);
  if (!verificaFormato(targaNormalizzata)) {
    throw new ErroreUtentiAccessi("TARGA_NON_VALIDA");
  }
  try {
    await eseguiInTransazione(async (client) => {
      const profilo = await targheDelProfilo(client, automobilista);
      if (profilo.some((voce) => voce.targa === targaNormalizzata)) {
        throw new ErroreUtentiAccessi("TARGA_GIA_PRESENTE");
      }
      const veicoloId = await trovaOCreaVeicolo(client, targaNormalizzata);
      await associaVeicolo(client, automobilista, veicoloId);
    }, contesto.pool);
  } catch (errore) {
    // Due aggiunte concorrenti della stessa targa: la seconda la ferma la chiave primaria.
    if (errore instanceof ErroreDominio && errore.codice === "TARGA_GIA_NEL_PROFILO") {
      throw new ErroreUtentiAccessi("TARGA_GIA_PRESENTE", { cause: errore });
    }
    throw errore;
  }
}

/** Toglie la targa dal profilo; il veicolo resta nel database per lo storico. */
export async function rimuoviTarga(
  contesto: ContestoUtentiAccessi,
  automobilista: number,
  targa: string,
): Promise<void> {
  const targaNormalizzata = normalizzaTarga(targa);
  await eseguiInTransazione(async (client) => {
    if (!(await bloccaAutomobilista(client, automobilista))) {
      throw new ErroreUtentiAccessi("TARGA_NON_PRESENTE");
    }
    const profilo = await targheDelProfilo(client, automobilista);
    const voce = profilo.find((v) => v.targa === targaNormalizzata);
    if (!voce) {
      throw new ErroreUtentiAccessi("TARGA_NON_PRESENTE");
    }
    if (profilo.length === 1) {
      throw new ErroreUtentiAccessi("ULTIMA_TARGA");
    }
    if (await sostaAttivaPerVeicolo(client, voce.veicoloId)) {
      throw new ErroreUtentiAccessi("TARGA_CON_SOSTA_ATTIVA");
    }
    await rimuoviVeicoloDalProfilo(client, automobilista, voce.veicoloId);
  }, contesto.pool);
}
