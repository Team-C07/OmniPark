# Vincoli di Dominio e Attributi Derivati (Class Diagram d'analisi v6.1)

- **Fonte:** OmniPark — Class Diagram d'analisi v6.1 (15 novembre 2026), Sezioni 4, 5 e 5.1.

## 1. Attributi derivati (`/`) e logiche di calcolo

- **`Wallet virtuale./saldo`:** È la somma algebrica dei movimenti del wallet (`ricariche` meno `addebiti`).
- **`Sosta./pagamento`:** Assume valore `gratuita` se la sosta si svolge in uno stallo per persone con disabilità con dichiarazione e foto del permesso; assume valore `pagata` per tutte le altre soste (inclusi gli stalli rosa).
- **Riepilogo dell'ente (`RF_ADM_1`, non persistito):** Calcolato contando gli `Stallo` delle `Area di sosta` di competenza dell'`Ente preposto`, le `Sosta` in stato `Attiva` in quegli stalli e le `Segnalazione` non chiuse (`Aperta` o `Presa in carico`) rilevate in quegli stalli.
- **Permesso da verificare (`RF_OP_2`, condizione derivata):** Una `Sosta` in stato `Attiva` in uno `Stallo` riservato a permesso esposto (`disabili` o `rosa`), con dichiarazione e foto del permesso, per cui non esiste ancora una `Verifica del permesso`.

## 2. Vincoli di integrità del modello (Sez. 5.1)

1. **Gerarchia Utente:** Ogni `Utente` è un `Automobilista`, un `Ausiliario del Traffico` oppure un `Amministratore`, mai più di uno (`{complete, disjoint}`); l'`email` è unica tra tutti gli `Utente`.
2. **Unicità Sosta Attiva:** Per ogni `Veicolo` (targa) esiste al più una `Sosta` in stato `Attiva` (`UC_SOSTA_1`).
3. **Appartenenza Veicolo:** Una `Sosta` è avviata per un `Veicolo` associato all'`Automobilista` che la avvia (`UC_SOSTA_1`).
4. **Movimenti Wallet:** Un `Movimento del wallet` di tipo `ricarica` non è collegato ad alcuna `Sosta`; uno di tipo `addebito` è collegato a una sola `Sosta` (`UC_WALLET_1`, `UC_SOSTA_1`, `UC_SOSTA_2`).
5. **Saldo non negativo:** Un addebito non può superare il `/saldo` del `Wallet virtuale` (`UC_SOSTA_1`, `UC_SOSTA_2`).
6. **Stato Stallo durante Sosta Attiva:** Lo `Stallo` è in stato `Non disponibile` finché vi si svolge una `Sosta` in stato `Attiva` (`UC_SOSTA_1`, `UC_SOSTA_2`, `RF_SOSTA_6`).
7. **Coerenza Tariffa-Ente:** Gli `Stallo` a cui si applica una `Tariffa` appartengono ad `Area di sosta` dello stesso `Ente preposto` (`UC_STALLI_2`).
8. **Permesso obbligatorio su stalli riservati:** La `dichiarazione di permesso` e la `foto del permesso` sono presenti solo per `Sosta` in `Stallo` riservati a permesso esposto (`disabili`, `rosa`) e sono entrambe obbligatorie per avviarle (`RF_SOSTA_5`).
9. **Durata massima Sosta:** La durata di una `Sosta`, all'avvio e dopo ogni prolungamento, non supera la `durata massima` della `Tariffa` del suo `Stallo` (`RF_SOSTA_1`, `RF_SOSTA_2`, `RD_05`).
10. **Gratuità Disabili vs Tariffa Stalli Rosa:** Negli `Stallo` per persone con disabilità la `Sosta` con dichiarazione e foto del permesso è `gratuita` qualunque sia la `Tariffa` dello stallo; negli stalli rosa si paga la tariffa (`UC_SOSTA_1`, `RD_06`, `RD_07`).
11. **Privacy e fine Sosta (`NRF_LEG_2`):** Una `Sosta` passa in stato `Terminata` quando il veicolo lascia lo stallo (e la sosta non è più attiva); da quel momento la `dichiarazione di permesso` e la `foto del permesso` sono eliminate e resta solo l'eventuale esito della `Verifica del permesso` (`SCD_2`, `NRF_LEG_2`).
12. **Unicità Verifica del permesso:** Una `Verifica del permesso` riguarda solo `Sosta` in `Stallo` riservati a permesso esposto con dichiarazione e foto del permesso; vale il primo esito registrato (`UC_OP_5`, flussi 2.a1 e 4.a2).
13. **Origine della Segnalazione (`UC_ANPR_1` vs `UC_OP_5`):**
    - Una `Segnalazione` generata da una `Verifica del permesso` con esito `non conforme` nasce in stato `Chiusa` con esito `sosta irregolare accertata`, è assegnata all'`Ausiliario del Traffico` che ha registrato la verifica e **non ha** `motivo`, `targa rilevata` né `data e ora della lettura` (`UC_OP_5`, flusso 4.a1).
    - Una `Segnalazione` generata da una lettura ANPR nasce in stato `Aperta` e **ha sempre** `motivo`, `targa rilevata` e `data e ora della lettura` (`UC_ANPR_1`).
14. **Orari di vigenza:** Fuori dagli `orari di vigenza` della `Tariffa` la sosta negli stalli ordinari è libera; negli stalli riservati il permesso va esposto a tutte le ore (`UC_ANPR_1`, flusso 2.a2).
15. **Timeout sensore IoT:** Lo `Stallo` passa in stato `Sconosciuto` quando dalla `data e ora dell'ultima rilevazione` sono trascorsi più di **60 secondi** (`UC_IOT_2`, `RF_IOT_2`).
16. **Deduplicazione Segnalazioni ANPR:** Per ogni `targa rilevata` esiste al più una `Segnalazione` non chiusa (`Aperta` o `Presa in carico`) (`UC_ANPR_1`, passo 4 e flusso 4.a1).
17. **Assegnazione Segnalazione:** Una `Segnalazione` in stato `Aperta` non è assegnata ad alcun `Ausiliario del Traffico`; in stato `Presa in carico` o `Chiusa` è assegnata a uno solo (`UC_OP_2`, `UC_OP_4`).
18. **Segregazione per Ente (`NRF_SIC_1`):** Una `Segnalazione` può essere assegnata solo a un `Ausiliario del Traffico` che opera per l'`Ente preposto` competente per l'`Area di sosta` dello `Stallo` in cui è rilevata (`UC_OP_1`, `NRF_SIC_1`).
19. **Disattivazione Ausiliario (`RF_ADM_2`):** L'`Amministratore` disattiva un `Ausiliario del Traffico` invece di eliminarlo: un Ausiliario disattivato non può accedere né prendere in carico segnalazioni, e le sue `Segnalazione` e `Verifica del permesso` restano conservate. Un Ausiliario con `Segnalazione` in stato `Presa in carico` può essere disattivato solo dopo averle chiuse (`UC_ADM_2`).
20. **Occupazione rilevata (CD 6.1):** `Stallo.occupazione rilevata` conserva l'ultima rilevazione del sensore (veicolo presente o assente) anche mentre lo stallo è `Non disponibile`; alla scadenza della sosta lo stallo torna a quello stato (`RF_SOSTA_6`, `UC_SOSTA_7`). Se il veicolo lascia lo stallo durante una sosta `Attiva`, la sosta resta `Attiva` fino alla scadenza e diventa `Terminata` subito dopo.
