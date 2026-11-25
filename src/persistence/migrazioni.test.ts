import { describe, expect, it } from "vitest";
import {
  analizzaNomeFile,
  calcolaChecksum,
  calcolaPendenti,
  ErroreMigrazione,
  preparaMigrazioni,
  type CodiceErroreMigrazione,
  type FileMigrazione,
} from "./migrazioni";

function erroreDi(operazione: () => unknown): ErroreMigrazione {
  try {
    operazione();
  } catch (errore) {
    if (errore instanceof ErroreMigrazione) {
      return errore;
    }
    throw errore;
  }
  throw new Error("Era atteso un ErroreMigrazione");
}

function codiceDi(operazione: () => unknown): CodiceErroreMigrazione {
  return erroreDi(operazione).codice;
}

function file(nomeFile: string, contenuto = "SELECT 1;\n") {
  return { nomeFile, contenuto };
}

function migrazione(versione: number, sql = `SELECT ${versione};\n`): FileMigrazione {
  const nome = `passo_${versione}`;
  return {
    versione,
    nome,
    nomeFile: `${String(versione).padStart(4, "0")}_${nome}.sql`,
    sql,
    checksum: calcolaChecksum(sql),
  };
}

function registrata(m: FileMigrazione, checksum = m.checksum) {
  return { versione: m.versione, nome: m.nome, checksum };
}

describe("OMP-31 · nomi dei file di migrazione", () => {
  it("OMP-31 · N-01 · 0001_crea_stallo.sql → versione 1, nome crea_stallo", () => {
    expect(analizzaNomeFile("0001_crea_stallo.sql")).toEqual({ versione: 1, nome: "crea_stallo" });
  });

  it("OMP-31 · N-02 · versione a 3 cifre → NOME_NON_VALIDO", () => {
    expect(codiceDi(() => analizzaNomeFile("001_crea_stallo.sql"))).toBe("NOME_NON_VALIDO");
  });

  it("OMP-31 · N-03 · versione a 5 cifre → NOME_NON_VALIDO", () => {
    expect(codiceDi(() => analizzaNomeFile("00001_crea_stallo.sql"))).toBe("NOME_NON_VALIDO");
  });

  it("OMP-31 · N-04 · trattino al posto di _ → NOME_NON_VALIDO", () => {
    expect(codiceDi(() => analizzaNomeFile("0001-crea_stallo.sql"))).toBe("NOME_NON_VALIDO");
  });

  it("OMP-31 · N-05 · maiuscole nella descrizione o nell'estensione → NOME_NON_VALIDO", () => {
    expect(codiceDi(() => analizzaNomeFile("0001_Crea_stallo.sql"))).toBe("NOME_NON_VALIDO");
    expect(codiceDi(() => analizzaNomeFile("0001_crea_stallo.SQL"))).toBe("NOME_NON_VALIDO");
  });

  it("OMP-31 · N-06 · descrizione mancante → NOME_NON_VALIDO", () => {
    expect(codiceDi(() => analizzaNomeFile("0001.sql"))).toBe("NOME_NON_VALIDO");
    expect(codiceDi(() => analizzaNomeFile("0001_.sql"))).toBe("NOME_NON_VALIDO");
  });

  it("OMP-31 · N-07 · versione 0000 → NOME_NON_VALIDO", () => {
    expect(codiceDi(() => analizzaNomeFile("0000_iniziale.sql"))).toBe("NOME_NON_VALIDO");
  });

  it("OMP-31 · N-08 · file nascosto (.gitkeep) → ignorato", () => {
    expect(analizzaNomeFile(".gitkeep")).toBeNull();
    expect(preparaMigrazioni([file(".gitkeep", "")])).toEqual([]);
  });
});

describe("OMP-31 · elenco delle migrazioni", () => {
  it("OMP-31 · E-01 · lette in ordine 0010, 0002, 0001 → ordinate 1, 2, 10", () => {
    const elenco = preparaMigrazioni([
      file("0010_terza.sql"),
      file("0002_seconda.sql"),
      file("0001_prima.sql"),
    ]);
    expect(elenco.map((m) => m.versione)).toEqual([1, 2, 10]);
  });

  it("OMP-31 · E-02 · due file con versione 0003 → VERSIONE_DUPLICATA con i due nomi", () => {
    const errore = erroreDi(() =>
      preparaMigrazioni([file("0003_stallo.sql"), file("0003_sosta.sql")]),
    );
    expect(errore.codice).toBe("VERSIONE_DUPLICATA");
    expect(errore.message).toContain("0003_stallo.sql");
    expect(errore.message).toContain("0003_sosta.sql");
  });

  it("OMP-31 · E-03 · nessun file → elenco vuoto", () => {
    expect(preparaMigrazioni([])).toEqual([]);
  });
});

describe("OMP-31 · controllo della transazione nei file", () => {
  it("OMP-31 · T-01 · riga BEGIN; → TRANSAZIONE_NEL_FILE", () => {
    const contenuto = "BEGIN;\nCREATE TABLE prova (id integer);\n";
    expect(codiceDi(() => preparaMigrazioni([file("0001_prova.sql", contenuto)]))).toBe(
      "TRANSAZIONE_NEL_FILE",
    );
  });

  it("OMP-31 · T-02 · riga COMMIT; → TRANSAZIONE_NEL_FILE", () => {
    const contenuto = "CREATE TABLE prova (id integer);\n  commit ;\n";
    expect(codiceDi(() => preparaMigrazioni([file("0001_prova.sql", contenuto)]))).toBe(
      "TRANSAZIONE_NEL_FILE",
    );
  });

  it("OMP-31 · T-03 · blocco PL/pgSQL BEGIN … END → accettato", () => {
    const contenuto = [
      "CREATE FUNCTION prova() RETURNS integer AS $$",
      "BEGIN",
      "  RETURN 1;",
      "END;",
      "$$ LANGUAGE plpgsql;",
      "",
    ].join("\n");
    expect(preparaMigrazioni([file("0001_prova.sql", contenuto)])).toHaveLength(1);
  });
});

describe("OMP-31 · checksum", () => {
  it("OMP-31 · C-01 · checksum sha256 noto", () => {
    expect(calcolaChecksum("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("OMP-31 · C-02 · fine riga CRLF e LF → stesso checksum", () => {
    expect(calcolaChecksum("SELECT 1;\r\nSELECT 2;\r\n")).toBe(
      calcolaChecksum("SELECT 1;\nSELECT 2;\n"),
    );
  });

  it("OMP-31 · C-03 · un carattere diverso → checksum diverso", () => {
    expect(calcolaChecksum("SELECT 1;")).not.toBe(calcolaChecksum("SELECT 2;"));
  });
});

describe("OMP-31 · confronto con il registro", () => {
  const m1 = migrazione(1);
  const m2 = migrazione(2);
  const m3 = migrazione(3);
  const m4 = migrazione(4);

  it("OMP-31 · R-01 · registro vuoto → tutte pendenti, in ordine", () => {
    expect(calcolaPendenti([m1, m2, m3], [])).toEqual([m1, m2, m3]);
  });

  it("OMP-31 · R-02 · tutte registrate con lo stesso checksum → nessuna pendente", () => {
    expect(calcolaPendenti([m1, m2], [registrata(m1), registrata(m2)])).toEqual([]);
  });

  it("OMP-31 · R-03 · registrate 1–2, file 1–4 → pendenti 3 e 4", () => {
    expect(calcolaPendenti([m1, m2, m3, m4], [registrata(m1), registrata(m2)])).toEqual([m3, m4]);
  });

  it("OMP-31 · R-04 · checksum registrato diverso dal file → CHECKSUM_DIVERSO", () => {
    const alterato = registrata(m2, calcolaChecksum("SELECT 'versione precedente';"));
    expect(codiceDi(() => calcolaPendenti([m1, m2], [registrata(m1), alterato]))).toBe(
      "CHECKSUM_DIVERSO",
    );
  });

  it("OMP-31 · R-05 · versione registrata senza file → MIGRAZIONE_SCONOSCIUTA", () => {
    expect(codiceDi(() => calcolaPendenti([m1], [registrata(m1), registrata(m2)]))).toBe(
      "MIGRAZIONE_SCONOSCIUTA",
    );
  });

  it("OMP-31 · R-06 · file nuovo con versione minore dell'ultima applicata → MIGRAZIONE_FUORI_ORDINE", () => {
    expect(codiceDi(() => calcolaPendenti([m1, m2, m3], [registrata(m1), registrata(m3)]))).toBe(
      "MIGRAZIONE_FUORI_ORDINE",
    );
  });
});
