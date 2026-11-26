# TCS — Inserimento del veicolo e associazione al profilo (vincoli dello schema)

- **Task:** OMP-33 (issue #5). Metodo: category partition.
- **Oggetto:** `INSERT` di una riga in `veicolo` e di una riga in `automobilista_veicolo` (associazione «associa» tra Automobilista e Veicolo), in `src/persistence/migrations/0001_schema_iniziale.sql`.
- **Fonti dell'esito atteso:** vincoli dello schema; requisiti in `docs/rad/requisiti.md`; vincoli di dominio in `docs/rad/vincoli_dominio.md` §2; `UC_AUTH_5`.
- **File di test:** `src/persistence/vincoliSchema/inserimentoVeicolo.db.test.ts` (eseguito da `npm run test:db`).

## 1. Tracciabilità

Ogni frame riporta un solo riferimento, scelto in quest'ordine:

1. un requisito dell'Elenco (`RF_…`, `NRF_…`) se il suo testo copre davvero il vincolo;
2. altrimenti il vincolo di dominio del RAD, scritto `VD_<n>` (vincolo n. `<n>` di `docs/rad/vincoli_dominio.md` §2);
3. altrimenti `SCHEMA` (vincolo introdotto dallo schema, senza un requisito o un vincolo di dominio che lo copra).

Nome del test: `<riferimento> · <frame> · <descrizione> → <esito>`, per esempio `SCHEMA · TF-VEIC-05 · targa già presente → veicolo_targa_unica`.

## 2. Ambiente

### Esecuzione

- Database di test (`DATABASE_URL_TEST`), riportato allo stato noto (schema e dati di esempio) una volta per file da `preparaDatabaseDiTest()` nel `beforeAll`.
- Ogni test gira in una transazione propria: `iniziaTransazioneDiTest()` nel `beforeEach` apre la transazione e restituisce il client, `annullaTransazioneDiTest()` nell'`afterEach` esegue `ROLLBACK`. Tutte le query del test usano quel client.
- Esito di errore: si controllano `codice` SQLSTATE e nome del vincolo (`error.code`, `error.constraint`); per `23502` la colonna (`error.column`). Esito accettato: l'`INSERT` riesce e una `SELECT` trova la riga; per le associazioni, la targa compare tra quelle del profilo dell'automobilista.

### Righe del dataset usate (migrazione `0002_dati_esempio.sql`)

| Tabella                 | id     | Contenuto                                                                      | Uso nei frame                        |
| :---------------------- | :----- | :----------------------------------------------------------------------------- | :----------------------------------- |
| `automobilista`         | 8      | Marco Rossi; nel profilo solo il veicolo 3 (`MN234PQ`)                         | automobilista predefinito            |
| `automobilista`         | 7      | Elena Bianchi; nel profilo i veicoli 1 (`EF456GH`) e 2 (`GH321JK`)             | proprietaria della targa condivisa   |
| `veicolo`               | 1      | `EF456GH`, associato all'automobilista 7                                       | targa già presente e targa condivisa |
| `veicolo`               | 3      | `MN234PQ`, associato all'automobilista 8                                       | veicolo dei frame sull'associazione  |
| `automobilista_veicolo` | (7, 1) | associazione già presente                                                      | associazione duplicata               |
| `utente`                | 2      | Paolo Ferri, ruolo `AUSILIARIO_DEL_TRAFFICO` (nessuna riga in `automobilista`) | utente con un altro ruolo            |

Id inesistente per i riferimenti: `999999`. La targa nuova predefinita, `ZZ999ZZ`, non è nel dataset.

### Valori predefiniti

| Inserimento             | Valore                                                           |
| :---------------------- | :--------------------------------------------------------------- |
| `veicolo.targa`         | `ZZ999ZZ`                                                        |
| `automobilista_veicolo` | (`automobilista_id` 8, `veicolo_id` del veicolo appena inserito) |

I frame sulla sola targa (TF-VEIC-01…05) inseriscono solo la riga di `veicolo`.

## 3. Parametri, categorie e scelte

| Parametro / ambiente                     | Categoria           | Scelte                                                                                                           |
| :--------------------------------------- | :------------------ | :--------------------------------------------------------------------------------------------------------------- |
| `veicolo.targa`                          | Formato della targa | normalizzata (maiuscole e cifre) · con minuscole [error] · con trattini [error] · vuota [error] · `NULL` [error] |
| `veicolo.targa` e ambiente               | Unicità della targa | nuova · già presente [error]                                                                                     |
| `automobilista_veicolo.automobilista_id` | Automobilista       | esistente · inesistente [error] · utente con un altro ruolo [error]                                              |
| `automobilista_veicolo.veicolo_id`       | Veicolo             | appena inserito · esistente nel profilo di un altro automobilista [property CONDIVISO] · inesistente [error]     |
| ambiente                                 | Associazione        | nuova · già presente [error]                                                                                     |

### Vincoli tra le scelte

- **[if CONDIVISO]** l'associazione è nuova per l'automobilista 8: accettata (la stessa targa può stare nel profilo di più automobilisti).
- Le scelte [error] si combinano solo con i valori predefiniti; per gli errori dell'associazione il veicolo è quello esistente indicato nel frame, così l'unico errore atteso è quello dell'associazione.

## 4. Test frame (11)

Codici SQLSTATE: `23514` CHECK, `23502` valore nullo, `23505` unicità, `23503` chiave esterna.

| Frame      | Scelte (differenze dai valori predefiniti)              | Esito atteso                                                 | Riferimento |
| :--------- | :------------------------------------------------------ | :----------------------------------------------------------- | :---------- |
| TF-VEIC-01 | targa `ab123cd`                                         | errore `23514` `veicolo_targa_normalizzata`                  | SCHEMA      |
| TF-VEIC-02 | targa `AB-123-CD`                                       | errore `23514` `veicolo_targa_normalizzata`                  | SCHEMA      |
| TF-VEIC-03 | targa `''`                                              | errore `23514` `veicolo_targa_normalizzata`                  | SCHEMA      |
| TF-VEIC-04 | targa `NULL`                                            | errore `23502`, colonna `targa`                              | SCHEMA      |
| TF-VEIC-05 | targa `EF456GH` (veicolo 1)                             | errore `23505` `veicolo_targa_unica`                         | SCHEMA      |
| TF-VEIC-06 | targa `ZZ999ZZ`, poi associazione all'automobilista 8   | accettato; `ZZ999ZZ` nel profilo dell'automobilista 8        | RF_AUTH_5   |
| TF-VEIC-07 | associazione (automobilista 8, veicolo 1)               | accettata; `EF456GH` nel profilo degli automobilisti 7 e 8   | RF_AUTH_5   |
| TF-VEIC-08 | associazione (automobilista 999999, veicolo 3)          | errore `23503` `automobilista_veicolo_automobilista_id_fkey` | SCHEMA      |
| TF-VEIC-09 | associazione (utente 2, veicolo 3)                      | errore `23503` `automobilista_veicolo_automobilista_id_fkey` | VD_1        |
| TF-VEIC-10 | associazione (automobilista 8, veicolo 999999)          | errore `23503` `automobilista_veicolo_veicolo_id_fkey`       | SCHEMA      |
| TF-VEIC-11 | associazione (automobilista 7, veicolo 1), già presente | errore `23505` `automobilista_veicolo_pkey`                  | SCHEMA      |

Riepilogo: 9 frame [error] singoli e 2 frame accettati. Totale 11: 9 errori, 2 accettati.

Note sui riferimenti:

- TF-VEIC-06/07: RF_AUTH_5 prevede che l'Automobilista associ al proprio profilo le targhe dei veicoli; la condivisione della targa è una regola di `UC_AUTH_5`, compatibile con il requisito.
- TF-VEIC-09: VD_1 (gerarchia `{complete, disjoint}`) esclude che un Ausiliario del Traffico sia anche Automobilista.
- TF-VEIC-01…05: il formato normalizzato e l'unicità della targa sono scelte dello schema; la validità formale della targa la verifica il servizio (`UC_AUTH_5` passo 4).
- TF-VEIC-11: corrisponde al flusso `UC_AUTH_5` 4.a1 («targa già nel profilo»), che non ha un requisito né un vincolo di dominio proprio.

## 5. Vincoli di dominio non garantiti dallo schema

Lo schema accetta questi casi: li deve impedire il servizio delle targhe (sottosistema Utenti e accessi). Nessun frame li verifica.

| Vincolo                             | Cosa lo schema non controlla                                                                            |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------ |
| `UC_AUTH_5`, `UC_AUTH_1`            | il profilo dell'automobilista conserva sempre almeno una targa                                          |
| CD, associazione «associa» (`1..*`) | ogni veicolo è nel profilo di almeno un automobilista (lo schema accetta un veicolo senza associazioni) |
| `UC_AUTH_5` passo 4                 | la targa è formalmente valida (lo schema controlla solo maiuscole e cifre)                              |
| `UC_AUTH_5` 3.a2                    | una targa con una sosta `ATTIVA` non si rimuove dal profilo                                             |
