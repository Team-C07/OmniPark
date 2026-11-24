# Convenzioni e Mappatura Boundary–Control–Entity (Sequence Diagram RAD v2.0)

- **Fonte:** OmniPark — Sequence Diagram (SD-01) v2.0 (17/11/2026).

## Mappatura Boundary (`MU_*` e Sistemi Esterni)

| Boundary                   | Rappresenta                                             | Sequence Diagram                                                                                       |
| :------------------------- | :------------------------------------------------------ | :----------------------------------------------------------------------------------------------------- |
| `:SchermataAccesso`        | `MU_1` Accesso e registrazione                          | `SD_AUTH_1`, `SD_AUTH_4`                                                                               |
| `:MappaStalli`             | `MU_2` Mappa, scheda stallo, sosta, permesso, preferiti | `SD_AUTH_1`, `SD_AUTH_4`, `SD_STALLI_1`..`5`, `SD_NAV_1`, `SD_IOT_1`..`2`, `SD_SOSTA_1`, `2`, `5`, `7` |
| `:SchermataProfilo`        | `MU_3` Targhe e wallet                                  | `SD_AUTH_5`, `SD_WALLET_1`, `SD_WALLET_3`                                                              |
| `:MappaSegnalazioni`       | `MU_4` Mappa segnalazioni e verifica permessi           | `SD_AUTH_4`, `SD_ANPR_1`, `SD_OP_1`..`5`                                                               |
| `:PanoramicaEnti`          | `MU_5` Riepilogo enti clienti                           | `SD_AUTH_4`, `SD_ADM_1`                                                                                |
| `:SchermataAusiliari`      | `MU_6` Gestione account Ausiliari                       | `SD_ADM_2`                                                                                             |
| `:MenuUtente`              | Barra comune a tutte le schermate (solo uscita)         | `SD_AUTH_4`                                                                                            |
| `:InterfacciaSensori`      | Boundary `<<system>>` Sensore IoT simulato              | `SD_IOT_1`                                                                                             |
| `:InterfacciaANPR`         | Boundary `<<system>>` Telecamera ANPR                   | `SD_ANPR_1`                                                                                            |
| `:InterfacciaMappeEsterne` | Boundary `<<system>>` App di mappe esterna              | `SD_NAV_1`                                                                                             |

## Regole di flusso BCE

- **Direzione messaggi:** `Attore -> Boundary -> Control -> Entity` e `Control -> Boundary`. `Time` (senza UI) attiva direttamente il `Control`. Le `Entity` non chiamano mai `Boundary` o `Control`.
- **Frammenti:** `break` (uscita anticipata _On success_ / _On failure_), `loop` (ritorno a un passo precedente), `alt` (rami alternativi), `opt` (comportamento opzionale o `ref` a punto di estensione).
