# UC_STALLI_5: Consultare lo stato dei preferiti

- **Package:** NAV - Stalli e navigazione
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Vedere subito se negli stalli e nelle aree preferite c’è posto.
- **Rilevanza:** Media (`RF_STALLI_5`)
- **Frequenza stimata:** Circa 500 consultazioni/giorno
- **Extension point:** Nessuno

## Entry condition

L'Automobilista, autenticato, apre i propri preferiti (cfr. `MU_2`).

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Apre i preferiti.
2. **Sistema:** Mostra gli stalli preferiti con il loro stato e le aree preferite con il numero di stalli `Liberi` sul totale (cfr. `MU_2`).
3. **Automobilista:** Seleziona uno stallo o un'area.
4. **Sistema:** Centra la mappa sullo stallo o sull'area selezionata (cfr. `MU_2`).

## Flussi alternativi (Eccezioni)

- **2.a1:** L'Automobilista non ha preferiti: il Sistema ne informa l'Automobilista e il caso d'uso termina (**On success**).
- **2.a2:** Lo stato dei preferiti non è disponibile: il Sistema ne informa l'Automobilista (**On failure**).

## Exit condition

- **On success:** L'Automobilista vede lo stato aggiornato degli stalli e delle aree salvati, oppure è informato che non ne ha.
- **On failure:** Lo stato dei preferiti non è disponibile e l'Automobilista ne è informato.

## Special requirements

- **NRF_PER_3:** Lo stato dei preferiti si aggiorna come la mappa, entro 2 secondi dalla rilevazione.
