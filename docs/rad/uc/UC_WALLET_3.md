# UC_WALLET_3: Consultare saldo e cronologia del wallet

- **Package:** WALLET - Wallet virtuale
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Sapere quanto credito ha e come lo ha speso.
- **Rilevanza:** Media (`RF_WALLET_3`)
- **Frequenza stimata:** Circa 1.200 consultazioni/giorno
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Il saldo è calcolato dalle ricariche meno gli addebiti (attributo derivato del Class Diagram).

## Entry condition

L'Automobilista, autenticato, apre il wallet (cfr. `MU_3`).

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Apre il wallet.
2. **Sistema:** Mostra il saldo e la cronologia dei movimenti, dal più recente: ricariche e addebiti con data, ora, importo e, per gli addebiti, la sosta e la targa (cfr. `MU_3`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Non ci sono movimenti: il Sistema mostra il saldo di `0,00 €` e la cronologia vuota (**On success**).
- **2.a2:** I dati del wallet non sono disponibili: il Sistema ne informa l'Automobilista (**On failure**).

## Exit condition

- **On success:** L'Automobilista vede il saldo e i movimenti del wallet.
- **On failure:** I dati del wallet non sono disponibili e l'Automobilista ne è informato.
