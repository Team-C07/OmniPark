// Errori di dominio del sottosistema Utenti e accessi, con i codici delle specifiche
// docs/test/cp_registraAutomobilista.md, cp_accedi.md, cp_targhe.md e cp_verificaAutorizzazione.md.

export type CodiceErroreUtentiAccessi =
  | "EMAIL_GIA_REGISTRATA"
  | "EMAIL_NON_VALIDA"
  | "PASSWORD_TROPPO_CORTA"
  | "TARGA_NON_VALIDA"
  | "CREDENZIALI_NON_VALIDE"
  | "ACCOUNT_DISATTIVATO"
  | "SESSIONE_NON_VALIDA"
  | "TARGA_GIA_PRESENTE"
  | "ULTIMA_TARGA"
  | "TARGA_NON_PRESENTE"
  | "TARGA_CON_SOSTA_ATTIVA"
  | "RUOLO_NON_AMMESSO"
  | "ENTE_NON_AMMESSO";

const MESSAGGI: Readonly<Record<CodiceErroreUtentiAccessi, string>> = {
  EMAIL_GIA_REGISTRATA: "L'email è già registrata.",
  EMAIL_NON_VALIDA: "L'email non è valida.",
  PASSWORD_TROPPO_CORTA: "La password deve avere almeno 8 caratteri.",
  TARGA_NON_VALIDA: "La targa non è valida.",
  CREDENZIALI_NON_VALIDE: "Email o password non corrette.",
  ACCOUNT_DISATTIVATO: "L'account è stato disattivato.",
  SESSIONE_NON_VALIDA: "La sessione non è valida. Accedi di nuovo.",
  TARGA_GIA_PRESENTE: "La targa è già nel profilo.",
  ULTIMA_TARGA: "Non puoi rimuovere l'unica targa del profilo.",
  TARGA_NON_PRESENTE: "La targa non è nel profilo.",
  TARGA_CON_SOSTA_ATTIVA: "Non puoi rimuovere una targa con una sosta attiva.",
  RUOLO_NON_AMMESSO: "Il tuo ruolo non consente questa operazione.",
  ENTE_NON_AMMESSO: "Non puoi operare sui dati di questo ente.",
};

export class ErroreUtentiAccessi extends Error {
  readonly codice: CodiceErroreUtentiAccessi;

  constructor(codice: CodiceErroreUtentiAccessi, opzioni?: { cause?: unknown }) {
    super(MESSAGGI[codice], opzioni);
    this.name = "ErroreUtentiAccessi";
    this.codice = codice;
  }
}
