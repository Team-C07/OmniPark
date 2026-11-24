# UC_IOT_2: Rilevare l'assenza di rilevazioni

- **Package:** NAV - Stalli e navigazione
- **Attori partecipanti:** Time (principale)
- **Interesse dell'attore:** Non mostrare come affidabile lo stato di uno stallo il cui sensore non comunica.
- **Rilevanza:** Media (`RF_IOT_2`)
- **Frequenza stimata:** Occasionale (guasto o simulatore fermo)
- **Extension point:** Nessuno

## Entry condition

Per uno stallo sono trascorsi **60 secondi** dall'ultima rilevazione valida.

## Flusso di eventi (Scenario principale)

1. **Time:** Segnala che per lo stallo sono trascorsi 60 secondi senza rilevazioni.
2. **Sistema:** Porta lo stallo nello stato `Sconosciuto`.
3. **Sistema:** Riporta la variazione sulla mappa, dove lo stallo compare in grigio (cfr. `MU_2`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Sullo stallo c'è una sosta `Attiva`: lo stallo resta `Non disponibile` fino alla scadenza (`RF_SOSTA_6`) e il caso d'uso termina (**On success**).

## Exit condition

- **On success:** Lo stallo è nello stato `Sconosciuto` e compare in grigio sulla mappa, oppure resta `Non disponibile` se ha una sosta `Attiva`.
