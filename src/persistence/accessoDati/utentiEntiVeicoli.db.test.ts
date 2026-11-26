import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  annullaTransazioneDiTest,
  chiudiDatabaseDiTest,
  iniziaTransazioneDiTest,
  preparaDatabaseDiTest,
} from "../test/databaseDiTest";
import { ErroreDominio, type CodiceErrore } from "./errori";
import {
  aggiornaAusiliario,
  associaVeicolo,
  ausiliari,
  creaAusiliario,
  creaAutomobilista,
  creaSessione,
  disattivaAusiliario,
  eliminaSessione,
  eliminaSessioniUtente,
  enti,
  riepilogoEnte,
  rimuoviVeicoloDalProfilo,
  targheDelProfilo,
  trovaAusiliario,
  trovaOCreaVeicolo,
  trovaSessione,
  trovaUtentePerEmail,
} from "./utentiEntiVeicoli";

// Test frame TF-UEV-01…46 di docs/test/cp_persistenza_utenti_enti_veicoli.md (OMP-34).

const ID_INESISTENTE = 999999;
const HASH = "hash-di-prova";
const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);
const ISTANTE = new Date("2026-11-20T09:00:00+01:00");
const UN_ORA_DOPO = new Date("2026-11-20T10:00:00+01:00");

describe("OMP-34 · TCS persistenza · utenti, enti e veicoli", () => {
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

  async function rifiutato(operazione: Promise<unknown>, codice: CodiceErrore): Promise<void> {
    let ottenuto: unknown;
    try {
      await operazione;
    } catch (errore) {
      ottenuto = errore;
    }
    expect(ottenuto).toBeInstanceOf(ErroreDominio);
    expect((ottenuto as ErroreDominio).codice).toBe(codice);
  }

  async function conta(sql: string, parametri: unknown[] = []): Promise<number> {
    const risultato = await client.query<{ n: string }>(sql, parametri);
    return Number(risultato.rows[0].n);
  }

  // trovaUtentePerEmail

  it("RF_AUTH_4 · TF-UEV-01 · automobilista esistente per email → utente 8 AUTOMOBILISTA senza stato dell'account", async () => {
    const utente = await trovaUtentePerEmail(client, "marco.rossi@omnipark.example");
    expect(utente).toMatchObject({
      id: 8,
      email: "marco.rossi@omnipark.example",
      ruolo: "AUTOMOBILISTA",
      statoDellAccount: null,
    });
    expect(typeof utente?.hashPassword).toBe("string");
    expect(utente?.hashPassword.length).toBeGreaterThan(0);
  });

  it("RF_AUTH_4 · TF-UEV-02 · ausiliario con email in maiuscolo → utente 4 AUSILIARIO_DEL_TRAFFICO DISATTIVATO", async () => {
    const utente = await trovaUtentePerEmail(client, "LUCA.RUSSO@omnipark.example");
    expect(utente).toMatchObject({
      id: 4,
      ruolo: "AUSILIARIO_DEL_TRAFFICO",
      statoDellAccount: "DISATTIVATO",
    });
  });

  it("RF_AUTH_4 · TF-UEV-03 · email inesistente → null", async () => {
    expect(await trovaUtentePerEmail(client, "nessuno@omnipark.example")).toBeNull();
  });

  // creaAutomobilista

  it("RF_AUTH_1 · TF-UEV-04 · email nuova → automobilista creato e ritrovato", async () => {
    const id = await creaAutomobilista(client, {
      email: "nuovo@omnipark.example",
      hashPassword: HASH,
    });
    expect(typeof id).toBe("number");
    const utente = await trovaUtentePerEmail(client, "nuovo@omnipark.example");
    expect(utente).toMatchObject({ id, ruolo: "AUTOMOBILISTA" });
    expect(await conta("SELECT count(*) AS n FROM automobilista WHERE id = $1", [id])).toBe(1);
  });

  it("VD_1 · TF-UEV-05 · email già registrata con maiuscole diverse → EMAIL_GIA_REGISTRATA", async () => {
    await rifiutato(
      creaAutomobilista(client, { email: "Marco.Rossi@omnipark.example", hashPassword: HASH }),
      "EMAIL_GIA_REGISTRATA",
    );
  });

  it("SCHEMA · TF-UEV-06 · email senza chiocciola → EMAIL_NON_VALIDA", async () => {
    await rifiutato(
      creaAutomobilista(client, { email: "senza-chiocciola", hashPassword: HASH }),
      "EMAIL_NON_VALIDA",
    );
  });

  // trovaOCreaVeicolo

  it("RF_AUTH_5 · TF-UEV-07 · targa esistente EF456GH → veicolo 1, nessun veicolo nuovo", async () => {
    const prima = await conta("SELECT count(*) AS n FROM veicolo");
    expect(await trovaOCreaVeicolo(client, "EF456GH")).toBe(1);
    expect(await conta("SELECT count(*) AS n FROM veicolo")).toBe(prima);
  });

  it("RF_AUTH_5 · TF-UEV-08 · targa nuova ZZ999ZZ → veicolo creato", async () => {
    const id = await trovaOCreaVeicolo(client, "ZZ999ZZ");
    expect(typeof id).toBe("number");
    const riga = await client.query<{ id: string }>(
      "SELECT id FROM veicolo WHERE targa = 'ZZ999ZZ'",
    );
    expect(riga.rows.map((r) => Number(r.id))).toEqual([id]);
  });

  it("SCHEMA · TF-UEV-09 · targa non normalizzata ab123cd → TARGA_NON_VALIDA", async () => {
    await rifiutato(trovaOCreaVeicolo(client, "ab123cd"), "TARGA_NON_VALIDA");
  });

  // associaVeicolo

  it("RF_AUTH_5 · TF-UEV-10 · associazione nuova (8, 1) → profilo 8 con EF456GH e MN234PQ", async () => {
    await associaVeicolo(client, 8, 1);
    expect(await targheDelProfilo(client, 8)).toEqual([
      { veicoloId: 1, targa: "EF456GH" },
      { veicoloId: 3, targa: "MN234PQ" },
    ]);
  });

  it("SCHEMA · TF-UEV-11 · associazione già presente (7, 1) → TARGA_GIA_NEL_PROFILO", async () => {
    await rifiutato(associaVeicolo(client, 7, 1), "TARGA_GIA_NEL_PROFILO");
  });

  it("SCHEMA · TF-UEV-12 · automobilista inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(associaVeicolo(client, ID_INESISTENTE, 1), "RIFERIMENTO_INESISTENTE");
  });

  // targheDelProfilo

  it("RF_AUTH_5 · TF-UEV-13 · profilo 11 con più targhe → ordinate per targa", async () => {
    expect(await targheDelProfilo(client, 11)).toEqual([
      { veicoloId: 6, targa: "AB123CD" },
      { veicoloId: 8, targa: "EB917RT" },
      { veicoloId: 7, targa: "FK771PS" },
    ]);
  });

  it("RF_AUTH_5 · TF-UEV-14 · profilo 8 con una targa → [MN234PQ]", async () => {
    expect(await targheDelProfilo(client, 8)).toEqual([{ veicoloId: 3, targa: "MN234PQ" }]);
  });

  it("RF_AUTH_5 · TF-UEV-15 · automobilista inesistente → elenco vuoto", async () => {
    expect(await targheDelProfilo(client, ID_INESISTENTE)).toEqual([]);
  });

  // rimuoviVeicoloDalProfilo

  it("RF_AUTH_5 · TF-UEV-16 · associazione esistente (7, 2) → true, resta EF456GH, il veicolo 2 esiste", async () => {
    expect(await rimuoviVeicoloDalProfilo(client, 7, 2)).toBe(true);
    expect(await targheDelProfilo(client, 7)).toEqual([{ veicoloId: 1, targa: "EF456GH" }]);
    expect(await conta("SELECT count(*) AS n FROM veicolo WHERE id = 2")).toBe(1);
  });

  it("RF_AUTH_5 · TF-UEV-17 · associazione inesistente (8, 1) → false", async () => {
    expect(await rimuoviVeicoloDalProfilo(client, 8, 1)).toBe(false);
  });

  // creaSessione

  it("RF_AUTH_4 · TF-UEV-18 · sessione nuova dell'utente 8 → ritrovata con ruolo AUTOMOBILISTA", async () => {
    await creaSessione(client, { utenteId: 8, hashToken: TOKEN_A, scadenza: UN_ORA_DOPO });
    expect(await trovaSessione(client, TOKEN_A, ISTANTE)).toEqual({
      utenteId: 8,
      ruolo: "AUTOMOBILISTA",
    });
  });

  it("SCHEMA · TF-UEV-19 · token già presente → SESSIONE_GIA_PRESENTE", async () => {
    await creaSessione(client, { utenteId: 8, hashToken: TOKEN_A, scadenza: UN_ORA_DOPO });
    await rifiutato(
      creaSessione(client, { utenteId: 8, hashToken: TOKEN_A, scadenza: UN_ORA_DOPO }),
      "SESSIONE_GIA_PRESENTE",
    );
  });

  it("SCHEMA · TF-UEV-20 · utente inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(
      creaSessione(client, { utenteId: ID_INESISTENTE, hashToken: TOKEN_A, scadenza: UN_ORA_DOPO }),
      "RIFERIMENTO_INESISTENTE",
    );
  });

  // trovaSessione

  it("RF_AUTH_4 · TF-UEV-21 · sessione valida dell'utente 2 → ruolo AUSILIARIO_DEL_TRAFFICO", async () => {
    await creaSessione(client, { utenteId: 2, hashToken: TOKEN_A, scadenza: UN_ORA_DOPO });
    expect(await trovaSessione(client, TOKEN_A, ISTANTE)).toEqual({
      utenteId: 2,
      ruolo: "AUSILIARIO_DEL_TRAFFICO",
    });
  });

  it("RF_AUTH_4 · TF-UEV-22 · sessione con scadenza uguale all'istante → null", async () => {
    await creaSessione(client, { utenteId: 8, hashToken: TOKEN_A, scadenza: ISTANTE });
    expect(await trovaSessione(client, TOKEN_A, ISTANTE)).toBeNull();
  });

  it("RF_AUTH_4 · TF-UEV-23 · token inesistente → null", async () => {
    expect(await trovaSessione(client, TOKEN_B, ISTANTE)).toBeNull();
  });

  // eliminaSessione

  it("RF_AUTH_4 · TF-UEV-24 · sessione esistente → true, poi non si trova più", async () => {
    await creaSessione(client, { utenteId: 8, hashToken: TOKEN_A, scadenza: UN_ORA_DOPO });
    expect(await eliminaSessione(client, TOKEN_A)).toBe(true);
    expect(await trovaSessione(client, TOKEN_A, ISTANTE)).toBeNull();
  });

  it("RF_AUTH_4 · TF-UEV-25 · sessione inesistente → false", async () => {
    expect(await eliminaSessione(client, TOKEN_B)).toBe(false);
  });

  // eliminaSessioniUtente

  it("VD_19 · TF-UEV-26 · due sessioni dell'utente 3 → 2, nessuna si trova più", async () => {
    await creaSessione(client, { utenteId: 3, hashToken: TOKEN_A, scadenza: UN_ORA_DOPO });
    await creaSessione(client, { utenteId: 3, hashToken: TOKEN_B, scadenza: UN_ORA_DOPO });
    expect(await eliminaSessioniUtente(client, 3)).toBe(2);
    expect(await trovaSessione(client, TOKEN_A, ISTANTE)).toBeNull();
    expect(await trovaSessione(client, TOKEN_B, ISTANTE)).toBeNull();
  });

  it("VD_19 · TF-UEV-27 · utente 3 senza sessioni → 0", async () => {
    expect(await eliminaSessioniUtente(client, 3)).toBe(0);
  });

  // enti

  it("RF_ADM_1 · TF-UEV-28 · più enti → ordinati per nome", async () => {
    expect(await enti(client)).toEqual([
      { id: 3, nome: "Comune di Baronissi" },
      { id: 2, nome: "Comune di Fisciano" },
      { id: 1, nome: "Comune di Gragnano" },
    ]);
  });

  // riepilogoEnte

  it("RF_ADM_1 · TF-UEV-29 · ente 1 con stalli e segnalazioni → 21 / 0 / 4", async () => {
    expect(await riepilogoEnte(client, 1)).toEqual({
      stalliGestiti: 21,
      sosteAttive: 0,
      segnalazioniNonChiuse: 4,
    });
  });

  it("RF_ADM_1 · TF-UEV-30 · ente 3 senza segnalazioni → 3 / 0 / 0", async () => {
    expect(await riepilogoEnte(client, 3)).toEqual({
      stalliGestiti: 3,
      sosteAttive: 0,
      segnalazioniNonChiuse: 0,
    });
  });

  it("RF_ADM_1 · TF-UEV-31 · ente 1 con una sosta attiva sullo stallo 16 → sosteAttive 1", async () => {
    await client.query(
      `INSERT INTO sosta (automobilista_id, veicolo_id, stallo_id, stato, orario_di_avvio,
                          orario_di_scadenza, pagamento)
       VALUES (8, 3, 16, 'ATTIVA', $1, $2, 'PAGATA')`,
      [ISTANTE, UN_ORA_DOPO],
    );
    expect(await riepilogoEnte(client, 1)).toEqual({
      stalliGestiti: 21,
      sosteAttive: 1,
      segnalazioniNonChiuse: 4,
    });
  });

  it("RF_ADM_1 · TF-UEV-32 · ente inesistente → null", async () => {
    expect(await riepilogoEnte(client, ID_INESISTENTE)).toBeNull();
  });

  // ausiliari

  it("RF_ADM_2 · TF-UEV-33 · più ausiliari → 5, ordinati per ente, cognome e nome", async () => {
    const elenco = await ausiliari(client);
    expect(elenco.map((a) => [a.ente, a.cognome, a.enteId, a.statoDellAccount])).toEqual([
      ["Comune di Baronissi", "Marino", 3, "ATTIVO"],
      ["Comune di Fisciano", "Moretti", 2, "ATTIVO"],
      ["Comune di Gragnano", "Ferri", 1, "ATTIVO"],
      ["Comune di Gragnano", "Galli", 1, "ATTIVO"],
      ["Comune di Gragnano", "Russo", 1, "DISATTIVATO"],
    ]);
    expect(elenco[2]).toMatchObject({
      id: 2,
      email: "paolo.ferri@omnipark.example",
      nome: "Paolo",
    });
    expect(elenco[3].email).toBe("sara.galli@omnipark.example");
    expect(elenco[4]).toMatchObject({ id: 4, email: "luca.russo@omnipark.example", nome: "Luca" });
    // Le email devono essere quelle degli utenti del dataset con lo stesso id.
    for (const ausiliario of elenco) {
      const utente = await trovaUtentePerEmail(client, ausiliario.email);
      expect(utente?.id).toBe(ausiliario.id);
      expect(utente?.ruolo).toBe("AUSILIARIO_DEL_TRAFFICO");
    }
  });

  // trovaAusiliario

  it("NRF_SIC_1 · TF-UEV-34 · ausiliario 2 esistente → Paolo Ferri, ente 1, ATTIVO", async () => {
    expect(await trovaAusiliario(client, 2)).toEqual({
      id: 2,
      email: "paolo.ferri@omnipark.example",
      nome: "Paolo",
      cognome: "Ferri",
      enteId: 1,
      statoDellAccount: "ATTIVO",
    });
  });

  it("NRF_SIC_1 · TF-UEV-35 · id di un automobilista → null", async () => {
    expect(await trovaAusiliario(client, 8)).toBeNull();
  });

  it("NRF_SIC_1 · TF-UEV-36 · id inesistente → null", async () => {
    expect(await trovaAusiliario(client, ID_INESISTENTE)).toBeNull();
  });

  // creaAusiliario

  const NUOVO_AUSILIARIO = {
    email: "nuovo.ausiliario@omnipark.example",
    hashPassword: HASH,
    nome: "Nuovo",
    cognome: "Ausiliario",
    enteId: 2,
    amministratoreId: 1,
  };

  it("RF_ADM_2 · TF-UEV-37 · dati validi → ausiliario ATTIVO dell'ente 2 e gestione dell'amministratore 1", async () => {
    const id = await creaAusiliario(client, NUOVO_AUSILIARIO);
    expect(typeof id).toBe("number");
    expect(await trovaAusiliario(client, id)).toEqual({
      id,
      email: "nuovo.ausiliario@omnipark.example",
      nome: "Nuovo",
      cognome: "Ausiliario",
      enteId: 2,
      statoDellAccount: "ATTIVO",
    });
    expect(
      await conta(
        `SELECT count(*) AS n FROM gestione_account_ausiliario
         WHERE amministratore_id = 1 AND ausiliario_del_traffico_id = $1`,
        [id],
      ),
    ).toBe(1);
  });

  it("VD_1 · TF-UEV-38 · email già registrata → EMAIL_GIA_REGISTRATA", async () => {
    await rifiutato(
      creaAusiliario(client, { ...NUOVO_AUSILIARIO, email: "paolo.ferri@omnipark.example" }),
      "EMAIL_GIA_REGISTRATA",
    );
  });

  it("SCHEMA · TF-UEV-39 · ente inesistente → RIFERIMENTO_INESISTENTE", async () => {
    await rifiutato(
      creaAusiliario(client, { ...NUOVO_AUSILIARIO, enteId: ID_INESISTENTE }),
      "RIFERIMENTO_INESISTENTE",
    );
  });

  it("SCHEMA · TF-UEV-40 · nome di soli spazi → DATI_NON_VALIDI", async () => {
    await rifiutato(
      creaAusiliario(client, { ...NUOVO_AUSILIARIO, nome: "   " }),
      "DATI_NON_VALIDI",
    );
  });

  // aggiornaAusiliario

  it("RF_ADM_2 · TF-UEV-41 · ausiliario 2 esistente → true, nuova email ed ente 2", async () => {
    expect(
      await aggiornaAusiliario(client, 2, {
        email: "paolo.ferri.nuovo@omnipark.example",
        nome: "Paolo",
        cognome: "Ferri",
        enteId: 2,
      }),
    ).toBe(true);
    expect(await trovaAusiliario(client, 2)).toMatchObject({
      email: "paolo.ferri.nuovo@omnipark.example",
      enteId: 2,
    });
  });

  it("RF_ADM_2 · TF-UEV-42 · ausiliario inesistente → false", async () => {
    expect(
      await aggiornaAusiliario(client, ID_INESISTENTE, {
        email: "altro.ausiliario@omnipark.example",
        nome: "Altro",
        cognome: "Ausiliario",
        enteId: 1,
      }),
    ).toBe(false);
  });

  it("VD_1 · TF-UEV-43 · email di un altro utente → EMAIL_GIA_REGISTRATA", async () => {
    await rifiutato(
      aggiornaAusiliario(client, 2, {
        email: "sara.galli@omnipark.example",
        nome: "Paolo",
        cognome: "Ferri",
        enteId: 1,
      }),
      "EMAIL_GIA_REGISTRATA",
    );
  });

  // disattivaAusiliario

  it("RF_ADM_2 · TF-UEV-44 · ausiliario 2 attivo → true, DISATTIVATO", async () => {
    expect(await disattivaAusiliario(client, 2)).toBe(true);
    expect((await trovaAusiliario(client, 2))?.statoDellAccount).toBe("DISATTIVATO");
  });

  it("RF_ADM_2 · TF-UEV-45 · ausiliario inesistente → false", async () => {
    expect(await disattivaAusiliario(client, ID_INESISTENTE)).toBe(false);
  });

  it("RF_ADM_2 · TF-UEV-46 · ausiliario 4 già DISATTIVATO → true, resta DISATTIVATO", async () => {
    expect(await disattivaAusiliario(client, 4)).toBe(true);
    expect((await trovaAusiliario(client, 4))?.statoDellAccount).toBe("DISATTIVATO");
  });
});
