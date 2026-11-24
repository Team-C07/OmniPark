# UC_SOSTA_2: Prolungare una sosta attiva

- **Package:** SOSTA - Sosta
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Allungare la sosta senza tornare allo stallo.
- **Rilevanza:** Media (`RF_SOSTA_2`, `RF_WALLET_2`)
- **Frequenza stimata:** Circa 700 prolungamenti/giorno
- **Extension point:** `Credito insufficiente` (al passo 5): <se il credito non basta e l'Automobilista sceglie di ricaricare, `UC_WALLET_1`>

## Regole di dominio e contesto

- Il prolungamento si fa da remoto, finché la sosta è `Attiva` e la durata complessiva resta entro il massimo dello stallo.
- Una sosta `Scaduta` non si prolunga: l'Automobilista ne avvia una nuova (`UC_SOSTA_1`).

## Entry condition

L'Automobilista, autenticato, seleziona una propria sosta `Attiva` e chiede di prolungarla (cfr. `MU_2`).

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Indica il tempo aggiuntivo.
2. **Sistema:** Verifica che la sosta sia ancora `Attiva` e che la durata complessiva non superi la durata massima dello stallo.
3. **Sistema:** Calcola l'importo aggiuntivo e mostra importo e nuovo orario di scadenza (cfr. `MU_2`).
4. **Automobilista:** Conferma il prolungamento.
5. **Sistema:** Verifica che il credito sia sufficiente e addebita l'importo aggiuntivo.
6. **Sistema:** Aggiorna l'orario di scadenza e lo conferma (cfr. `MU_2`).

## Flussi alternativi (Eccezioni)

- **2.a1:** La sosta è già `Scaduta`: il Sistema ne informa l'Automobilista, che può avviare una nuova sosta con `UC_SOSTA_1` (**On failure**).
- **2.a2:** La durata complessiva supera la durata massima dello stallo: il Sistema lo segnala indicando il tempo ancora disponibile e si torna al passo 1.
- **4.a1:** L'Automobilista annulla: la scadenza non cambia (**On failure**).
- **5.a1:** Il credito non è sufficiente: il Sistema non addebita l'importo e propone la ricarica. Nel punto di estensione `Credito insufficiente` l'Automobilista può eseguire extend (`UC_WALLET_1`) e si torna al passo 4; se rinuncia, la scadenza non cambia (**On failure**).

## Exit condition

- **On success:** L'orario di scadenza è posticipato, l'importo aggiuntivo è addebitato e registrato come movimento e lo stallo resta `Non disponibile`.
- **On failure:** La scadenza non cambia e nessun importo è addebitato.

## Special requirements

- **NRF_LEG_1:** L'importo aggiuntivo applica tariffe, fasce orarie ed esenzioni del tipo di stallo.
- **NRF_AFF_3:** Un prolungamento confermato non va perso in caso di interruzione o riavvio del servizio.
