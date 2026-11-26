// Accesso ai dati di wallet, movimenti e soste.
import type { PoolClient } from "pg";
import { ErroreDominio } from "./errori.ts";
import { interroga, type Esecutore } from "./esecutore.ts";

export type StatoSosta = "ATTIVA" | "SCADUTA" | "TERMINATA";
export type Pagamento = "PAGATA" | "GRATUITA";

export type Sosta = {
  id: number;
  automobilistaId: number;
  veicoloId: number;
  targa: string;
  stalloId: number;
  stato: StatoSosta;
  orarioDiAvvio: Date;
  orarioDiScadenza: Date;
  pagamento: Pagamento;
  dichiarazioneDiPermesso: string | null;
  fotoDelPermesso: Buffer | null;
};

type RigaSosta = {
  id: string;
  automobilista_id: string;
  veicolo_id: string;
  targa: string;
  stallo_id: string;
  stato: StatoSosta;
  orario_di_avvio: Date;
  orario_di_scadenza: Date;
  pagamento: Pagamento;
  dichiarazione_di_permesso: string | null;
  foto_del_permesso: Buffer | null;
};

const SELEZIONE_SOSTA = `
  SELECT so.id, so.automobilista_id, so.veicolo_id, v.targa, so.stallo_id, so.stato,
         so.orario_di_avvio, so.orario_di_scadenza, so.pagamento,
         so.dichiarazione_di_permesso, so.foto_del_permesso
  FROM sosta AS so
  JOIN veicolo AS v ON v.id = so.veicolo_id`;

function sostaDa(riga: RigaSosta): Sosta {
  return {
    id: Number(riga.id),
    automobilistaId: Number(riga.automobilista_id),
    veicoloId: Number(riga.veicolo_id),
    targa: riga.targa,
    stalloId: Number(riga.stallo_id),
    stato: riga.stato,
    orarioDiAvvio: riga.orario_di_avvio,
    orarioDiScadenza: riga.orario_di_scadenza,
    pagamento: riga.pagamento,
    dichiarazioneDiPermesso: riga.dichiarazione_di_permesso,
    fotoDelPermesso: riga.foto_del_permesso,
  };
}

export type MovimentoDelWallet = {
  id: number;
  walletVirtualeId: number;
  tipoDiMovimento: "RICARICA" | "ADDEBITO";
  importo: number;
  dataEOra: Date;
  sostaId: number | null;
};

type RigaMovimento = {
  id: string;
  wallet_virtuale_id: string;
  tipo_di_movimento: "RICARICA" | "ADDEBITO";
  importo: number;
  data_e_ora: Date;
  sosta_id: string | null;
};

const COLONNE_MOVIMENTO =
  "id, wallet_virtuale_id, tipo_di_movimento, importo, data_e_ora, sosta_id";

/**
 * Addebita `importo` centesimi sul wallet per la sosta indicata (RF_WALLET_2).
 * Blocca la riga del wallet con SELECT … FOR UPDATE, calcola il saldo dai movimenti e rifiuta con
 * SALDO_INSUFFICIENTE se l'importo lo supera: due addebiti simultanei non portano mai a un saldo
 * negativo. Va chiamata solo dentro eseguiInTransazione: fuori da una transazione il FOR UPDATE
 * non protegge. La sosta deve già esistere (il movimento la richiede all'inserimento).
 */
export async function addebita(
  client: PoolClient,
  dati: { walletVirtualeId: number; sostaId: number; importo: number; dataEOra: Date },
): Promise<MovimentoDelWallet> {
  const wallet = await interroga(
    client,
    "SELECT id FROM wallet_virtuale WHERE id = $1 FOR UPDATE",
    [dati.walletVirtualeId],
  );
  if (wallet.rows.length === 0) {
    throw new ErroreDominio("WALLET_INESISTENTE");
  }

  const saldo = await interroga<{ saldo: string }>(
    client,
    "SELECT saldo::text AS saldo FROM saldo_wallet_virtuale WHERE wallet_virtuale_id = $1",
    [dati.walletVirtualeId],
  );
  if (dati.importo > Number(saldo.rows[0].saldo)) {
    throw new ErroreDominio("SALDO_INSUFFICIENTE");
  }

  const inserito = await interroga<RigaMovimento>(
    client,
    `INSERT INTO movimento_del_wallet (wallet_virtuale_id, tipo_di_movimento, importo, data_e_ora, sosta_id)
     VALUES ($1, 'ADDEBITO', $2, $3, $4)
     RETURNING ${COLONNE_MOVIMENTO}`,
    [dati.walletVirtualeId, dati.importo, dati.dataEOra, dati.sostaId],
  );
  return movimentoDa(inserito.rows[0]);
}

function movimentoDa(riga: RigaMovimento): MovimentoDelWallet {
  return {
    id: Number(riga.id),
    walletVirtualeId: Number(riga.wallet_virtuale_id),
    tipoDiMovimento: riga.tipo_di_movimento,
    importo: riga.importo,
    dataEOra: riga.data_e_ora,
    sostaId: riga.sosta_id === null ? null : Number(riga.sosta_id),
  };
}

// --- Wallet e movimenti (SD_AUTH_1 3.3, SD_WALLET_1, SD_WALLET_3, SD_SOSTA_1/2 5.1)

/** Crea il wallet dell'automobilista; restituisce l'id. */
export async function creaWallet(es: Esecutore, automobilistaId: number): Promise<number> {
  const r = await interroga<{ id: string }>(
    es,
    "INSERT INTO wallet_virtuale (automobilista_id) VALUES ($1) RETURNING id",
    [automobilistaId],
  );
  return Number(r.rows[0].id);
}

/** Wallet dell'automobilista con il saldo calcolato dai movimenti; null se non ne ha uno. */
export async function trovaWalletDiAutomobilista(
  es: Esecutore,
  automobilistaId: number,
): Promise<{ id: number; saldo: number } | null> {
  const r = await interroga<{ wallet_virtuale_id: string; saldo: string }>(
    es,
    "SELECT wallet_virtuale_id, saldo::text AS saldo FROM saldo_wallet_virtuale WHERE automobilista_id = $1",
    [automobilistaId],
  );
  const riga = r.rows[0];
  return riga ? { id: Number(riga.wallet_virtuale_id), saldo: Number(riga.saldo) } : null;
}

export async function registraRicarica(
  es: Esecutore,
  dati: { walletVirtualeId: number; importo: number; dataEOra: Date },
): Promise<MovimentoDelWallet> {
  const r = await interroga<RigaMovimento>(
    es,
    `INSERT INTO movimento_del_wallet (wallet_virtuale_id, tipo_di_movimento, importo, data_e_ora)
     VALUES ($1, 'RICARICA', $2, $3)
     RETURNING ${COLONNE_MOVIMENTO}`,
    [dati.walletVirtualeId, dati.importo, dati.dataEOra],
  );
  return movimentoDa(r.rows[0]);
}

/**
 * Cronologia del wallet dal più recente (data e ora decrescente, poi id decrescente), con la
 * targa della sosta per gli addebiti (null per le ricariche).
 */
export async function movimenti(
  es: Esecutore,
  walletVirtualeId: number,
): Promise<(MovimentoDelWallet & { targa: string | null })[]> {
  const r = await interroga<RigaMovimento & { targa: string | null }>(
    es,
    `SELECT m.id, m.wallet_virtuale_id, m.tipo_di_movimento, m.importo, m.data_e_ora, m.sosta_id, v.targa
     FROM movimento_del_wallet AS m
     LEFT JOIN sosta AS so ON so.id = m.sosta_id
     LEFT JOIN veicolo AS v ON v.id = so.veicolo_id
     WHERE m.wallet_virtuale_id = $1
     ORDER BY m.data_e_ora DESC, m.id DESC`,
    [walletVirtualeId],
  );
  return r.rows.map((riga) => ({ ...movimentoDa(riga), targa: riga.targa }));
}

// --- Soste (SD_SOSTA_1, SD_SOSTA_2, SD_SOSTA_7, SD_IOT_1, SD_IOT_2, SD_ANPR_1, SD_OP_3, SD_OP_5)

/** Crea la sosta in stato ATTIVA; restituisce l'id. */
export async function creaSosta(
  es: Esecutore,
  dati: {
    automobilistaId: number;
    veicoloId: number;
    stalloId: number;
    orarioDiAvvio: Date;
    orarioDiScadenza: Date;
    pagamento: Pagamento;
    dichiarazioneDiPermesso?: string;
    fotoDelPermesso?: Buffer;
  },
): Promise<number> {
  const r = await interroga<{ id: string }>(
    es,
    `INSERT INTO sosta (automobilista_id, veicolo_id, stallo_id, stato, orario_di_avvio,
                        orario_di_scadenza, pagamento, dichiarazione_di_permesso, foto_del_permesso)
     VALUES ($1, $2, $3, 'ATTIVA', $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      dati.automobilistaId,
      dati.veicoloId,
      dati.stalloId,
      dati.orarioDiAvvio,
      dati.orarioDiScadenza,
      dati.pagamento,
      dati.dichiarazioneDiPermesso ?? null,
      dati.fotoDelPermesso ?? null,
    ],
  );
  return Number(r.rows[0].id);
}

export async function trovaSosta(es: Esecutore, id: number): Promise<Sosta | null> {
  const r = await interroga<RigaSosta>(es, `${SELEZIONE_SOSTA} WHERE so.id = $1`, [id]);
  return r.rows[0] ? sostaDa(r.rows[0]) : null;
}

export async function sostaAttivaPerVeicolo(
  es: Esecutore,
  veicoloId: number,
): Promise<Sosta | null> {
  const r = await interroga<RigaSosta>(
    es,
    `${SELEZIONE_SOSTA} WHERE so.veicolo_id = $1 AND so.stato = 'ATTIVA'`,
    [veicoloId],
  );
  return r.rows[0] ? sostaDa(r.rows[0]) : null;
}

export async function sostaAttivaSuStallo(es: Esecutore, stalloId: number): Promise<Sosta | null> {
  const r = await interroga<RigaSosta>(
    es,
    `${SELEZIONE_SOSTA} WHERE so.stallo_id = $1 AND so.stato = 'ATTIVA'`,
    [stalloId],
  );
  return r.rows[0] ? sostaDa(r.rows[0]) : null;
}

/** La sosta più recente (per orario di avvio, poi id) della targa sullo stallo, in qualsiasi stato. */
export async function sostaPerTargaSuStallo(
  es: Esecutore,
  targa: string,
  stalloId: number,
): Promise<Sosta | null> {
  const r = await interroga<RigaSosta>(
    es,
    `${SELEZIONE_SOSTA} WHERE v.targa = $1 AND so.stallo_id = $2
     ORDER BY so.orario_di_avvio DESC, so.id DESC LIMIT 1`,
    [targa, stalloId],
  );
  return r.rows[0] ? sostaDa(r.rows[0]) : null;
}

/** Soste ATTIVA dell'automobilista, per orario di avvio e poi id. */
export async function sosteAttiveDiAutomobilista(
  es: Esecutore,
  automobilistaId: number,
): Promise<Sosta[]> {
  const r = await interroga<RigaSosta>(
    es,
    `${SELEZIONE_SOSTA} WHERE so.automobilista_id = $1 AND so.stato = 'ATTIVA'
     ORDER BY so.orario_di_avvio, so.id`,
    [automobilistaId],
  );
  return r.rows.map(sostaDa);
}

/** Posticipa la scadenza di una sosta ATTIVA; false se la sosta non esiste o non è attiva. */
export async function aggiornaScadenza(
  es: Esecutore,
  sostaId: number,
  nuovaScadenza: Date,
): Promise<boolean> {
  const r = await interroga(
    es,
    "UPDATE sosta SET orario_di_scadenza = $2 WHERE id = $1 AND stato = 'ATTIVA'",
    [sostaId, nuovaScadenza],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Id delle soste ATTIVA con scadenza raggiunta all'istante, per scadenza e poi id. */
export async function sosteDaScadere(es: Esecutore, istante: Date): Promise<number[]> {
  const r = await interroga<{ id: string }>(
    es,
    `SELECT id FROM sosta WHERE stato = 'ATTIVA' AND orario_di_scadenza <= $1
     ORDER BY orario_di_scadenza, id`,
    [istante],
  );
  return r.rows.map((riga) => Number(riga.id));
}

/** ATTIVA → SCADUTA; false se la sosta non esiste o non è attiva. */
export async function impostaSostaScaduta(es: Esecutore, sostaId: number): Promise<boolean> {
  const r = await interroga(
    es,
    "UPDATE sosta SET stato = 'SCADUTA' WHERE id = $1 AND stato = 'ATTIVA'",
    [sostaId],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Porta a TERMINATA tutte le soste SCADUTA dello stallo ed elimina dichiarazione e foto del
 * permesso (NRF_LEG_2); restituisce quante.
 */
export async function terminaSosteScaduteDelloStallo(
  es: Esecutore,
  stalloId: number,
): Promise<number> {
  const r = await interroga(
    es,
    `UPDATE sosta SET stato = 'TERMINATA', dichiarazione_di_permesso = NULL, foto_del_permesso = NULL
     WHERE stallo_id = $1 AND stato = 'SCADUTA'`,
    [stalloId],
  );
  return r.rowCount ?? 0;
}
