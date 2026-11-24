# UC_OP_1: Consultare le segnalazioni del comune

- **Package:** OP - Operatività
- **Attori partecipanti:** Ausiliario del Traffico (principale)
- **Interesse dell'attore:** Conoscere le possibili soste irregolari e i permessi da verificare nel proprio comune.
- **Rilevanza:** Elevata (RF_OP_1); Media per i permessi da verificare (RF_OP_2)
- **Frequenza stimata:** Circa 45 usi/giorno per Ausiliario del Traffico
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Oltre alle segnalazioni (`Aperte` e `Prese in carico`), l'Ausiliario del Traffico vede sulla mappa gli stalli riservati a permesso esposto occupati da una sosta attiva, indicati come `permesso da verificare`, con il tipo di stallo, la dichiarazione e la foto del permesso caricata per la sosta (`RF_OP_2`).
- **NRF_SIC_1:** Accesso limitato al proprio ruolo e al proprio ente: ogni Ausiliario vede e gestisce solo le segnalazioni del proprio ente.

## Entry condition

Questo caso d'uso inizia quando l'Ausiliario del Traffico, autenticato, richiede la mappa delle segnalazioni del proprio comune.

## Flusso di eventi (Scenario principale)

1. **Ausiliario del Traffico:** Richiede la mappa delle segnalazioni del proprio comune.
2. **Sistema:** Mostra sulla mappa le segnalazioni `Aperte` e `Prese in carico` e gli stalli con `permesso da verificare`, con la posizione dello stallo, lo stato e l'ora (cfr. `MU_4`).
3. **Ausiliario del Traffico:** Seleziona una segnalazione.
4. **Sistema:** Mostra targa, stallo, tipo di stallo, motivo, data e ora della lettura, stato della segnalazione e, se è `Presa in carico`, l'Ausiliario a cui è assegnata (cfr. `MU_4`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Nel comune non ci sono segnalazioni `Aperte` o `Prese in carico` né permessi da verificare: il Sistema ne informa l'Ausiliario del Traffico e il caso d'uso termina (**On success**).
- **2.a2:** Le segnalazioni non sono disponibili: il Sistema ne informa l'Ausiliario del Traffico (**On failure**).
- **3.a1:** L'Ausiliario del Traffico seleziona uno stallo con `permesso da verificare`: il Sistema mostra il tipo di stallo, la targa della sosta, la dichiarazione di permesso e la foto del permesso caricata per la sosta (cfr. `MU_4`) e il caso d'uso termina (**On success**).

## Exit condition

- **On success:** L'Ausiliario del Traffico ha consultato le segnalazioni `Aperte` e `Prese in carico` e i permessi da verificare del proprio comune, oppure è stato informato che non ce ne sono.
- **On failure:** Le segnalazioni non sono disponibili e l'Ausiliario del Traffico ne è informato.

## Special requirements

- **NRF_USA_1:** La schermata di gestione delle segnalazioni (`MU_4`) non presenta violazioni dei livelli A e AA delle WCAG 2.2 rilevabili da uno strumento automatico di verifica.
- **NRF_SIC_1:** Segregazione per ente.
