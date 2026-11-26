# TCS — Persistenza: stalli, tariffe e rilevazioni

- **Task:** OMP-34 (issue #6). Metodo: category partition.
- **Oggetto:** le funzioni di accesso di `src/persistence/accessoDati/stalliTariffe.ts`.
- **Fonti dell'esito atteso:** sequence diagram e casi d'uso indicati per ogni funzione (inventario del piano approvato); vincoli dello schema; `docs/rad/requisiti.md`; `docs/rad/vincoli_dominio.md` §2; statechart `SCD_1`; codici di errore di `docs/test/cp_persistenza_base.md`.
- **File di test:** `src/persistence/accessoDati/stalliTariffe.db.test.ts` (eseguito da `npm run test:db`).

Le tariffe non hanno funzioni proprie: nessun SD o UC le modifica (D7 del piano) e si leggono con lo stallo (`trovaStallo`). Delle rilevazioni lo schema conserva solo l'ultima, nello stallo (D1 del piano).

## 1. Tracciabilità

Ogni frame riporta un solo riferimento, scelto in quest'ordine: un requisito dell'Elenco (`RF_…`, `NRF_…`) se il suo testo copre davvero il comportamento; altrimenti il vincolo di dominio `VD_<n>` (`docs/rad/vincoli_dominio.md` §2); altrimenti `SCHEMA` se il frame verifica un vincolo specifico dello schema.

Nome del test: `<riferimento> · <frame> · <descrizione> → <esito>`, per esempio `VD_20 · TF-STA-11 · rilevazione incoerente con lo stato → STATO_STALLO_NON_VALIDO`.

## 2. Funzioni verificate (firme)

Il primo parametro è sempre l'esecutore (`Esecutore = Pool | PoolClient`, da `./esecutore`); nei test è il client della transazione del test. Gli id sono `number`; gli istanti `Date`. Gli errori sono `ErroreDominio` con il `codice` indicato (`./errori`).

```ts
type TipoDiStallo = "ORDINARIO_A_PAGAMENTO" | "DISABILI" | "ROSA";
type StatoStallo = "LIBERO" | "OCCUPATO" | "NON_DISPONIBILE" | "SCONOSCIUTO";
type OccupazioneRilevata = "VEICOLO_PRESENTE" | "NESSUN_VEICOLO";
type Zona = { latMin: number; latMax: number; lonMin: number; lonMax: number }; // estremi inclusi
type StalloMappa = { id; numero; latitudine; longitudine; tipoDiStallo; stato; ultimaModifica: Date };

stalliNellaZona(es, zona: Zona): Promise<StalloMappa[]>;                          // ordinati per id
stalliModificatiDopo(es, zona: Zona, istante: Date): Promise<{ stalli: StalloMappa[]; cursore: Date | null }>;
// stalli della zona con ultima_modifica > istante, ordinati per id; cursore = max(ultimaModifica) delle righe restituite, null se nessuna
trovaStallo(es, id: number): Promise<{
  id; numero; latitudine; longitudine; tipoDiStallo; stato; ultimaModifica;
  occupazioneRilevata: OccupazioneRilevata | null; dataEOraUltimaRilevazione: Date | null;
  areaDiSosta: { id; nome }; enteId: number;
  tariffa: { id; costoOrario; orarioInizioVigenza: string; orarioFineVigenza: string; durataMassima }; // orari "HH:MM:SS"
} | null>;
registraRilevazione(es, stalloId: number, dati: { occupazioneRilevata; dataEOra: Date; stato: StatoStallo }): Promise<boolean>;
// rilevazione e stato nello stesso UPDATE (D5); false se lo stallo non esiste
impostaStatoStallo(es, stalloId: number, stato: StatoStallo): Promise<boolean>;  // false se lo stallo non esiste
stalliSenzaRilevazioniDa(es, istanteLimite: Date): Promise<number[]>;
// id degli stalli LIBERO o OCCUPATO con ultima rilevazione < istanteLimite, ordinati
salvaStalloPreferito(es, automobilistaId: number, stalloId: number): Promise<void>;
salvaAreaPreferita(es, automobilistaId: number, areaDiSostaId: number): Promise<void>;
preferiti(es, automobilistaId: number): Promise<{ stalli: StalloMappa[]; aree: { id; nome; stalli: StalloMappa[] }[] }>;
// stalli preferiti ordinati per id; aree ordinate per nome, ciascuna con i suoi stalli ordinati per id
```

Ordinamento degli elenchi: `stalliNellaZona`, `stalliModificatiDopo`, `stalliSenzaRilevazioniDa` e gli stalli di `preferiti` (sia preferiti sia di un'area) per id; le aree di `preferiti` per nome, poi id.

`ultima_modifica` la aggiorna il trigger dello schema con l'ora del database (D2 del piano): le funzioni non usano l'orologio.

## 3. Ambiente

- Database di test riportato allo stato noto da `preparaDatabaseDiTest()` nel `beforeAll`; ogni test in una transazione annullata (`iniziaTransazioneDiTest()` / `annullaTransazioneDiTest()`), con il client come esecutore.
- Istante del dataset: `2026-11-15 08:00:00+01` (ultima rilevazione di tutti gli stalli `LIBERO` e `OCCUPATO` e `ultima_modifica` di tutti gli stalli). Istante di prova per le rilevazioni: `2026-11-20 09:00:00+01`.

### Righe del dataset usate (migrazione `0002_dati_esempio.sql`)

| Tabella                   | id      | Contenuto                                                                                                                                   |
| :------------------------ | :------ | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `area_di_sosta`           | 5       | Piazza Aubry (ente 1), stalli 14…21 alla longitudine 14.52214 e latitudini da 40.68824 a 40.68859                                           |
| `stallo`                  | 13      | Via Roma n. 104 (area 4), `SCONOSCIUTO`, `VEICOLO_PRESENTE` rilevato il `2026-11-15 07:00:00+01`, latitudine 40.69149, longitudine 14.51616 |
| `stallo`                  | 14      | Piazza Aubry n. 1, `DISABILI`, `LIBERO`, tariffa 1 (150 centesimi l'ora, 08:00–20:00, 180 minuti)                                           |
| `stallo`                  | 16      | Piazza Aubry n. 3, `ORDINARIO_A_PAGAMENTO`, `LIBERO`, `NESSUN_VEICOLO`                                                                      |
| `stallo`                  | 17      | Piazza Aubry n. 4, `ORDINARIO_A_PAGAMENTO`, `OCCUPATO`, `VEICOLO_PRESENTE`                                                                  |
| `stallo`                  | 25      | Via Giovanni Paolo II n. 4 (Fisciano), `ROSA`, `SCONOSCIUTO`, mai rilevato                                                                  |
| stalli                    | —       | 30 in tutto; `SCONOSCIUTO` solo 13 e 25, tutti gli altri `LIBERO` o `OCCUPATO`                                                              |
| `stallo_preferito`        | (8, 11) | Marco Rossi preferisce lo stallo 11                                                                                                         |
| `area_di_sosta_preferita` | (10, 5) | Giulia Romano preferisce Piazza Aubry (stalli 14…21; `LIBERO` 14 e 16)                                                                      |
| `automobilista`           | 9       | Luigi Verde, nessun preferito                                                                                                               |

Zone usate:

| Nome             | latMin   | latMax   | lonMin   | lonMax   | Stalli               |
| :--------------- | :------- | :------- | :------- | :------- | :------------------- |
| Piazza Aubry     | 40.688   | 40.689   | 14.522   | 14.5223  | 14…21                |
| Stallo 13 esatto | 40.69149 | 40.69149 | 14.51616 | 14.51616 | 13 (estremi inclusi) |
| Mare             | 40.0     | 40.1     | 14.0     | 14.1     | nessuno              |

Colonne usate dai test (per le preparazioni e le verifiche con SQL):

| Tabella                   | Colonne                                                                                                                                                                                   |
| :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stallo`                  | `id`, `area_di_sosta_id`, `tariffa_id`, `numero`, `latitudine`, `longitudine`, `tipo_di_stallo`, `stato`, `occupazione_rilevata`, `data_e_ora_dell_ultima_rilevazione`, `ultima_modifica` |
| `area_di_sosta`           | `id`, `ente_preposto_id`, `nome`                                                                                                                                                          |
| `tariffa`                 | `id`, `costo_orario`, `orario_inizio_vigenza`, `orario_fine_vigenza`, `durata_massima`                                                                                                    |
| `stallo_preferito`        | `automobilista_id`, `stallo_id`                                                                                                                                                           |
| `area_di_sosta_preferita` | `automobilista_id`, `area_di_sosta_id`                                                                                                                                                    |
| `utente`                  | `id`, `ruolo` (l'utente 2 è `AUSILIARIO_DEL_TRAFFICO`, quindi non è in `automobilista`)                                                                                                   |

Id inesistente: `999999`.

## 4. Categorie per funzione

| Funzione                   | Scelte                                                                                                                                       |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `stalliNellaZona`          | più risultati · un risultato sugli estremi [single] · nessun risultato                                                                       |
| `stalliModificatiDopo`     | istante precedente alle modifiche · istante uguale all'ultima modifica · uno stallo modificato dopo l'istante                                |
| `trovaStallo`              | esistente rilevato · esistente mai rilevato · inesistente                                                                                    |
| `registraRilevazione`      | rilevazione coerente con lo stato · rilevazione incoerente [error] · stallo `NON_DISPONIBILE` con qualsiasi rilevazione · stallo inesistente |
| `impostaStatoStallo`       | transizione valida · stato incoerente con la rilevazione [error] · stallo mai rilevato portato a `LIBERO` [error] · stallo inesistente       |
| `stalliSenzaRilevazioniDa` | limite uguale all'ultima rilevazione · limite successivo · stallo `NON_DISPONIBILE` escluso                                                  |
| `salvaStalloPreferito`     | nuovo · già presente [error] · stallo inesistente [error]                                                                                    |
| `salvaAreaPreferita`       | nuova · già presente [error] · area inesistente [error]                                                                                      |
| `preferiti`                | solo stalli · solo aree · nessun preferito · più stalli · area senza stalli                                                                  |

## 5. Test frame (32)

| Frame     | Funzione e scelte                                                                                                                                                                                                                                                                 | Esito atteso                                                                                                                                                                         | Riferimento |
| :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| TF-STA-01 | `stalliNellaZona(Piazza Aubry)`                                                                                                                                                                                                                                                   | 8 stalli, id 14…21 in ordine; lo stallo 14 ha tipo `DISABILI`, stato `LIBERO`, latitudine 40.68824, longitudine 14.52214                                                             | RF_STALLI_1 |
| TF-STA-02 | `stalliNellaZona(Stallo 13 esatto)`                                                                                                                                                                                                                                               | solo lo stallo 13                                                                                                                                                                    | RF_STALLI_1 |
| TF-STA-03 | `stalliNellaZona(Mare)`                                                                                                                                                                                                                                                           | `[]`                                                                                                                                                                                 | RF_STALLI_1 |
| TF-STA-04 | `stalliModificatiDopo(Piazza Aubry, 2026-11-15 07:59:59+01)`                                                                                                                                                                                                                      | gli 8 stalli 14…21; `cursore` = `2026-11-15 08:00:00+01`                                                                                                                             | NRF_PER_3   |
| TF-STA-05 | `stalliModificatiDopo(Piazza Aubry, 2026-11-15 08:00:00+01)`                                                                                                                                                                                                                      | `{ stalli: [], cursore: null }`                                                                                                                                                      | NRF_PER_3   |
| TF-STA-06 | `impostaStatoStallo(16, "NON_DISPONIBILE")`, poi `stalliModificatiDopo(Piazza Aubry, 2026-11-15 08:00:00+01)`                                                                                                                                                                     | solo lo stallo 16, con stato `NON_DISPONIBILE`; `cursore` uguale alla sua `ultimaModifica` e successivo all'istante                                                                  | NRF_PER_3   |
| TF-STA-07 | `trovaStallo(14)`                                                                                                                                                                                                                                                                 | numero 1, `DISABILI`, `LIBERO`, `NESSUN_VEICOLO`, ultima rilevazione `2026-11-15 08:00:00+01`, area `{ 5, Piazza Aubry }`, ente 1, tariffa `{ 1, 150, "08:00:00", "20:00:00", 180 }` | RF_STALLI_2 |
| TF-STA-08 | `trovaStallo(25)`                                                                                                                                                                                                                                                                 | `SCONOSCIUTO`, `occupazioneRilevata` `null`, `dataEOraUltimaRilevazione` `null`, ente 2                                                                                              | RF_STALLI_2 |
| TF-STA-09 | `trovaStallo(999999)`                                                                                                                                                                                                                                                             | `null`                                                                                                                                                                               | RF_STALLI_2 |
| TF-STA-10 | `registraRilevazione(16, { VEICOLO_PRESENTE, istante di prova, OCCUPATO })`                                                                                                                                                                                                       | `true`; `trovaStallo(16)`: `OCCUPATO`, `VEICOLO_PRESENTE`, ultima rilevazione all'istante di prova                                                                                   | RF_IOT_1    |
| TF-STA-11 | `registraRilevazione(16, { VEICOLO_PRESENTE, istante di prova, LIBERO })`                                                                                                                                                                                                         | `STATO_STALLO_NON_VALIDO`                                                                                                                                                            | VD_20       |
| TF-STA-12 | `registraRilevazione(17, { NESSUN_VEICOLO, istante di prova, NON_DISPONIBILE })`                                                                                                                                                                                                  | `true`; `NON_DISPONIBILE` con `NESSUN_VEICOLO`                                                                                                                                       | VD_20       |
| TF-STA-13 | `registraRilevazione(999999, { NESSUN_VEICOLO, istante di prova, LIBERO })`                                                                                                                                                                                                       | `false`                                                                                                                                                                              | RF_IOT_1    |
| TF-STA-14 | `impostaStatoStallo(17, "NON_DISPONIBILE")`                                                                                                                                                                                                                                       | `true`; `trovaStallo(17).stato` è `NON_DISPONIBILE`                                                                                                                                  | RF_SOSTA_6  |
| TF-STA-15 | `impostaStatoStallo(16, "OCCUPATO")` (rilevazione `NESSUN_VEICOLO`)                                                                                                                                                                                                               | `STATO_STALLO_NON_VALIDO`                                                                                                                                                            | VD_20       |
| TF-STA-16 | `impostaStatoStallo(25, "LIBERO")` (mai rilevato)                                                                                                                                                                                                                                 | `STATO_STALLO_NON_VALIDO`                                                                                                                                                            | VD_20       |
| TF-STA-17 | `impostaStatoStallo(999999, "SCONOSCIUTO")`                                                                                                                                                                                                                                       | `false`                                                                                                                                                                              | RF_IOT_2    |
| TF-STA-18 | `stalliSenzaRilevazioniDa(2026-11-15 08:00:00+01)`                                                                                                                                                                                                                                | `[]`                                                                                                                                                                                 | RF_IOT_2    |
| TF-STA-19 | `stalliSenzaRilevazioniDa(2026-11-15 08:01:00+01)`                                                                                                                                                                                                                                | 28 id: da 1 a 30 tranne 13 e 25, in ordine                                                                                                                                           | RF_IOT_2    |
| TF-STA-20 | `impostaStatoStallo(17, "NON_DISPONIBILE")`, poi `stalliSenzaRilevazioniDa(2026-11-15 08:01:00+01)`                                                                                                                                                                               | 27 id: come TF-STA-19 senza 17                                                                                                                                                       | RF_SOSTA_6  |
| TF-STA-21 | `salvaStalloPreferito(10, 16)`                                                                                                                                                                                                                                                    | `preferiti(10).stalli` contiene solo lo stallo 16                                                                                                                                    | RF_STALLI_3 |
| TF-STA-22 | `salvaStalloPreferito(8, 11)`                                                                                                                                                                                                                                                     | `GIA_TRA_I_PREFERITI`                                                                                                                                                                | RF_STALLI_3 |
| TF-STA-23 | `salvaStalloPreferito(8, 999999)`                                                                                                                                                                                                                                                 | `RIFERIMENTO_INESISTENTE`                                                                                                                                                            | SCHEMA      |
| TF-STA-24 | `salvaAreaPreferita(8, 5)`                                                                                                                                                                                                                                                        | `preferiti(8).aree` contiene l'area 5 con gli stalli 14…21                                                                                                                           | RF_STALLI_3 |
| TF-STA-25 | `salvaAreaPreferita(10, 5)`                                                                                                                                                                                                                                                       | `GIA_TRA_I_PREFERITI`                                                                                                                                                                | RF_STALLI_3 |
| TF-STA-26 | `salvaAreaPreferita(8, 999999)`                                                                                                                                                                                                                                                   | `RIFERIMENTO_INESISTENTE`                                                                                                                                                            | SCHEMA      |
| TF-STA-27 | `preferiti(8)`                                                                                                                                                                                                                                                                    | `stalli`: solo lo stallo 11; `aree`: `[]`                                                                                                                                            | RF_STALLI_5 |
| TF-STA-28 | `preferiti(10)`                                                                                                                                                                                                                                                                   | `stalli`: `[]`; `aree`: una, `{ 5, Piazza Aubry }` con gli stalli 14…21, di cui 2 `LIBERO` (14 e 16)                                                                                 | RF_STALLI_5 |
| TF-STA-29 | `preferiti(9)`                                                                                                                                                                                                                                                                    | `{ stalli: [], aree: [] }`                                                                                                                                                           | RF_STALLI_5 |
| TF-STA-30 | `salvaStalloPreferito(8, 16)`, poi `preferiti(8)`                                                                                                                                                                                                                                 | `stalli`: 11 e 16, in quest'ordine                                                                                                                                                   | RF_STALLI_5 |
| TF-STA-31 | `salvaStalloPreferito(2, 16)` (l'utente 2 è un ausiliario, non un automobilista)                                                                                                                                                                                                  | `RIFERIMENTO_INESISTENTE`                                                                                                                                                            | VD_1        |
| TF-STA-32 | area senza stalli creata con SQL (`INSERT INTO area_di_sosta (ente_preposto_id, nome) VALUES (1, 'Area di prova senza stalli') RETURNING id`) e salvata tra i preferiti di 9 con SQL (`INSERT INTO area_di_sosta_preferita (automobilista_id, area_di_sosta_id)`); `preferiti(9)` | `stalli`: `[]`; `aree`: una, `{ id dell'area nuova, Area di prova senza stalli, stalli: [] }`                                                                                        | RF_STALLI_5 |

Note sui riferimenti:

- TF-STA-11, 12, 15, 16: VD_20 e le guardie di `SCD_1` (Libero e Occupato riflettono l'ultima rilevazione; Non disponibile e Sconosciuto la conservano qualunque sia).
- TF-STA-14, 20: RF_SOSTA_6 (stallo `Non disponibile` durante la sosta).
- TF-STA-31: VD_1 (gerarchia `{complete, disjoint}`): un Ausiliario del Traffico non è un Automobilista, quindi non ha preferiti.
- TF-STA-22, 25: `UC_STALLI_3` 2.a1 («già tra i preferiti»), coperto da RF_STALLI_3.

## 6. Nota per il sottosistema Gestione stalli: il cursore

Il chiamante usa il `cursore` restituito da `stalliModificatiDopo` come `istante` della richiesta successiva, al posto del proprio orologio. Limite: `ultima_modifica` vale l'istante di inizio della transazione che ha modificato lo stallo (`now()` del trigger), non quello del commit. Una transazione iniziata prima del cursore e confermata dopo scrive un valore minore del cursore, e la sua modifica non compare nella richiesta successiva. Il sottosistema deve tenerne conto, per esempio ripartendo da un cursore arretrato di qualche secondo e scartando i duplicati, oppure rileggendo periodicamente l'intera zona. Lo stesso vale per `segnalazioniModificateDopo`.

Precisione: il cursore è un `Date` di JavaScript, al millisecondo, mentre `ultima_modifica` in PostgreSQL è al microsecondo. Il cursore è quindi troncato e può essere minore della `ultima_modifica` reale: nella richiesta successiva la stessa riga può tornare una seconda volta, ma non va mai persa. Il sottosistema scarta i duplicati per id.

## 7. Regole lasciate ai sottosistemi

| Regola                                                                                 | Dove                                                |
| :------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| calcolo del nuovo stato dalla rilevazione e dalla sosta in corso (`SCD_1`, RF_SOSTA_6) | Gestione stalli (`UC_IOT_1`, `UC_IOT_2`)            |
| permesso richiesto e gratuità mostrati nella scheda dello stallo                       | Gestione stalli (`UC_STALLI_2` 2.a1)                |
| conteggio dei liberi e centro dell'area nei preferiti (D6)                             | Gestione stalli (`UC_STALLI_5`)                     |
| coerenza tra tariffa ed ente (VD_7)                                                    | dati di configurazione (non garantita dallo schema) |
