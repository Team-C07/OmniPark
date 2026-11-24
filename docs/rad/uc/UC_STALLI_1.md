# UC_STALLI_1: Visualizzare la mappa degli stalli

- **Package:** NAV - Stalli e navigazione
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Sapere in tempo reale quali stalli sono liberi nella zona in cui vuole parcheggiare.
- **Rilevanza:** Elevata (`RF_STALLI_1`)
- **Frequenza stimata:** Circa 7.200 consultazioni/giorno
- **Extension point:** Nessuno

## Regole di dominio e contesto

- La mappa mostra solo gli stalli gestiti (a pagamento e riservati), esclusi quelli a strisce bianche, con tipo e stato aggiornato (`Libero`, `Occupato`, `Non disponibile`, `Sconosciuto` secondo `SCD_1`).
- Gli stati cambiano dinamicamente senza ricaricare la pagina, riportando le variazioni acquisite da `UC_IOT_1` e `UC_IOT_2`. Nell'MVP non ci sono filtri (`RF_STALLI_4` rinviato).

## Entry condition

L'Automobilista, autenticato, apre la mappa degli stalli (cfr. `MU_2`).

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Sposta o ingrandisce la mappa sulla zona che gli interessa (cfr. `MU_2`).
2. **Sistema:** Recupera gli stalli gestiti della zona, esclusi quelli a strisce bianche.
3. **Sistema:** Mostra gli stalli con il tipo e lo stato, ciascuno con un colore diverso (cfr. `MU_2`).
4. **Sistema:** Finché la mappa è aperta, aggiorna lo stato degli stalli a ogni variazione ricevuta (cfr. `MU_2`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Nella zona non ci sono stalli gestiti: il Sistema ne informa l'Automobilista e il caso d'uso termina (**On success**).
- **2.a2:** I dati degli stalli non sono disponibili: il Sistema ne informa l'Automobilista (**On failure**).
- **4.a1:** La connessione al servizio di aggiornamento si interrompe: il Sistema avvisa che gli stati mostrati potrebbero non essere aggiornati e ritenta la connessione; quando la connessione torna, si riprende dal passo 4.

## Exit condition

- **On success:** L'Automobilista vede gli stalli gestiti della zona con tipo e stato (`Libero`, `Occupato`, `Non disponibile`, `Sconosciuto`), aggiornati durante la consultazione, oppure è informato che nella zona non ce ne sono.
- **On failure:** Gli stalli non sono disponibili e l'Automobilista ne è informato.

## Special requirements

- **NRF_PER_3:** Ogni variazione valida dello stato di uno stallo compare sulla mappa entro 2 secondi dalla rilevazione, senza aggiornamento manuale, purché l'applicazione sia connessa al servizio di aggiornamento.
- **NRF_USA_1:** La schermata della mappa non presenta violazioni dei livelli A e AA delle WCAG 2.2 rilevabili da uno strumento automatico.
