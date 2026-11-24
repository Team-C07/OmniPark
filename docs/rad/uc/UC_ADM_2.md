# UC_ADM_2: Gestire gli account degli Ausiliari del Traffico

- **Package:** ADM - Amministrazione
- **Attori partecipanti:** Amministratore (principale)
- **Interesse dell'attore:** Tenere gli account degli Ausiliari del Traffico allineati al personale in servizio presso ciascun ente cliente.
- **Rilevanza:** Media (RF_ADM_2)
- **Frequenza stimata:** Circa 2 usi/settimana
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Copre le quattro operazioni CRUD (`RF_ADM_2`): consultazione (elenco), creazione e modifica (modulo) ed eliminazione (flusso alternativo).
- L'eliminazione è una **disattivazione logica**: l'Ausiliario non può più accedere, ma le segnalazioni già chiuse restano associate a lui come richiesto dal Class Diagram.
- Non è consentito disattivare un Ausiliario che ha segnalazioni `Prese in carico`, perché nessun altro potrebbe chiuderle (`UC_OP_2`).

## Entry condition

Questo caso d'uso inizia quando l'Amministratore, autenticato, richiede la gestione degli Ausiliari del Traffico.

## Flusso di eventi (Scenario principale)

1. **Amministratore:** Richiede la gestione degli Ausiliari del Traffico.
2. **Sistema:** Mostra l'elenco degli Ausiliari del Traffico per ente cliente, con nome, cognome, email, ente e stato dell'account (cfr. `MU_6`).
3. **Amministratore:** Sceglie di creare un nuovo account oppure seleziona un account da modificare.
4. **Sistema:** Mostra il modulo con nome, cognome, email ed ente cliente, già compilato se si tratta di una modifica (cfr. `MU_6`).
5. **Amministratore:** Inserisce o modifica i dati e conferma.
6. **Sistema:** Verifica che i dati siano completi e che l'email non sia già usata da un altro account.
7. **Sistema:** Registra l'account, conferma l'operazione e aggiorna l'elenco (cfr. `MU_6`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Non è registrato alcun Ausiliario del Traffico: il Sistema mostra l'elenco vuoto e il flusso prosegue dal passo 3 con la sola creazione.
- **3.a1:** L'Amministratore chiede di eliminare un account: il Sistema chiede conferma e, se l'Ausiliario del Traffico non ha segnalazioni `Prese in carico`, disattiva l'account, che non può più accedere, e mantiene le segnalazioni già chiuse associate all'Ausiliario (**On success**).
- **3.a2:** L'Ausiliario del Traffico da eliminare ha segnalazioni `Prese in carico`: il Sistema non disattiva l'account e ne informa l'Amministratore (**On failure**).
- **5.a1:** L'Amministratore annulla l'operazione: il Sistema non modifica alcun account (**On failure**).
- **6.a1:** I dati sono incompleti oppure l'email è già usata da un altro account: il Sistema lo segnala e si torna al passo 4.

## Exit condition

- **On success:** L'account dell'Ausiliario del Traffico è creato, modificato o disattivato e l'elenco degli Ausiliari riflette la modifica; un account disattivato non può più accedere.
- **On failure:** Nessun account è modificato e l'Amministratore ne è informato.

## Special requirements

- **NRF_SIC_1:** L'ente cliente associato all'account stabilisce le funzioni e i dati a cui l'Ausiliario del Traffico può accedere.
