# UC_NAV_1: Avviare la navigazione verso uno stallo

- **Package:** NAV - Stalli e navigazione
- **Attori partecipanti:** Automobilista (principale); `<<system>>` App di mappe esterna (secondario)
- **Interesse dell'attore:** Raggiungere lo stallo scelto con le indicazioni del proprio navigatore.
- **Rilevanza:** Media (`RF_NAV_1`)
- **Frequenza stimata:** Circa 1.800 navigazioni/giorno
- **Extension point:** Nessuno

## Regole di dominio e contesto

- OmniPark passa all'app di mappe esterna la posizione dello stallo e non calcola percorsi. Nell'MVP non monitora lo stallo durante il tragitto e non propone alternative (`RF_NAV_2` rinviato).

## Entry condition

L'Automobilista, autenticato, dalla scheda di uno stallo chiede di navigare verso di esso (cfr. `MU_2`).

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Chiede di navigare verso lo stallo selezionato (cfr. `MU_2`).
2. **Sistema:** Apre l'App di mappe esterna passandole la posizione dello stallo.

## Flussi alternativi (Eccezioni)

- **2.a1:** L'App di mappe esterna non si apre: il Sistema ne informa l'Automobilista e mostra l'indirizzo dello stallo (**On failure**).

## Exit condition

- **On success:** L'app di mappe esterna è aperta sulla posizione dello stallo.
- **On failure:** L'app non è aperta e l'Automobilista vede l'indirizzo dello stallo.
