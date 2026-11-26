import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  annullaTransazioneDiTest,
  chiudiDatabaseDiTest,
  iniziaTransazioneDiTest,
  preparaDatabaseDiTest,
} from "../test/databaseDiTest";
import {
  ErroreDominio,
  TRIGGER_SPECIFICI,
  VINCOLI_SPECIFICI,
  VINCOLI_UNICI_GENERICI,
  type CodiceErrore,
} from "./errori";
import { interroga } from "./esecutore";

// Test frame TF-BASE-25…36 e 45…47 di docs/test/cp_persistenza_base.md (OMP-34): codici specifici
// e trigger con errori veri del database, coerenza delle tabelle di traduzione con lo schema.
// Ogni frame gira in una transazione annullata alla fine.

const ISTANTE = "2026-11-20 09:00:00+01";
const SCADENZA = "2026-11-20 10:00:00+01";

describe("OMP-34 · TCS base della persistenza · errori veri del database e catalogo", () => {
  let client: PoolClient;

  beforeAll(async () => {
    await preparaDatabaseDiTest();
  });

  afterAll(async () => {
    await chiudiDatabaseDiTest();
  });

  beforeEach(async () => {
    client = await iniziaTransazioneDiTest();
  });

  afterEach(async () => {
    await annullaTransazioneDiTest();
  });

  async function rifiutata(
    sql: string,
    parametri: unknown[],
    codice: CodiceErrore,
  ): Promise<ErroreDominio> {
    let ottenuto: unknown;
    try {
      await interroga(client, sql, parametri);
    } catch (errore) {
      ottenuto = errore;
    }
    expect(ottenuto).toBeInstanceOf(ErroreDominio);
    expect((ottenuto as ErroreDominio).codice).toBe(codice);
    return ottenuto as ErroreDominio;
  }

  const INSERISCI_SOSTA_ATTIVA = `INSERT INTO sosta (automobilista_id, veicolo_id, stallo_id, stato, orario_di_avvio, orario_di_scadenza, pagamento)
     VALUES ($1, $2, $3, 'ATTIVA', $4, $5, 'PAGATA')`;

  it("VD_1 · TF-BASE-25 · utente con email PAOLO.FERRI@omnipark.example → EMAIL_GIA_REGISTRATA, messaggio senza email", async () => {
    const email = "PAOLO.FERRI@omnipark.example";
    const errore = await rifiutata(
      "INSERT INTO utente (email, hash_password, ruolo) VALUES ($1, $2, $3)",
      [email, "hash-di-prova", "AUSILIARIO_DEL_TRAFFICO"],
      "EMAIL_GIA_REGISTRATA",
    );
    expect(errore.messaggio.toLowerCase()).not.toContain(email.toLowerCase());
    expect(errore.message.toLowerCase()).not.toContain(email.toLowerCase());
  });

  it("SCHEMA · TF-BASE-26 · automobilista_veicolo (7, 1) già presente → TARGA_GIA_NEL_PROFILO", async () => {
    await rifiutata(
      "INSERT INTO automobilista_veicolo (automobilista_id, veicolo_id) VALUES ($1, $2)",
      [7, 1],
      "TARGA_GIA_NEL_PROFILO",
    );
  });

  it("RF_SOSTA_1 · TF-BASE-27 · seconda sosta ATTIVA per il veicolo 3 → SOSTA_GIA_ATTIVA_PER_VEICOLO", async () => {
    await interroga(client, INSERISCI_SOSTA_ATTIVA, [8, 3, 17, ISTANTE, SCADENZA]);
    await rifiutata(
      INSERISCI_SOSTA_ATTIVA,
      [8, 3, 16, ISTANTE, SCADENZA],
      "SOSTA_GIA_ATTIVA_PER_VEICOLO",
    );
  });

  it("SCHEMA · TF-BASE-28 · seconda sosta ATTIVA sullo stallo 16 → SOSTA_GIA_ATTIVA_PER_STALLO", async () => {
    await interroga(client, INSERISCI_SOSTA_ATTIVA, [7, 1, 16, ISTANTE, SCADENZA]);
    await rifiutata(
      INSERISCI_SOSTA_ATTIVA,
      [8, 3, 16, ISTANTE, SCADENZA],
      "SOSTA_GIA_ATTIVA_PER_STALLO",
    );
  });

  it("VD_4 · TF-BASE-29 · ricarica da 500 sul wallet 2 con sosta_id 2 → MOVIMENTO_NON_COERENTE", async () => {
    await rifiutata(
      `INSERT INTO movimento_del_wallet (wallet_virtuale_id, tipo_di_movimento, importo, data_e_ora, sosta_id)
       VALUES ($1, 'RICARICA', $2, $3, $4)`,
      [2, 500, ISTANTE, 2],
      "MOVIMENTO_NON_COERENTE",
    );
  });

  it("VD_16 · TF-BASE-30 · segnalazione APERTA per la targa HB204KM già segnalata → SEGNALAZIONE_NON_CHIUSA_GIA_PRESENTE", async () => {
    await rifiutata(
      `INSERT INTO segnalazione (stallo_id, stato, motivo, targa_rilevata, data_e_ora_della_lettura)
       VALUES ($1, 'APERTA', 'SOSTA_ASSENTE', $2, $3)`,
      [3, "HB204KM", ISTANTE],
      "SEGNALAZIONE_NON_CHIUSA_GIA_PRESENTE",
    );
  });

  it("VD_20 · TF-BASE-31 · stallo 16 OCCUPATO con occupazione NESSUN_VEICOLO → STATO_STALLO_NON_VALIDO", async () => {
    const stallo = await interroga<{ occupazione_rilevata: string | null }>(
      client,
      "SELECT occupazione_rilevata FROM stallo WHERE id = 16",
    );
    expect(stallo.rows).toEqual([{ occupazione_rilevata: "NESSUN_VEICOLO" }]);
    await rifiutata(
      "UPDATE stallo SET stato = 'OCCUPATO' WHERE id = $1",
      [16],
      "STATO_STALLO_NON_VALIDO",
    );
  });

  it("SCHEMA · TF-BASE-32 · stallo_preferito (8, 11) già presente → GIA_TRA_I_PREFERITI", async () => {
    await rifiutata(
      "INSERT INTO stallo_preferito (automobilista_id, stallo_id) VALUES ($1, $2)",
      [8, 11],
      "GIA_TRA_I_PREFERITI",
    );
  });

  it("VD_12 · TF-BASE-33 · seconda verifica del permesso per la sosta 4 → VERIFICA_GIA_REGISTRATA", async () => {
    await rifiutata(
      `INSERT INTO verifica_del_permesso (sosta_id, ausiliario_del_traffico_id, esito, data_e_ora)
       VALUES ($1, $2, 'NON_CONFORME', $3)`,
      [4, 2, ISTANTE],
      "VERIFICA_GIA_REGISTRATA",
    );
  });

  it("SCHEMA · TF-BASE-34 · pagamento della sosta 2 cambiato in GRATUITA → PAGAMENTO_NON_MODIFICABILE", async () => {
    await rifiutata(
      "UPDATE sosta SET pagamento = 'GRATUITA' WHERE id = $1",
      [2],
      "PAGAMENTO_NON_MODIFICABILE",
    );
  });

  it("VD_12 · TF-BASE-35 · esito della verifica 1 cambiato in NON_CONFORME → VERIFICA_GIA_REGISTRATA", async () => {
    await rifiutata(
      "UPDATE verifica_del_permesso SET esito = 'NON_CONFORME' WHERE id = $1",
      [1],
      "VERIFICA_GIA_REGISTRATA",
    );
  });

  it("VD_13 · TF-BASE-36 · segnalazione dalla verifica 1 CONFORME → STATO_SEGNALAZIONE_NON_VALIDO", async () => {
    await rifiutata(
      `INSERT INTO segnalazione (stallo_id, ausiliario_del_traffico_id, verifica_del_permesso_id, stato, esito, data_e_ora_della_chiusura)
       VALUES ($1, $2, $3, 'CHIUSA', 'SOSTA_IRREGOLARE_ACCERTATA', $4)`,
      [15, 3, 1, ISTANTE],
      "STATO_SEGNALAZIONE_NON_VALIDO",
    );
  });

  it("SCHEMA · TF-BASE-45 · ogni chiave di VINCOLI_SPECIFICI esiste come vincolo o indice → nessun nome mancante", async () => {
    const nomi = Object.keys(VINCOLI_SPECIFICI);
    const presenti = await interroga<{ nome: string }>(
      client,
      `SELECT c.conname AS nome
       FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE n.nspname = 'public' AND c.conname = ANY($1::text[])
       UNION
       SELECT indexname AS nome FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [nomi],
    );
    const trovati = new Set(presenti.rows.map((r) => r.nome));
    expect(nomi.filter((nome) => !trovati.has(nome))).toEqual([]);
  });

  it("SCHEMA · TF-BASE-46 · ogni chiave di TRIGGER_SPECIFICI esiste come funzione → nessun nome mancante", async () => {
    const nomi = Object.keys(TRIGGER_SPECIFICI);
    const presenti = await interroga<{ nome: string }>(
      client,
      `SELECT p.proname AS nome
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
      [nomi],
    );
    const trovati = new Set(presenti.rows.map((r) => r.nome));
    expect(nomi.filter((nome) => !trovati.has(nome))).toEqual([]);
  });

  it("SCHEMA · TF-BASE-47 · ogni vincolo o indice unico dello schema è classificato → nessun nome scoperto", async () => {
    const unici = await interroga<{ nome: string }>(
      client,
      `SELECT c.conname AS nome
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public' AND c.contype = 'u' AND t.relname <> 'registro_migrazioni'
       UNION
       SELECT i.relname AS nome
       FROM pg_index x
       JOIN pg_class i ON i.oid = x.indexrelid
       JOIN pg_class t ON t.oid = x.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public' AND x.indisunique AND NOT x.indisprimary
         AND t.relname <> 'registro_migrazioni'
         AND NOT EXISTS (
           SELECT 1 FROM pg_constraint c
           WHERE c.conindid = x.indexrelid AND c.conrelid = x.indrelid AND c.contype IN ('p', 'u', 'x')
         )`,
    );
    expect(unici.rows.length).toBeGreaterThan(0);
    const classificati = new Set([...Object.keys(VINCOLI_SPECIFICI), ...VINCOLI_UNICI_GENERICI]);
    const scoperti = unici.rows.map((r) => r.nome).filter((nome) => !classificati.has(nome));
    expect(scoperti).toEqual([]);
  });
});
