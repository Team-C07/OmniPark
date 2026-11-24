# UC_OP_3: Verificare lo stato del pagamento

- **Package:** OP - Operatività
- **Attori partecipanti:** Ausiliario del Traffico (principale)
- **Interesse dell'attore:** Sapere se per il veicolo risulta una sosta `Attiva`, pagata o gratuita, prima di decidere l'esito della segnalazione.
- **Rilevanza:** Media (RF_OP_4)
- **Frequenza stimata:** Circa 22 usi/giorno per Ausiliario del Traffico
- **Relazioni:** Estende `UC_OP_4` nel punto di estensione `Verifica del pagamento`.
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Mostra se per la targa della segnalazione risulta una sosta sullo stallo e in quale stato si trova (`Attiva`, `Scaduta` o `Terminata`, allineato a `SCD_2`).
- Negli stalli per persone con disabilità la sosta è gratuita, quindi conta che sia `Attiva` e non che sia pagata.
- Si usa da solo oppure come estensione di `UC_OP_4`.

## Entry condition

Questo caso d'uso inizia quando l'Ausiliario del Traffico, autenticato, richiede la verifica del pagamento per una segnalazione `Aperta` o da lui presa in carico, oppure quando estende `UC_OP_4` nel punto di estensione `Verifica del pagamento`: in questo caso la richiesta è già avvenuta, il flusso parte dal passo 2 e al termine prosegue in `UC_OP_4`.

## Flusso di eventi (Scenario principale)

1. **Ausiliario del Traffico:** Richiede la verifica del pagamento per la segnalazione selezionata.
2. **Sistema:** Cerca la sosta associata alla targa e allo stallo della segnalazione.
3. **Sistema:** Mostra lo stato della sosta (`Attiva`, `Scaduta` o `Terminata`) con orario di avvio e di scadenza, oppure indica che per la targa non risulta alcuna sosta sullo stallo (cfr. `MU_4`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Le informazioni sul pagamento non sono disponibili: il Sistema ne informa l'Ausiliario del Traffico (**On failure**). Se `UC_OP_3` estende `UC_OP_4`, la chiusura prosegue dal passo 3 di `UC_OP_4`.

## Exit condition

- **On success:** L'Ausiliario del Traffico sa se per la targa della segnalazione risulta una sosta sullo stallo e in quale stato (`Attiva`, `Scaduta` o `Terminata`), oppure che non ne risulta alcuna.
- **On failure:** Le informazioni sul pagamento non sono disponibili e l'Ausiliario del Traffico ne è informato.

## Special requirements

- **NRF_SIC_1:** Segregazione per ente.
