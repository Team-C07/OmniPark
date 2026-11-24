# UC_AUTH_5: Gestire le targhe del profilo

- **Package:** AUTH - Autenticazione
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Avere nel profilo le targhe dei veicoli che usa, per sceglierle all’avvio della sosta.
- **Rilevanza:** Elevata (`RF_AUTH_5`)
- **Frequenza stimata:** Circa 5 modifiche/giorno
- **Extension point:** Nessuno

## Regole di dominio e contesto

- La stessa targa può comparire nel profilo di più Automobilisti (es. auto di famiglia, Class Diagram 6.0).
- Il profilo conserva sempre **almeno una targa**.

## Entry condition

L'Automobilista, autenticato, apre la sezione targhe del profilo (cfr. `MU_3`).

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Apre la sezione targhe del profilo.
2. **Sistema:** Mostra le targhe associate al profilo (cfr. `MU_3`).
3. **Automobilista:** Inserisce una nuova targa e conferma.
4. **Sistema:** Verifica che la targa sia formalmente valida e non sia già nel profilo.
5. **Sistema:** Associa la targa al profilo e aggiorna l'elenco (cfr. `MU_3`).

## Flussi alternativi (Eccezioni)

- **3.a1:** L'Automobilista chiede di rimuovere una targa: se non è l'unica del profilo e non ha una sosta `Attiva`, il Sistema la rimuove e aggiorna l'elenco (**On success**).
- **3.a2:** La targa da rimuovere è l'unica del profilo oppure ha una sosta `Attiva`: il Sistema non la rimuove e ne spiega il motivo (**On failure**).
- **4.a1:** La targa non è valida o è già nel profilo: il Sistema lo segnala e si torna al passo 3.

## Exit condition

- **On success:** La targa è aggiunta o rimossa e l'elenco del profilo è aggiornato, con almeno una targa.
- **On failure:** L'elenco delle targhe non cambia e l'Automobilista ne è informato.
