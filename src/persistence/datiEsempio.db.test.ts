import { readFile } from "node:fs/promises";
import { scryptSync, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  annullaTransazioneDiTest,
  chiudiDatabaseDiTest,
  iniziaTransazioneDiTest,
  preparaDatabaseDiTest,
} from "./test/databaseDiTest";

// Controlli di integrità del dataset 0002_dati_esempio.sql (OMP-33). Non sono frame di una TCS:
// verificano che i dati di esempio siano quelli documentati e che il reset li riproduca identici.

const FORMATO_HASH = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

function verificaPassword(password: string, hash: string): boolean {
  const parti = FORMATO_HASH.exec(hash);
  if (!parti) {
    return false;
  }
  const [, ln, r, p, sale, attesa] = parti;
  const calcolata = scryptSync(password, Buffer.from(sale, "base64"), 32, {
    N: 2 ** Number(ln),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(calcolata, Buffer.from(attesa, "base64"));
}

// Impronta md5 di ogni tabella dello schema public, righe ordinate per id (o per contenuto se la
// tabella non ha id). Del registro delle migrazioni si esclude applicata_il, che vale l'ora del reset.
async function impronteDelleTabelle(client: PoolClient): Promise<Record<string, string>> {
  const tabelle = await client.query<{ nome: string; ha_id: boolean }>(`
    SELECT t.table_name AS nome,
           EXISTS (
             SELECT 1 FROM information_schema.columns c
             WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'id'
           ) AS ha_id
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name`);

  const impronte: Record<string, string> = {};
  for (const { nome, ha_id } of tabelle.rows) {
    expect(nome).toMatch(/^[a-z_]+$/);
    const righe =
      nome === "registro_migrazioni"
        ? "(SELECT versione, nome, checksum FROM registro_migrazioni) AS r"
        : `"${nome}" AS r`;
    const ordine = ha_id ? "r.id" : "r::text";
    const risultato = await client.query<{ impronta: string }>(
      `SELECT md5(coalesce(string_agg(r::text, E'\\n' ORDER BY ${ordine}), '')) AS impronta FROM ${righe}`,
    );
    impronte[nome] = risultato.rows[0].impronta;
  }

  const sequenze = await client.query<{ nome: string; ultimo: string | null }>(
    "SELECT sequencename AS nome, last_value::text AS ultimo FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename",
  );
  for (const { nome, ultimo } of sequenze.rows) {
    impronte[`sequenza ${nome}`] = ultimo ?? "";
  }
  return impronte;
}

describe("OMP-33 · dati di esempio", () => {
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

  it("OMP-33 · DS-01 · tutti i tipi di stallo e gli stati Libero, Occupato, Sconosciuto; nessuno stallo Non disponibile né sosta in corso", async () => {
    const tipi = await client.query<{ tipo_di_stallo: string }>(
      "SELECT DISTINCT tipo_di_stallo FROM stallo ORDER BY tipo_di_stallo",
    );
    expect(tipi.rows.map((r) => r.tipo_di_stallo)).toEqual([
      "DISABILI",
      "ORDINARIO_A_PAGAMENTO",
      "ROSA",
    ]);

    const stati = await client.query<{ stato: string }>(
      "SELECT DISTINCT stato FROM stallo ORDER BY stato",
    );
    expect(stati.rows.map((r) => r.stato)).toEqual(["LIBERO", "OCCUPATO", "SCONOSCIUTO"]);

    const soste = await client.query<{ stato: string }>("SELECT DISTINCT stato FROM sosta");
    expect(soste.rows.map((r) => r.stato)).toEqual(["TERMINATA"]);
  });

  it("OMP-33 · DS-02 · conteggi per ente: stalli 21/6/3, nessuna sosta attiva, segnalazioni non chiuse 4/1/0", async () => {
    const riepilogo = await client.query<{
      ente: string;
      stalli: number;
      soste_attive: number;
      segnalazioni_non_chiuse: number;
    }>(`
      SELECT e.id::text AS ente,
             (SELECT count(*)::int FROM stallo s JOIN area_di_sosta a ON a.id = s.area_di_sosta_id
               WHERE a.ente_preposto_id = e.id) AS stalli,
             (SELECT count(*)::int FROM sosta so JOIN stallo s ON s.id = so.stallo_id
               JOIN area_di_sosta a ON a.id = s.area_di_sosta_id
               WHERE a.ente_preposto_id = e.id AND so.stato = 'ATTIVA') AS soste_attive,
             (SELECT count(*)::int FROM segnalazione g JOIN stallo s ON s.id = g.stallo_id
               JOIN area_di_sosta a ON a.id = s.area_di_sosta_id
               WHERE a.ente_preposto_id = e.id AND g.stato IN ('APERTA', 'PRESA_IN_CARICO')) AS segnalazioni_non_chiuse
      FROM ente_preposto e ORDER BY e.id`);

    expect(riepilogo.rows).toEqual([
      { ente: "1", stalli: 21, soste_attive: 0, segnalazioni_non_chiuse: 4 },
      { ente: "2", stalli: 6, soste_attive: 0, segnalazioni_non_chiuse: 1 },
      { ente: "3", stalli: 3, soste_attive: 0, segnalazioni_non_chiuse: 0 },
    ]);
  });

  it("OMP-33 · DS-03 · saldi dei wallet 1700/600/500/900/1750 centesimi, mai negativi nella cronologia", async () => {
    const saldi = await client.query<{ wallet: string; saldo: string }>(
      "SELECT wallet_virtuale_id::text AS wallet, saldo::text FROM saldo_wallet_virtuale ORDER BY wallet_virtuale_id",
    );
    expect(saldi.rows).toEqual([
      { wallet: "1", saldo: "1700" },
      { wallet: "2", saldo: "600" },
      { wallet: "3", saldo: "500" },
      { wallet: "4", saldo: "900" },
      { wallet: "5", saldo: "1750" },
    ]);

    const minimo = await client.query<{ minimo: string }>(`
      SELECT min(parziale)::text AS minimo FROM (
        SELECT sum(CASE tipo_di_movimento WHEN 'RICARICA' THEN importo ELSE -importo END)
                 OVER (PARTITION BY wallet_virtuale_id ORDER BY data_e_ora, id) AS parziale
        FROM movimento_del_wallet) AS cronologia`);
    expect(Number(minimo.rows[0].minimo)).toBeGreaterThanOrEqual(0);
  });

  it("OMP-33 · DS-04 · ogni addebito è per una sosta pagata del titolare del wallet", async () => {
    const incoerenti = await client.query(`
      SELECT m.id
      FROM movimento_del_wallet m
      JOIN wallet_virtuale w ON w.id = m.wallet_virtuale_id
      JOIN sosta s ON s.id = m.sosta_id
      WHERE m.tipo_di_movimento = 'ADDEBITO'
        AND (s.automobilista_id <> w.automobilista_id OR s.pagamento <> 'PAGATA')`);
    expect(incoerenti.rows).toEqual([]);
  });

  it("OMP-33 · DS-05 · il dataset non usa l'orologio e le colonne ultima_modifica sono fisse", async () => {
    const sql = await readFile(
      new URL("./migrations/0002_dati_esempio.sql", import.meta.url),
      "utf8",
    );
    expect(sql).not.toMatch(
      /\b(now|clock_timestamp|statement_timestamp|transaction_timestamp|timeofday)\s*\(|current_(timestamp|date|time)|localtime/i,
    );

    const modifiche = await client.query<{ valore: string }>(`
      SELECT DISTINCT ultima_modifica::text AS valore FROM (
        SELECT ultima_modifica FROM stallo UNION ALL SELECT ultima_modifica FROM segnalazione) AS u`);
    expect(modifiche.rows).toHaveLength(1);
  });

  it("OMP-33 · DS-06 · password: hash scrypt in formato PHC con sale distinti; credenziali dimostrative del README valide", async () => {
    const utenti = await client.query<{ id: string; ruolo: string; hash_password: string }>(
      "SELECT id::text, ruolo, hash_password FROM utente ORDER BY id",
    );
    expect(utenti.rows).toHaveLength(11);

    const sali = new Set<string>();
    for (const { hash_password } of utenti.rows) {
      const parti = FORMATO_HASH.exec(hash_password);
      expect(parti?.slice(1, 4)).toEqual(["15", "8", "3"]);
      sali.add(parti?.[4] ?? "");
    }
    expect(sali.size).toBe(11);

    for (const { ruolo, hash_password } of utenti.rows) {
      if (ruolo === "AUSILIARIO_DEL_TRAFFICO") {
        expect(verificaPassword("Demo-Ausiliario-2026", hash_password)).toBe(true);
      }
      if (ruolo === "AUTOMOBILISTA") {
        expect(verificaPassword("Demo-Automobilista-2026", hash_password)).toBe(true);
      }
    }
  });
});

describe("OMP-33 · riproducibilità del reset", () => {
  afterAll(async () => {
    await chiudiDatabaseDiTest();
  });

  it("OMP-33 · DS-07 · due reset consecutivi → stessa impronta md5 di ogni tabella e delle sequenze", async () => {
    await preparaDatabaseDiTest();
    const primo = await iniziaTransazioneDiTest();
    const primaImpronta = await impronteDelleTabelle(primo);
    await annullaTransazioneDiTest();

    await preparaDatabaseDiTest();
    const secondo = await iniziaTransazioneDiTest();
    const secondaImpronta = await impronteDelleTabelle(secondo);
    await annullaTransazioneDiTest();

    expect(Object.keys(primaImpronta)).toContain("stallo");
    expect(secondaImpronta).toEqual(primaImpronta);
  });
});
