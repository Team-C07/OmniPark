# cp_verificaAutorizzazione

Specifica dei casi di test (category partition) del servizio Autorizzazione, operazioni `verificaAutorizzazione(sessione, operazione, ente)` e `ausiliariDellEntePreposto(ente)`.
Requisito: NRF_SIC_1 (controllo degli accessi), base.

## Parametri e ambiente

- `sessione`: token della sessione.
- `operazione`: operazione richiesta; per ogni operazione è definito l'elenco dei ruoli ammessi.
- `ente`: ente a cui appartengono i dati, oppure nessuno per le operazioni che non riguardano un ente.
- Ambiente: due enti; per ciascuno un Ausiliario attivo; nel primo ente anche un Ausiliario disattivato; un Automobilista e un Amministratore. La durata della sessione è fissa; la sessione scaduta si ottiene spostando l'orologio dei test, senza attese reali.

## Categorie e scelte: verificaAutorizzazione

**Sessione**

1. valida
2. scaduta [error]
3. inesistente [error]

**Ruolo rispetto all'operazione**

1. ammesso
2. non ammesso [error]

**Ente dei dati**

1. lo stesso dell'Ausiliario
2. un altro ente [error]
3. non applicabile

Vincoli: l'ente si verifica solo per l'Ausiliario del Traffico. L'Amministratore opera su tutti gli enti [single].

## Categorie e scelte: ausiliariDellEntePreposto

**Ente**

1. con Ausiliari attivi
2. senza Ausiliari [single]

## Frame ed esiti attesi

| Frame | Operazione                | Sessione    | Ruolo                      | Ente            | Esito atteso                                                 |
| ----- | ------------------------- | ----------- | -------------------------- | --------------- | ------------------------------------------------------------ |
| TF-01 | verifica                  | valida      | Automobilista, ammesso     | non applicabile | autorizzato                                                  |
| TF-02 | verifica                  | valida      | Ausiliario, ammesso        | lo stesso       | autorizzato                                                  |
| TF-03 | verifica                  | valida      | Ausiliario, ammesso        | un altro ente   | errore `ENTE_NON_AMMESSO`                                    |
| TF-04 | verifica                  | valida      | Automobilista, non ammesso | –               | errore `RUOLO_NON_AMMESSO`                                   |
| TF-05 | verifica                  | valida      | Amministratore, ammesso    | qualsiasi ente  | autorizzato                                                  |
| TF-06 | verifica                  | scaduta     | –                          | –               | errore `SESSIONE_NON_VALIDA`                                 |
| TF-07 | verifica                  | inesistente | –                          | –               | errore `SESSIONE_NON_VALIDA`                                 |
| TF-08 | ausiliariDellEntePreposto | –           | –                          | con Ausiliari   | solo gli Ausiliari attivi dell'ente (escluso il disattivato) |
| TF-09 | ausiliariDellEntePreposto | –           | –                          | senza Ausiliari | elenco vuoto                                                 |
