# UC_WALLET_1: Ricaricare il wallet virtuale

- **Package:** WALLET - Wallet virtuale
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Avere credito sufficiente per pagare le soste.
- **Rilevanza:** Elevata (`RF_WALLET_1`)
- **Frequenza stimata:** Circa 1.200 ricariche/giorno
- **Relazioni:** Può estendere `UC_SOSTA_1` e `UC_SOSTA_2` nel punto di estensione `Credito insufficiente`.
- **Extension point:** Nessuno

## Entry condition

L'Automobilista, autenticato, apre il wallet e chiede una ricarica (cfr. `MU_3`), oppure `UC_SOSTA_1` o `UC_SOSTA_2` raggiungono il punto di estensione `Credito insufficiente` e l'Automobilista sceglie di ricaricare.

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Sceglie l'importo della ricarica (`5`, `10` o `20 €`) (cfr. `MU_3`).
2. **Sistema:** Mostra il riepilogo della ricarica simulata.
3. **Automobilista:** Conferma.
4. **Sistema:** Registra la ricarica come movimento, aggiorna il saldo e lo mostra (cfr. `MU_3`); se la ricarica è partita da `UC_SOSTA_1` o `UC_SOSTA_2`, il flusso torna al caso d'uso di partenza.

## Flussi alternativi (Eccezioni)

- **3.a1:** L'Automobilista annulla: il saldo non cambia (**On failure**).

## Exit condition

- **On success:** Il saldo è aumentato dell'importo ricaricato e la ricarica è registrata come movimento.
- **On failure:** Il saldo non cambia.

## Special requirements

- **RD_04:** La ricarica è simulata e non comporta transazioni economiche reali.
