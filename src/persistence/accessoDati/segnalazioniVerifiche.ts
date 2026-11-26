// Accesso ai dati di segnalazioni (con i dati della lettura ANPR) e verifiche del permesso.
// Le letture delle targhe non hanno una tabella: la segnalazione conserva targa e data e ora.
// La segregazione per ente (VD_18) resta al sottosistema Segnalazioni.
import { interroga, type Esecutore } from "./esecutore.ts";
import type { TipoDiStallo } from "./stalliTariffe.ts";

export type StatoSegnalazione = "APERTA" | "PRESA_IN_CARICO" | "CHIUSA";
export type Motivo = "SOSTA_ASSENTE" | "SOSTA_SCADUTA" | "TARGA_NON_CORRISPONDENTE";
export type Esito = "SOSTA_IRREGOLARE_ACCERTATA" | "NON_CONFERMATA";
export type EsitoVerifica = "CONFORME" | "NON_CONFORME";

export type SegnalazioneMappa = {
  id: number;
  stalloId: number;
  numeroStallo: number;
  latitudine: number;
  longitudine: number;
  stato: StatoSegnalazione;
  motivo: Motivo | null;
  targaRilevata: string | null;
  dataEOraDellaLettura: Date | null;
  ausiliarioId: number | null;
  ultimaModifica: Date;
};

export type DettaglioSegnalazione = SegnalazioneMappa & {
  tipoDiStallo: TipoDiStallo;
  enteId: number;
  dataEOraDellaPresaInCarico: Date | null;
  esito: Esito | null;
  dataEOraDellaChiusura: Date | null;
  verificaDelPermessoId: number | null;
  assegnatario: { id: number; nome: string; cognome: string } | null;
};

const SELEZIONE_SEGNALAZIONE = `
  SELECT g.id, g.stallo_id, s.numero AS numero_stallo, s.latitudine, s.longitudine, g.stato,
         g.motivo, g.targa_rilevata, g.data_e_ora_della_lettura, g.ausiliario_del_traffico_id,
         g.ultima_modifica, s.tipo_di_stallo, a.ente_preposto_id, g.data_e_ora_della_presa_in_carico,
         g.esito, g.data_e_ora_della_chiusura, g.verifica_del_permesso_id,
         aus.nome AS nome_assegnatario, aus.cognome AS cognome_assegnatario
  FROM segnalazione AS g
  JOIN stallo AS s ON s.id = g.stallo_id
  JOIN area_di_sosta AS a ON a.id = s.area_di_sosta_id
  LEFT JOIN ausiliario_del_traffico AS aus ON aus.id = g.ausiliario_del_traffico_id`;

type RigaSegnalazione = {
  id: string;
  stallo_id: string;
  numero_stallo: number;
  latitudine: number;
  longitudine: number;
  stato: StatoSegnalazione;
  motivo: Motivo | null;
  targa_rilevata: string | null;
  data_e_ora_della_lettura: Date | null;
  ausiliario_del_traffico_id: string | null;
  ultima_modifica: Date;
  tipo_di_stallo: TipoDiStallo;
  ente_preposto_id: string;
  data_e_ora_della_presa_in_carico: Date | null;
  esito: Esito | null;
  data_e_ora_della_chiusura: Date | null;
  verifica_del_permesso_id: string | null;
  nome_assegnatario: string | null;
  cognome_assegnatario: string | null;
};

function numeroONull(valore: string | null): number | null {
  return valore === null ? null : Number(valore);
}

function segnalazioneMappaDa(riga: RigaSegnalazione): SegnalazioneMappa {
  return {
    id: Number(riga.id),
    stalloId: Number(riga.stallo_id),
    numeroStallo: riga.numero_stallo,
    latitudine: riga.latitudine,
    longitudine: riga.longitudine,
    stato: riga.stato,
    motivo: riga.motivo,
    targaRilevata: riga.targa_rilevata,
    dataEOraDellaLettura: riga.data_e_ora_della_lettura,
    ausiliarioId: numeroONull(riga.ausiliario_del_traffico_id),
    ultimaModifica: riga.ultima_modifica,
  };
}

function dettaglioDa(riga: RigaSegnalazione): DettaglioSegnalazione {
  const ausiliarioId = numeroONull(riga.ausiliario_del_traffico_id);
  return {
    ...segnalazioneMappaDa(riga),
    tipoDiStallo: riga.tipo_di_stallo,
    enteId: Number(riga.ente_preposto_id),
    dataEOraDellaPresaInCarico: riga.data_e_ora_della_presa_in_carico,
    esito: riga.esito,
    dataEOraDellaChiusura: riga.data_e_ora_della_chiusura,
    verificaDelPermessoId: numeroONull(riga.verifica_del_permesso_id),
    assegnatario:
      ausiliarioId === null
        ? null
        : {
            id: ausiliarioId,
            nome: riga.nome_assegnatario ?? "",
            cognome: riga.cognome_assegnatario ?? "",
          },
  };
}

// --- Letture ANPR (SD_ANPR_1)

/** true se per la targa esiste una segnalazione APERTA o PRESA_IN_CARICO (VD_16). */
export async function esisteSegnalazioneNonChiusa(es: Esecutore, targa: string): Promise<boolean> {
  const r = await interroga<{ esiste: boolean }>(
    es,
    `SELECT EXISTS (
       SELECT 1 FROM segnalazione WHERE targa_rilevata = $1 AND stato IN ('APERTA', 'PRESA_IN_CARICO')
     ) AS esiste`,
    [targa],
  );
  return r.rows[0].esiste;
}

/** Crea la segnalazione di una lettura ANPR in stato APERTA; restituisce l'id. */
export async function creaSegnalazioneDaLettura(
  es: Esecutore,
  dati: { stalloId: number; targa: string; dataEOra: Date; motivo: Motivo },
): Promise<number> {
  const r = await interroga<{ id: string }>(
    es,
    `INSERT INTO segnalazione (stallo_id, stato, motivo, targa_rilevata, data_e_ora_della_lettura)
     VALUES ($1, 'APERTA', $2, $3, $4) RETURNING id`,
    [dati.stalloId, dati.motivo, dati.targa, dati.dataEOra],
  );
  return Number(r.rows[0].id);
}

// --- Mappa delle segnalazioni (SD_OP_1)

/** Segnalazioni APERTA e PRESA_IN_CARICO negli stalli dell'ente, per id. */
export async function segnalazioniNonChiuseDellEnte(
  es: Esecutore,
  enteId: number,
): Promise<SegnalazioneMappa[]> {
  const r = await interroga<RigaSegnalazione>(
    es,
    `${SELEZIONE_SEGNALAZIONE}
     WHERE a.ente_preposto_id = $1 AND g.stato IN ('APERTA', 'PRESA_IN_CARICO')
     ORDER BY g.id`,
    [enteId],
  );
  return r.rows.map(segnalazioneMappaDa);
}

/**
 * Segnalazioni dell'ente, in qualsiasi stato, modificate dopo l'istante (per id), e cursore: la
 * massima ultimaModifica restituita (null se nessuna).
 */
export async function segnalazioniModificateDopo(
  es: Esecutore,
  enteId: number,
  istante: Date,
): Promise<{ segnalazioni: SegnalazioneMappa[]; cursore: Date | null }> {
  const r = await interroga<RigaSegnalazione>(
    es,
    `${SELEZIONE_SEGNALAZIONE}
     WHERE a.ente_preposto_id = $1 AND g.ultima_modifica > $2
     ORDER BY g.id`,
    [enteId, istante],
  );
  const segnalazioni = r.rows.map(segnalazioneMappaDa);
  const cursore = segnalazioni.reduce<Date | null>(
    (max, s) => (max === null || s.ultimaModifica > max ? s.ultimaModifica : max),
    null,
  );
  return { segnalazioni, cursore };
}

/**
 * Permessi da verificare (RF_OP_2): soste ATTIVA con dichiarazione e foto in stalli DISABILI o ROSA
 * dell'ente, senza verifica; per id della sosta.
 */
export async function permessiDaVerificare(
  es: Esecutore,
  enteId: number,
): Promise<
  {
    sostaId: number;
    stalloId: number;
    tipoDiStallo: TipoDiStallo;
    latitudine: number;
    longitudine: number;
    targa: string;
  }[]
> {
  const r = await interroga<{
    sosta_id: string;
    stallo_id: string;
    tipo_di_stallo: TipoDiStallo;
    latitudine: number;
    longitudine: number;
    targa: string;
  }>(
    es,
    `SELECT so.id AS sosta_id, s.id AS stallo_id, s.tipo_di_stallo, s.latitudine, s.longitudine, v.targa
     FROM sosta AS so
     JOIN stallo AS s ON s.id = so.stallo_id
     JOIN area_di_sosta AS a ON a.id = s.area_di_sosta_id
     JOIN veicolo AS v ON v.id = so.veicolo_id
     WHERE a.ente_preposto_id = $1
       AND so.stato = 'ATTIVA'
       AND s.tipo_di_stallo IN ('DISABILI', 'ROSA')
       AND so.dichiarazione_di_permesso IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM verifica_del_permesso AS vp WHERE vp.sosta_id = so.id)
     ORDER BY so.id`,
    [enteId],
  );
  return r.rows.map((riga) => ({
    sostaId: Number(riga.sosta_id),
    stalloId: Number(riga.stallo_id),
    tipoDiStallo: riga.tipo_di_stallo,
    latitudine: riga.latitudine,
    longitudine: riga.longitudine,
    targa: riga.targa,
  }));
}

// --- Gestione della segnalazione (SD_OP_1 4.1, SD_OP_2, SD_OP_3 2.1, SD_OP_4, SD_ADM_2 3.a1.5)

export async function dettaglioSegnalazione(
  es: Esecutore,
  id: number,
): Promise<DettaglioSegnalazione | null> {
  const r = await interroga<RigaSegnalazione>(es, `${SELEZIONE_SEGNALAZIONE} WHERE g.id = $1`, [
    id,
  ]);
  return r.rows[0] ? dettaglioDa(r.rows[0]) : null;
}

/** Solo se APERTA: assegna e porta a PRESA_IN_CARICO; false se non è più APERTA o non esiste. */
export async function prendiInCarico(
  es: Esecutore,
  id: number,
  ausiliarioId: number,
  dataEOra: Date,
): Promise<boolean> {
  const r = await interroga(
    es,
    `UPDATE segnalazione
     SET stato = 'PRESA_IN_CARICO', ausiliario_del_traffico_id = $2, data_e_ora_della_presa_in_carico = $3
     WHERE id = $1 AND stato = 'APERTA'`,
    [id, ausiliarioId, dataEOra],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Chiude la segnalazione con esito e data se è APERTA (la assegna a chi chiude) o PRESA_IN_CARICO
 * dallo stesso ausiliario; false altrimenti.
 */
export async function chiudiSegnalazione(
  es: Esecutore,
  id: number,
  ausiliarioId: number,
  esito: Esito,
  dataEOra: Date,
): Promise<boolean> {
  const r = await interroga(
    es,
    `UPDATE segnalazione
     SET stato = 'CHIUSA', ausiliario_del_traffico_id = $2, esito = $3, data_e_ora_della_chiusura = $4
     WHERE id = $1
       AND (stato = 'APERTA' OR (stato = 'PRESA_IN_CARICO' AND ausiliario_del_traffico_id = $2))`,
    [id, ausiliarioId, esito, dataEOra],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function contaSegnalazioniPreseInCarico(
  es: Esecutore,
  ausiliarioId: number,
): Promise<number> {
  const r = await interroga<{ numero: number }>(
    es,
    `SELECT count(*)::int AS numero FROM segnalazione
     WHERE ausiliario_del_traffico_id = $1 AND stato = 'PRESA_IN_CARICO'`,
    [ausiliarioId],
  );
  return r.rows[0].numero;
}

// --- Verifica del permesso (SD_OP_5)

/** Registra l'esito della verifica; una seconda verifica della stessa sosta è rifiutata. */
export async function registraVerifica(
  es: Esecutore,
  dati: { sostaId: number; ausiliarioId: number; esito: EsitoVerifica; dataEOra: Date },
): Promise<number> {
  const r = await interroga<{ id: string }>(
    es,
    `INSERT INTO verifica_del_permesso (sosta_id, ausiliario_del_traffico_id, esito, data_e_ora)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [dati.sostaId, dati.ausiliarioId, dati.esito, dati.dataEOra],
  );
  return Number(r.rows[0].id);
}

/**
 * Segnalazione generata da una verifica non conforme: nasce CHIUSA con esito
 * SOSTA_IRREGOLARE_ACCERTATA, assegnata a chi ha registrato la verifica, senza dati di lettura.
 */
export async function creaSegnalazioneDaVerifica(
  es: Esecutore,
  dati: { verificaId: number; stalloId: number; ausiliarioId: number; dataEOra: Date },
): Promise<number> {
  const r = await interroga<{ id: string }>(
    es,
    `INSERT INTO segnalazione (stallo_id, ausiliario_del_traffico_id, verifica_del_permesso_id, stato,
                               esito, data_e_ora_della_chiusura)
     VALUES ($1, $2, $3, 'CHIUSA', 'SOSTA_IRREGOLARE_ACCERTATA', $4) RETURNING id`,
    [dati.stalloId, dati.ausiliarioId, dati.verificaId, dati.dataEOra],
  );
  return Number(r.rows[0].id);
}
