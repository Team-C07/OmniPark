// Errori di dominio dello strato di persistenza e traduzione degli errori del database.
// Il codice e il messaggio seguono il formato delle API { errore: { codice, messaggio } }:
// i messaggi sono fissi, senza valori, SQL o stringhe di connessione; l'errore originale resta
// in `cause`.

export type CodiceErrore =
  // generici, per SQLSTATE o per tipo di errore
  | "VALORE_DUPLICATO"
  | "RIFERIMENTO_INESISTENTE"
  | "DATI_NON_VALIDI"
  | "VALORE_MANCANTE"
  | "VALORE_FUORI_INTERVALLO"
  | "CONFLITTO_DI_CONCORRENZA"
  | "DATABASE_NON_RAGGIUNGIBILE"
  | "ERRORE_DATABASE"
  // specifici, per vincolo o trigger dello schema
  | "EMAIL_GIA_REGISTRATA"
  | "EMAIL_NON_VALIDA"
  | "TARGA_NON_VALIDA"
  | "TARGA_GIA_PRESENTE"
  | "TARGA_GIA_NEL_PROFILO"
  | "WALLET_GIA_PRESENTE"
  | "SESSIONE_GIA_PRESENTE"
  | "ENTE_GIA_PRESENTE"
  | "AREA_GIA_PRESENTE"
  | "STALLO_GIA_PRESENTE"
  | "STATO_STALLO_NON_VALIDO"
  | "GIA_TRA_I_PREFERITI"
  | "SOSTA_GIA_ATTIVA_PER_VEICOLO"
  | "SOSTA_GIA_ATTIVA_PER_STALLO"
  | "DURATA_NON_VALIDA"
  | "PERMESSO_NON_VALIDO"
  | "FOTO_NON_VALIDA"
  | "PERMESSO_NON_ELIMINATO"
  | "PAGAMENTO_NON_MODIFICABILE"
  | "IMPORTO_NON_VALIDO"
  | "MOVIMENTO_NON_COERENTE"
  | "VERIFICA_GIA_REGISTRATA"
  | "SEGNALAZIONE_NON_CHIUSA_GIA_PRESENTE"
  | "SEGNALAZIONE_GIA_GENERATA"
  | "STATO_SEGNALAZIONE_NON_VALIDO"
  // dello strato di persistenza
  | "SALDO_INSUFFICIENTE"
  | "WALLET_INESISTENTE";

const MESSAGGI: Readonly<Record<CodiceErrore, string>> = {
  VALORE_DUPLICATO: "Il dato esiste già.",
  RIFERIMENTO_INESISTENTE: "Il dato a cui si fa riferimento non esiste.",
  DATI_NON_VALIDI: "I dati non sono validi.",
  VALORE_MANCANTE: "Manca un dato obbligatorio.",
  VALORE_FUORI_INTERVALLO: "Un valore è fuori dall'intervallo consentito.",
  CONFLITTO_DI_CONCORRENZA:
    "L'operazione è in conflitto con un'altra operazione in corso. Riprova.",
  DATABASE_NON_RAGGIUNGIBILE: "Il database non è raggiungibile. Riprova più tardi.",
  ERRORE_DATABASE: "Si è verificato un errore nell'accesso ai dati.",
  EMAIL_GIA_REGISTRATA: "L'email è già registrata.",
  EMAIL_NON_VALIDA: "L'email non è valida.",
  TARGA_NON_VALIDA: "La targa non è valida.",
  TARGA_GIA_PRESENTE: "La targa è già registrata.",
  TARGA_GIA_NEL_PROFILO: "La targa è già nel profilo.",
  WALLET_GIA_PRESENTE: "L'automobilista ha già un wallet.",
  SESSIONE_GIA_PRESENTE: "La sessione esiste già.",
  ENTE_GIA_PRESENTE: "Esiste già un ente con questo nome.",
  AREA_GIA_PRESENTE: "Esiste già un'area di sosta con questo nome per l'ente.",
  STALLO_GIA_PRESENTE: "Esiste già uno stallo con questo numero nell'area di sosta.",
  STATO_STALLO_NON_VALIDO: "Lo stato dello stallo non è coerente con l'ultima rilevazione.",
  GIA_TRA_I_PREFERITI: "È già tra i preferiti.",
  SOSTA_GIA_ATTIVA_PER_VEICOLO: "Per questa targa c'è già una sosta attiva.",
  SOSTA_GIA_ATTIVA_PER_STALLO: "Sullo stallo c'è già una sosta attiva.",
  DURATA_NON_VALIDA: "La durata della sosta non è valida.",
  PERMESSO_NON_VALIDO: "La dichiarazione e la foto del permesso non sono valide.",
  FOTO_NON_VALIDA: "La foto del permesso non è valida.",
  PERMESSO_NON_ELIMINATO:
    "Al termine della sosta dichiarazione e foto del permesso vanno eliminate.",
  PAGAMENTO_NON_MODIFICABILE: "Il pagamento della sosta non si può modificare.",
  IMPORTO_NON_VALIDO: "L'importo non è valido.",
  MOVIMENTO_NON_COERENTE: "Il movimento non è coerente con la sosta indicata.",
  VERIFICA_GIA_REGISTRATA: "L'esito della verifica del permesso è già registrato.",
  SEGNALAZIONE_NON_CHIUSA_GIA_PRESENTE: "Per questa targa esiste già una segnalazione non chiusa.",
  SEGNALAZIONE_GIA_GENERATA: "La verifica ha già generato una segnalazione.",
  STATO_SEGNALAZIONE_NON_VALIDO: "Lo stato della segnalazione non è valido.",
  SALDO_INSUFFICIENTE: "Il credito del wallet non è sufficiente.",
  WALLET_INESISTENTE: "Il wallet non esiste.",
};

export class ErroreDominio extends Error {
  readonly codice: CodiceErrore;
  readonly messaggio: string;

  constructor(
    codice: CodiceErrore,
    messaggio: string = MESSAGGI[codice],
    opzioni?: { cause?: unknown },
  ) {
    super(messaggio, opzioni);
    this.name = "ErroreDominio";
    this.codice = codice;
    this.messaggio = messaggio;
  }
}

/** Vincoli e indici dello schema con un significato di dominio (piano approvato di OMP-34). */
export const VINCOLI_SPECIFICI: Readonly<Record<string, CodiceErrore>> = {
  utente_email_unica: "EMAIL_GIA_REGISTRATA",
  utente_email_formato: "EMAIL_NON_VALIDA",
  veicolo_targa_normalizzata: "TARGA_NON_VALIDA",
  segnalazione_targa_rilevata_normalizzata: "TARGA_NON_VALIDA",
  veicolo_targa_unica: "TARGA_GIA_PRESENTE",
  automobilista_veicolo_pkey: "TARGA_GIA_NEL_PROFILO",
  wallet_virtuale_uno_per_automobilista: "WALLET_GIA_PRESENTE",
  sessione_hash_token_unico: "SESSIONE_GIA_PRESENTE",
  ente_preposto_nome_unico: "ENTE_GIA_PRESENTE",
  area_di_sosta_nome_unico_per_ente: "AREA_GIA_PRESENTE",
  stallo_numero_unico_per_area: "STALLO_GIA_PRESENTE",
  stallo_rilevazione_completa: "STATO_STALLO_NON_VALIDO",
  stallo_senza_rilevazione_sconosciuto: "STATO_STALLO_NON_VALIDO",
  stallo_libero_senza_veicolo: "STATO_STALLO_NON_VALIDO",
  stallo_occupato_con_veicolo: "STATO_STALLO_NON_VALIDO",
  stallo_preferito_pkey: "GIA_TRA_I_PREFERITI",
  area_di_sosta_preferita_pkey: "GIA_TRA_I_PREFERITI",
  sosta_una_attiva_per_veicolo: "SOSTA_GIA_ATTIVA_PER_VEICOLO",
  sosta_una_attiva_per_stallo: "SOSTA_GIA_ATTIVA_PER_STALLO",
  sosta_scadenza_dopo_avvio: "DURATA_NON_VALIDA",
  sosta_permesso_completo: "PERMESSO_NON_VALIDO",
  sosta_dichiarazione_non_vuota: "PERMESSO_NON_VALIDO",
  sosta_gratuita_con_permesso: "PERMESSO_NON_VALIDO",
  sosta_foto_dimensione: "FOTO_NON_VALIDA",
  sosta_permesso_eliminato_al_termine: "PERMESSO_NON_ELIMINATO",
  movimento_del_wallet_importo_positivo: "IMPORTO_NON_VALIDO",
  movimento_del_wallet_sosta_coerente_con_tipo: "MOVIMENTO_NON_COERENTE",
  verifica_del_permesso_una_per_sosta: "VERIFICA_GIA_REGISTRATA",
  segnalazione_una_non_chiusa_per_targa: "SEGNALAZIONE_NON_CHIUSA_GIA_PRESENTE",
  segnalazione_una_per_verifica: "SEGNALAZIONE_GIA_GENERATA",
  segnalazione_una_origine: "STATO_SEGNALAZIONE_NON_VALIDO",
  segnalazione_dati_lettura_completi: "STATO_SEGNALAZIONE_NON_VALIDO",
  segnalazione_da_verifica_chiusa_accertata: "STATO_SEGNALAZIONE_NON_VALIDO",
  segnalazione_assegnazione: "STATO_SEGNALAZIONE_NON_VALIDO",
  segnalazione_assegnata_a_chi_ha_verificato: "STATO_SEGNALAZIONE_NON_VALIDO",
  segnalazione_presa_in_carico_con_data: "STATO_SEGNALAZIONE_NON_VALIDO",
  segnalazione_chiusura_con_esito_e_data: "STATO_SEGNALAZIONE_NON_VALIDO",
  segnalazione_date_ordinate: "STATO_SEGNALAZIONE_NON_VALIDO",
};

/** Funzioni trigger dello schema: decidono il codice qualunque sia il SQLSTATE. */
export const TRIGGER_SPECIFICI: Readonly<Record<string, CodiceErrore>> = {
  impedisci_modifica_pagamento: "PAGAMENTO_NON_MODIFICABILE",
  impedisci_modifica_verifica: "VERIFICA_GIA_REGISTRATA",
  impedisci_segnalazione_da_verifica_conforme: "STATO_SEGNALAZIONE_NON_VALIDO",
};

/**
 * Vincoli e indici unici che usano volutamente il codice generico VALORE_DUPLICATO: esistono solo
 * come bersaglio di chiavi esterne composte.
 */
export const VINCOLI_UNICI_GENERICI: readonly string[] = [
  "utente_id_ruolo_unico",
  "verifica_del_permesso_id_ausiliario_unico",
];

const CODICI_PER_SQLSTATE: Readonly<Record<string, CodiceErrore>> = {
  "23505": "VALORE_DUPLICATO",
  "23503": "RIFERIMENTO_INESISTENTE",
  "23514": "DATI_NON_VALIDI",
  "23502": "VALORE_MANCANTE",
  "22003": "VALORE_FUORI_INTERVALLO",
  "40001": "CONFLITTO_DI_CONCORRENZA",
  "40P01": "CONFLITTO_DI_CONCORRENZA",
  "57P01": "DATABASE_NON_RAGGIUNGIBILE",
};

const CODICI_DI_CONNESSIONE = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
]);
const MESSAGGI_DI_CONNESSIONE = [
  "timeout exceeded when trying to connect",
  "Connection terminated",
];

type ErroreDelDatabase = {
  code?: unknown;
  constraint?: unknown;
  where?: unknown;
  message?: unknown;
};

/** Traduce un errore qualsiasi in un ErroreDominio; un ErroreDominio è restituito invariato. */
export function traduciErrore(errore: unknown): ErroreDominio {
  if (errore instanceof ErroreDominio) {
    return errore;
  }
  return new ErroreDominio(codiceDi(errore), undefined, { cause: errore });
}

function codiceDi(errore: unknown): CodiceErrore {
  if (typeof errore !== "object" || errore === null) {
    return "ERRORE_DATABASE";
  }
  const { code, constraint, where, message } = errore as ErroreDelDatabase;

  if (typeof where === "string") {
    const trigger = Object.keys(TRIGGER_SPECIFICI).find((nome) => where.includes(nome));
    if (trigger) {
      return TRIGGER_SPECIFICI[trigger];
    }
  }
  if (typeof constraint === "string" && Object.hasOwn(VINCOLI_SPECIFICI, constraint)) {
    return VINCOLI_SPECIFICI[constraint];
  }
  if (typeof code === "string") {
    if (Object.hasOwn(CODICI_PER_SQLSTATE, code)) {
      return CODICI_PER_SQLSTATE[code];
    }
    if (code.startsWith("08") || CODICI_DI_CONNESSIONE.has(code)) {
      return "DATABASE_NON_RAGGIUNGIBILE";
    }
  }
  if (typeof message === "string" && MESSAGGI_DI_CONNESSIONE.some((m) => message.includes(m))) {
    return "DATABASE_NON_RAGGIUNGIBILE";
  }
  return "ERRORE_DATABASE";
}
