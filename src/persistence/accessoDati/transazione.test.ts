import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import { eseguiInTransazione } from "./transazione";

// Test frame TF-BASE-05 di docs/test/cp_persistenza_base.md (OMP-34): pool finto, senza database.

describe("OMP-34 · TCS base della persistenza · transazione con pool finto", () => {
  it("ISSUE_5 · TF-BASE-05 · l'operazione lancia e anche il ROLLBACK lancia → errore dell'operazione, release(true) una sola volta", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.trim().toUpperCase().startsWith("ROLLBACK")) {
        throw new Error("rollback non riuscito");
      }
      return { rows: [], rowCount: 0 };
    });
    const release = vi.fn();
    const clientFinto = { query, release } as unknown as PoolClient;
    const poolFinto = { connect: vi.fn(async () => clientFinto) } as unknown as Pool;
    const erroreOperazione = new Error("operazione fallita");

    await expect(
      eseguiInTransazione(async () => {
        throw erroreOperazione;
      }, poolFinto),
    ).rejects.toBe(erroreOperazione);

    expect(query.mock.calls.some(([sql]) => sql.trim().toUpperCase().startsWith("ROLLBACK"))).toBe(
      true,
    );
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(true);
  });
});
