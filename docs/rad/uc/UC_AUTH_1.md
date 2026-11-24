# UC_AUTH_1: Registrare un account Automobilista

- **Package:** AUTH - Autenticazione
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Creare un account personale per avviare e pagare le soste con il wallet virtuale.
- **Rilevanza:** Elevata (`RF_AUTH_1`; la targa traccia `RF_AUTH_5` e il wallet `RF_WALLET_1`, entrambi a priorità Alta)
- **Frequenza stimata:** Circa 15 registrazioni/giorno a regime
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Ogni Automobilista ha almeno un veicolo associato al profilo al momento della registrazione (Class Diagram 6.0); altre targhe si aggiungono con `UC_AUTH_5`.
- L'account viene creato con un wallet virtuale a saldo `0,00 €`.

## Entry condition

Un utente senza account richiede la registrazione (cfr. `MU_1`).

## Flusso di eventi (Scenario principale)

1. **Utente:** Inserisce email, password e la targa di un proprio veicolo e chiede di registrarsi (cfr. `MU_1`).
2. **Sistema:** Verifica che i dati siano completi, che l'email non sia già registrata e che la targa sia formalmente valida.
3. **Sistema:** Crea l'account, associa la targa e un wallet virtuale con saldo `0,00 €`, avvia la sessione e mostra la mappa degli stalli (cfr. `MU_2`).

## Flussi alternativi (Eccezioni)

- **1.a1:** L'utente annulla la registrazione: nessun account è creato (**On failure**).
- **2.a1:** L'email è già registrata: il Sistema lo segnala (cfr. `MU_1`) e si torna al passo 1.
- **2.a2:** I dati sono incompleti oppure la targa non è valida: il Sistema indica il campo da correggere e si torna al passo 1.

## Exit condition

- **On success:** L'account Automobilista è registrato con almeno una targa, ha un wallet virtuale con saldo `0,00 €` e la sessione è avviata.
- **On failure:** Nessun account è creato e l'utente ne è informato.
