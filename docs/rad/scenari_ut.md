# Scenari d'Uso — Area Automobilista, Navigazione e Pagamenti

- **Riferimento:** RAD 1.2.0 — Elenco dei Requisiti 1.1.0 (CR_01)
- **Contesto di riferimento (stime):** Comune di Gragnano (~28.000 abitanti, sosta a pagamento 8:00–20:00, ~600 stalli gestiti di cui ~30 riservati).

---

## SC_UT_1: Registrazione e seconda targa

- **Partecipanti:** Elena Bianchi (Automobilista)
- **Flusso degli eventi:**
  Elena Bianchi apre OmniPark dal browser del telefono per cercare parcheggio in centro. Nella schermata di registrazione inserisce email, password e la targa della sua auto, `EF456GH` (cfr. `MU_1`). Il sistema verifica che l'email non sia già registrata e che la targa sia valida, crea l'account con un wallet virtuale a saldo `0,00 €` e le mostra la mappa degli stalli (cfr. `MU_2`). La sera Elena apre il profilo e aggiunge la targa `GH321JK` dell'auto del compagno, che a volte usa (cfr. `MU_3`).

---

## SC_UT_2: Ricerca, navigazione e sosta

- **Partecipanti:** Marco Rossi (Automobilista), `<<system>>` App di mappe esterna
- **Flusso degli eventi:**
  Alle 8:30 Marco Rossi apre la mappa e cerca uno stallo in Corso Italia (cfr. `MU_2`). Seleziona uno stallo a pagamento `Libero` e legge la scheda: `1,50 €/h` dalle 8:00 alle 20:00, durata massima 3 ore. Avvia la navigazione e il sistema apre Google Maps sulla posizione dello stallo. Alle 8:42 Marco parcheggia e il sensore segnala lo stallo come `Occupato`. Marco seleziona lo stallo, sceglie la targa `MN234PQ` e una durata di 2 ore: il sistema mostra `3,00 €` con scadenza alle 10:42. Marco conferma, il sistema addebita `3,00 €` sul wallet e imposta lo stallo su `Non disponibile` (cfr. `MU_2`).

---

## SC_UT_3: Sosta in uno stallo per persone con disabilità

- **Partecipanti:** Luigi Verde (Automobilista)
- **Flusso degli eventi:**
  Luigi Verde, titolare del contrassegno per persone con disabilità, parcheggia in uno stallo riservato in Piazza Libertà. Seleziona lo stallo, sceglie la targa `IJ789KL` e una durata di 1 ora. Il sistema gli chiede di dichiarare di esporre il contrassegno e di caricarne la foto (cfr. `MU_2`): Luigi spunta la dichiarazione e fotografa il contrassegno sul parabrezza. Il sistema applica la tariffa di `0,00 €`, avvia la sosta e imposta lo stallo su `Non disponibile`. Quando Luigi riparte, dopo la scadenza, la sosta termina e il sistema elimina dichiarazione e foto.

---

## SC_UT_4: Sensore muto (stato Sconosciuto)

- **Partecipanti:** Giulia Romano (Automobilista), Time
- **Flusso degli eventi:**
  Alle 11:00 il sensore dello stallo 104 smette di inviare rilevazioni. Dopo 60 secondi Time fa scattare il timeout e il sistema porta lo stallo nello stato `Sconosciuto`. Giulia Romano consulta la mappa, vede lo stallo 104 in grigio (cfr. `MU_2`) ed evita di dirigersi verso un posto il cui stato non è affidabile.

---

## SC_UT_5: Prolungamento con credito insufficiente

- **Partecipanti:** Marco Rossi (Automobilista)
- **Flusso degli eventi:**
  Alle 10:20, dall'ufficio, Marco Rossi chiede di prolungare di 1 ora la sosta che scade alle 10:42. Il sistema calcola `1,50 €`, ma il wallet ha un saldo di `0,50 €`: nega l'addebito e gli propone la ricarica. Marco ricarica `10,00 €` (cfr. `MU_3`) e conferma il prolungamento: il sistema addebita `1,50 €` e porta la scadenza alle 11:42. Marco prova ad aggiungere altri 30 minuti, ma il sistema lo informa che la sosta raggiungerebbe 3 ore e 30 minuti, oltre la durata massima dello stallo. Nella cronologia del wallet Marco vede la ricarica di `10,00 €` e gli addebiti di `3,00 €` e `1,50 €` (cfr. `MU_3`).

---

## SC_UT_6: Sosta in uno stallo rosa

- **Partecipanti:** Elena Bianchi (Automobilista)
- **Flusso degli eventi:**
  Elena Bianchi, in gravidanza e titolare del permesso rosa, parcheggia in uno stallo rosa di Piazza Libertà. Avvia la sosta con la targa `EF456GH` per 1 ora; il sistema le chiede la dichiarazione e la foto del permesso rosa e lei le carica (cfr. `MU_2`). Il permesso rosa non dà diritto alla gratuità: il sistema applica la tariffa di `1,50 €/h`, addebita `1,50 €` e imposta lo stallo su `Non disponibile`.

---

## SC_UT_7: Preferiti

- **Partecipanti:** Giulia Romano (Automobilista)
- **Flusso degli eventi:**
  Giulia Romano parcheggia spesso vicino al lavoro. Dalla scheda di uno stallo salva tra i preferiti l'area di sosta di Piazza Libertà (cfr. `MU_2`). La mattina dopo apre i preferiti: il sistema mostra l'area con 2 stalli `Liberi` su 8 e lo stato aggiornato di ciascuno. Giulia seleziona l'area e la mappa si centra su Piazza Libertà.

---

## SC_UT_8: Scadenza della sosta

- **Partecipanti:** Marco Rossi (Automobilista), Time
- **Flusso degli eventi:**
  Un altro giorno la sosta di Marco Rossi in Corso Italia scade alle 18:00 mentre l'auto è ancora parcheggiata. Time fa scattare la scadenza: il sistema porta la sosta nello stato `Scaduta` e riporta lo stallo allo stato rilevato dal sensore, `Occupato` (cfr. `MU_2`). Alle 18:20 Marco riparte: il sensore rileva lo stallo `Libero` e il sistema porta la sosta nello stato `Terminata`.
