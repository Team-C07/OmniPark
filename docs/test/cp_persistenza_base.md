# TCS — Base comune dello strato di persistenza

- **Task:** OMP-34 (issue #6). Metodo: category partition.
- **Oggetto:** i servizi comuni di `src/persistence/accessoDati/`: esecuzione delle query (`interroga`), transazione (`eseguiInTransazione`), traduzione degli errori (`traduciErrore`, `ErroreDominio`) e addebito con blocco del wallet (`addebita`).
- **Fonti dell'esito atteso:** piano approvato di OMP-34 (tabella vincolo → codice di dominio); vincoli dello schema (`0001_schema_iniziale.sql`); requisiti in `docs/rad/requisiti.md`; vincoli di dominio in `docs/rad/vincoli_dominio.md` §2.

## 1. Tracciabilità

Ogni frame riporta un solo riferimento, scelto in quest'ordine:

1. un requisito dell'Elenco (`RF_…`, `NRF_…`) se il suo testo copre davvero il comportamento;
2. altrimenti il vincolo di dominio del RAD, scritto `VD_<n>` (vincolo n. `<n>` di `docs/rad/vincoli_dominio.md` §2);
3. altrimenti `SCHEMA`, se il frame verifica un vincolo o un trigger specifico dello schema;
4. altrimenti `ISSUE_5`, per i comportamenti dello strato di persistenza richiesti dall'issue #6 (transazione, traduzione generica degli errori) senza un requisito, un vincolo di dominio o un vincolo dello schema che li copra.

Nome del test: `<riferimento> · <frame> · <descrizione> → <esito>`, per esempio `RF_WALLET_2 · TF-BASE-39 · addebito oltre il saldo → SALDO_INSUFFICIENTE`.

## 2. Servizi verificati (firme)

```ts
// src/persistence/accessoDati/esecutore.ts
type Esecutore = Pool | PoolClient;
interroga<R>(esecutore: Esecutore, sql: string, parametri?: unknown[]): Promise<QueryResult<R>>;
// un errore della query è rilanciato già tradotto con traduciErrore

// src/persistence/accessoDati/transazione.ts
eseguiInTransazione<T>(operazione: (client: PoolClient) => Promise<T>, pool?: Pool): Promise<T>;
// BEGIN; operazione; COMMIT. Su qualsiasi errore: ROLLBACK e l'errore dell'operazione è rilanciato
// invariato. Il client è sempre rilasciato; se il ROLLBACK fallisce è rilasciato come da scartare
// (release(true)).

// src/persistence/accessoDati/errori.ts
class ErroreDominio extends Error { codice: CodiceErrore; messaggio: string (= message); cause?: unknown }
traduciErrore(errore: unknown): ErroreDominio;
const VINCOLI_SPECIFICI: Readonly<Record<string, CodiceErrore>>; // nome del vincolo o dell'indice → codice
const TRIGGER_SPECIFICI: Readonly<Record<string, CodiceErrore>>; // nome della funzione trigger → codice
const VINCOLI_UNICI_GENERICI: readonly string[]; // vincoli o indici unici che usano volutamente VALORE_DUPLICATO

// src/persistence/accessoDati/walletSoste.ts
addebita(client: PoolClient, dati: { walletVirtualeId: number; sostaId: number; importo: number; dataEOra: Date }): Promise<MovimentoDelWallet>;
// MovimentoDelWallet: { id, walletVirtualeId, tipoDiMovimento: "ADDEBITO", importo, dataEOra, sostaId }
// Va chiamata solo dentro eseguiInTransazione (o nella transazione del test): fuori da una
// transazione il FOR UPDATE non protegge.
```

Regole di traduzione (dal piano approvato):

- un `ErroreDominio` è restituito invariato;
- se `error.where` nomina una funzione dei trigger dello schema, il codice dipende dal trigger, qualunque sia il SQLSTATE: `impedisci_modifica_pagamento` → `PAGAMENTO_NON_MODIFICABILE`, `impedisci_modifica_verifica` → `VERIFICA_GIA_REGISTRATA`, `impedisci_segnalazione_da_verifica_conforme` → `STATO_SEGNALAZIONE_NON_VALIDO`;
- altrimenti, se `error.constraint` è nella tabella dei vincoli specifici del piano, vale il codice della tabella;
- altrimenti il codice dipende dal SQLSTATE (`error.code`): `23505` `VALORE_DUPLICATO`, `23503` `RIFERIMENTO_INESISTENTE`, `23514` `DATI_NON_VALIDI`, `23502` `VALORE_MANCANTE`, `22003` `VALORE_FUORI_INTERVALLO`, `40001` e `40P01` `CONFLITTO_DI_CONCORRENZA`, classe `08` e `57P01` `DATABASE_NON_RAGGIUNGIBILE`;
- errori di connessione di Node o del pool (`ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, messaggi «timeout exceeded when trying to connect» e «Connection terminated») → `DATABASE_NON_RAGGIUNGIBILE`;
- tutto il resto, compreso `P0001` senza un trigger riconosciuto, → `ERRORE_DATABASE`.
- In ogni caso il messaggio è il testo fisso del codice, senza valori, SQL o stringhe di connessione, e `cause` è l'errore originale.

## 3. Ambiente

### Esecuzione

| Gruppo di frame      | File di test                                                                                    | Esecuzione                                                                                                                                                                                                                                        |
| :------------------- | :---------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TF-BASE-05, 06…24    | `src/persistence/accessoDati/transazione.test.ts`, `src/persistence/accessoDati/errori.test.ts` | `npm test`, senza database: errori di forma pg costruiti nel test (oggetti `Error` con `code`, `constraint`, `where`) e, per TF-BASE-05, un pool finto                                                                                            |
| TF-BASE-01…04        | `src/persistence/accessoDati/transazione.commit.db.test.ts`                                     | `npm run test:db`, con commit veri sul pool `poolDiTest()`; il file chiama `preparaDatabaseDiTest()` nel `beforeEach` (ogni frame parte dallo stato noto) e di nuovo nell'`afterAll` prima di `chiudiDatabaseDiTest()`, così lascia lo stato noto |
| TF-BASE-25…36, 45…47 | `src/persistence/accessoDati/errori.db.test.ts`                                                 | `npm run test:db`, transazione annullata per test (`iniziaTransazioneDiTest` / `annullaTransazioneDiTest`); le istruzioni si eseguono con `interroga(client, …)`                                                                                  |
| TF-BASE-37…42        | `src/persistence/accessoDati/addebito.db.test.ts`                                               | `npm run test:db`, transazione annullata per test; `addebita` riceve il client del test                                                                                                                                                           |
| TF-BASE-43, 44       | `src/persistence/accessoDati/addebito.commit.db.test.ts`                                        | `npm run test:db`, con commit veri e stato noto ripristinato nel `beforeEach` e nell'`afterAll`, come TF-BASE-01…04                                                                                                                               |

Supporto ai test: `preparaDatabaseDiTest()`, `iniziaTransazioneDiTest()`, `annullaTransazioneDiTest()`, `chiudiDatabaseDiTest()` (come nelle TCS di OMP-33) e il nuovo `poolDiTest(): Pool`, il pool del database di test da passare a `eseguiInTransazione`. Va chiamato dopo `preparaDatabaseDiTest()`.

### Righe del dataset usate (migrazione `0002_dati_esempio.sql`)

| Tabella                 | id      | Contenuto                                                      | Uso nei frame                   |
| :---------------------- | :------ | :------------------------------------------------------------- | :------------------------------ |
| `utente`                | 2       | `paolo.ferri@omnipark.example`, Ausiliario del Traffico        | email duplicata (TF-BASE-25)    |
| `automobilista`         | 7, 8    | Elena Bianchi, Marco Rossi                                     | soste e preferiti               |
| `veicolo`               | 1, 3    | `EF456GH` (automobilista 7), `MN234PQ` (automobilista 8)       | soste                           |
| `automobilista_veicolo` | (7, 1)  | associazione esistente                                         | TF-BASE-26                      |
| `stallo`                | 16, 17  | Piazza Aubry n. 3 e n. 4, `LIBERO` e `OCCUPATO`, nessuna sosta | soste preesistenti e TF-BASE-31 |
| `stallo`                | 15      | Piazza Aubry n. 2, `ROSA`                                      | TF-BASE-36                      |
| `stallo_preferito`      | (8, 11) | preferito esistente                                            | TF-BASE-32                      |
| `sosta`                 | 2       | automobilista 8, `TERMINATA`, `PAGATA`                         | addebiti e TF-BASE-34           |
| `sosta`                 | 4       | automobilista 7, con verifica 1                                | TF-BASE-33                      |
| `verifica_del_permesso` | 1       | sosta 4, ausiliario 3, `CONFORME`                              | TF-BASE-35, 36                  |
| `segnalazione`          | 11      | `APERTA`, targa `HB204KM`, stallo 3                            | TF-BASE-30                      |
| `wallet_virtuale`       | 2       | wallet dell'automobilista 8; saldo nel dataset 600 centesimi   | addebiti                        |

Colonne usate dai test (per le preparazioni e le verifiche con SQL):

| Tabella                         | Colonne                                                                                                                                                                                                                |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utente`                        | `id`, `email`, `hash_password`, `ruolo` (`AUTOMOBILISTA`, `AUSILIARIO_DEL_TRAFFICO`, `AMMINISTRATORE`)                                                                                                                 |
| `automobilista_veicolo`         | `automobilista_id`, `veicolo_id`                                                                                                                                                                                       |
| `stallo`                        | `id`, `stato`, `occupazione_rilevata` (lo stallo 16 ha `NESSUN_VEICOLO`)                                                                                                                                               |
| `stallo_preferito`              | `automobilista_id`, `stallo_id`                                                                                                                                                                                        |
| `sosta`                         | `id`, `automobilista_id`, `veicolo_id`, `stallo_id`, `stato`, `orario_di_avvio`, `orario_di_scadenza`, `pagamento`                                                                                                     |
| `movimento_del_wallet`          | `id`, `wallet_virtuale_id`, `tipo_di_movimento`, `importo`, `data_e_ora`, `sosta_id`                                                                                                                                   |
| `saldo_wallet_virtuale` (vista) | `wallet_virtuale_id`, `automobilista_id`, `saldo` (`bigint`)                                                                                                                                                           |
| `verifica_del_permesso`         | `id`, `sosta_id`, `ausiliario_del_traffico_id`, `esito`, `data_e_ora`                                                                                                                                                  |
| `segnalazione`                  | `id`, `stallo_id`, `ausiliario_del_traffico_id`, `verifica_del_permesso_id`, `stato`, `motivo`, `targa_rilevata`, `data_e_ora_della_lettura`, `data_e_ora_della_presa_in_carico`, `esito`, `data_e_ora_della_chiusura` |

Id inesistente: `999999`. Istante usato dove serve una data: `2026-11-20 09:00:00+01` (per le soste preesistenti scadenza `2026-11-20 10:00:00+01`).

## 4. Parametri, categorie e scelte

| Servizio              | Parametro / ambiente        | Categoria             | Scelte                                                                                                                            |
| :-------------------- | :-------------------------- | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `eseguiInTransazione` | operazione                  | Esito dell'operazione | riuscita · errore applicativo dopo una scrittura · errore del database dopo una scrittura                                         |
| `eseguiInTransazione` | ambiente                    | Client                | rilasciato dopo ogni esito · ROLLBACK fallito [single]                                                                            |
| `traduciErrore`       | `error.code`                | SQLSTATE              | 23505 · 23503 · 23514 · 23502 · 22003 · 40001 · 40P01 · 08006 · 57P01 · P0001 · non previsto (42P01)                              |
| `traduciErrore`       | errore di Node o del pool   | Connessione           | ECONNREFUSED · ENOTFOUND · ETIMEDOUT · timeout del pool · connessione chiusa                                                      |
| `traduciErrore`       | `error.constraint`          | Vincolo               | assente · nella tabella dei vincoli specifici · non nella tabella                                                                 |
| `traduciErrore`       | `error.where`               | Trigger               | nessuno · `impedisci_modifica_pagamento` · `impedisci_modifica_verifica` · `impedisci_segnalazione_da_verifica_conforme`          |
| `traduciErrore`       | tipo dell'input             | Input                 | errore pg · `ErroreDominio` [single] · `Error` generico [single]                                                                  |
| `addebita`            | `walletVirtualeId`          | Wallet                | esistente · inesistente [error]                                                                                                   |
| `addebita`            | `sostaId`                   | Sosta                 | esistente · inesistente [error]                                                                                                   |
| `addebita`            | `importo` rispetto al saldo | Importo               | minore del saldo · uguale al saldo [single] · maggiore del saldo [error] · zero [error]                                           |
| `addebita`            | ambiente                    | Concorrenza           | nessun altro addebito · due addebiti simultanei che insieme superano il saldo · due addebiti simultanei che insieme lo eguagliano |

### Vincoli tra le scelte

- Il trigger prevale su vincolo e SQLSTATE: un `where` con un trigger riconosciuto decide il codice qualunque sia `error.code` (TF-BASE-24).
- `P0001` senza trigger riconosciuto → `ERRORE_DATABASE` (TF-BASE-15).
- Le scelte [error] e [single] compaiono in un solo frame, con le altre scelte ai valori validi.
- I frame di traduzione con un vincolo della tabella usano errori veri del database (TF-BASE-25…36), così verificano anche i nomi reali dei vincoli e il formato reale di `where`.

## 5. Test frame (47)

Codice atteso: il `codice` dell'`ErroreDominio` lanciato o restituito.

### Transazione

| Frame      | Scelte                                                                                                                                                 | Esito atteso                                                                                                                        | Riferimento |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| TF-BASE-01 | operazione riuscita: inserisce due ricariche da 100 sul wallet 2 e restituisce `"fatto"`                                                               | `eseguiInTransazione` restituisce `"fatto"`; da un'altra connessione del pool si vedono entrambe le righe; saldo del wallet 2 = 800 | ISSUE_5     |
| TF-BASE-02 | errore applicativo: inserisce una ricarica da 100, poi lancia `new Error("prova")`                                                                     | rilancia lo stesso oggetto errore (non tradotto); nessuna delle righe è presente; saldo del wallet 2 = 600                          | ISSUE_5     |
| TF-BASE-03 | errore del database: inserisce una ricarica da 100, poi una ricarica con `sosta_id` = 2 (`interroga`)                                                  | rilancia `ErroreDominio` `MOVIMENTO_NON_COERENTE`; anche la prima ricarica è annullata; saldo del wallet 2 = 600                    | VD_4        |
| TF-BASE-04 | 5 transazioni in sequenza: 3 riuscite (ciascuna una ricarica da 100) e 2 che falliscono (una con errore applicativo, una con `MOVIMENTO_NON_COERENTE`) | nessun client trattenuto: `pool.totalCount === pool.idleCount`, `pool.waitingCount === 0`, `pool.totalCount ≤ 3`                    | ISSUE_5     |
| TF-BASE-05 | pool finto: l'operazione lancia, poi il `ROLLBACK` lancia                                                                                              | rilancia l'errore dell'operazione; il client è rilasciato una sola volta con `release(true)`                                        | ISSUE_5     |

### Traduzione per SQLSTATE e connessione (senza database)

| Frame      | Errore in ingresso                                               | Esito atteso                                                                           | Riferimento |
| :--------- | :--------------------------------------------------------------- | :------------------------------------------------------------------------------------- | :---------- |
| TF-BASE-06 | `code` 23505, `constraint` `sosta_pkey`, `detail` con un valore  | `VALORE_DUPLICATO`; il messaggio non contiene `detail`; `cause` è l'errore in ingresso | ISSUE_5     |
| TF-BASE-07 | 23503, `constraint` `sosta_stallo_id_fkey`                       | `RIFERIMENTO_INESISTENTE`                                                              | ISSUE_5     |
| TF-BASE-08 | 23514, `constraint` `sosta_stato_ammesso`                        | `DATI_NON_VALIDI`                                                                      | ISSUE_5     |
| TF-BASE-09 | 23502, `column` `targa`                                          | `VALORE_MANCANTE`                                                                      | ISSUE_5     |
| TF-BASE-10 | 22003                                                            | `VALORE_FUORI_INTERVALLO`                                                              | ISSUE_5     |
| TF-BASE-11 | 40001                                                            | `CONFLITTO_DI_CONCORRENZA`                                                             | ISSUE_5     |
| TF-BASE-12 | 40P01                                                            | `CONFLITTO_DI_CONCORRENZA`                                                             | ISSUE_5     |
| TF-BASE-13 | 08006                                                            | `DATABASE_NON_RAGGIUNGIBILE`                                                           | ISSUE_5     |
| TF-BASE-14 | 57P01                                                            | `DATABASE_NON_RAGGIUNGIBILE`                                                           | ISSUE_5     |
| TF-BASE-15 | P0001, `where` assente                                           | `ERRORE_DATABASE`                                                                      | ISSUE_5     |
| TF-BASE-16 | 42P01                                                            | `ERRORE_DATABASE`                                                                      | ISSUE_5     |
| TF-BASE-17 | `code` `ECONNREFUSED`                                            | `DATABASE_NON_RAGGIUNGIBILE`                                                           | ISSUE_5     |
| TF-BASE-18 | `code` `ENOTFOUND`                                               | `DATABASE_NON_RAGGIUNGIBILE`                                                           | ISSUE_5     |
| TF-BASE-19 | `code` `ETIMEDOUT`                                               | `DATABASE_NON_RAGGIUNGIBILE`                                                           | ISSUE_5     |
| TF-BASE-20 | `Error("timeout exceeded when trying to connect")`, senza `code` | `DATABASE_NON_RAGGIUNGIBILE`                                                           | ISSUE_5     |
| TF-BASE-21 | `Error("Connection terminated unexpectedly")`, senza `code`      | `DATABASE_NON_RAGGIUNGIBILE`                                                           | ISSUE_5     |
| TF-BASE-22 | un `ErroreDominio` `SALDO_INSUFFICIENTE`                         | restituisce lo stesso oggetto                                                          | ISSUE_5     |
| TF-BASE-23 | `Error("qualcosa")` senza `code`                                 | `ERRORE_DATABASE`, `cause` è l'errore in ingresso                                      | ISSUE_5     |
| TF-BASE-24 | P0001 con `where` che nomina `impedisci_modifica_verifica()`     | `VERIFICA_GIA_REGISTRATA` (il trigger prevale sul SQLSTATE)                            | VD_12       |

### Codici specifici e trigger con errori veri del database

Ogni frame esegue l'istruzione con `interroga(client, …)` nella transazione del test e verifica il `codice`.

| Frame      | Istruzione                                                                                                                                                                                                    | Esito atteso                                              | Riferimento |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------- | :---------- |
| TF-BASE-25 | `INSERT INTO utente (email, hash_password, ruolo)` con email `PAOLO.FERRI@omnipark.example`                                                                                                                   | `EMAIL_GIA_REGISTRATA`; il messaggio non contiene l'email | VD_1        |
| TF-BASE-26 | `INSERT INTO automobilista_veicolo` (7, 1)                                                                                                                                                                    | `TARGA_GIA_NEL_PROFILO`                                   | SCHEMA      |
| TF-BASE-27 | sosta `ATTIVA` (automobilista 8, veicolo 3, stallo 17), poi un'altra `ATTIVA` (8, 3, 16)                                                                                                                      | `SOSTA_GIA_ATTIVA_PER_VEICOLO`                            | RF_SOSTA_1  |
| TF-BASE-28 | sosta `ATTIVA` (7, 1, 16), poi una `ATTIVA` (8, 3, 16)                                                                                                                                                        | `SOSTA_GIA_ATTIVA_PER_STALLO`                             | SCHEMA      |
| TF-BASE-29 | movimento `RICARICA` da 500 sul wallet 2 con `sosta_id` = 2                                                                                                                                                   | `MOVIMENTO_NON_COERENTE`                                  | VD_4        |
| TF-BASE-30 | segnalazione `APERTA` sullo stallo 3, motivo `SOSTA_ASSENTE`, targa `HB204KM`, lettura all'istante di prova                                                                                                   | `SEGNALAZIONE_NON_CHIUSA_GIA_PRESENTE`                    | VD_16       |
| TF-BASE-31 | `UPDATE stallo SET stato = 'OCCUPATO' WHERE id = 16` (occupazione rilevata `NESSUN_VEICOLO`)                                                                                                                  | `STATO_STALLO_NON_VALIDO`                                 | VD_20       |
| TF-BASE-32 | `INSERT INTO stallo_preferito` (8, 11)                                                                                                                                                                        | `GIA_TRA_I_PREFERITI`                                     | SCHEMA      |
| TF-BASE-33 | verifica del permesso per la sosta 4, ausiliario 2, `NON_CONFORME`                                                                                                                                            | `VERIFICA_GIA_REGISTRATA`                                 | VD_12       |
| TF-BASE-34 | `UPDATE sosta SET pagamento = 'GRATUITA' WHERE id = 2` (trigger `impedisci_modifica_pagamento`)                                                                                                               | `PAGAMENTO_NON_MODIFICABILE`                              | SCHEMA      |
| TF-BASE-35 | `UPDATE verifica_del_permesso SET esito = 'NON_CONFORME' WHERE id = 1` (trigger `impedisci_modifica_verifica`)                                                                                                | `VERIFICA_GIA_REGISTRATA`                                 | VD_12       |
| TF-BASE-36 | segnalazione sullo stallo 15 dalla verifica 1 (`CONFORME`): ausiliario 3, `CHIUSA`, esito `SOSTA_IRREGOLARE_ACCERTATA`, chiusura all'istante di prova (trigger `impedisci_segnalazione_da_verifica_conforme`) | `STATO_SEGNALAZIONE_NON_VALIDO`                           | VD_13       |

### Addebito

| Frame      | Scelte                                                                                                                                                                                                                         | Esito atteso                                                                                                   | Riferimento |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :---------- |
| TF-BASE-37 | wallet 2, sosta 2, importo 300                                                                                                                                                                                                 | movimento `ADDEBITO` restituito e presente con i dati inseriti; saldo del wallet 2 da 600 a 300                | RF_WALLET_2 |
| TF-BASE-38 | wallet 2, sosta 2, importo 600 (uguale al saldo)                                                                                                                                                                               | movimento creato; saldo 0                                                                                      | RF_WALLET_2 |
| TF-BASE-39 | wallet 2, sosta 2, importo 601                                                                                                                                                                                                 | `SALDO_INSUFFICIENTE`; nessun movimento nuovo; saldo 600                                                       | RF_WALLET_2 |
| TF-BASE-40 | wallet 999999, sosta 2, importo 100                                                                                                                                                                                            | `WALLET_INESISTENTE`                                                                                           | ISSUE_5     |
| TF-BASE-41 | wallet 2, sosta 999999, importo 100                                                                                                                                                                                            | `RIFERIMENTO_INESISTENTE`                                                                                      | SCHEMA      |
| TF-BASE-42 | wallet 2, sosta 2, importo 0                                                                                                                                                                                                   | `IMPORTO_NON_VALIDO`                                                                                           | SCHEMA      |
| TF-BASE-43 | due `eseguiInTransazione` avviate insieme, ciascuna con `addebita` di 400 sul wallet 2 (sosta 2); la transazione che ottiene per prima il blocco resta aperta 500 ms dopo l'addebito (`SELECT pg_sleep(0.5)`) prima del commit | una riesce, l'altra fallisce con `SALDO_INSUFFICIENTE`; un solo addebito nuovo; saldo finale 200, mai negativo | RF_WALLET_2 |
| TF-BASE-44 | come TF-BASE-43, con due addebiti di 300                                                                                                                                                                                       | entrambe riescono; due addebiti nuovi; saldo finale 0                                                          | RF_WALLET_2 |

### Coerenza della tabella con lo schema

Ogni frame interroga il catalogo del database di test (schema `public`) nella transazione del test.

| Frame      | Verifica                                                                                                                                                                                                                                                                         | Esito atteso         | Riferimento |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------- | :---------- |
| TF-BASE-45 | ogni chiave di `VINCOLI_SPECIFICI` esiste come vincolo (`pg_constraint.conname`) o come indice (`pg_indexes.indexname`)                                                                                                                                                          | nessun nome mancante | SCHEMA      |
| TF-BASE-46 | ogni chiave di `TRIGGER_SPECIFICI` esiste come funzione (`pg_proc.proname`)                                                                                                                                                                                                      | nessun nome mancante | SCHEMA      |
| TF-BASE-47 | ogni vincolo `UNIQUE` (`pg_constraint.contype = 'u'`) e ogni indice unico che non sostiene un vincolo (`pg_index.indisunique`, escluse le chiavi primarie) delle tabelle dello schema, tranne `registro_migrazioni`, è in `VINCOLI_SPECIFICI` oppure in `VINCOLI_UNICI_GENERICI` | nessun nome scoperto | SCHEMA      |

Riepilogo: 5 frame di transazione, 19 di traduzione senza database, 12 di traduzione con il database (di cui 3 trigger), 8 di addebito (di cui 2 di concorrenza), 3 di coerenza con lo schema. Totale 47.

Note sui riferimenti:

- TF-BASE-37…39, 43, 44: RF_WALLET_2 prevede l'addebito e il rifiuto se il credito non è sufficiente; VD_5 (saldo non negativo) è la stessa regola.
- TF-BASE-47: `VINCOLI_UNICI_GENERICI` contiene `utente_id_ruolo_unico` e `verifica_del_permesso_id_ausiliario_unico`, che esistono solo come bersaglio di chiavi esterne composte e non hanno un significato di dominio proprio.
- Transazione e traduzione generica non hanno un requisito, un vincolo di dominio o un vincolo dello schema propri: sono comportamenti dello strato richiesti dall'issue (`ISSUE_5`). L'atomicità di sosta e addebito, richiesta dall'issue, la usa il sottosistema Gestione soste (`UC_SOSTA_1`, exit condition On failure).
- TF-BASE-25: VD_1 (email unica tra tutti gli Utente); il confronto senza distinzione tra maiuscole e minuscole è dello schema.
- TF-BASE-30: VD_16 (al più una segnalazione non chiusa per targa).

Chiarimenti sull'esecuzione:

- TF-BASE-04: `poolDiTest()` usa la configurazione comune di `creaPool` (al massimo 3 connessioni), da cui il limite `pool.totalCount ≤ 3`.
- TF-BASE-39: `SALDO_INSUFFICIENTE` nasce prima dell'inserimento, quindi la transazione del test non resta annullata e la verifica «nessun movimento nuovo» si può fare sullo stesso client.
- TF-BASE-43: «mai negativo» si verifica sul saldo finale (≥ 0 e uguale a 200). Per sapere quale transazione ha ottenuto il blocco per prima, il test usa un indicatore condiviso: la prima `addebita` che termina esegue `pg_sleep(0.5)`.

## 6. Fuori da questa TCS

- La segregazione per ente (VD_18) e le altre regole di dominio restano ai sottosistemi (piano approvato).
- Il controllo del saldo di `addebita` vale solo dentro una transazione: lo garantisce il tipo `PoolClient` del primo parametro, non un controllo a runtime.
