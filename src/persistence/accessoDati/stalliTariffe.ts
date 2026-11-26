// Accesso ai dati di stalli, tariffe, ultima rilevazione e preferiti.
// Le tariffe non hanno funzioni proprie (nessun SD le modifica): si leggono con lo stallo.
// Delle rilevazioni lo schema conserva solo l'ultima, nello stallo.
import { interroga, type Esecutore } from "./esecutore.ts";

export type TipoDiStallo = "ORDINARIO_A_PAGAMENTO" | "DISABILI" | "ROSA";
export type StatoStallo = "LIBERO" | "OCCUPATO" | "NON_DISPONIBILE" | "SCONOSCIUTO";
export type OccupazioneRilevata = "VEICOLO_PRESENTE" | "NESSUN_VEICOLO";

/** Rettangolo di latitudine e longitudine, estremi inclusi. */
export type Zona = { latMin: number; latMax: number; lonMin: number; lonMax: number };

export type StalloMappa = {
  id: number;
  numero: number;
  latitudine: number;
  longitudine: number;
  tipoDiStallo: TipoDiStallo;
  stato: StatoStallo;
  ultimaModifica: Date;
};

export type DettaglioStallo = StalloMappa & {
  occupazioneRilevata: OccupazioneRilevata | null;
  dataEOraUltimaRilevazione: Date | null;
  areaDiSosta: { id: number; nome: string };
  enteId: number;
  tariffa: {
    id: number;
    costoOrario: number;
    orarioInizioVigenza: string;
    orarioFineVigenza: string;
    durataMassima: number;
  };
};

const COLONNE_MAPPA =
  "s.id, s.numero, s.latitudine, s.longitudine, s.tipo_di_stallo, s.stato, s.ultima_modifica";

type RigaMappa = {
  id: string;
  numero: number;
  latitudine: number;
  longitudine: number;
  tipo_di_stallo: TipoDiStallo;
  stato: StatoStallo;
  ultima_modifica: Date;
};

function stalloMappaDa(riga: RigaMappa): StalloMappa {
  return {
    id: Number(riga.id),
    numero: riga.numero,
    latitudine: riga.latitudine,
    longitudine: riga.longitudine,
    tipoDiStallo: riga.tipo_di_stallo,
    stato: riga.stato,
    ultimaModifica: riga.ultima_modifica,
  };
}

const NELLA_ZONA = "s.latitudine BETWEEN $1 AND $2 AND s.longitudine BETWEEN $3 AND $4";

function parametriZona(zona: Zona): number[] {
  return [zona.latMin, zona.latMax, zona.lonMin, zona.lonMax];
}

// --- Mappa degli stalli (SD_STALLI_1, NRF_PER_3)

/** Stalli della zona, ordinati per id. */
export async function stalliNellaZona(es: Esecutore, zona: Zona): Promise<StalloMappa[]> {
  const r = await interroga<RigaMappa>(
    es,
    `SELECT ${COLONNE_MAPPA} FROM stallo AS s WHERE ${NELLA_ZONA} ORDER BY s.id`,
    parametriZona(zona),
  );
  return r.rows.map(stalloMappaDa);
}

/**
 * Stalli della zona modificati dopo l'istante, ordinati per id, e cursore: la massima
 * ultimaModifica restituita (null se nessuna), da usare come istante della richiesta successiva.
 */
export async function stalliModificatiDopo(
  es: Esecutore,
  zona: Zona,
  istante: Date,
): Promise<{ stalli: StalloMappa[]; cursore: Date | null }> {
  const r = await interroga<RigaMappa>(
    es,
    `SELECT ${COLONNE_MAPPA} FROM stallo AS s
     WHERE ${NELLA_ZONA} AND s.ultima_modifica > $5
     ORDER BY s.id`,
    [...parametriZona(zona), istante],
  );
  const stalli = r.rows.map(stalloMappaDa);
  return { stalli, cursore: massimo(stalli.map((s) => s.ultimaModifica)) };
}

/** Stallo con area, ente, tariffa e ultima rilevazione; null se non esiste. */
export async function trovaStallo(es: Esecutore, id: number): Promise<DettaglioStallo | null> {
  const r = await interroga<
    RigaMappa & {
      occupazione_rilevata: OccupazioneRilevata | null;
      data_e_ora_dell_ultima_rilevazione: Date | null;
      area_id: string;
      area_nome: string;
      ente_preposto_id: string;
      tariffa_id: string;
      costo_orario: number;
      orario_inizio_vigenza: string;
      orario_fine_vigenza: string;
      durata_massima: number;
    }
  >(
    es,
    `SELECT ${COLONNE_MAPPA}, s.occupazione_rilevata, s.data_e_ora_dell_ultima_rilevazione,
            a.id AS area_id, a.nome AS area_nome, a.ente_preposto_id,
            t.id AS tariffa_id, t.costo_orario, t.orario_inizio_vigenza::text AS orario_inizio_vigenza,
            t.orario_fine_vigenza::text AS orario_fine_vigenza, t.durata_massima
     FROM stallo AS s
     JOIN area_di_sosta AS a ON a.id = s.area_di_sosta_id
     JOIN tariffa AS t ON t.id = s.tariffa_id
     WHERE s.id = $1`,
    [id],
  );
  const riga = r.rows[0];
  if (!riga) {
    return null;
  }
  return {
    ...stalloMappaDa(riga),
    occupazioneRilevata: riga.occupazione_rilevata,
    dataEOraUltimaRilevazione: riga.data_e_ora_dell_ultima_rilevazione,
    areaDiSosta: { id: Number(riga.area_id), nome: riga.area_nome },
    enteId: Number(riga.ente_preposto_id),
    tariffa: {
      id: Number(riga.tariffa_id),
      costoOrario: riga.costo_orario,
      orarioInizioVigenza: riga.orario_inizio_vigenza,
      orarioFineVigenza: riga.orario_fine_vigenza,
      durataMassima: riga.durata_massima,
    },
  };
}

// --- Rilevazioni e stato (SD_IOT_1, SD_IOT_2, SD_SOSTA_1 6.3, SD_SOSTA_7)

/**
 * Registra la rilevazione e lo stato calcolato dal chiamante nello stesso UPDATE: i vincoli dello
 * schema legano Libero e Occupato all'ultima rilevazione. false se lo stallo non esiste.
 */
export async function registraRilevazione(
  es: Esecutore,
  stalloId: number,
  dati: { occupazioneRilevata: OccupazioneRilevata; dataEOra: Date; stato: StatoStallo },
): Promise<boolean> {
  const r = await interroga(
    es,
    `UPDATE stallo SET occupazione_rilevata = $2, data_e_ora_dell_ultima_rilevazione = $3, stato = $4
     WHERE id = $1`,
    [stalloId, dati.occupazioneRilevata, dati.dataEOra, dati.stato],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Imposta lo stato dello stallo; false se lo stallo non esiste. */
export async function impostaStatoStallo(
  es: Esecutore,
  stalloId: number,
  stato: StatoStallo,
): Promise<boolean> {
  const r = await interroga(es, "UPDATE stallo SET stato = $2 WHERE id = $1", [stalloId, stato]);
  return (r.rowCount ?? 0) > 0;
}

/** Id degli stalli LIBERO o OCCUPATO con l'ultima rilevazione precedente al limite, ordinati. */
export async function stalliSenzaRilevazioniDa(
  es: Esecutore,
  istanteLimite: Date,
): Promise<number[]> {
  const r = await interroga<{ id: string }>(
    es,
    `SELECT id FROM stallo
     WHERE stato IN ('LIBERO', 'OCCUPATO') AND data_e_ora_dell_ultima_rilevazione < $1
     ORDER BY id`,
    [istanteLimite],
  );
  return r.rows.map((riga) => Number(riga.id));
}

// --- Preferiti (SD_STALLI_3, SD_STALLI_5)

export async function salvaStalloPreferito(
  es: Esecutore,
  automobilistaId: number,
  stalloId: number,
): Promise<void> {
  await interroga(
    es,
    "INSERT INTO stallo_preferito (automobilista_id, stallo_id) VALUES ($1, $2)",
    [automobilistaId, stalloId],
  );
}

export async function salvaAreaPreferita(
  es: Esecutore,
  automobilistaId: number,
  areaDiSostaId: number,
): Promise<void> {
  await interroga(
    es,
    "INSERT INTO area_di_sosta_preferita (automobilista_id, area_di_sosta_id) VALUES ($1, $2)",
    [automobilistaId, areaDiSostaId],
  );
}

/**
 * Stalli preferiti (per id) e aree preferite (per nome, poi id), ciascuna con i suoi stalli (per id).
 */
export async function preferiti(
  es: Esecutore,
  automobilistaId: number,
): Promise<{
  stalli: StalloMappa[];
  aree: { id: number; nome: string; stalli: StalloMappa[] }[];
}> {
  const stalli = await interroga<RigaMappa>(
    es,
    `SELECT ${COLONNE_MAPPA} FROM stallo_preferito AS p
     JOIN stallo AS s ON s.id = p.stallo_id
     WHERE p.automobilista_id = $1
     ORDER BY s.id`,
    [automobilistaId],
  );
  // LEFT JOIN: un'area preferita senza stalli compare con stalli vuoti (righe con stallo NULL).
  const aree = await interroga<
    Omit<RigaMappa, "id"> & { id: string | null; area_id: string; area_nome: string }
  >(
    es,
    `SELECT a.id AS area_id, a.nome AS area_nome, ${COLONNE_MAPPA}
     FROM area_di_sosta_preferita AS p
     JOIN area_di_sosta AS a ON a.id = p.area_di_sosta_id
     LEFT JOIN stallo AS s ON s.area_di_sosta_id = a.id
     WHERE p.automobilista_id = $1
     ORDER BY a.nome, a.id, s.id`,
    [automobilistaId],
  );

  const perArea = new Map<number, { id: number; nome: string; stalli: StalloMappa[] }>();
  for (const riga of aree.rows) {
    const id = Number(riga.area_id);
    let area = perArea.get(id);
    if (!area) {
      area = { id, nome: riga.area_nome, stalli: [] };
      perArea.set(id, area);
    }
    if (riga.id !== null) {
      area.stalli.push(stalloMappaDa({ ...riga, id: riga.id }));
    }
  }
  return { stalli: stalli.rows.map(stalloMappaDa), aree: [...perArea.values()] };
}

function massimo(istanti: Date[]): Date | null {
  return istanti.reduce<Date | null>(
    (max, istante) => (max === null || istante > max ? istante : max),
    null,
  );
}
