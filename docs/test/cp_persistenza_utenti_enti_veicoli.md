# TCS — Persistenza: utenti, enti e veicoli

- **Task:** OMP-34 (issue #6). Metodo: category partition.
- **Oggetto:** le funzioni di accesso di `src/persistence/accessoDati/utentiEntiVeicoli.ts`.
- **Fonti dell'esito atteso:** sequence diagram e casi d'uso indicati per ogni funzione (inventario del piano approvato); vincoli dello schema; `docs/rad/requisiti.md`; `docs/rad/vincoli_dominio.md` §2; codici di errore di `docs/test/cp_persistenza_base.md`.
- **File di test:** `src/persistence/accessoDati/utentiEntiVeicoli.db.test.ts` (eseguito da `npm run test:db`).

## 1. Tracciabilità

Ogni frame riporta un solo riferimento, scelto in quest'ordine: un requisito dell'Elenco (`RF_…`, `NRF_…`) se il suo testo copre davvero il comportamento; altrimenti il vincolo di dominio `VD_<n>` (`docs/rad/vincoli_dominio.md` §2); altrimenti `SCHEMA` se il frame verifica un vincolo specifico dello schema.

Nome del test: `<riferimento> · <frame> · <descrizione> → <esito>`, per esempio `VD_1 · TF-UEV-05 · email già registrata → EMAIL_GIA_REGISTRATA`.

## 2. Funzioni verificate (firme)

Il primo parametro è sempre l'esecutore (`Esecutore = Pool | PoolClient`, da `./esecutore`); nei test è il client della transazione del test. Gli id sono `number`; gli istanti `Date`. Gli errori sono `ErroreDominio` con il `codice` indicato (`./errori`).

```ts
type Ruolo = "AUTOMOBILISTA" | "AUSILIARIO_DEL_TRAFFICO" | "AMMINISTRATORE";
type StatoDellAccount = "ATTIVO" | "DISATTIVATO";

trovaUtentePerEmail(es, email: string): Promise<{ id; email; hashPassword; ruolo: Ruolo; statoDellAccount: StatoDellAccount | null } | null>;
// confronto senza distinzione tra maiuscole e minuscole; statoDellAccount solo per gli ausiliari
creaAutomobilista(es, dati: { email; hashPassword }): Promise<number>;                // id dell'utente
trovaOCreaVeicolo(es, targa: string): Promise<number>;                                 // id del veicolo
associaVeicolo(es, automobilistaId: number, veicoloId: number): Promise<void>;
targheDelProfilo(es, automobilistaId: number): Promise<{ veicoloId: number; targa: string }[]>; // ordinate per targa
rimuoviVeicoloDalProfilo(es, automobilistaId: number, veicoloId: number): Promise<boolean>;     // false se non c'era
creaSessione(es, dati: { utenteId: number; hashToken: string; scadenza: Date }): Promise<void>;
trovaSessione(es, hashToken: string, istante: Date): Promise<{ utenteId: number; ruolo: Ruolo } | null>; // null se scaduta (scadenza ≤ istante)
eliminaSessione(es, hashToken: string): Promise<boolean>;
eliminaSessioniUtente(es, utenteId: number): Promise<number>;                         // sessioni eliminate
enti(es): Promise<{ id: number; nome: string }[]>;                                     // ordinati per nome
riepilogoEnte(es, enteId: number): Promise<{ stalliGestiti: number; sosteAttive: number; segnalazioniNonChiuse: number } | null>;
ausiliari(es): Promise<{ id; email; nome; cognome; enteId; ente: string; statoDellAccount }[]>; // ordinati per ente, cognome, nome
trovaAusiliario(es, id: number): Promise<{ id; email; nome; cognome; enteId; statoDellAccount } | null>;
creaAusiliario(es, dati: { email; hashPassword; nome; cognome; enteId; amministratoreId }): Promise<number>;
aggiornaAusiliario(es, id: number, dati: { email; nome; cognome; enteId }): Promise<boolean>;   // false se l'ausiliario non esiste
disattivaAusiliario(es, id: number): Promise<boolean>;                                // false se l'ausiliario non esiste
```

Ordinamento degli elenchi (sempre con l'id come ultimo criterio di spareggio): `targheDelProfilo` per targa, poi id del veicolo; `enti` per nome, poi id; `ausiliari` per nome dell'ente, cognome, nome, poi id.

`riepilogoEnte` conta gli stalli delle aree dell'ente, le soste `ATTIVA` in quegli stalli e le segnalazioni `APERTA` o `PRESA_IN_CARICO` rilevate in quegli stalli (`UC_ADM_1`).

## 3. Ambiente

- Database di test riportato allo stato noto da `preparaDatabaseDiTest()` nel `beforeAll`; ogni test in una transazione annullata (`iniziaTransazioneDiTest()` nel `beforeEach`, `annullaTransazioneDiTest()` nell'`afterEach`), con il client come esecutore. Le verifiche dello stato dopo l'operazione si fanno con le funzioni del gruppo o con una `SELECT` sullo stesso client.
- Hash di prova: la stringa `hash-di-prova` (lo schema accetta qualsiasi testo non vuoto). Token di prova: `'a'.repeat(64)` e `'b'.repeat(64)`. Istante di prova: `2026-11-20 09:00:00+01`.

### Righe del dataset usate (migrazione `0002_dati_esempio.sql`)

| Tabella                              | id           | Contenuto                                                                                                                                                                                                                                                                                        |
| :----------------------------------- | :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utente` / `amministratore`          | 1            | `marco.esposito@omnipark.example`, Marco Esposito                                                                                                                                                                                                                                                |
| `utente` / `ausiliario_del_traffico` | 2            | `paolo.ferri@omnipark.example`, Paolo Ferri, ente 1, `ATTIVO`                                                                                                                                                                                                                                    |
| `utente` / `ausiliario_del_traffico` | 4            | `luca.russo@omnipark.example`, Luca Russo, ente 1, `DISATTIVATO`                                                                                                                                                                                                                                 |
| `utente` / `ausiliario_del_traffico` | 2…6          | 2 Paolo Ferri `paolo.ferri@omnipark.example`, 3 Sara Galli `sara.galli@omnipark.example`, 4 Luca Russo `luca.russo@omnipark.example` (ente 1); 5 Anna Moretti `anna.moretti@omnipark.example` (ente 2); 6 Giorgio Marino `giorgio.marino@omnipark.example` (ente 3); tutti `ATTIVO` tranne Russo |
| `utente` / `automobilista`           | 7            | `elena.bianchi@omnipark.example`; veicoli 1 `EF456GH`, 2 `GH321JK`                                                                                                                                                                                                                               |
| `utente` / `automobilista`           | 8            | `marco.rossi@omnipark.example`; veicolo 3 `MN234PQ`                                                                                                                                                                                                                                              |
| `automobilista`                      | 9            | Luigi Verde; veicolo 4 `IJ789KL`                                                                                                                                                                                                                                                                 |
| `automobilista`                      | 11           | Davide Conte; veicoli 6 `AB123CD`, 7 `FK771PS`, 8 `EB917RT`                                                                                                                                                                                                                                      |
| `ente_preposto`                      | 1, 2, 3      | Comune di Gragnano, di Fisciano, di Baronissi                                                                                                                                                                                                                                                    |
| riepilogo                            | enti 1, 2, 3 | stalli 21 / 6 / 3; soste attive 0 / 0 / 0; segnalazioni non chiuse 4 / 1 / 0                                                                                                                                                                                                                     |
| `stallo`                             | 16           | Piazza Aubry n. 3 (ente 1), nessuna sosta                                                                                                                                                                                                                                                        |
| sessioni                             | —            | nessuna                                                                                                                                                                                                                                                                                          |

Colonne usate dai test (per le preparazioni e le verifiche con SQL):

| Tabella                       | Colonne                                                                                                            |
| :---------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `utente`                      | `id`, `email`, `hash_password`, `ruolo` (`AUTOMOBILISTA`, `AUSILIARIO_DEL_TRAFFICO`, `AMMINISTRATORE`)             |
| `automobilista`               | `id`, `ruolo` (predefinito `AUTOMOBILISTA`)                                                                        |
| `ausiliario_del_traffico`     | `id`, `nome`, `cognome`, `stato_dell_account`, `ente_preposto_id`                                                  |
| `gestione_account_ausiliario` | `amministratore_id`, `ausiliario_del_traffico_id`                                                                  |
| `veicolo`                     | `id`, `targa`                                                                                                      |
| `automobilista_veicolo`       | `automobilista_id`, `veicolo_id`                                                                                   |
| `sessione`                    | `id`, `utente_id`, `hash_token`, `scadenza`                                                                        |
| `sosta`                       | `id`, `automobilista_id`, `veicolo_id`, `stallo_id`, `stato`, `orario_di_avvio`, `orario_di_scadenza`, `pagamento` |

Id inesistente: `999999`.

## 4. Categorie per funzione

Per ogni funzione si scelgono, dove applicabili, le categorie dell'issue: elemento esistente · elemento inesistente · nessun risultato · più risultati · violazione di vincolo. Le scelte [error] (violazioni) si combinano con valori altrimenti validi.

| Funzione                   | Scelte                                                                                             |
| :------------------------- | :------------------------------------------------------------------------------------------------- |
| `trovaUtentePerEmail`      | automobilista esistente · ausiliario esistente con email in maiuscolo · inesistente                |
| `creaAutomobilista`        | email nuova · email già registrata [error] · email non valida [error]                              |
| `trovaOCreaVeicolo`        | targa esistente · targa nuova · targa non normalizzata [error]                                     |
| `associaVeicolo`           | associazione nuova · già presente [error] · automobilista inesistente [error]                      |
| `targheDelProfilo`         | più risultati · un risultato · nessun risultato                                                    |
| `rimuoviVeicoloDalProfilo` | associazione esistente · inesistente                                                               |
| `creaSessione`             | sessione nuova · token già presente [error] · utente inesistente [error]                           |
| `trovaSessione`            | valida · scaduta · inesistente                                                                     |
| `eliminaSessione`          | esistente · inesistente                                                                            |
| `eliminaSessioniUtente`    | più sessioni · nessuna                                                                             |
| `enti`                     | più risultati                                                                                      |
| `riepilogoEnte`            | ente con stalli e segnalazioni · ente senza segnalazioni · ente con una sosta attiva · inesistente |
| `ausiliari`                | più risultati                                                                                      |
| `trovaAusiliario`          | esistente · id di un utente con un altro ruolo · inesistente                                       |
| `creaAusiliario`           | dati validi · email già registrata [error] · ente inesistente [error] · nome di soli spazi [error] |
| `aggiornaAusiliario`       | esistente · inesistente · email di un altro utente [error]                                         |
| `disattivaAusiliario`      | attivo · inesistente                                                                               |

## 5. Test frame (46)

| Frame     | Funzione e scelte                                                                                                                                    | Esito atteso                                                                                                                                                                      | Riferimento |
| :-------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| TF-UEV-01 | `trovaUtentePerEmail("marco.rossi@omnipark.example")`                                                                                                | `{ id: 8, email: "marco.rossi@omnipark.example", ruolo: "AUTOMOBILISTA", statoDellAccount: null }`, `hashPassword` non vuoto                                                      | RF_AUTH_4   |
| TF-UEV-02 | `trovaUtentePerEmail("LUCA.RUSSO@omnipark.example")`                                                                                                 | id 4, ruolo `AUSILIARIO_DEL_TRAFFICO`, `statoDellAccount` `DISATTIVATO`                                                                                                           | RF_AUTH_4   |
| TF-UEV-03 | `trovaUtentePerEmail("nessuno@omnipark.example")`                                                                                                    | `null`                                                                                                                                                                            | RF_AUTH_4   |
| TF-UEV-04 | `creaAutomobilista({ email: "nuovo@omnipark.example", hashPassword })`                                                                               | restituisce un id; `trovaUtentePerEmail` lo trova con ruolo `AUTOMOBILISTA`; esiste la riga in `automobilista`                                                                    | RF_AUTH_1   |
| TF-UEV-05 | `creaAutomobilista` con email `Marco.Rossi@omnipark.example`                                                                                         | `EMAIL_GIA_REGISTRATA`                                                                                                                                                            | VD_1        |
| TF-UEV-06 | `creaAutomobilista` con email `senza-chiocciola`                                                                                                     | `EMAIL_NON_VALIDA`                                                                                                                                                                | SCHEMA      |
| TF-UEV-07 | `trovaOCreaVeicolo("EF456GH")`                                                                                                                       | 1; nessun veicolo nuovo                                                                                                                                                           | RF_AUTH_5   |
| TF-UEV-08 | `trovaOCreaVeicolo("ZZ999ZZ")`                                                                                                                       | un id nuovo; il veicolo `ZZ999ZZ` esiste                                                                                                                                          | RF_AUTH_5   |
| TF-UEV-09 | `trovaOCreaVeicolo("ab123cd")`                                                                                                                       | `TARGA_NON_VALIDA`                                                                                                                                                                | SCHEMA      |
| TF-UEV-10 | `associaVeicolo(8, 1)`                                                                                                                               | `targheDelProfilo(8)` contiene `EF456GH` e `MN234PQ`                                                                                                                              | RF_AUTH_5   |
| TF-UEV-11 | `associaVeicolo(7, 1)`                                                                                                                               | `TARGA_GIA_NEL_PROFILO`                                                                                                                                                           | SCHEMA      |
| TF-UEV-12 | `associaVeicolo(999999, 1)`                                                                                                                          | `RIFERIMENTO_INESISTENTE`                                                                                                                                                         | SCHEMA      |
| TF-UEV-13 | `targheDelProfilo(11)`                                                                                                                               | `[{6, AB123CD}, {8, EB917RT}, {7, FK771PS}]` in quest'ordine                                                                                                                      | RF_AUTH_5   |
| TF-UEV-14 | `targheDelProfilo(8)`                                                                                                                                | `[{3, MN234PQ}]`                                                                                                                                                                  | RF_AUTH_5   |
| TF-UEV-15 | `targheDelProfilo(999999)`                                                                                                                           | `[]`                                                                                                                                                                              | RF_AUTH_5   |
| TF-UEV-16 | `rimuoviVeicoloDalProfilo(7, 2)`                                                                                                                     | `true`; `targheDelProfilo(7)` è `[{1, EF456GH}]`; il veicolo 2 esiste ancora                                                                                                      | RF_AUTH_5   |
| TF-UEV-17 | `rimuoviVeicoloDalProfilo(8, 1)`                                                                                                                     | `false`                                                                                                                                                                           | RF_AUTH_5   |
| TF-UEV-18 | `creaSessione({ utenteId: 8, hashToken: 'a'×64, scadenza: istante + 1 h })`                                                                          | `trovaSessione('a'×64, istante)` restituisce `{ utenteId: 8, ruolo: "AUTOMOBILISTA" }`                                                                                            | RF_AUTH_4   |
| TF-UEV-19 | due `creaSessione` con lo stesso token `'a'×64`                                                                                                      | la seconda: `SESSIONE_GIA_PRESENTE`                                                                                                                                               | SCHEMA      |
| TF-UEV-20 | `creaSessione` con `utenteId` 999999                                                                                                                 | `RIFERIMENTO_INESISTENTE`                                                                                                                                                         | SCHEMA      |
| TF-UEV-21 | sessione dell'utente 2 con scadenza istante + 1 h; `trovaSessione(token, istante)`                                                                   | `{ utenteId: 2, ruolo: "AUSILIARIO_DEL_TRAFFICO" }`                                                                                                                               | RF_AUTH_4   |
| TF-UEV-22 | sessione con scadenza = istante; `trovaSessione(token, istante)`                                                                                     | `null`                                                                                                                                                                            | RF_AUTH_4   |
| TF-UEV-23 | `trovaSessione('b'×64, istante)` senza sessioni                                                                                                      | `null`                                                                                                                                                                            | RF_AUTH_4   |
| TF-UEV-24 | sessione `'a'×64`; `eliminaSessione('a'×64)`                                                                                                         | `true`; poi `trovaSessione` restituisce `null`                                                                                                                                    | RF_AUTH_4   |
| TF-UEV-25 | `eliminaSessione('b'×64)` senza sessioni                                                                                                             | `false`                                                                                                                                                                           | RF_AUTH_4   |
| TF-UEV-26 | due sessioni dell'utente 3 (`'a'×64`, `'b'×64`); `eliminaSessioniUtente(3)`                                                                          | 2; nessuna delle due si trova più                                                                                                                                                 | VD_19       |
| TF-UEV-27 | `eliminaSessioniUtente(3)` senza sessioni                                                                                                            | 0                                                                                                                                                                                 | VD_19       |
| TF-UEV-28 | `enti()`                                                                                                                                             | `[{3, Comune di Baronissi}, {2, Comune di Fisciano}, {1, Comune di Gragnano}]`                                                                                                    | RF_ADM_1    |
| TF-UEV-29 | `riepilogoEnte(1)`                                                                                                                                   | `{ stalliGestiti: 21, sosteAttive: 0, segnalazioniNonChiuse: 4 }`                                                                                                                 | RF_ADM_1    |
| TF-UEV-30 | `riepilogoEnte(3)`                                                                                                                                   | `{ stalliGestiti: 3, sosteAttive: 0, segnalazioniNonChiuse: 0 }`                                                                                                                  | RF_ADM_1    |
| TF-UEV-31 | inserita con SQL una sosta `ATTIVA` (automobilista 8, veicolo 3, stallo 16, `PAGATA`, istante → istante + 1 h); `riepilogoEnte(1)`                   | `sosteAttive: 1`, gli altri valori come TF-UEV-29                                                                                                                                 | RF_ADM_1    |
| TF-UEV-32 | `riepilogoEnte(999999)`                                                                                                                              | `null`                                                                                                                                                                            | RF_ADM_1    |
| TF-UEV-33 | `ausiliari()`                                                                                                                                        | 5 elementi, in ordine: Baronissi (Marino), Fisciano (Moretti), Gragnano (Ferri, Galli, Russo); Russo `DISATTIVATO`, gli altri `ATTIVO`; email ed `enteId` coerenti con il dataset | RF_ADM_2    |
| TF-UEV-34 | `trovaAusiliario(2)`                                                                                                                                 | `{ id: 2, email: "paolo.ferri@omnipark.example", nome: "Paolo", cognome: "Ferri", enteId: 1, statoDellAccount: "ATTIVO" }`                                                        | NRF_SIC_1   |
| TF-UEV-35 | `trovaAusiliario(8)` (un automobilista)                                                                                                              | `null`                                                                                                                                                                            | NRF_SIC_1   |
| TF-UEV-36 | `trovaAusiliario(999999)`                                                                                                                            | `null`                                                                                                                                                                            | NRF_SIC_1   |
| TF-UEV-37 | `creaAusiliario({ email: "nuovo.ausiliario@omnipark.example", hashPassword, nome: "Nuovo", cognome: "Ausiliario", enteId: 2, amministratoreId: 1 })` | restituisce un id; `trovaAusiliario` lo trova `ATTIVO` con ente 2; esiste la riga (1, id) in `gestione_account_ausiliario`                                                        | RF_ADM_2    |
| TF-UEV-38 | `creaAusiliario` con email `paolo.ferri@omnipark.example`                                                                                            | `EMAIL_GIA_REGISTRATA`                                                                                                                                                            | VD_1        |
| TF-UEV-39 | `creaAusiliario` con `enteId` 999999                                                                                                                 | `RIFERIMENTO_INESISTENTE`                                                                                                                                                         | SCHEMA      |
| TF-UEV-40 | `creaAusiliario` con nome `"   "`                                                                                                                    | `DATI_NON_VALIDI`                                                                                                                                                                 | SCHEMA      |
| TF-UEV-41 | `aggiornaAusiliario(2, { email: "paolo.ferri.nuovo@omnipark.example", nome: "Paolo", cognome: "Ferri", enteId: 2 })`                                 | `true`; `trovaAusiliario(2)` riporta la nuova email e l'ente 2                                                                                                                    | RF_ADM_2    |
| TF-UEV-42 | `aggiornaAusiliario(999999, …)` con dati validi                                                                                                      | `false`                                                                                                                                                                           | RF_ADM_2    |
| TF-UEV-43 | `aggiornaAusiliario(2, …)` con email `sara.galli@omnipark.example`                                                                                   | `EMAIL_GIA_REGISTRATA`                                                                                                                                                            | VD_1        |
| TF-UEV-44 | `disattivaAusiliario(2)`                                                                                                                             | `true`; `trovaAusiliario(2).statoDellAccount` è `DISATTIVATO`                                                                                                                     | RF_ADM_2    |
| TF-UEV-45 | `disattivaAusiliario(999999)`                                                                                                                        | `false`                                                                                                                                                                           | RF_ADM_2    |
| TF-UEV-46 | `disattivaAusiliario(4)` (già `DISATTIVATO`)                                                                                                         | `true` (l'ausiliario esiste); `trovaAusiliario(4).statoDellAccount` resta `DISATTIVATO`                                                                                           | RF_ADM_2    |

Note sui riferimenti:

- TF-UEV-05, 38, 43: VD_1 (email unica tra tutti gli Utente).
- TF-UEV-26, 27: VD_19 (alla disattivazione si eliminano le sessioni dell'ausiliario).
- TF-UEV-29…31: il campo si chiama `segnalazioniNonChiuse` perché RF_ADM_1 parla di «segnalazioni aperte», ma `UC_ADM_1` (Regole di dominio) precisa che nel riepilogo sono tutte quelle non chiuse, `Aperta` e `Presa in carico` (anche `vincoli_dominio.md` §1).
- TF-UEV-46: come le altre funzioni di aggiornamento, `disattivaAusiliario` restituisce `false` solo se l'ausiliario non esiste; disattivare un ausiliario già disattivato non è un errore.
- TF-UEV-34…36: `trovaAusiliario` fornisce l'ente dell'ausiliario per la segregazione (NRF_SIC_1, SD_OP_1 2.1).

## 6. Regole lasciate ai sottosistemi

| Regola                                                                                                                         | Dove                                                |
| :----------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| il profilo conserva almeno una targa; una targa con sosta attiva non si rimuove                                                | Utenti e accessi (`UC_AUTH_5` 3.a2)                 |
| un ausiliario con segnalazioni prese in carico non si disattiva; alla disattivazione si chiamano anche `eliminaSessioniUtente` | Amministrazione (`UC_ADM_2` 3.a2, VD_19)            |
| verifica della password e validità formale della targa                                                                         | Utenti e accessi (`UC_AUTH_4`, `UC_AUTH_5` passo 4) |
| creazione atomica di automobilista, veicolo e wallet alla registrazione: il chiamante usa `eseguiInTransazione`                | Utenti e accessi (`UC_AUTH_1` 3)                    |
