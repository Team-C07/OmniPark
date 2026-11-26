# TCS — Inserimento della sosta (vincoli dello schema)

- **Task:** OMP-33 (issue #5). Metodo: category partition.
- **Oggetto:** `INSERT` di una riga nella tabella `sosta` (`src/persistence/migrations/0001_schema_iniziale.sql`).
- **Fonti dell'esito atteso:** vincoli dello schema; requisiti in `docs/rad/requisiti.md`; vincoli di dominio in `docs/rad/vincoli_dominio.md` §2; statechart `SCD_1`, `SCD_2`.
- **File di test:** `src/persistence/vincoliSchema/inserimentoSosta.db.test.ts` (eseguito da `npm run test:db`).

## 1. Tracciabilità

Ogni frame riporta un solo riferimento, scelto in quest'ordine:

1. un requisito dell'Elenco (`RF_…`, `NRF_…`) se il suo testo copre davvero il vincolo;
2. altrimenti il vincolo di dominio del RAD, scritto `VD_<n>` (vincolo n. `<n>` di `docs/rad/vincoli_dominio.md` §2);
3. altrimenti `SCHEMA` (vincolo introdotto dallo schema, senza un requisito o un vincolo di dominio che lo copra).

Nome del test: `<riferimento> · <frame> · <descrizione> → <esito>`, per esempio `RF_SOSTA_1 · TF-SOSTA-25 · seconda sosta attiva per lo stesso veicolo → sosta_una_attiva_per_veicolo`.

## 2. Ambiente

### Esecuzione

- Database di test (`DATABASE_URL_TEST`), riportato allo stato noto (schema e dati di esempio) una volta per file da `preparaDatabaseDiTest()` nel `beforeAll`.
- Ogni test gira in una transazione propria: `iniziaTransazioneDiTest()` nel `beforeEach` apre la transazione e restituisce il client, `annullaTransazioneDiTest()` nell'`afterEach` esegue `ROLLBACK`. Tutte le query del test (preparazione, inserimento, verifica) usano quel client. Nessun frame vede le righe inserite da un altro.
- Esito di errore: si controllano `codice` SQLSTATE e nome del vincolo dell'errore restituito da PostgreSQL (`error.code`, `error.constraint`). Esito accettato: l'`INSERT` riesce e una `SELECT` sullo stesso client trova la riga con i valori inseriti.

### Righe del dataset usate (migrazione `0002_dati_esempio.sql`)

| Tabella         | id  | Contenuto                                                             | Uso nei frame                                                |
| :-------------- | :-- | :-------------------------------------------------------------------- | :----------------------------------------------------------- |
| `automobilista` | 8   | Marco Rossi                                                           | automobilista predefinito                                    |
| `veicolo`       | 3   | `MN234PQ`, nel profilo dell'automobilista 8                           | veicolo predefinito                                          |
| `automobilista` | 7   | Elena Bianchi                                                         | automobilista del secondo veicolo                            |
| `veicolo`       | 1   | `EF456GH`, nel profilo dell'automobilista 7                           | secondo veicolo (frame sullo stesso stallo)                  |
| `stallo`        | 16  | Piazza Aubry n. 3, `ORDINARIO_A_PAGAMENTO`, nessuna sosta nel dataset | stallo predefinito                                           |
| `stallo`        | 17  | Piazza Aubry n. 4, `ORDINARIO_A_PAGAMENTO`, nessuna sosta nel dataset | stallo della sosta preesistente (frame sullo stesso veicolo) |
| `stallo`        | 14  | Piazza Aubry n. 1, `DISABILI`                                         | stallo dei frame `GRATUITA`                                  |
| `stallo`        | 15  | Piazza Aubry n. 2, `ROSA`                                             | stallo dei frame `PAGATA` con permesso                       |
| `sosta`         | 2   | automobilista 8, veicolo 3, stallo 11, `TERMINATA`                    | sosta terminata dello stesso veicolo                         |

Nel dataset tutte le soste sono `TERMINATA`: le soste `ATTIVA` o `SCADUTA` richieste dall'ambiente si inseriscono nella transazione del test, prima dell'inserimento da verificare. Id inesistente per i riferimenti: `999999`.

### Valori predefiniti

Salvo diversa indicazione del frame, la sosta inserita ha:

| Colonna                                          | Valore                                             |
| :----------------------------------------------- | :------------------------------------------------- |
| `automobilista_id`, `veicolo_id`, `stallo_id`    | 8, 3, 16                                           |
| `stato`                                          | `ATTIVA`                                           |
| `orario_di_avvio`, `orario_di_scadenza`          | `2026-11-20 09:00:00+01`, `2026-11-20 10:00:00+01` |
| `pagamento`                                      | `PAGATA`                                           |
| `dichiarazione_di_permesso`, `foto_del_permesso` | `NULL`, `NULL`                                     |

Permesso «completo»: dichiarazione `Dichiaro di esporre il permesso previsto per lo stallo` e foto di 1024 byte. Le soste preesistenti create dai frame usano gli stessi orari, `PAGATA` e nessun permesso.

## 3. Parametri, categorie e scelte

| Parametro / ambiente                             | Categoria                        | Scelte                                                                                                                                                                                                                    |
| :----------------------------------------------- | :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `automobilista_id`, `veicolo_id`, `stallo_id`    | Riferimenti                      | tutti esistenti · automobilista inesistente [error] · veicolo inesistente [error] · stallo inesistente [error]                                                                                                            |
| `stato`                                          | Stato                            | `ATTIVA` [property ATTIVA] · `SCADUTA` · `TERMINATA` [property TERMINATA] · valore non ammesso [error]                                                                                                                    |
| `orario_di_avvio`, `orario_di_scadenza`          | Orari                            | scadenza dopo l'avvio · scadenza uguale all'avvio [error]                                                                                                                                                                 |
| `pagamento`                                      | Pagamento                        | `PAGATA` · `GRATUITA` [property GRATUITA] · valore non ammesso [error]                                                                                                                                                    |
| `dichiarazione_di_permesso`, `foto_del_permesso` | Permesso                         | assenti · completo [property PERMESSO] · solo dichiarazione [error] · solo foto [error] · dichiarazione di soli spazi [error] · foto di 0 byte [error] · foto di 2 097 153 byte [error] · foto di 2 097 152 byte [single] |
| ambiente                                         | Altre soste dello stesso veicolo | nessuna · una `ATTIVA` [if ATTIVA] · una `SCADUTA` · una `TERMINATA`                                                                                                                                                      |
| ambiente                                         | Altre soste dello stesso stallo  | nessuna · una `ATTIVA` [if ATTIVA] · una `SCADUTA`                                                                                                                                                                        |

### Vincoli tra le scelte

- **[if TERMINATA and PERMESSO]** → errore `sosta_permesso_eliminato_al_termine` (al termine dichiarazione e foto sono eliminate).
- **[if GRATUITA and not PERMESSO and not TERMINATA]** → errore `sosta_gratuita_con_permesso` (una sosta gratuita ha il permesso finché non termina).
- **[if ATTIVA]** sulle altre soste: una `ATTIVA` dello stesso veicolo → errore `sosta_una_attiva_per_veicolo`; una `ATTIVA` dello stesso stallo → errore `sosta_una_attiva_per_stallo`. Se la sosta inserita non è `ATTIVA`, la sosta attiva preesistente non conta.
- Le scelte [error] si combinano solo con i valori predefiniti; la scelta [single] compare in un solo frame.

## 4. Test frame (30)

Codici SQLSTATE: `23503` chiave esterna, `23514` CHECK, `23505` unicità.

| Frame       | Scelte (differenze dai valori predefiniti)                                                               | Esito atteso                                         | Riferimento |
| :---------- | :------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- | :---------- |
| TF-SOSTA-01 | `automobilista_id` = 999999                                                                              | errore `23503` `sosta_automobilista_id_fkey`         | SCHEMA      |
| TF-SOSTA-02 | `veicolo_id` = 999999                                                                                    | errore `23503` `sosta_veicolo_id_fkey`               | SCHEMA      |
| TF-SOSTA-03 | `stallo_id` = 999999                                                                                     | errore `23503` `sosta_stallo_id_fkey`                | SCHEMA      |
| TF-SOSTA-04 | `stato` = `IN_CORSO`                                                                                     | errore `23514` `sosta_stato_ammesso`                 | SCHEMA      |
| TF-SOSTA-05 | scadenza = avvio (`2026-11-20 09:00:00+01`)                                                              | errore `23514` `sosta_scadenza_dopo_avvio`           | SCHEMA      |
| TF-SOSTA-06 | `pagamento` = `SCONTATA`                                                                                 | errore `23514` `sosta_pagamento_ammesso`             | SCHEMA      |
| TF-SOSTA-07 | solo dichiarazione, foto `NULL`, stallo 15                                                               | errore `23514` `sosta_permesso_completo`             | RF_SOSTA_5  |
| TF-SOSTA-08 | solo foto, dichiarazione `NULL`, stallo 15                                                               | errore `23514` `sosta_permesso_completo`             | RF_SOSTA_5  |
| TF-SOSTA-09 | dichiarazione `'   '`, foto di 1024 byte, stallo 15                                                      | errore `23514` `sosta_dichiarazione_non_vuota`       | SCHEMA      |
| TF-SOSTA-10 | dichiarazione valida, foto di 0 byte, stallo 15                                                          | errore `23514` `sosta_foto_dimensione`               | SCHEMA      |
| TF-SOSTA-11 | dichiarazione valida, foto di 2 097 153 byte, stallo 15                                                  | errore `23514` `sosta_foto_dimensione`               | SCHEMA      |
| TF-SOSTA-12 | dichiarazione valida, foto di 2 097 152 byte, stallo 15                                                  | accettata                                            | SCHEMA      |
| TF-SOSTA-13 | `ATTIVA`, `PAGATA`, permesso assente                                                                     | accettata                                            | RF_SOSTA_1  |
| TF-SOSTA-14 | `ATTIVA`, `PAGATA`, permesso completo, stallo 15                                                         | accettata                                            | RF_SOSTA_5  |
| TF-SOSTA-15 | `ATTIVA`, `GRATUITA`, permesso assente, stallo 14                                                        | errore `23514` `sosta_gratuita_con_permesso`         | VD_10       |
| TF-SOSTA-16 | `ATTIVA`, `GRATUITA`, permesso completo, stallo 14                                                       | accettata                                            | VD_10       |
| TF-SOSTA-17 | `SCADUTA`, `PAGATA`, permesso assente                                                                    | accettata                                            | RF_SOSTA_7  |
| TF-SOSTA-18 | `SCADUTA`, `PAGATA`, permesso completo, stallo 15                                                        | accettata                                            | NRF_LEG_2   |
| TF-SOSTA-19 | `SCADUTA`, `GRATUITA`, permesso assente, stallo 14                                                       | errore `23514` `sosta_gratuita_con_permesso`         | VD_10       |
| TF-SOSTA-20 | `SCADUTA`, `GRATUITA`, permesso completo, stallo 14                                                      | accettata                                            | VD_10       |
| TF-SOSTA-21 | `TERMINATA`, `PAGATA`, permesso assente                                                                  | accettata                                            | NRF_LEG_2   |
| TF-SOSTA-22 | `TERMINATA`, `PAGATA`, permesso completo, stallo 15                                                      | errore `23514` `sosta_permesso_eliminato_al_termine` | NRF_LEG_2   |
| TF-SOSTA-23 | `TERMINATA`, `GRATUITA`, permesso assente, stallo 14                                                     | accettata                                            | NRF_LEG_2   |
| TF-SOSTA-24 | `TERMINATA`, `GRATUITA`, permesso completo, stallo 14                                                    | errore `23514` `sosta_permesso_eliminato_al_termine` | NRF_LEG_2   |
| TF-SOSTA-25 | preesistente: sosta `ATTIVA` (automobilista 8, veicolo 3, stallo 17); inserita: `ATTIVA` sullo stallo 16 | errore `23505` `sosta_una_attiva_per_veicolo`        | RF_SOSTA_1  |
| TF-SOSTA-26 | preesistente: sosta `ATTIVA` (8, 3, 17); inserita: `SCADUTA` sullo stallo 16                             | accettata                                            | RF_SOSTA_1  |
| TF-SOSTA-27 | preesistente: sosta `SCADUTA` (8, 3, 17); inserita: `ATTIVA` sullo stallo 16                             | accettata (comportamento attuale, vedi §6)           | RF_SOSTA_1  |
| TF-SOSTA-28 | preesistente: sosta 2 del dataset (`TERMINATA`, veicolo 3); inserita: `ATTIVA`                           | accettata                                            | RF_SOSTA_1  |
| TF-SOSTA-29 | preesistente: sosta `ATTIVA` (automobilista 7, veicolo 1, stallo 16); inserita: `ATTIVA` (8, 3, 16)      | errore `23505` `sosta_una_attiva_per_stallo`         | SCHEMA      |
| TF-SOSTA-30 | preesistente: sosta `SCADUTA` (7, 1, 16); inserita: `ATTIVA` (8, 3, 16)                                  | accettata (comportamento attuale, vedi §6)           | SCHEMA      |

Riepilogo: 11 frame [error] singoli, 1 frame [single], 12 frame dal prodotto stato × pagamento × permesso (4 in errore), 6 frame d'ambiente (2 in errore). Totale 30: 13 errori, 17 accettati.

Note sui riferimenti:

- TF-SOSTA-07/08: RF_SOSTA_5 richiede sia la dichiarazione sia la foto per l'avvio negli stalli riservati.
- TF-SOSTA-15, 16, 19, 20: VD_10 (con l'attributo derivato `/pagamento`, `vincoli_dominio.md` §1) lega la gratuità alla dichiarazione e alla foto del permesso.
- TF-SOSTA-18, 21–24: NRF_LEG_2 elimina dichiarazione e foto al termine della sosta; prima del termine restano.
- TF-SOSTA-29/30: nessun requisito né vincolo di dominio dice esplicitamente «una sola sosta attiva per stallo»; il vincolo deriva da VD_6 e da `UC_SOSTA_1` 2.a1 (l'avvio richiede lo stallo `Occupato`, non `Non disponibile`).

## 5. Vincoli di dominio non garantiti dallo schema

Lo schema accetta questi casi: li deve impedire il servizio che avvia, prolunga o termina la sosta (sottosistema Gestione soste). Nessun frame li verifica.

| Vincolo                      | Cosa lo schema non controlla                                                                                                      |
| :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| VD_3                         | il veicolo appartiene al profilo dell'automobilista che avvia la sosta                                                            |
| VD_5, RF_WALLET_2            | l'importo addebitato non supera il saldo                                                                                          |
| VD_6, RF_SOSTA_6             | lo stallo è `Non disponibile` mentre la sosta è `ATTIVA`                                                                          |
| VD_8                         | dichiarazione e foto solo su stalli `DISABILI` o `ROSA` (lo schema le accetta anche su uno stallo ordinario)                      |
| VD_9, RF_SOSTA_1, RF_SOSTA_2 | la durata non supera la durata massima della tariffa dello stallo                                                                 |
| VD_10                        | `GRATUITA` solo su stalli `DISABILI` (lo schema accetta `GRATUITA` con permesso su qualsiasi stallo) e `PAGATA` negli stalli rosa |
| `UC_SOSTA_1` 2.a1            | l'avvio richiede lo stallo `Occupato`                                                                                             |
| VD_11, `SCD_2`               | le transizioni di stato (`ATTIVA` → `SCADUTA` → `TERMINATA`); lo schema accetta qualsiasi stato all'inserimento                   |

## 6. Nota: una sola sosta attiva e soste scadute

Verifica richiesta: «una sola sosta attiva» deve valere anche per le soste `SCADUTA` (cioè per tutte le soste non terminate)?

- **Schema:** gli indici `sosta_una_attiva_per_veicolo` e `sosta_una_attiva_per_stallo` considerano solo `stato = 'ATTIVA'`.
- **Dominio:** `RF_SOSTA_1` («una sola sosta attiva per targa»), `UC_SOSTA_1` passo 2 e VD_2 parlano solo di soste `Attiva`. Per lo stallo, `SCD_1` riporta lo stallo da `Non disponibile` a `Occupato` alla scadenza, e da `Occupato` è possibile un nuovo `avvioSosta` mentre la sosta precedente è ancora `Scaduta`; `sincronizzazione_eventi.md` §1 prevede che `terminaSosta` termini «tutte le soste `Scadute` dello stallo», quindi più soste scadute sullo stesso stallo sono previste.
- **Conclusione:** non risulta un contrasto tra schema e modelli. TF-SOSTA-27 e TF-SOSTA-30 verificano il comportamento attuale (una sosta `SCADUTA` non impedisce una nuova sosta `ATTIVA`). Se il team decidesse di estendere l'unicità alle soste non terminate, questi due frame cambierebbero esito insieme allo schema.
