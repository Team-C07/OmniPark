import { createHash } from "node:crypto";

// Logica pura delle migrazioni: nessun accesso al database o al file system.

export type CodiceErroreMigrazione =
  | "NOME_NON_VALIDO"
  | "VERSIONE_DUPLICATA"
  | "TRANSAZIONE_NEL_FILE"
  | "CHECKSUM_DIVERSO"
  | "MIGRAZIONE_SCONOSCIUTA"
  | "MIGRAZIONE_FUORI_ORDINE";

export class ErroreMigrazione extends Error {
  readonly codice: CodiceErroreMigrazione;

  constructor(codice: CodiceErroreMigrazione, messaggio: string) {
    super(messaggio);
    this.name = "ErroreMigrazione";
    this.codice = codice;
  }
}

export type FileMigrazione = {
  versione: number;
  nome: string;
  nomeFile: string;
  sql: string;
  checksum: string;
};

export type MigrazioneRegistrata = {
  versione: number;
  nome: string;
  checksum: string;
};

const FORMATO_NOME = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

// Istruzioni di controllo della transazione su una riga propria: la transazione la apre
// e la chiude l'esecutore. Il punto e virgola distingue BEGIN; dal BEGIN dei blocchi PL/pgSQL.
const ISTRUZIONE_TRANSAZIONE = /^\s*(BEGIN|COMMIT)(\s+(WORK|TRANSACTION))?\s*;/im;

/**
 * Ricava versione e nome dal nome del file (NNNN_descrizione.sql).
 * Restituisce null per i file nascosti (per esempio .gitkeep), che vanno ignorati.
 */
export function analizzaNomeFile(nomeFile: string): { versione: number; nome: string } | null {
  if (nomeFile.startsWith(".")) {
    return null;
  }
  const corrispondenza = FORMATO_NOME.exec(nomeFile);
  const versione = corrispondenza ? Number(corrispondenza[1]) : 0;
  if (!corrispondenza || versione === 0) {
    throw new ErroreMigrazione(
      "NOME_NON_VALIDO",
      `Nome di migrazione non valido: "${nomeFile}". Il formato è NNNN_descrizione.sql, ` +
        "con versione da 0001 e descrizione in minuscolo con parole separate da _.",
    );
  }
  return { versione, nome: corrispondenza[2] };
}

/** Checksum sha256 esadecimale del contenuto, con i fine riga CRLF normalizzati a LF. */
export function calcolaChecksum(sql: string): string {
  return createHash("sha256").update(normalizzaFineRiga(sql)).digest("hex");
}

/** Valida i file della cartella delle migrazioni e li restituisce ordinati per versione. */
export function preparaMigrazioni(
  file: { nomeFile: string; contenuto: string }[],
): FileMigrazione[] {
  const perVersione = new Map<number, FileMigrazione>();

  for (const { nomeFile, contenuto } of file) {
    const analizzato = analizzaNomeFile(nomeFile);
    if (!analizzato) {
      continue;
    }

    const esistente = perVersione.get(analizzato.versione);
    if (esistente) {
      throw new ErroreMigrazione(
        "VERSIONE_DUPLICATA",
        `La versione ${formattaVersione(analizzato.versione)} è usata da due migrazioni: ` +
          `"${esistente.nomeFile}" e "${nomeFile}".`,
      );
    }

    const sql = normalizzaFineRiga(contenuto);
    if (ISTRUZIONE_TRANSAZIONE.test(sql)) {
      throw new ErroreMigrazione(
        "TRANSAZIONE_NEL_FILE",
        `La migrazione "${nomeFile}" contiene BEGIN o COMMIT: ogni migrazione viene già ` +
          "eseguita in una transazione, il file non deve aprirla né chiuderla.",
      );
    }

    perVersione.set(analizzato.versione, {
      versione: analizzato.versione,
      nome: analizzato.nome,
      nomeFile,
      sql,
      checksum: calcolaChecksum(sql),
    });
  }

  return [...perVersione.values()].sort((a, b) => a.versione - b.versione);
}

/**
 * Confronta i file con le migrazioni già registrate e restituisce, in ordine, quelle da applicare.
 * Lancia un errore se una migrazione applicata è stata modificata o non esiste più,
 * o se una migrazione nuova ha una versione inferiore all'ultima applicata.
 */
export function calcolaPendenti(
  file: FileMigrazione[],
  registrate: MigrazioneRegistrata[],
): FileMigrazione[] {
  const filePerVersione = new Map(file.map((f) => [f.versione, f]));
  let ultimaApplicata = 0;

  for (const registrata of registrate) {
    const corrispondente = filePerVersione.get(registrata.versione);
    const etichetta = `${formattaVersione(registrata.versione)}_${registrata.nome}`;
    if (!corrispondente) {
      throw new ErroreMigrazione(
        "MIGRAZIONE_SCONOSCIUTA",
        `La migrazione ${etichetta} risulta applicata al database ma il file non esiste. ` +
          "Il branch è probabilmente più indietro del database.",
      );
    }
    if (corrispondente.checksum !== registrata.checksum) {
      throw new ErroreMigrazione(
        "CHECKSUM_DIVERSO",
        `La migrazione ${etichetta} è stata modificata dopo essere stata applicata. ` +
          "Le migrazioni sono immutabili: la modifica va fatta con una nuova migrazione.",
      );
    }
    ultimaApplicata = Math.max(ultimaApplicata, registrata.versione);
  }

  const versioniRegistrate = new Set(registrate.map((r) => r.versione));
  const pendenti = file.filter((f) => !versioniRegistrate.has(f.versione));

  const fuoriOrdine = pendenti.find((f) => f.versione < ultimaApplicata);
  if (fuoriOrdine) {
    throw new ErroreMigrazione(
      "MIGRAZIONE_FUORI_ORDINE",
      `La migrazione "${fuoriOrdine.nomeFile}" ha una versione inferiore all'ultima applicata ` +
        `(${formattaVersione(ultimaApplicata)}). Rinumerala dopo l'ultima versione.`,
    );
  }

  return pendenti;
}

function normalizzaFineRiga(testo: string): string {
  return testo.replace(/\r\n/g, "\n");
}

function formattaVersione(versione: number): string {
  return String(versione).padStart(4, "0");
}
