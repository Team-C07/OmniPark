# UC_STALLI_2: Consultare tariffe e condizioni di uno stallo

- **Package:** NAV - Stalli e navigazione
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Sapere quanto costa la sosta e a quali condizioni prima di raggiungere lo stallo o di avviare la sosta.
- **Rilevanza:** Media (`RF_STALLI_2`)
- **Frequenza stimata:** Circa 3.600 consultazioni/giorno
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Tariffe, fasce orarie, durate massime e permessi richiesti sono dati di configurazione di ciascun ente (`RD_03`, `RD_05`).

## Entry condition

L'Automobilista, autenticato, seleziona uno stallo sulla mappa (cfr. `MU_2`).

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Seleziona uno stallo sulla mappa (cfr. `MU_2`).
2. **Sistema:** Mostra la scheda dello stallo: tipo, stato, costo orario, fascia oraria a pagamento e durata massima della sosta (cfr. `MU_2`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Lo stallo è riservato a permesso esposto: la scheda indica anche il permesso richiesto, che va dichiarato e fotografato all'avvio della sosta, e se la sosta è gratuita (**On success**).
- **2.a2:** I dettagli dello stallo non sono disponibili: il Sistema ne informa l'Automobilista (**On failure**).

## Exit condition

- **On success:** L'Automobilista vede tipo, stato, costo orario, fascia oraria a pagamento, durata massima e, per gli stalli riservati, il permesso richiesto.
- **On failure:** I dettagli dello stallo non sono disponibili e l'Automobilista ne è informato.
