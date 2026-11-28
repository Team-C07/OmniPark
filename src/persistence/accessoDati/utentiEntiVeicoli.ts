// Accesso ai dati di utenti, sessioni, enti, ausiliari e veicoli.
import { interroga, type Esecutore } from "./esecutore.ts";

export type Ruolo = "AUTOMOBILISTA" | "AUSILIARIO_DEL_TRAFFICO" | "AMMINISTRATORE";
export type StatoDellAccount = "ATTIVO" | "DISATTIVATO";

export type UtenteConCredenziali = {
  id: number;
  email: string;
  hashPassword: string;
  ruolo: Ruolo;
  statoDellAccount: StatoDellAccount | null;
};

export type Ausiliario = {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  enteId: number;
  statoDellAccount: StatoDellAccount;
};

export type RiepilogoEnte = {
  stalliGestiti: number;
  sosteAttive: number;
  segnalazioniNonChiuse: number;
};

// --- Utenti e automobilisti (SD_AUTH_1, SD_AUTH_4, SD_ADM_2)

/** Utente con la sua email, senza distinzione tra maiuscole e minuscole; null se non esiste. */
export async function trovaUtentePerEmail(
  es: Esecutore,
  email: string,
): Promise<UtenteConCredenziali | null> {
  const r = await interroga<{
    id: string;
    email: string;
    hash_password: string;
    ruolo: Ruolo;
    stato_dell_account: StatoDellAccount | null;
  }>(
    es,
    `SELECT u.id, u.email, u.hash_password, u.ruolo, a.stato_dell_account
     FROM utente AS u
     LEFT JOIN ausiliario_del_traffico AS a ON a.id = u.id
     WHERE lower(u.email) = lower($1)`,
    [email],
  );
  const riga = r.rows[0];
  if (!riga) {
    return null;
  }
  return {
    id: Number(riga.id),
    email: riga.email,
    hashPassword: riga.hash_password,
    ruolo: riga.ruolo,
    statoDellAccount: riga.stato_dell_account,
  };
}

/** Crea utente e automobilista in una sola istruzione; restituisce l'id. */
export async function creaAutomobilista(
  es: Esecutore,
  dati: { email: string; hashPassword: string },
): Promise<number> {
  const r = await interroga<{ id: string }>(
    es,
    `WITH nuovo AS (
       INSERT INTO utente (email, hash_password, ruolo) VALUES ($1, $2, 'AUTOMOBILISTA') RETURNING id
     )
     INSERT INTO automobilista (id) SELECT id FROM nuovo RETURNING id`,
    [dati.email, dati.hashPassword],
  );
  return Number(r.rows[0].id);
}

// --- Veicoli e targhe del profilo (SD_AUTH_1 3.2, SD_AUTH_5)

/** Id del veicolo con la targa indicata, creandolo se non esiste. */
export async function trovaOCreaVeicolo(es: Esecutore, targa: string): Promise<number> {
  const r = await interroga<{ id: string }>(
    es,
    `INSERT INTO veicolo (targa) VALUES ($1)
     ON CONFLICT (targa) DO UPDATE SET targa = EXCLUDED.targa
     RETURNING id`,
    [targa],
  );
  return Number(r.rows[0].id);
}

export async function associaVeicolo(
  es: Esecutore,
  automobilistaId: number,
  veicoloId: number,
): Promise<void> {
  await interroga(
    es,
    "INSERT INTO automobilista_veicolo (automobilista_id, veicolo_id) VALUES ($1, $2)",
    [automobilistaId, veicoloId],
  );
}

/** Targhe del profilo, ordinate per targa e poi per id del veicolo. */
export async function targheDelProfilo(
  es: Esecutore,
  automobilistaId: number,
): Promise<{ veicoloId: number; targa: string }[]> {
  const r = await interroga<{ id: string; targa: string }>(
    es,
    `SELECT v.id, v.targa
     FROM automobilista_veicolo AS av
     JOIN veicolo AS v ON v.id = av.veicolo_id
     WHERE av.automobilista_id = $1
     ORDER BY v.targa, v.id`,
    [automobilistaId],
  );
  return r.rows.map((riga) => ({ veicoloId: Number(riga.id), targa: riga.targa }));
}

/** Toglie la targa dal profilo (il veicolo resta); false se l'associazione non c'era. */
export async function rimuoviVeicoloDalProfilo(
  es: Esecutore,
  automobilistaId: number,
  veicoloId: number,
): Promise<boolean> {
  const r = await interroga(
    es,
    "DELETE FROM automobilista_veicolo WHERE automobilista_id = $1 AND veicolo_id = $2",
    [automobilistaId, veicoloId],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Blocca la riga dell'automobilista fino alla fine della transazione, così due rimozioni
 * concorrenti non svuotano il profilo; false se l'automobilista non esiste.
 */
export async function bloccaAutomobilista(es: Esecutore, id: number): Promise<boolean> {
  const r = await interroga(es, "SELECT id FROM automobilista WHERE id = $1 FOR UPDATE", [id]);
  return (r.rowCount ?? 0) > 0;
}

// --- Sessioni (SD_AUTH_4 3.1 e 3.a1.2, VD_19)

export async function creaSessione(
  es: Esecutore,
  dati: { utenteId: number; hashToken: string; scadenza: Date },
): Promise<void> {
  await interroga(
    es,
    "INSERT INTO sessione (utente_id, hash_token, scadenza) VALUES ($1, $2, $3)",
    [dati.utenteId, dati.hashToken, dati.scadenza],
  );
}

/** Sessione valida all'istante indicato (scadenza successiva); null se scaduta o inesistente. */
export async function trovaSessione(
  es: Esecutore,
  hashToken: string,
  istante: Date,
): Promise<{ utenteId: number; ruolo: Ruolo } | null> {
  const r = await interroga<{ utente_id: string; ruolo: Ruolo }>(
    es,
    `SELECT s.utente_id, u.ruolo
     FROM sessione AS s
     JOIN utente AS u ON u.id = s.utente_id
     WHERE s.hash_token = $1 AND s.scadenza > $2`,
    [hashToken, istante],
  );
  const riga = r.rows[0];
  return riga ? { utenteId: Number(riga.utente_id), ruolo: riga.ruolo } : null;
}

export async function eliminaSessione(es: Esecutore, hashToken: string): Promise<boolean> {
  const r = await interroga(es, "DELETE FROM sessione WHERE hash_token = $1", [hashToken]);
  return (r.rowCount ?? 0) > 0;
}

/** Elimina tutte le sessioni dell'utente; restituisce quante. */
export async function eliminaSessioniUtente(es: Esecutore, utenteId: number): Promise<number> {
  const r = await interroga(es, "DELETE FROM sessione WHERE utente_id = $1", [utenteId]);
  return r.rowCount ?? 0;
}

// --- Enti (SD_ADM_1)

/** Enti preposti, ordinati per nome e poi per id. */
export async function enti(es: Esecutore): Promise<{ id: number; nome: string }[]> {
  const r = await interroga<{ id: string; nome: string }>(
    es,
    "SELECT id, nome FROM ente_preposto ORDER BY nome, id",
  );
  return r.rows.map((riga) => ({ id: Number(riga.id), nome: riga.nome }));
}

/**
 * Riepilogo dell'ente (RF_ADM_1): stalli delle sue aree, soste ATTIVA in quegli stalli e
 * segnalazioni non chiuse (APERTA o PRESA_IN_CARICO, UC_ADM_1). null se l'ente non esiste.
 */
export async function riepilogoEnte(es: Esecutore, enteId: number): Promise<RiepilogoEnte | null> {
  const r = await interroga<{
    stalli_gestiti: number;
    soste_attive: number;
    segnalazioni_non_chiuse: number;
  }>(
    es,
    `WITH stalli AS (
       SELECT s.id FROM stallo AS s
       JOIN area_di_sosta AS a ON a.id = s.area_di_sosta_id
       WHERE a.ente_preposto_id = $1
     )
     SELECT
       (SELECT count(*)::int FROM stalli) AS stalli_gestiti,
       (SELECT count(*)::int FROM sosta WHERE stato = 'ATTIVA' AND stallo_id IN (SELECT id FROM stalli)) AS soste_attive,
       (SELECT count(*)::int FROM segnalazione
          WHERE stato IN ('APERTA', 'PRESA_IN_CARICO') AND stallo_id IN (SELECT id FROM stalli)) AS segnalazioni_non_chiuse
     FROM ente_preposto WHERE id = $1`,
    [enteId],
  );
  const riga = r.rows[0];
  if (!riga) {
    return null;
  }
  return {
    stalliGestiti: riga.stalli_gestiti,
    sosteAttive: riga.soste_attive,
    segnalazioniNonChiuse: riga.segnalazioni_non_chiuse,
  };
}

// --- Ausiliari del Traffico (SD_ADM_2, SD_OP_1 2.1)

const SELEZIONE_AUSILIARIO = `
  SELECT a.id, u.email, a.nome, a.cognome, a.ente_preposto_id, e.nome AS ente, a.stato_dell_account
  FROM ausiliario_del_traffico AS a
  JOIN utente AS u ON u.id = a.id
  JOIN ente_preposto AS e ON e.id = a.ente_preposto_id`;

type RigaAusiliario = {
  id: string;
  email: string;
  nome: string;
  cognome: string;
  ente_preposto_id: string;
  ente: string;
  stato_dell_account: StatoDellAccount;
};

function ausiliarioDa(riga: RigaAusiliario): Ausiliario {
  return {
    id: Number(riga.id),
    email: riga.email,
    nome: riga.nome,
    cognome: riga.cognome,
    enteId: Number(riga.ente_preposto_id),
    statoDellAccount: riga.stato_dell_account,
  };
}

/** Tutti gli ausiliari, ordinati per nome dell'ente, cognome, nome e id. */
export async function ausiliari(es: Esecutore): Promise<(Ausiliario & { ente: string })[]> {
  const r = await interroga<RigaAusiliario>(
    es,
    `${SELEZIONE_AUSILIARIO} ORDER BY e.nome, a.cognome, a.nome, a.id`,
  );
  return r.rows.map((riga) => ({ ...ausiliarioDa(riga), ente: riga.ente }));
}

/** Ausiliari ATTIVO dell'ente, ordinati per cognome, nome e id. */
export async function ausiliariAttiviDellEnte(
  es: Esecutore,
  enteId: number,
): Promise<Ausiliario[]> {
  const r = await interroga<RigaAusiliario>(
    es,
    `${SELEZIONE_AUSILIARIO}
     WHERE a.ente_preposto_id = $1 AND a.stato_dell_account = 'ATTIVO'
     ORDER BY a.cognome, a.nome, a.id`,
    [enteId],
  );
  return r.rows.map(ausiliarioDa);
}

export async function trovaAusiliario(es: Esecutore, id: number): Promise<Ausiliario | null> {
  const r = await interroga<RigaAusiliario>(es, `${SELEZIONE_AUSILIARIO} WHERE a.id = $1`, [id]);
  return r.rows[0] ? ausiliarioDa(r.rows[0]) : null;
}

/**
 * Crea utente, ausiliario (ATTIVO) e associazione «gestisce l'account di» con l'amministratore,
 * in una sola istruzione; restituisce l'id.
 */
export async function creaAusiliario(
  es: Esecutore,
  dati: {
    email: string;
    hashPassword: string;
    nome: string;
    cognome: string;
    enteId: number;
    amministratoreId: number;
  },
): Promise<number> {
  const r = await interroga<{ id: string }>(
    es,
    `WITH nuovo_utente AS (
       INSERT INTO utente (email, hash_password, ruolo)
       VALUES ($1, $2, 'AUSILIARIO_DEL_TRAFFICO') RETURNING id
     ), nuovo_ausiliario AS (
       INSERT INTO ausiliario_del_traffico (id, nome, cognome, ente_preposto_id)
       SELECT id, $3, $4, $5 FROM nuovo_utente RETURNING id
     )
     INSERT INTO gestione_account_ausiliario (amministratore_id, ausiliario_del_traffico_id)
     SELECT $6, id FROM nuovo_ausiliario RETURNING ausiliario_del_traffico_id AS id`,
    [dati.email, dati.hashPassword, dati.nome, dati.cognome, dati.enteId, dati.amministratoreId],
  );
  return Number(r.rows[0].id);
}

/** Aggiorna email, nome, cognome ed ente; false se l'ausiliario non esiste. */
export async function aggiornaAusiliario(
  es: Esecutore,
  id: number,
  dati: { email: string; nome: string; cognome: string; enteId: number },
): Promise<boolean> {
  const r = await interroga(
    es,
    `WITH aggiornato AS (
       UPDATE ausiliario_del_traffico SET nome = $2, cognome = $3, ente_preposto_id = $4
       WHERE id = $1 RETURNING id
     )
     UPDATE utente SET email = $5 WHERE id IN (SELECT id FROM aggiornato)`,
    [id, dati.nome, dati.cognome, dati.enteId, dati.email],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Porta l'account a DISATTIVATO; false se l'ausiliario non esiste. */
export async function disattivaAusiliario(es: Esecutore, id: number): Promise<boolean> {
  const r = await interroga(
    es,
    "UPDATE ausiliario_del_traffico SET stato_dell_account = 'DISATTIVATO' WHERE id = $1",
    [id],
  );
  return (r.rowCount ?? 0) > 0;
}
