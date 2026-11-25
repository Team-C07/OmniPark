import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { applicaMigrazioni, leggiMigrazioni, resettaDatabase } from "./esecutoreMigrazioni";

// Pool finto: registra le query eseguite, restituisce un registro vuoto e
// fallisce sulle query che contengono il testo indicato.
function creaPoolFinto(opzioni: { fallisceSu?: string } = {}) {
  const query: string[] = [];
  let connessioni = 0;
  const client = {
    async query(sql: string) {
      query.push(sql.trim());
      if (opzioni.fallisceSu && sql.includes(opzioni.fallisceSu)) {
        throw new Error("errore simulato");
      }
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  const pool = {
    async connect() {
      connessioni += 1;
      return client;
    },
  } as unknown as Pool;
  return { pool, query, connessioni: () => connessioni };
}

const cartelleTemporanee: string[] = [];

async function cartellaCon(file: Record<string, string>): Promise<string> {
  const cartella = await mkdtemp(join(tmpdir(), "omnipark-migrazioni-"));
  cartelleTemporanee.push(cartella);
  for (const [nome, contenuto] of Object.entries(file)) {
    await writeFile(join(cartella, nome), contenuto);
  }
  return cartella;
}

afterEach(async () => {
  await Promise.all(cartelleTemporanee.splice(0).map((c) => rm(c, { recursive: true })));
});

const LOCK = expect.stringMatching(/^SELECT pg_advisory_xact_lock\(\d+\)$/);
const REGISTRA = expect.stringMatching(/^INSERT INTO registro_migrazioni/);
const CONTROLLA = expect.stringMatching(/^SELECT checksum FROM registro_migrazioni/);

describe("OMP-31 · cartella reale delle migrazioni", () => {
  it("OMP-31 · M-01 · src/persistence/migrations/ → nomi validi, versioni uniche, nessun BEGIN/COMMIT", async () => {
    const migrazioni = await leggiMigrazioni();
    const versioni = migrazioni.map((m) => m.versione);
    expect(versioni).toEqual([...versioni].sort((a, b) => a - b));
  });
});

describe("OMP-31 · esecuzione delle migrazioni", () => {
  it("OMP-31 · X-01 · due migrazioni pendenti → una transazione ciascuna con lock, SQL e registrazione", async () => {
    const cartella = await cartellaCon({
      "0001_prima.sql": "CREATE TABLE prima (id integer);",
      "0002_seconda.sql": "CREATE TABLE seconda (id integer);",
    });
    const { pool, query } = creaPoolFinto();

    const esito = await applicaMigrazioni(pool, { cartella });

    expect(esito).toEqual({ applicate: ["0001_prima.sql", "0002_seconda.sql"], giaPresenti: 0 });
    const dopoLettura = query.slice(query.indexOf("COMMIT") + 1);
    expect(dopoLettura).toEqual([
      "BEGIN",
      LOCK,
      CONTROLLA,
      "CREATE TABLE prima (id integer);",
      REGISTRA,
      "COMMIT",
      "BEGIN",
      LOCK,
      CONTROLLA,
      "CREATE TABLE seconda (id integer);",
      REGISTRA,
      "COMMIT",
    ]);
  });

  it("OMP-31 · X-02 · la seconda migrazione fallisce → ROLLBACK, la terza non viene eseguita", async () => {
    const cartella = await cartellaCon({
      "0001_prima.sql": "CREATE TABLE prima (id integer);",
      "0002_seconda.sql": "CREATE TABLE seconda (id integer);",
      "0003_terza.sql": "CREATE TABLE terza (id integer);",
    });
    const { pool, query } = creaPoolFinto({ fallisceSu: "CREATE TABLE seconda" });

    await expect(applicaMigrazioni(pool, { cartella })).rejects.toThrow("errore simulato");

    expect(query.at(-1)).toBe("ROLLBACK");
    expect(query).not.toContain("CREATE TABLE terza (id integer);");
    expect(query.filter((q) => q.startsWith("INSERT INTO registro_migrazioni"))).toHaveLength(1);
  });

  it("OMP-31 · X-03 · nessuna migrazione pendente → solo la transazione di lettura del registro", async () => {
    const cartella = await cartellaCon({ ".gitkeep": "" });
    const { pool, query, connessioni } = creaPoolFinto();

    const esito = await applicaMigrazioni(pool, { cartella });

    expect(esito).toEqual({ applicate: [], giaPresenti: 0 });
    expect(connessioni()).toBe(1);
    expect(query).toEqual([
      "BEGIN",
      LOCK,
      expect.stringMatching(/^CREATE TABLE IF NOT EXISTS registro_migrazioni/),
      expect.stringMatching(/^SELECT versione, nome, checksum FROM registro_migrazioni/),
      "COMMIT",
    ]);
  });

  it("OMP-31 · X-04 · reset con la guardia che rifiuta → nessuna query eseguita", async () => {
    const { pool, connessioni } = creaPoolFinto();

    await expect(resettaDatabase(pool, { NODE_ENV: "production" })).rejects.toThrow(/rifiutato/);

    expect(connessioni()).toBe(0);
  });

  it("OMP-31 · X-05 · reset consentito → schema ricreato prima di applicare le migrazioni", async () => {
    const cartella = await cartellaCon({ "0001_prima.sql": "CREATE TABLE prima (id integer);" });
    const { pool, query } = creaPoolFinto();

    const esito = await resettaDatabase(pool, { OMNIPARK_AMBIENTE: "sviluppo" }, { cartella });

    expect(esito.applicate).toEqual(["0001_prima.sql"]);
    const ricreazione = query.findIndex((q) => q.startsWith("DROP SCHEMA public CASCADE"));
    expect(ricreazione).toBeGreaterThan(-1);
    expect(query[ricreazione]).toContain("ALTER SCHEMA public OWNER TO pg_database_owner");
    expect(query[ricreazione]).toContain("GRANT USAGE ON SCHEMA public TO PUBLIC");
    expect(ricreazione).toBeLessThan(query.indexOf("CREATE TABLE prima (id integer);"));
  });
});
