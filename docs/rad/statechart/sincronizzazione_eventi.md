# Sincronizzazione e Guardie degli Statechart (`SCD_1`, `SCD_2`, `SCD_3`)

- **Fonte:** OmniPark — RAD, Modello del sistema v2.0 (17/11/2026), Sez. 3.4.4 (Modello dinamico).

## 1. Eventi condivisi tra Stallo (`SCD_1`) e Sosta (`SCD_2`)

| Evento          | Generato da                                                                                                       | Effetto su `SCD_1` (Stallo)                                                                       | Effetto su `SCD_2` (Sosta)                                                                                                    |
| :-------------- | :---------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- |
| `avvioSosta`    | Automobilista, alla conclusione di `UC_SOSTA_1`                                                                   | `Occupato` $\rightarrow$ `Non disponibile`                                                        | Creata in stato `Attiva`                                                                                                      |
| `scadenzaSosta` | `Sosta`, all'ingresso in `Scaduta` (`notificaScadenza()`), dopo `at(orario di scadenza)` di `Time` (`UC_SOSTA_7`) | `Non disponibile` $\rightarrow$ `Occupato`, `Libero` o `Sconosciuto` secondo l'ultima rilevazione | `Attiva` $\rightarrow$ `Scaduta` (precede l'evento)                                                                           |
| `terminaSosta`  | `Stallo`, all'ingresso in `Libero` (`terminaSosta()`)                                                             | Azione d'ingresso di `Libero`                                                                     | `Scaduta` $\rightarrow$ `Terminata` per tutte le soste `Scadute` dello stallo (`eliminaDichiarazioneEFoto()` per `NRF_LEG_2`) |

## 2. Significato formale delle guardie

- **`[veicolo presente]` / `[nessun veicolo presente]`:** L'attributo `occupazione rilevata` di `Stallo` (aggiornato dall'ultima rilevazione valida ricevuta negli ultimi 60 secondi) indica presenza oppure assenza di un veicolo.
- **`[nessuna rilevazione da più di 60 s]`:** Sono trascorsi più di 60 secondi dalla `data e ora dell'ultima rilevazione` dello `Stallo` (`RF_IOT_1`, `RF_IOT_2`).
- **`at(orario di scadenza)`:** Istante uguale all'`orario di scadenza` della `Sosta` (fissato all'avvio e posticipato a ogni prolungamento).
- **Nota sul `Class Diagram d'analisi 6.1`:** La classe `Stallo` include l'attributo `occupazione rilevata` oltre a `numero`, `posizione`, `tipo di stallo`, `stato` e `data e ora dell'ultima rilevazione`.
