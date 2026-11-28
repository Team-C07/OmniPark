// Facade del sottosistema Utenti e accessi: l'unico punto usato dagli altri sottosistemi.
import type { Pool } from "pg";
import { ottieniPool } from "../../persistence/db.ts";
import type { Ausiliario, Ruolo } from "../../persistence/accessoDati/utentiEntiVeicoli.ts";
import { orologioDiSistema, type Orologio } from "../orologio.ts";
import {
  accedi,
  esci,
  registraAutomobilista,
  type ContestoUtentiAccessi,
  type SessioneAperta,
} from "./autenticazione.ts";
import {
  ausiliariDellEntePreposto,
  verificaAutorizzazione,
  type Operazione,
  type UtenteAutorizzato,
} from "./autorizzazione.ts";
import { aggiungiTarga, rimuoviTarga } from "./targhe.ts";

export { DURATA_SESSIONE_MS } from "./autenticazione.ts";
export { ErroreUtentiAccessi, type CodiceErroreUtentiAccessi } from "./errori.ts";
export type { Ausiliario, Operazione, Ruolo, SessioneAperta, UtenteAutorizzato };

export type FacadeUtentiAccessi = {
  registraAutomobilista(email: string, password: string, targa: string): Promise<SessioneAperta>;
  accedi(email: string, password: string): Promise<SessioneAperta>;
  esci(sessione: string): Promise<void>;
  aggiungiTarga(automobilista: number, targa: string): Promise<void>;
  rimuoviTarga(automobilista: number, targa: string): Promise<void>;
  verificaAutorizzazione(
    sessione: string,
    operazione: Operazione,
    ente: number | null,
  ): Promise<UtenteAutorizzato>;
  ausiliariDellEntePreposto(ente: number): Promise<Ausiliario[]>;
};

export function creaFacadeUtentiAccessi(
  dipendenze: { pool?: Pool; orologio?: Orologio } = {},
): FacadeUtentiAccessi {
  const contesto: ContestoUtentiAccessi = {
    pool: dipendenze.pool ?? ottieniPool(),
    orologio: dipendenze.orologio ?? orologioDiSistema,
  };
  return {
    registraAutomobilista: (email, password, targa) =>
      registraAutomobilista(contesto, email, password, targa),
    accedi: (email, password) => accedi(contesto, email, password),
    esci: (sessione) => esci(contesto, sessione),
    aggiungiTarga: (automobilista, targa) => aggiungiTarga(contesto, automobilista, targa),
    rimuoviTarga: (automobilista, targa) => rimuoviTarga(contesto, automobilista, targa),
    verificaAutorizzazione: (sessione, operazione, ente) =>
      verificaAutorizzazione(contesto, sessione, operazione, ente),
    ausiliariDellEntePreposto: (ente) => ausiliariDellEntePreposto(contesto, ente),
  };
}
