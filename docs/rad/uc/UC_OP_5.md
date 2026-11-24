# UC_OP_5: Registrare l'esito della verifica del permesso

- **Package:** OP - Operatività
- **Attori partecipanti:** Ausiliario del Traffico (principale)
- **Interesse dell'attore:** Accertare che chi sosta in uno stallo riservato esponga davvero il permesso dichiarato e fotografato.
- **Rilevanza:** Media (RF_OP_5)
- **Frequenza stimata:** Circa 15 usi/giorno per Ausiliario del Traffico
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Riguarda gli stalli riservati a permesso esposto (persone con disabilità, stalli rosa) occupati da una sosta attiva con dichiarazione e foto del permesso.
- L'esito può essere `conforme` (se il permesso della foto è esposto) oppure `non conforme` (se non lo è).
- Se `non conforme`, la segnalazione generata nasce già in stato `Chiusa` con esito `sosta irregolare accertata`.

## Entry condition

Questo caso d'uso inizia quando l'Ausiliario del Traffico, autenticato, consultando la mappa delle segnalazioni del proprio comune, sceglie uno stallo con `permesso da verificare`.

## Flusso di eventi (Scenario principale)

1. **Ausiliario del Traffico:** Richiede la verifica del permesso per lo stallo scelto.
2. **Sistema:** Mostra il tipo di stallo, la targa, la dichiarazione di permesso e la foto del permesso caricata per la sosta (cfr. `MU_4`).
3. **Ausiliario del Traffico:** Confronta il permesso esposto sul veicolo con la foto e indica l'esito della verifica: `conforme` o `non conforme`.
4. **Sistema:** Registra l'esito della verifica, la data, l'ora e l'Ausiliario del Traffico e conferma la registrazione (cfr. `MU_4`).

## Flussi alternativi (Eccezioni)

- **2.a1:** La sosta non è più `Attiva` (`Scaduta` o `Terminata`): il Sistema informa l'Ausiliario del Traffico che non c'è più nulla da verificare (**On failure**).
- **3.a1:** L'Ausiliario del Traffico annulla la verifica: il Sistema non registra alcun esito (**On failure**).
- **4.a1:** L'esito è `non conforme`: il Sistema genera per la targa della sosta una segnalazione in stato `Chiusa` con esito `sosta irregolare accertata`, la associa all'Ausiliario del Traffico e non vi copia né la dichiarazione né la foto (**On success**).
- **4.a2:** Un altro Ausiliario del Traffico ha già registrato l'esito per quella sosta: il Sistema mantiene il primo esito e ne informa l'Ausiliario del Traffico (**On failure**).

## Exit condition

- **On success:** L'esito della verifica (`conforme` o `non conforme`) è registrato con data, ora e Ausiliario del Traffico, e lo stallo non risulta più con permesso da verificare per quella sosta; se l'esito è `non conforme`, esiste una segnalazione di sosta irregolare accertata in stato `Chiusa`.
- **On failure:** L'Ausiliario del Traffico non registra alcun esito; se un altro Ausiliario del Traffico l'aveva già registrato, resta valido il primo.

## Special requirements

- **NRF_LEG_2:** Il Sistema non memorizza nel profilo dell'Automobilista informazioni sulla titolarità di permessi; la dichiarazione e la foto del permesso sono associate alla singola sosta ed eliminate al suo termine, e la segnalazione generata conserva solo l'esito della verifica.
- **NRF_SIC_1:** Segregazione per ente.
