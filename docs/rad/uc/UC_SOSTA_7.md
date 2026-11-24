# UC_SOSTA_7: Far scadere una sosta

- **Package:** SOSTA - Sosta
- **Attori partecipanti:** Time (principale)
- **Interesse dell'attore:** Chiudere la sosta all’orario previsto e restituire allo stallo lo stato reale.
- **Rilevanza:** Elevata (`RF_SOSTA_7`, `RF_SOSTA_6`)
- **Frequenza stimata:** Circa 3.600 scadenze/giorno
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Avviato da `Time` all'orario di scadenza: rende rilevabile dalla Telecamera ANPR una sosta scaduta (`UC_ANPR_1`, motivo `sosta scaduta`).

## Entry condition

Viene raggiunto l'orario di scadenza di una sosta `Attiva`.

## Flusso di eventi (Scenario principale)

1. **Time:** Segnala che è stato raggiunto l'orario di scadenza della sosta.
2. **Sistema:** Porta la sosta nello stato `Scaduta`.
3. **Sistema:** Riporta lo stallo allo stato dell'ultima rilevazione del sensore (`Occupato` o `Sconosciuto`) e aggiorna la mappa (cfr. `MU_2`).

## Flussi alternativi (Eccezioni)

- **3.a1:** L'ultima rilevazione indica lo stallo libero: il Sistema porta lo stallo su `Libero`, porta la sosta nello stato `Terminata` ed elimina dichiarazione e foto del permesso se presenti (**On success**).

## Exit condition

- **On success:** La sosta è `Scaduta`, oppure `Terminata` se lo stallo risulta libero, e lo stallo è tornato allo stato rilevato dal sensore.

## Special requirements

- **NRF_LEG_2:** Quando la sosta diventa `Terminata`, dichiarazione e foto del permesso sono eliminate.
