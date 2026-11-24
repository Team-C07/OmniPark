# UC_ANPR_1: Rilevare una possibile sosta irregolare

- **Package:** ANPR - Rilevamento
- **Attori partecipanti:** `<<system>>` Telecamera ANPR (principale), Ausiliario del Traffico (secondario)
- **Interesse dell'attore:** Inviare al Sistema le targhe dei veicoli rilevati negli stalli, così che venga verificata la regolarità della sosta.
- **Rilevanza:** Elevata (RF_ANPR_1)
- **Frequenza stimata:** Circa 3.600 letture/giorno nel comune di Gragnano
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Ogni segnalazione riporta il motivo: `sosta assente`, `sosta scaduta` oppure `targa non corrispondente`.
- La sosta è a pagamento nella fascia oraria prevista dalla tariffa dello stallo; il permesso sugli stalli riservati va invece esposto a tutte le ore.
- Se per lo stallo riservato c'è una sosta attiva con dichiarazione e foto del permesso, la Telecamera ANPR non genera segnalazioni.
- Una segnalazione generata quando nessun Ausiliario consulta la mappa resta `Aperta` e la trova chi la consulta per primo (nessuna notifica push, nessuna gestione turni).

## Entry condition

Questo caso d'uso inizia quando la Telecamera ANPR invia la lettura di una targa rilevata in uno stallo.

## Flusso di eventi (Scenario principale)

1. **Telecamera ANPR:** Invia la lettura della targa, con stallo, data e ora.
2. **Sistema:** Verifica se la targa è associata a una sosta `Attiva` per quello stallo.
3. **Sistema:** Individua il motivo: `sosta assente`, `sosta scaduta` oppure `targa non corrispondente` a quella della sosta `Attiva` sullo stallo.
4. **Sistema:** Verifica che per il veicolo non esista già una segnalazione non chiusa.
5. **Sistema:** Genera una segnalazione di possibile sosta irregolare in stato `Aperta`, con targa, stallo, data, ora e motivo.
6. **Sistema:** Rende disponibile la segnalazione sulla mappa delle segnalazioni degli Ausiliari del Traffico dell'ente preposto competente per lo stallo (cfr. `MU_4`).

## Flussi alternativi (Eccezioni)

- **1.a1:** La lettura è incompleta (manca la targa o lo stallo) oppure lo stallo non esiste: il Sistema la scarta (**On failure**).
- **2.a1:** La targa è associata a una sosta `Attiva` per quello stallo: il Sistema non genera alcuna segnalazione e il caso d'uso termina (**On success**).
- **2.a2:** La lettura avviene fuori dalla fascia oraria a pagamento prevista dalla tariffa dello stallo e lo stallo non è riservato a permesso esposto: la sosta è libera, il Sistema non genera alcuna segnalazione e il caso d'uso termina (**On success**). Se lo stallo è riservato, il flusso prosegue dal passo 3 con motivo `sosta assente`, perché il permesso va dichiarato ed esposto a tutte le ore.
- **4.a1:** Per il veicolo esiste già una segnalazione non chiusa: il Sistema scarta la nuova segnalazione senza generarla, mantiene la prima e il caso d'uso termina (**On success**).

## Exit condition

- **On success:** La lettura è elaborata e, se la targa non è associata a una sosta `Attiva` per quello stallo, per quel veicolo esiste una sola segnalazione non chiusa, con il motivo, visibile sulla mappa delle segnalazioni agli Ausiliari del Traffico dell'ente preposto competente per lo stallo.
- **On failure:** La lettura non è elaborata e nessuna segnalazione è generata.

## Special requirements

- **NRF_AFF_2:** In almeno il 98% delle letture valide effettuate durante i test, la targa rilevata è associata alla sosta attiva corrispondente, se presente; in assenza di corrispondenza non è associata a soste di altri veicoli.
