import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  annullaTransazioneDiTest,
  chiudiDatabaseDiTest,
  iniziaTransazioneDiTest,
  preparaDatabaseDiTest,
} from "../test/databaseDiTest";

// Test frame di docs/test/cp_inserimento_veicolo.md (OMP-33): vincoli dello schema sull'INSERT in
// veicolo e in automobilista_veicolo (associazione «associa»).

const ID_INESISTENTE = 999999;
const TARGA_NUOVA = "ZZ999ZZ";

async function inserisciVeicolo(client: PoolClient, targa: string | null): Promise<number> {
  const risultato = await client.query<{ id: number }>(
    "INSERT INTO veicolo (targa) VALUES ($1) RETURNING id::int AS id",
    [targa],
  );
  return risultato.rows[0].id;
}

async function associa(
  client: PoolClient,
  automobilistaId: number,
  veicoloId: number,
): Promise<void> {
  await client.query(
    "INSERT INTO automobilista_veicolo (automobilista_id, veicolo_id) VALUES ($1, $2)",
    [automobilistaId, veicoloId],
  );
}

async function targheDelProfilo(client: PoolClient, automobilistaId: number): Promise<string[]> {
  const risultato = await client.query<{ targa: string }>(
    `SELECT v.targa FROM automobilista_veicolo av JOIN veicolo v ON v.id = av.veicolo_id
     WHERE av.automobilista_id = $1 ORDER BY v.targa`,
    [automobilistaId],
  );
  return risultato.rows.map((r) => r.targa);
}

describe("OMP-33 · TCS inserimento del veicolo e associazione al profilo", () => {
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

  it("SCHEMA · TF-VEIC-01 · targa con minuscole → veicolo_targa_normalizzata", async () => {
    await expect(inserisciVeicolo(client, "ab123cd")).rejects.toMatchObject({
      code: "23514",
      constraint: "veicolo_targa_normalizzata",
    });
  });

  it("SCHEMA · TF-VEIC-02 · targa con trattini → veicolo_targa_normalizzata", async () => {
    await expect(inserisciVeicolo(client, "AB-123-CD")).rejects.toMatchObject({
      code: "23514",
      constraint: "veicolo_targa_normalizzata",
    });
  });

  it("SCHEMA · TF-VEIC-03 · targa vuota → veicolo_targa_normalizzata", async () => {
    await expect(inserisciVeicolo(client, "")).rejects.toMatchObject({
      code: "23514",
      constraint: "veicolo_targa_normalizzata",
    });
  });

  it("SCHEMA · TF-VEIC-04 · targa NULL → 23502 targa", async () => {
    await expect(inserisciVeicolo(client, null)).rejects.toMatchObject({
      code: "23502",
      column: "targa",
    });
  });

  it("SCHEMA · TF-VEIC-05 · targa già presente → veicolo_targa_unica", async () => {
    await expect(inserisciVeicolo(client, "EF456GH")).rejects.toMatchObject({
      code: "23505",
      constraint: "veicolo_targa_unica",
    });
  });

  it("RF_AUTH_5 · TF-VEIC-06 · targa nuova associata all'automobilista 8 → accettato, targa nel profilo", async () => {
    const veicoloId = await inserisciVeicolo(client, TARGA_NUOVA);
    const veicolo = await client.query<{ targa: string }>(
      "SELECT targa FROM veicolo WHERE id = $1",
      [veicoloId],
    );
    expect(veicolo.rows).toEqual([{ targa: TARGA_NUOVA }]);

    await associa(client, 8, veicoloId);
    expect(await targheDelProfilo(client, 8)).toContain(TARGA_NUOVA);
  });

  it("RF_AUTH_5 · TF-VEIC-07 · targa di un altro automobilista associata all'automobilista 8 → accettata, targa in entrambi i profili", async () => {
    await associa(client, 8, 1);
    expect(await targheDelProfilo(client, 8)).toContain("EF456GH");
    expect(await targheDelProfilo(client, 7)).toContain("EF456GH");
  });

  it("SCHEMA · TF-VEIC-08 · associazione con automobilista inesistente → automobilista_veicolo_automobilista_id_fkey", async () => {
    await expect(associa(client, ID_INESISTENTE, 3)).rejects.toMatchObject({
      code: "23503",
      constraint: "automobilista_veicolo_automobilista_id_fkey",
    });
  });

  it("VD_1 · TF-VEIC-09 · associazione con un utente Ausiliario del Traffico → automobilista_veicolo_automobilista_id_fkey", async () => {
    await expect(associa(client, 2, 3)).rejects.toMatchObject({
      code: "23503",
      constraint: "automobilista_veicolo_automobilista_id_fkey",
    });
  });

  it("SCHEMA · TF-VEIC-10 · associazione con veicolo inesistente → automobilista_veicolo_veicolo_id_fkey", async () => {
    await expect(associa(client, 8, ID_INESISTENTE)).rejects.toMatchObject({
      code: "23503",
      constraint: "automobilista_veicolo_veicolo_id_fkey",
    });
  });

  it("SCHEMA · TF-VEIC-11 · associazione già presente → automobilista_veicolo_pkey", async () => {
    await expect(associa(client, 7, 1)).rejects.toMatchObject({
      code: "23505",
      constraint: "automobilista_veicolo_pkey",
    });
  });
});
