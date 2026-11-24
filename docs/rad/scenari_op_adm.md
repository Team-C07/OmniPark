# Scenari d'Uso — Area Ausiliario del Traffico e Amministratore

- **Riferimento:** RAD 1.2.0 — Elenco dei Requisiti 1.1.0 (CR_01)
- **Contesto di riferimento (stime):** Comune di Gragnano (~28.000 abitanti, sosta a pagamento 8:00–20:00, ~600 stalli gestiti di cui ~30 riservati a permesso esposto, ~3.600 letture ANPR/giorno, ~180 segnalazioni/giorno, 8 Ausiliari del Traffico).

---

## Parte 1 — Scenari dell'Ausiliario del Traffico (`SC_OP_1` ... `SC_OP_7`)

### SC_OP_1: Auto senza sosta in via Tommaso Sorrentino

- **Partecipanti:** Paolo Ferri (Ausiliario del Traffico)
- **Flusso degli eventi:**
  Martedì mattina Paolo Ferri è in servizio a Gragnano. Alle 10:42 la telecamera ANPR di via Tommaso Sorrentino legge la targa `FG482KL` del veicolo parcheggiato nello stallo 14. Il sistema verifica che per quella targa non risulti una sosta attiva sullo stallo e genera una segnalazione di possibile sosta irregolare con motivo `sosta assente`, che compare sulla mappa delle segnalazioni del comune. Paolo apre la mappa (cfr. `MU_4`) e prende in carico la segnalazione; il sistema la assegna a lui. Paolo raggiunge lo stallo, trova il veicolo e avvia la chiusura. Prima di indicare l'esito chiede di verificare il pagamento: il sistema conferma che per la targa non risulta alcuna sosta (cfr. `MU_4`). Paolo registra l'esito `sosta irregolare accertata` e il sistema chiude la segnalazione.

---

### SC_OP_2: Sosta pagata all'ultimo minuto

- **Partecipanti:** Paolo Ferri (Ausiliario del Traffico), Davide Conte (Automobilista)
- **Flusso degli eventi:**
  Venerdì pomeriggio, alle 15:01, il sistema genera una segnalazione con motivo `sosta assente` per la targa `EB917RT` nello stallo 8 di piazza San Leone. Paolo Ferri la vede sulla mappa, la prende in carico alle 15:03 e raggiunge lo stallo. Alle 15:04 Davide Conte avvia e paga da remoto una sosta per quella targa. Alle 15:06 Paolo verifica lo stato del pagamento: il sistema indica una sosta `Attiva`, avviata alle 15:04 (cfr. `MU_4`). Paolo avvia la chiusura, registra l'esito `non confermata` e il sistema chiude la segnalazione.

---

### SC_OP_3: Segnalazione già presa in carico

- **Partecipanti:** Paolo Ferri (Ausiliario del Traffico), Sara Galli (Ausiliario del Traffico)
- **Flusso degli eventi:**
  Mercoledì mattina Paolo Ferri e Sara Galli sono entrambi in servizio. Alle 9:18 sulla mappa compare una nuova segnalazione nello stallo 3 di via Raffaele Viviani. Alle 9:19 Sara la prende in carico. Alle 9:20 Paolo, che aveva la mappa già aperta (cfr. `MU_4`), tenta di prenderla in carico, ma il sistema lo informa che la segnalazione è già stata presa in carico da Sara Galli. Paolo prende in carico la segnalazione successiva, sempre in via Raffaele Viviani, e il sistema la assegna a lui.

---

### SC_OP_4: Permesso dichiarato ma non esposto

- **Partecipanti:** Paolo Ferri (Ausiliario del Traffico), Davide Conte (Automobilista)
- **Flusso degli eventi:**
  Giovedì alle 11:10 Davide Conte avvia una sosta nello stallo 2 di via Tommaso Sorrentino, riservato alle persone con disabilità: dichiara di esporre il contrassegno e ne carica la foto, ma scendendo lo lascia nel portaoggetti. Alle 11:30 Paolo Ferri vede sulla mappa lo stallo 2 indicato come `permesso da verificare`, con il tipo di stallo, la dichiarazione e la foto del contrassegno (cfr. `MU_4`). Raggiunge lo stallo e confronta il parabrezza con la foto: il contrassegno non è esposto. Paolo registra l'esito `non conforme` e il sistema genera una segnalazione di sosta irregolare accertata, già chiusa, che conserva solo l'esito della verifica. Quando Davide lascia lo stallo la sosta termina e il sistema elimina dichiarazione e foto.

---

### SC_OP_5: Veicolo già andato via

- **Partecipanti:** Paolo Ferri (Ausiliario del Traffico)
- **Flusso degli eventi:**
  Sabato pomeriggio la sosta della targa `CD330PL` nello stallo 21 di piazza San Leone scade alle 17:00. Alle 17:10 la telecamera legge la targa e il sistema genera una segnalazione con motivo `sosta scaduta`. Alle 17:15 la telecamera legge di nuovo la stessa targa: il sistema scarta la nuova segnalazione, perché per quel veicolo ne esiste già una non chiusa, e mantiene la prima. Paolo Ferri la prende in carico alle 17:20, ma quando arriva alle 17:35 lo stallo è libero. Avvia la chiusura e verifica il pagamento: il sistema indica che la sosta è scaduta alle 17:00 ed è `Terminata` perché il veicolo ha lasciato lo stallo (cfr. `MU_4`). Non potendo accertare la violazione, Paolo registra l'esito `non confermata` e il sistema chiude la segnalazione.

---

### SC_OP_6: Targa diversa da quella pagata

- **Partecipanti:** Paolo Ferri (Ausiliario del Traffico), Davide Conte (Automobilista)
- **Flusso degli eventi:**
  Domenica alle 16:20 Davide Conte avvia e paga una sosta nello stallo 5 di via Raffaele Viviani indicando la targa `AB123CD`, ma parcheggia la sua seconda auto. Alle 16:25 la telecamera legge la targa `FK771PS` e il sistema genera una segnalazione con motivo `targa non corrispondente`. Paolo Ferri la prende in carico, raggiunge lo stallo e controlla la targa dell'auto presente: `FK771PS`. Verifica lo stato del pagamento e il sistema indica che per quella targa non risulta alcuna sosta (cfr. `MU_4`). Paolo registra l'esito `sosta irregolare accertata` e il sistema chiude la segnalazione.

---

### SC_OP_7: Stallo rosa di notte

- **Partecipanti:** Sara Galli (Ausiliario del Traffico)
- **Flusso degli eventi:**
  Martedì alle 22:30 la telecamera ANPR di piazza San Leone legge la targa `LM640TZ` nello stallo 1, riservato alle donne in gravidanza. Fuori dalla fascia a pagamento la sosta è libera, ma il permesso va dichiarato ed esposto a tutte le ore: per la targa non risulta una sosta con dichiarazione e il sistema genera una segnalazione con motivo `sosta assente`. Di notte nessun Ausiliario consulta la mappa e la segnalazione resta `Aperta`. Mercoledì alle 8:05 Sara Galli apre la mappa delle segnalazioni (cfr. `MU_4`), prende in carico quella dello stallo 1 e raggiunge l'auto: il permesso è esposto sul parabrezza. Sara avvia la chiusura, registra l'esito `non confermata` e il sistema chiude la segnalazione.

---

## Parte 2 — Scenari dell'Amministratore (`SC_ADM_1` ... `SC_ADM_5`)

### SC_ADM_1: Riepilogo del comune di Gragnano

- **Partecipanti:** Marco Esposito (Amministratore)
- **Flusso degli eventi:**
  Il 3 novembre 2026 Marco Esposito accede a OmniPark per conoscere la situazione dei parcheggi gestiti dal comune di Gragnano. Richiede il riepilogo degli enti clienti (cfr. `MU_5`) e seleziona Gragnano. Il sistema recupera i dati e mostra 600 stalli gestiti, 180 soste attive e 12 segnalazioni aperte (cfr. `MU_5`). Marco prende visione delle informazioni e conclude la consultazione.

---

### SC_ADM_2: Nuovo Ausiliario a Gragnano

- **Partecipanti:** Marco Esposito (Amministratore)
- **Flusso degli eventi:**
  Il comune di Gragnano assume un nuovo Ausiliario del Traffico, Luca Russo. Marco Esposito apre la gestione degli Ausiliari (cfr. `MU_6`), sceglie di creare un account e inserisce nome, cognome, email e comune di Luca; il sistema verifica che l'email non sia già usata e crea l'account. Qualche giorno dopo Marco corregge l'email di Luca e il sistema aggiorna l'account. A fine contratto Marco elimina l'account: Luca non ha segnalazioni prese in carico, quindi il sistema disattiva l'account, che non può più accedere, e conserva le segnalazioni già chiuse da Luca.

---

### SC_ADM_3: Comune senza soste né segnalazioni

- **Partecipanti:** Marco Esposito (Amministratore)
- **Flusso degli eventi:**
  Il 3 novembre 2026 Marco Esposito richiede il riepilogo del comune di Baronissi (cfr. `MU_5`). Il sistema rileva che il comune gestisce 80 stalli, ma che non risultano né soste attive né segnalazioni aperte, e mostra 80 stalli gestiti e il valore 0 sia per le soste attive sia per le segnalazioni aperte. Marco prende visione delle informazioni e conclude la consultazione.

---

### SC_ADM_4: Riepilogo non disponibile

- **Partecipanti:** Marco Esposito (Amministratore)
- **Flusso degli eventi:**
  Il 4 novembre 2026 Marco Esposito richiede il riepilogo degli enti clienti; il sistema mostra l'elenco degli enti (cfr. `MU_5`) e Marco seleziona il comune di Fisciano. Durante il recupero delle informazioni il sistema riscontra un problema che impedisce di ottenere i dati sulle soste attive e sulle segnalazioni aperte, e comunica a Marco che il riepilogo non può essere completato. Marco prende atto dell'errore e termina l'operazione senza il riepilogo.

---

### SC_ADM_5: Ausiliario con segnalazioni in carico

- **Partecipanti:** Marco Esposito (Amministratore), Sara Galli (Ausiliario del Traffico)
- **Flusso degli eventi:**
  Sara Galli lascia il servizio presso il comune di Gragnano. Alle 10:00 Marco Esposito apre la gestione degli Ausiliari (cfr. `MU_6`) e chiede di eliminare l'account di Sara, che però ha due segnalazioni prese in carico: il sistema blocca l'operazione e lo informa. Nel corso della mattina Sara chiude le due segnalazioni. Alle 13:00 Marco ripete l'operazione e il sistema disattiva l'account di Sara.
