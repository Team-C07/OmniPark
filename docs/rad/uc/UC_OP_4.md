# UC_OP_4: Chiudere una segnalazione

- **Package:** OP - Operatività
- **Attori partecipanti:** Ausiliario del Traffico (principale)
- **Interesse dell'attore:** Concludere la verifica di una possibile sosta irregolare registrandone l'esito.
- **Rilevanza:** Elevata (RF_OP_6)
- **Frequenza stimata:** Circa 22 usi/giorno per Ausiliario del Traffico
- **Extension point:** `Verifica del pagamento` (dopo il passo 2): <se l'Ausiliario del Traffico chiede di verificare il pagamento, `UC_OP_3`>

## Regole di dominio e contesto

- Gli esiti possibili sono due: `sosta irregolare accertata` e `non confermata`.
- La segnalazione non è una sanzione (`RD_10`): l'esito finale lo stabilisce l'Ausiliario dopo la verifica sul posto.
- Accetta anche una segnalazione `Aperta`, che il Sistema assegna a chi la chiude senza richiedere la preventiva presa in carico (`UC_OP_2`). Se già `Presa in carico`, può essere chiusa solo dall'Ausiliario assegnatario.

## Entry condition

Questo caso d'uso inizia quando l'Ausiliario del Traffico, autenticato, avvia la chiusura di una segnalazione `Aperta` o da lui presa in carico.

## Flusso di eventi (Scenario principale)

1. **Ausiliario del Traffico:** Avvia la chiusura della segnalazione.
2. **Sistema:** Verifica che la segnalazione sia `Aperta` o presa in carico dall'Ausiliario del Traffico e ne mostra targa, stallo e motivo (cfr. `MU_4`).
3. **Ausiliario del Traffico:** Indica l'esito: `sosta irregolare accertata` o `non confermata`.
4. **Sistema:** Registra l'esito, la data, l'ora e l'Ausiliario del Traffico, gli assegna la segnalazione se era `Aperta` e la porta in stato `Chiusa` (cfr. `MU_4`).

## Flussi alternativi (Eccezioni)

- **2.a1:** La segnalazione è presa in carico da un altro Ausiliario del Traffico o è già `Chiusa`: il Sistema ne informa l'Ausiliario del Traffico (**On failure**).
- **2.a2:** L'Ausiliario del Traffico chiede di verificare il pagamento: nel punto di estensione `Verifica del pagamento` si esegue extend (`UC_OP_3`), poi si prosegue dal passo 3.
- **3.a1:** L'Ausiliario del Traffico annulla la chiusura: il Sistema lascia la segnalazione nello stato in cui si trovava (**On failure**).
- **3.a2:** L'esito non è indicato o non è tra quelli previsti: il Sistema lo segnala e si torna al passo 3.

## Exit condition

- **On success:** La segnalazione è in stato `Chiusa` e riporta esito, data, ora e Ausiliario del Traffico che l'ha chiusa.
- **On failure:** Nessun esito è registrato e lo stato della segnalazione non cambia.

## Special requirements

- **NRF_SIC_1:** Segregazione per ente.
