# TCS — Inserimento del movimento del wallet (vincoli dello schema)

- **Task:** OMP-33 (issue #5). Metodo: category partition.
- **Oggetto:** `INSERT` di una riga nella tabella `movimento_del_wallet` (`src/persistence/migrations/0001_schema_iniziale.sql`) e saldo calcolato dalla vista `saldo_wallet_virtuale`.
- **Fonti dell'esito atteso:** vincoli dello schema; requisiti in `docs/rad/requisiti.md`; vincoli di dominio in `docs/rad/vincoli_dominio.md` §2.
- **File di test:** `src/persistence/vincoliSchema/inserimentoMovimentoDelWallet.db.test.ts` (eseguito da `npm run test:db`).

## 1. Tracciabilità

Ogni frame riporta un solo riferimento, scelto in quest'ordine:

1. un requisito dell'Elenco (`RF_…`, `NRF_…`) se il suo testo copre davvero il vincolo;
2. altrimenti il vincolo di dominio del RAD, scritto `VD_<n>` (vincolo n. `<n>` di `docs/rad/vincoli_dominio.md` §2);
3. altrimenti `SCHEMA` (vincolo introdotto dallo schema, senza un requisito o un vincolo di dominio che lo copra).

Nome del test: `<riferimento> · <frame> · <descrizione> → <esito>`, per esempio `VD_4 · TF-MOV-10 · ricarica collegata a una sosta → movimento_del_wallet_sosta_coerente_con_tipo`.

## 2. Ambiente

### Esecuzione

- Database di test (`DATABASE_URL_TEST`), riportato allo stato noto (schema e dati di esempio) una volta per file da `preparaDatabaseDiTest()` nel `beforeAll`.
- Ogni test gira in una transazione propria: `iniziaTransazioneDiTest()` nel `beforeEach` apre la transazione e restituisce il client, `annullaTransazioneDiTest()` nell'`afterEach` esegue `ROLLBACK`. Tutte le query del test usano quel client.
- Esito di errore: si controllano `codice` SQLSTATE e nome del vincolo (`error.code`, `error.constraint`); per `23502` la colonna (`error.column`). Esito accettato: l'`INSERT` riesce, la riga si ritrova con una `SELECT` e, dove indicato, il saldo della vista `saldo_wallet_virtuale` cambia come previsto.

### Righe del dataset usate (migrazione `0002_dati_esempio.sql`)

| Tabella           | id  | Contenuto                                                                   | Uso nei frame        |
| :---------------- | :-- | :-------------------------------------------------------------------------- | :------------------- |
| `wallet_virtuale` | 2   | wallet dell'automobilista 8 (Marco Rossi); saldo nel dataset: 600 centesimi | wallet predefinito   |
| `sosta`           | 2   | sosta `TERMINATA` dell'automobilista 8 (veicolo 3, stallo 11)               | sosta degli addebiti |

Id inesistente per i riferimenti: `999999`.

### Valori predefiniti

| Colonna              | Valore                   |
| :------------------- | :----------------------- |
| `wallet_virtuale_id` | 2                        |
| `tipo_di_movimento`  | `RICARICA`               |
| `importo`            | 500 (centesimi)          |
| `data_e_ora`         | `2026-11-20 09:00:00+01` |
| `sosta_id`           | `NULL`                   |

## 3. Parametri, categorie e scelte

| Parametro            | Categoria  | Scelte                                                                                                                     |
| :------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------- |
| `wallet_virtuale_id` | Wallet     | esistente · inesistente [error]                                                                                            |
| `tipo_di_movimento`  | Tipo       | `RICARICA` [property RICARICA] · `ADDEBITO` [property ADDEBITO] · valore non ammesso [error]                               |
| `importo`            | Importo    | tipico (500) · 1 centesimo [single] · 0 [error] · negativo [error] · oltre il massimo di `integer` (2 147 483 648) [error] |
| `sosta_id`           | Sosta      | assente [property SENZA_SOSTA] · esistente [property CON_SOSTA] · inesistente [error]                                      |
| `data_e_ora`         | Data e ora | presente · `NULL` [error]                                                                                                  |

### Vincoli tra le scelte

- **[if RICARICA and CON_SOSTA]** → errore `movimento_del_wallet_sosta_coerente_con_tipo` (una ricarica non è collegata ad alcuna sosta).
- **[if ADDEBITO and SENZA_SOSTA]** → errore `movimento_del_wallet_sosta_coerente_con_tipo` (un addebito è collegato a una sola sosta).
- La scelta «sosta inesistente» si combina con `ADDEBITO`, così l'errore atteso è solo quello della chiave esterna.
- Le scelte [error] si combinano solo con i valori predefiniti; la scelta [single] compare in un solo frame.
- Eccezione: la scelta «tipo non ammesso» viola sempre anche `movimento_del_wallet_sosta_coerente_con_tipo`, qualunque sia la sosta (vedi la nota su TF-MOV-02).

## 4. Test frame (12)

Codici SQLSTATE: `23503` chiave esterna, `23514` CHECK, `23502` valore nullo, `22003` valore fuori intervallo.

| Frame     | Scelte (differenze dai valori predefiniti)  | Esito atteso                                                                                                                  | Riferimento |
| :-------- | :------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- | :---------- |
| TF-MOV-01 | `wallet_virtuale_id` = 999999               | errore `23503` `movimento_del_wallet_wallet_virtuale_id_fkey`                                                                 | SCHEMA      |
| TF-MOV-02 | `tipo_di_movimento` = `RIMBORSO`            | errore `23514`, vincolo `movimento_del_wallet_tipo_ammesso` oppure `movimento_del_wallet_sosta_coerente_con_tipo` (vedi nota) | SCHEMA      |
| TF-MOV-03 | `importo` = 0                               | errore `23514` `movimento_del_wallet_importo_positivo`                                                                        | SCHEMA      |
| TF-MOV-04 | `importo` = -500                            | errore `23514` `movimento_del_wallet_importo_positivo`                                                                        | SCHEMA      |
| TF-MOV-05 | `importo` = 2147483648                      | errore `22003` (fuori dall'intervallo di `integer`)                                                                           | SCHEMA      |
| TF-MOV-06 | `ADDEBITO`, `sosta_id` = 999999             | errore `23503` `movimento_del_wallet_sosta_id_fkey`                                                                           | SCHEMA      |
| TF-MOV-07 | `data_e_ora` = `NULL`                       | errore `23502`, colonna `data_e_ora`                                                                                          | SCHEMA      |
| TF-MOV-08 | `RICARICA`, `importo` = 1                   | accettato                                                                                                                     | SCHEMA      |
| TF-MOV-09 | `RICARICA`, senza sosta                     | accettato; saldo del wallet 2 da 600 a 1100                                                                                   | RF_WALLET_1 |
| TF-MOV-10 | `RICARICA`, `sosta_id` = 2                  | errore `23514` `movimento_del_wallet_sosta_coerente_con_tipo`                                                                 | VD_4        |
| TF-MOV-11 | `ADDEBITO`, `sosta_id` = 2, `importo` = 300 | accettato; saldo del wallet 2 da 600 a 300                                                                                    | RF_WALLET_2 |
| TF-MOV-12 | `ADDEBITO`, senza sosta                     | errore `23514` `movimento_del_wallet_sosta_coerente_con_tipo`                                                                 | VD_4        |

Riepilogo: 7 frame [error] singoli, 1 frame [single], 4 frame dal prodotto tipo × sosta (2 in errore). Totale 12: 9 errori, 3 accettati.

Note sui riferimenti:

- TF-MOV-02: per un tipo non ammesso i due CHECK si sovrappongono. `movimento_del_wallet_tipo_ammesso` lo rifiuta, e `movimento_del_wallet_sosta_coerente_con_tipo` accetta solo `RICARICA` senza sosta o `ADDEBITO` con una sosta, quindi fallisce anch'esso con o senza `sosta_id`. Nessuna scelta isola il primo vincolo e PostgreSQL riporta uno solo dei vincoli violati, senza un ordine garantito dalla specifica: l'esito atteso accetta entrambi i nomi.
- TF-MOV-09: RF_WALLET_1 prevede la ricarica simulata del credito; il saldo atteso viene dall'attributo derivato `/saldo` (ricariche meno addebiti, `vincoli_dominio.md` §1).
- TF-MOV-11: RF_WALLET_2 prevede l'addebito dell'importo della sosta sul wallet. Lo schema accetta più addebiti per la stessa sosta (avvio e prolungamenti): la sosta 2 ne ha già due nel dataset.
- TF-MOV-03/04: l'importo positivo con il segno dato dal tipo è una scelta dello schema; nessun requisito ne parla.
- TF-MOV-07: la cronologia di RF_WALLET_3 usa la data, ma il testo del requisito non impone che sia sempre presente.

Osservazione per lo schema (nessuna modifica in OMP-33): se si vuole che un tipo non ammesso violi solo `movimento_del_wallet_tipo_ammesso`, il vincolo di coerenza può essere riscritto in modo da valere solo per i tipi ammessi, per esempio `tipo_di_movimento NOT IN ('RICARICA', 'ADDEBITO') OR (…condizione attuale…)`. Servirebbe una nuova migrazione; in quel caso l'esito atteso di TF-MOV-02 tornerebbe al solo `movimento_del_wallet_tipo_ammesso`.

## 5. Vincoli di dominio non garantiti dallo schema

Lo schema accetta questi casi: li deve impedire il servizio del wallet o della sosta (sottosistemi Wallet e Gestione soste). Nessun frame li verifica.

| Vincolo               | Cosa lo schema non controlla                                                                                                               |
| :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| VD_5, RF_WALLET_2     | un addebito non supera il saldo; con credito insufficiente l'operazione è negata                                                           |
| RF_WALLET_2           | l'addebito va sul wallet dell'automobilista che ha avviato la sosta (lo schema accetta un addebito per la sosta di un altro automobilista) |
| NRF_LEG_1             | l'importo dell'addebito è quello calcolato con tariffa, fasce orarie ed esenzioni dello stallo                                             |
| `UC_WALLET_1` passo 1 | la ricarica è di 5, 10 o 20 € (500, 1000 o 2000 centesimi)                                                                                 |
| VD_10                 | nessun addebito per una sosta `GRATUITA`                                                                                                   |
