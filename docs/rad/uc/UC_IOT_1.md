# UC_IOT_1: Acquisire una rilevazione di occupazione

- **Package:** NAV - Stalli e navigazione
- **Attori partecipanti:** `<<system>>` Sensore IoT simulato (principale)
- **Interesse dell'attore:** Comunicare al Sistema se nello stallo c’è un veicolo.
- **Rilevanza:** Elevata (`RF_IOT_1`, `RF_SOSTA_6`)
- **Frequenza stimata:** Circa 7.200 variazioni di stato/giorno, più le rilevazioni periodiche dei simulatori
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Aggiorna lo stato dello stallo secondo `SCD_1` (`Libero`, `Occupato`, `Non disponibile`, `Sconosciuto`).
- Una sosta `Attiva` prevale sulla rilevazione: lo stallo resta `Non disponibile` fino alla scadenza (`RF_SOSTA_6`).

## Entry condition

Il Sensore IoT simulato invia una rilevazione per uno stallo.

## Flusso di eventi (Scenario principale)

1. **Sensore IoT simulato:** Invia la rilevazione: stallo, presenza o assenza di un veicolo, data e ora.
2. **Sistema:** Verifica che la rilevazione sia completa e che lo stallo esista.
3. **Sistema:** Registra la rilevazione come ultima dello stallo e ne aggiorna lo stato: `Libero` se non c'è un veicolo, `Occupato` se c'è un veicolo e nessuna sosta `Attiva`.
4. **Sistema:** Riporta la variazione sulla mappa degli stalli (cfr. `MU_2`).

## Flussi alternativi (Eccezioni)

- **2.a1:** La rilevazione è incompleta o lo stallo non esiste: il Sistema la scarta (**On failure**).
- **3.a1:** Sullo stallo c'è una sosta `Attiva`: il Sistema registra la rilevazione ma lo stallo resta `Non disponibile`, e il caso d'uso termina (**On success**).
- **3.a2:** Non c'è più un veicolo e sullo stallo c'è una sosta `Scaduta`: il Sistema porta la sosta nello stato `Terminata`, elimina dichiarazione e foto del permesso se presenti e prosegue dal passo 3 con lo stallo `Libero`.
- **3.a3:** Lo stallo era `Sconosciuto`: torna allo stato indicato dalla rilevazione e si prosegue dal passo 4.

## Exit condition

- **On success:** La rilevazione è registrata e lo stato dello stallo è aggiornato e riportato sulla mappa.
- **On failure:** La rilevazione è scartata e lo stato dello stallo non cambia.

## Special requirements

- **NRF_PER_3:** La variazione di stato compare sulla mappa dell'Automobilista entro 2 secondi dalla rilevazione.
- **NRF_LEG_2:** Quando la sosta diventa `Terminata`, dichiarazione e foto del permesso sono eliminate.
