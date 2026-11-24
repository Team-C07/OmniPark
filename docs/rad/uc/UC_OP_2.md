# UC_OP_2: Prendere in carico una segnalazione

- **Package:** OP - Operatività
- **Attori partecipanti:** Ausiliario del Traffico (principale)
- **Interesse dell'attore:** Assumersi la verifica di una possibile sosta irregolare senza che altri Ausiliari la duplichino.
- **Rilevanza:** Media (RF_OP_3)
- **Frequenza stimata:** Circa 22 usi/giorno per Ausiliario del Traffico
- **Extension point:** Nessuno

## Regole di dominio e contesto

- La presa in carico è esclusiva e l'Ausiliario del Traffico non può rilasciarla: una segnalazione `Presa in carico` può essere chiusa solo dall'Ausiliario a cui è assegnata (`UC_OP_4`).
- **NRF_SIC_1:** Ogni Ausiliario gestisce solo le segnalazioni del proprio ente.

## Entry condition

Questo caso d'uso inizia quando l'Ausiliario del Traffico, autenticato, consultando la mappa delle segnalazioni del proprio comune, sceglie di prendere in carico una segnalazione `Aperta`.

## Flusso di eventi (Scenario principale)

1. **Ausiliario del Traffico:** Chiede di prendere in carico la segnalazione selezionata.
2. **Sistema:** Verifica che la segnalazione sia ancora in stato `Aperta`.
3. **Sistema:** Assegna la segnalazione all'Ausiliario del Traffico, la porta in stato `Presa in carico` e conferma l'assegnazione (cfr. `MU_4`).

## Flussi alternativi (Eccezioni)

- **2.a1:** La segnalazione è già stata presa in carico da un altro Ausiliario del Traffico o è già `Chiusa`: il Sistema informa l'Ausiliario del Traffico che non è più disponibile (**On failure**).

## Exit condition

- **On success:** La segnalazione è in stato `Presa in carico`, assegnata in modo esclusivo all'Ausiliario del Traffico e non più disponibile per gli altri Ausiliari fino alla chiusura.
- **On failure:** La segnalazione non è assegnata all'Ausiliario del Traffico e il suo stato non cambia.

## Special requirements

- **NRF_SIC_1:** Segregazione per ente.
