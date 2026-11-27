// Servizio Autorizzazione: controllo di sessione, ruolo ed ente (NRF_SIC_1).
import {
  ausiliariAttiviDellEnte,
  trovaAusiliario,
  trovaSessione,
  type Ausiliario,
  type Ruolo,
} from "../../persistence/accessoDati/utentiEntiVeicoli.ts";
import type { ContestoUtentiAccessi } from "./autenticazione.ts";
import { calcolaHashToken } from "./crittografia.ts";
import { ErroreUtentiAccessi } from "./errori.ts";

type RegolaOperazione = { ruolo: Ruolo; perEnte: boolean };

const DELL_AUTOMOBILISTA: RegolaOperazione = { ruolo: "AUTOMOBILISTA", perEnte: false };
const DELL_AUSILIARIO: RegolaOperazione = { ruolo: "AUSILIARIO_DEL_TRAFFICO", perEnte: true };
const DELL_AMMINISTRATORE: RegolaOperazione = { ruolo: "AMMINISTRATORE", perEnte: false };

/** Operazioni con sessione, per caso d'uso: il ruolo ammesso è l'attore principale. */
export const OPERAZIONI = {
  UC_AUTH_5: DELL_AUTOMOBILISTA,
  UC_NAV_1: DELL_AUTOMOBILISTA,
  UC_SOSTA_1: DELL_AUTOMOBILISTA,
  UC_SOSTA_2: DELL_AUTOMOBILISTA,
  UC_SOSTA_5: DELL_AUTOMOBILISTA,
  UC_STALLI_1: DELL_AUTOMOBILISTA,
  UC_STALLI_2: DELL_AUTOMOBILISTA,
  UC_STALLI_3: DELL_AUTOMOBILISTA,
  UC_STALLI_5: DELL_AUTOMOBILISTA,
  UC_WALLET_1: DELL_AUTOMOBILISTA,
  UC_WALLET_3: DELL_AUTOMOBILISTA,
  UC_OP_1: DELL_AUSILIARIO,
  UC_OP_2: DELL_AUSILIARIO,
  UC_OP_3: DELL_AUSILIARIO,
  UC_OP_4: DELL_AUSILIARIO,
  UC_OP_5: DELL_AUSILIARIO,
  UC_ADM_1: DELL_AMMINISTRATORE,
  UC_ADM_2: DELL_AMMINISTRATORE,
} as const satisfies Record<string, RegolaOperazione>;

export type Operazione = keyof typeof OPERAZIONI;

export type UtenteAutorizzato = {
  utenteId: number;
  ruolo: Ruolo;
  enteId: number | null;
};

/** Controlla nell'ordine sessione, ruolo ed ente; rifiuta con ErroreUtentiAccessi. */
export async function verificaAutorizzazione(
  contesto: ContestoUtentiAccessi,
  sessione: string,
  operazione: Operazione,
  ente: number | null,
): Promise<UtenteAutorizzato> {
  const { pool, orologio } = contesto;
  const trovata = await trovaSessione(pool, calcolaHashToken(sessione), orologio.adesso());
  if (!trovata) {
    throw new ErroreUtentiAccessi("SESSIONE_NON_VALIDA");
  }

  let enteId: number | null = null;
  if (trovata.ruolo === "AUSILIARIO_DEL_TRAFFICO") {
    const ausiliario = await trovaAusiliario(pool, trovata.utenteId);
    // Un Ausiliario disattivato non opera, anche se gli è rimasta una sessione.
    if (!ausiliario || ausiliario.statoDellAccount !== "ATTIVO") {
      throw new ErroreUtentiAccessi("SESSIONE_NON_VALIDA");
    }
    enteId = ausiliario.enteId;
  }

  // Il controllo a runtime copre anche un nome di operazione che non è nel catalogo.
  const regola: RegolaOperazione | undefined = Object.hasOwn(OPERAZIONI, operazione)
    ? OPERAZIONI[operazione]
    : undefined;
  if (!regola || regola.ruolo !== trovata.ruolo) {
    throw new ErroreUtentiAccessi("RUOLO_NON_AMMESSO");
  }
  if (regola.perEnte && ente !== enteId) {
    throw new ErroreUtentiAccessi("ENTE_NON_AMMESSO");
  }
  return { utenteId: trovata.utenteId, ruolo: trovata.ruolo, enteId };
}

/** Ausiliari attivi dell'ente; elenco vuoto se non ne ha. */
export async function ausiliariDellEntePreposto(
  contesto: ContestoUtentiAccessi,
  ente: number,
): Promise<Ausiliario[]> {
  return ausiliariAttiviDellEnte(contesto.pool, ente);
}
