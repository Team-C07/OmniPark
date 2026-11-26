# TCS — Persistenza: wallet, movimenti e soste

- **Task:** OMP-34 (issue #6). Metodo: category partition.
- **Oggetto:** le funzioni di accesso di `src/persistence/accessoDati/walletSoste.ts`. `addebita` è già verificata in `cp_persistenza_base.md` (TF-BASE-37…44).
- **Fonti dell'esito atteso:** sequence diagram e casi d'uso indicati per ogni funzione (inventario del piano approvato); vincoli dello schema; `docs/rad/requisiti.md`; `docs/rad/vincoli_dominio.md` §2; statechart `SCD_2` e `sincronizzazione_eventi.md`; codici di errore di `docs/test/cp_persistenza_base.md`.
- **File di test:** `src/persistence/accessoDati/walletSoste.db.test.ts` (eseguito da `npm run test:db`).

## 1. Tracciabilità

Ogni frame riporta un solo riferimento, scelto in quest'ordine: un requisito dell'Elenco (`RF_…`, `NRF_…`) se il suo testo copre davvero il comportamento; altrimenti il vincolo di dominio `VD_<n>` (`docs/rad/vincoli_dominio.md` §2); altrimenti `SCHEMA` se il frame verifica un vincolo specifico dello schema.

Nome del test: `<riferimento> · <frame> · <descrizione> → <esito>`, per esempio `RF_WALLET_3 · TF-WS-08 · cronologia del wallet 2 → 6 movimenti dal più recente`.

## 2. Funzioni verificate (firme)

Il primo parametro è sempre l'esecutore (`Esecutore = Pool | PoolClient`, da `./esecutore`); nei test è il client della transazione del test. Gli id e gli importi (centesimi) sono `number`; gli istanti `Date`. Gli errori sono `ErroreDominio` con il `codice` indicato (`./errori`).

```ts
type StatoSosta = "ATTIVA" | "SCADUTA" | "TERMINATA";
type Pagamento = "PAGATA" | "GRATUITA";
type Sosta = {
  id; automobilistaId; veicoloId; targa: string; stalloId; stato: StatoSosta;
  orarioDiAvvio: Date; orarioDiScadenza: Date; pagamento: Pagamento;
  dichiarazioneDiPermesso: string | null; fotoDelPermesso: Buffer | null;
};
type MovimentoDelWallet = { id; walletVirtualeId; tipoDiMovimento: "RICARICA" | "ADDEBITO"; importo; dataEOra: Date; sostaId: number | null };

creaWallet(es, automobilistaId: number): Promise<number>;                         // id del wallet
trovaWalletDiAutomobilista(es, automobilistaId: number): Promise<{ id: number; saldo: number } | null>;
registraRicarica(es, dati: { walletVirtualeId; importo; dataEOra }): Promise<MovimentoDelWallet>;
movimenti(es, walletVirtualeId: number): Promise<(MovimentoDelWallet & { targa: string | null })[]>;
// dal più recente (data_e_ora decrescente, poi id decrescente); targa della sosta per gli addebiti, null per le ricariche
creaSosta(es, dati: { automobilistaId; veicoloId; stalloId; orarioDiAvvio; orarioDiScadenza; pagamento;
  dichiarazioneDiPermesso?: string; fotoDelPermesso?: Buffer }): Promise<number>; // la sosta nasce ATTIVA
trovaSosta(es, id: number): Promise<Sosta | null>;
sostaAttivaPerVeicolo(es, veicoloId: number): Promise<Sosta | null>;
sostaAttivaSuStallo(es, stalloId: number): Promise<Sosta | null>;
sostaPerTargaSuStallo(es, targa: string, stalloId: number): Promise<Sosta | null>; // la più recente per orario di avvio, in qualsiasi stato
sosteAttiveDiAutomobilista(es, automobilistaId: number): Promise<Sosta[]>;        // ordinate per orario di avvio, poi id
aggiornaScadenza(es, sostaId: number, nuovaScadenza: Date): Promise<boolean>;     // solo se ATTIVA; false altrimenti
sosteDaScadere(es, istante: Date): Promise<number[]>;                             // id delle ATTIVA con scadenza ≤ istante, ordinati
impostaSostaScaduta(es, sostaId: number): Promise<boolean>;                       // ATTIVA → SCADUTA; false altrimenti
terminaSosteScaduteDelloStallo(es, stalloId: number): Promise<number>;
// SCADUTA → TERMINATA per tutte le soste scadute dello stallo, con dichiarazione e foto eliminate; restituisce quante
```

Ordinamento degli elenchi (sempre con l'id come ultimo criterio di spareggio): `movimenti` per `data_e_ora` decrescente, poi id decrescente; `sosteAttiveDiAutomobilista` per `orario_di_avvio` crescente, poi id crescente; `sosteDaScadere` per `orario_di_scadenza` crescente, poi id crescente. `sostaPerTargaSuStallo` sceglie la sosta con `orario_di_avvio` più recente e, a parità, l'id maggiore.

## 3. Ambiente

- Database di test riportato allo stato noto da `preparaDatabaseDiTest()` nel `beforeAll`; ogni test in una transazione annullata (`iniziaTransazioneDiTest()` / `annullaTransazioneDiTest()`), con il client come esecutore.
- Istante di prova `I` = `2026-11-20 09:00:00+01`; `I+1h` = `2026-11-20 10:00:00+01`. Permesso «completo»: dichiarazione `Dichiaro di esporre il permesso previsto per lo stallo` e foto di 1024 byte (`Buffer.alloc(1024, 0xff)`).
- Le soste preesistenti richieste dai frame si inseriscono con SQL nella transazione del test (colonne sotto), salvo dove il frame nomina `creaSosta`; se il frame non indica gli orari, valgono `I` → `I+1h` (anche per le soste `SCADUTA` di TF-WS-42).
- Un automobilista senza wallet si prepara con SQL: `INSERT INTO utente (email, hash_password, ruolo) VALUES ('senza.wallet@omnipark.example', 'hash-di-prova', 'AUTOMOBILISTA') RETURNING id`, poi `INSERT INTO automobilista (id) VALUES (<id>)`.

### Righe del dataset usate (migrazione `0002_dati_esempio.sql`)

| Tabella                             | id                | Contenuto                                                                                                                                                                              |
| :---------------------------------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `automobilista` / `wallet_virtuale` | 7 / 1             | Elena Bianchi; veicoli 1 `EF456GH`, 2 `GH321JK`; saldo 1700                                                                                                                            |
| `automobilista` / `wallet_virtuale` | 8 / 2             | Marco Rossi; veicolo 3 `MN234PQ`; saldo 600                                                                                                                                            |
| `automobilista` / `wallet_virtuale` | 9 / 3             | Luigi Verde; veicolo 4; un solo movimento, ricarica 10 da 500 il `2026-11-01 09:30:00+01`                                                                                              |
| `automobilista`                     | 11                | Davide Conte; veicoli 6 `AB123CD`, 7 `FK771PS`, 8 `EB917RT`                                                                                                                            |
| `movimento_del_wallet` del wallet 2 | 1…6               | 1 R 500 (31/10 08:30), 2 A 150 sosta 1 (31/10 09:00), 3 A 300 sosta 2 (02/11 08:42), 4 R 1000 (02/11 10:18), 5 A 150 sosta 2 (02/11 10:20), 6 A 300 sosta 9 (09/11 16:00); orari `+01` |
| `sosta`                             | 2                 | automobilista 8, veicolo 3, stallo 11, `TERMINATA`, `PAGATA`, `2026-11-02 08:42:00+01` → `11:42`, nessun permesso                                                                      |
| `sosta`                             | 9                 | automobilista 8, veicolo 3, stallo 11, `TERMINATA`, `2026-11-09 16:00:00+01` → `18:00`                                                                                                 |
| `sosta`                             | 7                 | automobilista 10, veicolo 5 `CD330PL`, stallo 6, `TERMINATA`                                                                                                                           |
| soste                               | 1…10              | tutte `TERMINATA`: nessuna sosta `ATTIVA` o `SCADUTA` nel dataset                                                                                                                      |
| `stallo`                            | 11, 15, 16, 17, 6 | 11 Via Roma n. 102; 15 Piazza Aubry n. 2 `ROSA`; 16 e 17 Piazza Aubry n. 3 e n. 4 senza soste; 6 Piazza San Leone n. 21                                                                |
| `utente`                            | 2                 | Paolo Ferri, ausiliario (non è in `automobilista`)                                                                                                                                     |

Colonne usate dai test (per le preparazioni e le verifiche con SQL):

| Tabella                         | Colonne                                                                                                                                                              |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utente`                        | `id`, `email`, `hash_password`, `ruolo`                                                                                                                              |
| `automobilista`                 | `id`                                                                                                                                                                 |
| `wallet_virtuale`               | `id`, `automobilista_id`                                                                                                                                             |
| `movimento_del_wallet`          | `id`, `wallet_virtuale_id`, `tipo_di_movimento`, `importo`, `data_e_ora`, `sosta_id`                                                                                 |
| `saldo_wallet_virtuale` (vista) | `wallet_virtuale_id`, `automobilista_id`, `saldo` (`bigint`)                                                                                                         |
| `sosta`                         | `id`, `automobilista_id`, `veicolo_id`, `stallo_id`, `stato`, `orario_di_avvio`, `orario_di_scadenza`, `pagamento`, `dichiarazione_di_permesso`, `foto_del_permesso` |

Id inesistente: `999999`.

## 4. Categorie per funzione

| Funzione                         | Scelte                                                                                                                                                         |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creaWallet`                     | automobilista senza wallet · automobilista con wallet [error] · utente non automobilista [error]                                                               |
| `trovaWalletDiAutomobilista`     | con movimenti · senza movimenti · automobilista inesistente                                                                                                    |
| `registraRicarica`               | dati validi · wallet inesistente [error] · importo zero [error]                                                                                                |
| `movimenti`                      | più risultati · un risultato · nessun risultato                                                                                                                |
| `creaSosta`                      | senza permesso · con permesso · veicolo con sosta attiva [error] · scadenza uguale all'avvio [error] · solo dichiarazione [error] · stallo inesistente [error] |
| `trovaSosta`                     | esistente · inesistente                                                                                                                                        |
| `sostaAttivaPerVeicolo`          | con sosta attiva · solo soste terminate · veicolo inesistente                                                                                                  |
| `sostaAttivaSuStallo`            | con sosta attiva · solo soste terminate · nessuna sosta                                                                                                        |
| `sostaPerTargaSuStallo`          | più soste della targa (la più recente) · una sosta · nessuna sosta                                                                                             |
| `sosteAttiveDiAutomobilista`     | più risultati · nessun risultato                                                                                                                               |
| `aggiornaScadenza`               | sosta attiva · sosta terminata · inesistente · nuova scadenza non successiva all'avvio [error]                                                                 |
| `sosteDaScadere`                 | scadenza uguale all'istante · scadenza successiva · solo soste terminate                                                                                       |
| `impostaSostaScaduta`            | attiva · terminata · inesistente                                                                                                                               |
| `terminaSosteScaduteDelloStallo` | più soste scadute con permesso · solo una sosta attiva · nessuna sosta                                                                                         |

## 5. Test frame (43)

| Frame    | Funzione e scelte                                                                                                               | Esito atteso                                                                                                                                        | Riferimento |
| :------- | :------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| TF-WS-01 | automobilista senza wallet (preparato con SQL); `creaWallet(id)`                                                                | restituisce un id; `trovaWalletDiAutomobilista(id)` è `{ id, saldo: 0 }`                                                                            | RF_WALLET_1 |
| TF-WS-02 | `creaWallet(8)`                                                                                                                 | `WALLET_GIA_PRESENTE`                                                                                                                               | SCHEMA      |
| TF-WS-03 | `creaWallet(2)` (ausiliario)                                                                                                    | `RIFERIMENTO_INESISTENTE`                                                                                                                           | VD_1        |
| TF-WS-04 | `trovaWalletDiAutomobilista(8)`                                                                                                 | `{ id: 2, saldo: 600 }`                                                                                                                             | RF_WALLET_3 |
| TF-WS-05 | automobilista senza wallet + `creaWallet`; `trovaWalletDiAutomobilista`                                                         | saldo 0                                                                                                                                             | RF_WALLET_3 |
| TF-WS-06 | `trovaWalletDiAutomobilista(999999)`                                                                                            | `null`                                                                                                                                              | RF_WALLET_3 |
| TF-WS-07 | `registraRicarica({ walletVirtualeId: 3, importo: 1000, dataEOra: I })`                                                         | movimento `RICARICA` da 1000 sul wallet 3 con `sostaId` null; saldo del wallet 3 da 500 a 1500                                                      | RF_WALLET_1 |
| TF-WS-08 | `registraRicarica` con wallet 999999                                                                                            | `RIFERIMENTO_INESISTENTE`                                                                                                                           | SCHEMA      |
| TF-WS-09 | `registraRicarica` con importo 0                                                                                                | `IMPORTO_NON_VALIDO`                                                                                                                                | SCHEMA      |
| TF-WS-10 | `movimenti(2)`                                                                                                                  | id 6, 5, 4, 3, 2, 1 in quest'ordine; targa `MN234PQ` per 6, 5, 3, 2 e `null` per 4 e 1; importi e tipi come nel dataset                             | RF_WALLET_3 |
| TF-WS-11 | `movimenti(3)`                                                                                                                  | un solo movimento: id 10, `RICARICA`, 500, targa `null`                                                                                             | RF_WALLET_3 |
| TF-WS-12 | wallet appena creato (TF-WS-01); `movimenti(id)`                                                                                | `[]`                                                                                                                                                | RF_WALLET_3 |
| TF-WS-13 | `creaSosta({ 8, 3, 16, I, I+1h, PAGATA })`                                                                                      | id; `trovaSosta(id)`: `ATTIVA`, targa `MN234PQ`, orari e pagamento come inseriti, dichiarazione e foto `null`                                       | RF_SOSTA_1  |
| TF-WS-14 | `creaSosta({ 7, 1, 15, I, I+1h, PAGATA, permesso completo })`                                                                   | id; `trovaSosta(id)` restituisce la dichiarazione e una foto di 1024 byte                                                                           | RF_SOSTA_5  |
| TF-WS-15 | `creaSosta({ 8, 3, 17, … })`, poi `creaSosta({ 8, 3, 16, … })`                                                                  | la seconda: `SOSTA_GIA_ATTIVA_PER_VEICOLO`                                                                                                          | RF_SOSTA_1  |
| TF-WS-16 | `creaSosta` con scadenza = avvio = `I`                                                                                          | `DURATA_NON_VALIDA`                                                                                                                                 | SCHEMA      |
| TF-WS-17 | `creaSosta` sullo stallo 15 con sola dichiarazione                                                                              | `PERMESSO_NON_VALIDO`                                                                                                                               | RF_SOSTA_5  |
| TF-WS-18 | `creaSosta` con stallo 999999                                                                                                   | `RIFERIMENTO_INESISTENTE`                                                                                                                           | SCHEMA      |
| TF-WS-19 | `trovaSosta(2)`                                                                                                                 | automobilista 8, veicolo 3, targa `MN234PQ`, stallo 11, `TERMINATA`, `PAGATA`, `2026-11-02 08:42:00+01` → `2026-11-02 11:42:00+01`, permesso `null` | RF_OP_4     |
| TF-WS-20 | `trovaSosta(999999)`                                                                                                            | `null`                                                                                                                                              | RF_OP_4     |
| TF-WS-21 | sosta `ATTIVA` (8, 3, 16) creata con `creaSosta`; `sostaAttivaPerVeicolo(3)`                                                    | quella sosta                                                                                                                                        | RF_SOSTA_1  |
| TF-WS-22 | `sostaAttivaPerVeicolo(3)` (solo soste terminate)                                                                               | `null`                                                                                                                                              | RF_SOSTA_1  |
| TF-WS-23 | `sostaAttivaPerVeicolo(999999)`                                                                                                 | `null`                                                                                                                                              | RF_SOSTA_1  |
| TF-WS-24 | sosta `ATTIVA` (8, 3, 16); `sostaAttivaSuStallo(16)`                                                                            | quella sosta, con targa `MN234PQ`                                                                                                                   | RF_SOSTA_6  |
| TF-WS-25 | `sostaAttivaSuStallo(11)` (solo soste terminate)                                                                                | `null`                                                                                                                                              | RF_SOSTA_6  |
| TF-WS-26 | `sostaAttivaSuStallo(17)` (nessuna sosta)                                                                                       | `null`                                                                                                                                              | RF_SOSTA_6  |
| TF-WS-27 | `sostaPerTargaSuStallo("MN234PQ", 11)`                                                                                          | la sosta 9 (la più recente tra 2 e 9)                                                                                                               | RF_OP_4     |
| TF-WS-28 | `sostaPerTargaSuStallo("CD330PL", 6)`                                                                                           | la sosta 7                                                                                                                                          | RF_OP_4     |
| TF-WS-29 | `sostaPerTargaSuStallo("FG482KL", 3)`                                                                                           | `null`                                                                                                                                              | RF_OP_4     |
| TF-WS-30 | soste `ATTIVA` (11, 6, 16, I → I+1h) e (11, 7, 17, `2026-11-20 09:30:00+01` → `10:30`); `sosteAttiveDiAutomobilista(11)`        | due soste, sullo stallo 16 poi sul 17                                                                                                               | RF_SOSTA_2  |
| TF-WS-31 | `sosteAttiveDiAutomobilista(8)`                                                                                                 | `[]`                                                                                                                                                | RF_SOSTA_2  |
| TF-WS-32 | sosta `ATTIVA` (8, 3, 16, I → I+1h); `aggiornaScadenza(id, 2026-11-20 11:00:00+01)`                                             | `true`; `trovaSosta(id).orarioDiScadenza` è la nuova scadenza                                                                                       | RF_SOSTA_2  |
| TF-WS-33 | `aggiornaScadenza(2, 2026-11-02 12:42:00+01)` (sosta terminata)                                                                 | `false`; la scadenza della sosta 2 non cambia                                                                                                       | RF_SOSTA_2  |
| TF-WS-34 | `aggiornaScadenza(999999, I+1h)`                                                                                                | `false`                                                                                                                                             | RF_SOSTA_2  |
| TF-WS-35 | sosta `ATTIVA` (8, 3, 16, I → I+1h); `aggiornaScadenza(id, I)`                                                                  | `DURATA_NON_VALIDA`                                                                                                                                 | SCHEMA      |
| TF-WS-36 | sosta `ATTIVA` (8, 3, 16, I → I+1h); `sosteDaScadere(I+1h)`                                                                     | `[id]`                                                                                                                                              | RF_SOSTA_7  |
| TF-WS-37 | sosta `ATTIVA` (8, 3, 16, I → I+1h); `sosteDaScadere(2026-11-20 09:59:59+01)`                                                   | `[]`                                                                                                                                                | RF_SOSTA_7  |
| TF-WS-38 | `sosteDaScadere(2026-12-31 00:00:00+01)` (solo soste terminate)                                                                 | `[]`                                                                                                                                                | RF_SOSTA_7  |
| TF-WS-39 | sosta `ATTIVA` (8, 3, 16) creata con `creaSosta`; `impostaSostaScaduta(id)`                                                     | `true`; `trovaSosta(id).stato` è `SCADUTA`                                                                                                          | RF_SOSTA_7  |
| TF-WS-40 | `impostaSostaScaduta(2)` (sosta terminata)                                                                                      | `false`; la sosta 2 resta `TERMINATA`                                                                                                               | RF_SOSTA_7  |
| TF-WS-41 | `impostaSostaScaduta(999999)`                                                                                                   | `false`                                                                                                                                             | RF_SOSTA_7  |
| TF-WS-42 | due soste `SCADUTA` con permesso completo sullo stallo 15 (7, 1 e 8, 3), inserite con SQL; `terminaSosteScaduteDelloStallo(15)` | 2; entrambe `TERMINATA` con dichiarazione e foto `null`                                                                                             | NRF_LEG_2   |
| TF-WS-43 | sosta `ATTIVA` (8, 3, 16); `terminaSosteScaduteDelloStallo(16)`, poi `terminaSosteScaduteDelloStallo(17)`                       | 0 e 0; la sosta attiva resta `ATTIVA`                                                                                                               | NRF_LEG_2   |

Note sui riferimenti:

- TF-WS-03: VD_1 (gerarchia `{complete, disjoint}`): solo un Automobilista possiede un wallet.
- TF-WS-19, 20, 27…29: `trovaSosta` e `sostaPerTargaSuStallo` servono alla verifica del pagamento (RF_OP_4, SD_OP_3 2.2, 3.1); `trovaSosta` serve anche al prolungamento e alla verifica del permesso.
- TF-WS-30, 31: le soste attive di un automobilista servono a scegliere la sosta da prolungare (RF_SOSTA_2, entry condition di `UC_SOSTA_2`).
- TF-WS-36, 37: la scadenza è raggiunta all'istante uguale all'orario di scadenza (`at(orario di scadenza)`, `sincronizzazione_eventi.md` §2).
- TF-WS-42: `terminaSosta` termina tutte le soste `Scadute` dello stallo (`sincronizzazione_eventi.md` §1) ed elimina dichiarazione e foto (NRF_LEG_2).

## 6. Regole lasciate ai sottosistemi

| Regola                                                                                                                                       | Dove                                        |
| :------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------ |
| il veicolo appartiene all'automobilista; lo stallo è `Occupato`; durata entro il massimo; importo secondo la tariffa (VD_3, VD_9, NRF_LEG_1) | Gestione soste (`UC_SOSTA_1`, `UC_SOSTA_2`) |
| creazione della sosta e addebito nella stessa `eseguiInTransazione`, prima la sosta poi `addebita` (D3)                                      | Gestione soste                              |
| ricariche solo di 5, 10 o 20 €                                                                                                               | Wallet (`UC_WALLET_1`)                      |
| gratuità solo negli stalli per disabili (VD_10)                                                                                              | Gestione soste                              |
