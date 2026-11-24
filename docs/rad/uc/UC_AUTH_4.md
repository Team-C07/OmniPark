# UC_AUTH_4: Accedere al sistema e uscirne

- **Package:** AUTH - Autenticazione
- **Attori partecipanti:** Utente — Automobilista, Ausiliario del Traffico o Amministratore (principale)
- **Interesse dell'attore:** Accedere in modo riservato alle funzioni del proprio ruolo e chiudere la sessione al termine.
- **Rilevanza:** Elevata (`RF_AUTH_4`)
- **Frequenza stimata:** Circa 3.600 accessi/giorno di Automobilisti, più quelli di Ausiliari e Amministratore
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Vale per tutti e tre i ruoli: dopo l'accesso ciascuno vede la schermata iniziale del proprio ruolo.
- Gli account degli Ausiliari sono creati dall'Amministratore (`UC_ADM_2`); quello dell'Amministratore fa parte dei dati di partenza.

## Entry condition

Un utente registrato, senza una sessione attiva, richiede l'accesso (cfr. `MU_1`).

## Flusso di eventi (Scenario principale)

1. **Utente:** Inserisce email e password e chiede di accedere (cfr. `MU_1`).
2. **Sistema:** Verifica le credenziali e che l'account sia attivo.
3. **Sistema:** Avvia la sessione e mostra la schermata iniziale del ruolo: mappa degli stalli (`MU_2`), mappa delle segnalazioni (`MU_4`) o panoramica degli enti (`MU_5`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Le credenziali sono errate: il Sistema nega l'accesso senza indicare quale dato è sbagliato e si torna al passo 1.
- **2.a2:** L'account è stato disattivato dall'Amministratore (`UC_ADM_2`): il Sistema nega l'accesso (**On failure**).
- **3.a1:** Durante la sessione l'utente chiede di uscire: il Sistema chiude la sessione e mostra la schermata di accesso (cfr. `MU_1`) (**On success**).

## Exit condition

- **On success:** La sessione è attiva e l'utente vede la schermata iniziale del proprio ruolo (`MU_2`, `MU_4` o `MU_5`); dopo l'uscita la sessione è chiusa.
- **On failure:** L'accesso è negato e nessuna sessione è avviata.

## Special requirements

- **NRF_SIC_1:** Ogni utente autenticato accede solo alle funzioni e ai dati previsti dal proprio ruolo e dall'ente di appartenenza.
