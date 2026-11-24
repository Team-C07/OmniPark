# Matrice di Tracciabilità Completa — OmniPark

- **Riferimento:** RAD 1.2.0 — Elenco dei Requisiti 1.1.0 (CR_01: 27 RF e 11 NRF approvati)
- **Requisiti rinviati o rifiutati (esclusi dal sistema):** `RF_AUTH_2`, `RF_AUTH_3`, `RF_STALLI_4`, `RF_NAV_2`, `RF_SOSTA_3`, `RF_SOSTA_4`.

---

## 1. Requisiti Funzionali (27 RF approvati)

### Area Automobilista, Navigazione, IoT, Sosta e Wallet (18 RF)

| ID RF         | Nome                                    | Priorità | Caso d'Uso (UC)                                    | Sequence Diagram (SD)                              | Mock-up (MU)                    |
| :------------ | :-------------------------------------- | :------- | :------------------------------------------------- | :------------------------------------------------- | :------------------------------ |
| `RF_AUTH_1`   | Registrazione dell'Automobilista        | Alta     | `UC_AUTH_1`                                        | `SD_AUTH_1`                                        | `MU_1`                          |
| `RF_AUTH_4`   | Accesso e uscita dal sistema            | Alta     | `UC_AUTH_4`                                        | `SD_AUTH_4`                                        | `MU_1` (`MU_2`, `MU_4`, `MU_5`) |
| `RF_AUTH_5`   | Targhe dell'Automobilista               | Alta     | `UC_AUTH_1`, `UC_AUTH_5`                           | `SD_AUTH_1`, `SD_AUTH_5`                           | `MU_1`, `MU_3`                  |
| `RF_STALLI_1` | Mappa degli stalli e stato              | Alta     | `UC_STALLI_1`                                      | `SD_STALLI_1`                                      | `MU_2`                          |
| `RF_STALLI_2` | Tariffe e condizioni dello stallo       | Media    | `UC_STALLI_2`                                      | `SD_STALLI_2`                                      | `MU_2`                          |
| `RF_STALLI_3` | Salvataggio tra i preferiti             | Media    | `UC_STALLI_3`                                      | `SD_STALLI_3`                                      | `MU_2`                          |
| `RF_STALLI_5` | Stato dei preferiti                     | Media    | `UC_STALLI_5`                                      | `SD_STALLI_5`                                      | `MU_2`                          |
| `RF_NAV_1`    | Navigazione verso lo stallo             | Media    | `UC_NAV_1`                                         | `SD_NAV_1`                                         | `MU_2`                          |
| `RF_IOT_1`    | Acquisizione dei dati dei sensori       | Alta     | `UC_IOT_1`                                         | `SD_IOT_1`                                         | `MU_2`                          |
| `RF_IOT_2`    | Stato Sconosciuto dello stallo          | Media    | `UC_IOT_2`                                         | `SD_IOT_2`                                         | `MU_2`                          |
| `RF_SOSTA_1`  | Avvio della sosta                       | Alta     | `UC_SOSTA_1`                                       | `SD_SOSTA_1`                                       | `MU_2`                          |
| `RF_SOSTA_2`  | Prolungamento della sosta               | Media    | `UC_SOSTA_2`                                       | `SD_SOSTA_2`                                       | `MU_2`                          |
| `RF_SOSTA_5`  | Dichiarazione e foto del permesso       | Media    | `UC_SOSTA_5`                                       | `SD_SOSTA_5`                                       | `MU_2`                          |
| `RF_SOSTA_6`  | Stallo Non disponibile durante la sosta | Alta     | `UC_SOSTA_1`, `UC_SOSTA_7`, `UC_IOT_1`, `UC_IOT_2` | `SD_SOSTA_1`, `SD_SOSTA_7`, `SD_IOT_1`, `SD_IOT_2` | `MU_2`                          |
| `RF_SOSTA_7`  | Scadenza della sosta                    | Alta     | `UC_SOSTA_7`                                       | `SD_SOSTA_7`                                       | `MU_2`                          |
| `RF_WALLET_1` | Wallet e ricarica simulata              | Alta     | `UC_AUTH_1`, `UC_WALLET_1`                         | `SD_AUTH_1`, `SD_WALLET_1`                         | `MU_3`                          |
| `RF_WALLET_2` | Addebito della sosta                    | Alta     | `UC_SOSTA_1`, `UC_SOSTA_2`                         | `SD_SOSTA_1`, `SD_SOSTA_2`                         | `MU_2`                          |
| `RF_WALLET_3` | Saldo e cronologia del wallet           | Media    | `UC_WALLET_3`                                      | `SD_WALLET_3`                                      | `MU_3`                          |

### Area ANPR, Ausiliario del Traffico e Amministratore (9 RF)

| ID RF       | Nome                                                | Priorità | Caso d'Uso (UC) | Sequence Diagram (SD) | Mock-up (MU) |
| :---------- | :-------------------------------------------------- | :------- | :-------------- | :-------------------- | :----------- |
| `RF_ANPR_1` | Segnalazione automatica ANPR                        | Alta     | `UC_ANPR_1`     | `SD_ANPR_1`           | `MU_4`       |
| `RF_OP_1`   | Mappa delle segnalazioni                            | Alta     | `UC_OP_1`       | `SD_OP_1`             | `MU_4`       |
| `RF_OP_2`   | Permesso da verificare                              | Media    | `UC_OP_1`       | `SD_OP_1`             | `MU_4`       |
| `RF_OP_3`   | Presa in carico della segnalazione                  | Media    | `UC_OP_2`       | `SD_OP_2`             | `MU_4`       |
| `RF_OP_4`   | Verifica del pagamento                              | Media    | `UC_OP_3`       | `SD_OP_3`             | `MU_4`       |
| `RF_OP_5`   | Esito della verifica del permesso                   | Media    | `UC_OP_5`       | `SD_OP_5`             | `MU_4`       |
| `RF_OP_6`   | Chiusura della segnalazione                         | Alta     | `UC_OP_4`       | `SD_OP_4`             | `MU_4`       |
| `RF_ADM_1`  | Panoramica degli enti clienti                       | Media    | `UC_ADM_1`      | `SD_ADM_1`            | `MU_5`       |
| `RF_ADM_2`  | Gestione degli account degli Ausiliari del Traffico | Media    | `UC_ADM_2`      | `SD_ADM_2`            | `MU_6`       |

---

## 2. Requisiti Non Funzionali (11 RNF approvati)

| ID RNF      | Contenuto in breve                                                                                                                                         | Casi d'Uso collegati                                        |
| :---------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `NRF_AFF_2` | Accuratezza associazione targa-sosta >= 98% nelle letture ANPR valide                                                                                      | `UC_ANPR_1`                                                 |
| `NRF_AFF_3` | Persistenza delle soste e dei prolungamenti confermati dopo guasto/riavvio                                                                                 | `UC_SOSTA_1`, `UC_SOSTA_2`                                  |
| `NRF_IMP_1` | Web app responsive su Chrome e Safari, smartphone e desktop                                                                                                | Trasversale a tutti gli UC                                  |
| `NRF_LEG_1` | Calcolo importo conforme a tariffe, fasce orarie ed esenzioni dello stallo                                                                                 | `UC_SOSTA_1`, `UC_SOSTA_2`                                  |
| `NRF_LEG_2` | Dichiarazione e foto del permesso legate alla singola sosta ed eliminate al termine (`Terminata`); nessun dato conservato nel profilo o nella segnalazione | `UC_SOSTA_5`, `UC_SOSTA_7`, `UC_IOT_1`, `UC_OP_5`           |
| `NRF_PER_3` | Variazioni di stato degli stalli visibili sulla mappa e nei preferiti entro 2 secondi                                                                      | `UC_STALLI_1`, `UC_STALLI_5`, `UC_IOT_1`                    |
| `NRF_SIC_1` | Controllo accessi basato su ruolo ed ente di appartenenza                                                                                                  | `UC_AUTH_4`, `UC_ADM_2`, `UC_OP_1` ... `UC_OP_5`            |
| `NRF_USA_1` | Conformità WCAG 2.2 livelli A e AA rilevabile da strumenti automatici                                                                                      | `UC_STALLI_1`, `UC_SOSTA_1`, `UC_OP_1`, `UC_ADM_1`          |
| `NRF_PKG_1` | Installazione riproducibile su un ambiente di test pulito, senza modifiche al codice                                                                       | Trasversale: verificato con il README e l'avvio del sistema |
| `NRF_SUP_3` | Copertura dei test automatici ≥ 80% sul codice dei requisiti a priorità Alta                                                                               | Trasversale: verificato con il report di coverage           |
| `NRF_USA_2` | Sosta avviata e pagata in al massimo 3 interazioni dalla schermata principale                                                                              | `UC_SOSTA_1`                                                |

---

## 3. Schermate (Mock-up)

- **`MU_1`:** Accesso e registrazione (`UC_AUTH_1`, `UC_AUTH_4`).
- **`MU_2`:** Mappa degli stalli, con scheda dello stallo, avvio e prolungamento della sosta, dichiarazione del permesso e preferiti (`UC_STALLI_1`..`5`, `UC_NAV_1`, `UC_SOSTA_1`..`5`).
- **`MU_3`:** Profilo: targhe, wallet, ricarica e cronologia (`UC_AUTH_5`, `UC_WALLET_1`, `UC_WALLET_3`).
- **`MU_4`:** Mappa e gestione delle segnalazioni e verifica permessi dell'Ausiliario del Traffico (`UC_OP_1`..`5`).
- **`MU_5`:** Panoramica in sola lettura degli enti clienti (`UC_ADM_1`).
- **`MU_6`:** Gestione degli account degli Ausiliari del Traffico (`UC_ADM_2`).
