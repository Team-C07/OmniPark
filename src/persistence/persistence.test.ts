import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { creaConfigurazionePool, SERVERLESS_POOL_CONFIG } from "./db";
import { eseguiMigrazioni, leggiFileMigrazioni, type FileMigrazione } from "./migrate";
import { eseguiResetSchema, verificaSicurezzaReset } from "./reset";

describe("Persistenza - Configurazione pool serverless", () => {
  it("configura il pool con limite connessioni contenuto da DATABASE_URL", () => {
    const cfg = creaConfigurazionePool(
      "postgresql://u:p@ep-dev.neon.tech/omnipark?sslmode=require",
    );
    expect(cfg.max).toBe(SERVERLESS_POOL_CONFIG.max);
    expect(cfg.max).toBeLessThanOrEqual(5);
    expect(cfg.allowExitOnIdle).toBe(true);
  });
  it("rifiuta una DATABASE_URL mancante o vuota", () => {
    expect(() => creaConfigurazionePool("")).toThrow("DATABASE_URL non configurata");
  });
});
describe("Persistenza - Migrazioni versionate e idempotenti", () => {
  it("legge e ordina i file SQL numerati ignorando altri file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-mig-"));
    try {
      fs.writeFileSync(path.join(dir, "002_b.sql"), "SELECT 2;");
      fs.writeFileSync(path.join(dir, "001_a.sql"), "SELECT 1;");
      fs.writeFileSync(path.join(dir, "note.txt"), "skip");
      expect(leggiFileMigrazioni(dir).map((m) => m.nome)).toEqual(["001_a.sql", "002_b.sql"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("applica le migrazioni una sola volta garantendo idempotenza", async () => {
    const ok = new Set<string>();
    const q: string[] = [];
    const client = {
      query: async (sql: string, p?: unknown[]) => {
        const s = sql.trim();
        q.push(s);
        if (s.startsWith("SELECT version"))
          return { rows: Array.from(ok).map((version) => ({ version })) };
        if (s.startsWith("INSERT INTO")) {
          ok.add(String(p?.[0]));
          return { rows: [] };
        }
        return { rows: [] };
      },
    };
    const migs: FileMigrazione[] = [{ nome: "001_init.sql", sql: "CREATE TABLE t (id INT);" }];
    expect((await eseguiMigrazioni(client as never, migs)).applicate).toEqual(["001_init.sql"]);
    q.length = 0;
    const res2 = await eseguiMigrazioni(client as never, migs);
    expect(res2.applicate).toEqual([]);
    expect(res2.giaPresenti).toEqual(["001_init.sql"]);
    expect(q.some((x) => x.includes("CREATE TABLE t"))).toBe(false);
  });
  it("esegue ROLLBACK se una migrazione fallisce", async () => {
    const q: string[] = [];
    const client = {
      query: async (sql: string) => {
        const s = sql.trim();
        q.push(s);
        if (s.startsWith("SELECT version")) return { rows: [] };
        if (s === "ERR") throw new Error("SQL fail");
        return { rows: [] };
      },
    };
    await expect(
      eseguiMigrazioni(client as never, [{ nome: "001_e.sql", sql: "ERR" }]),
    ).rejects.toThrow("SQL fail");
    expect(q).toContain("ROLLBACK");
  });
});

describe("Persistenza - Reset dello schema", () => {
  it("blocca il reset in produzione", () => {
    expect(() =>
      verificaSicurezzaReset("postgresql://u:p@dev.neon.tech/db", { NODE_ENV: "production" }),
    ).toThrow("ambiente di produzione");
    expect(() =>
      verificaSicurezzaReset("postgresql://u:p@ep.neon.tech/db_prod", { NODE_ENV: "development" }),
    ).toThrow("database di produzione");
  });
  it("elimina e ricrea lo schema public in sviluppo", async () => {
    verificaSicurezzaReset("postgresql://u:p@dev.neon.tech/db", { NODE_ENV: "development" });
    const sqls: string[] = [];
    await eseguiResetSchema({
      query: async (s: string) => {
        sqls.push(s);
        return { rows: [] };
      },
    } as never);
    expect(sqls).toEqual([
      "DROP SCHEMA IF EXISTS public CASCADE",
      "CREATE SCHEMA public",
      "GRANT ALL ON SCHEMA public TO CURRENT_USER",
      "GRANT ALL ON SCHEMA public TO public",
    ]);
  });
});
