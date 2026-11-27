# cp_targhe

Specifica dei casi di test (category partition) del servizio Targhe, operazioni `aggiungiTarga(automobilista, targa)` e `rimuoviTarga(automobilista, targa)`.
Requisito: RF_AUTH_5 (targhe dell'Automobilista).

## Parametri e ambiente

- `automobilista`: identificativo dell'Automobilista.
- `targa`: normalizzata prima dell'uso (maiuscole, senza spazi).
- Ambiente: l'Automobilista ha una o due targhe nel profilo; un altro Automobilista ha una targa propria.

## Categorie e scelte: aggiungiTarga

**Targa**

1. valida, mai registrata
2. valida, scritta con minuscole e spazi [single]
3. valida, nel profilo di un altro Automobilista [single]
4. già nel proprio profilo [error]
5. non valida [error]

## Categorie e scelte: rimuoviTarga

**Targa rispetto al profilo**

1. presente, il profilo ne ha almeno un'altra
2. unica targa del profilo [error]
3. non presente nel profilo [error]
4. presente, con il veicolo in una sosta Attiva [error] (UC_AUTH_5, SD_AUTH_5)

## Frame ed esiti attesi

| Frame | Operazione    | Targa                                                               | Esito atteso                                                          |
| ----- | ------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| TF-01 | aggiungiTarga | mai registrata                                                      | targa aggiunta al profilo                                             |
| TF-02 | aggiungiTarga | minuscole e spazi                                                   | targa aggiunta normalizzata                                           |
| TF-03 | aggiungiTarga | di un altro Automobilista                                           | targa aggiunta; il veicolo resta anche nel profilo dell'altro         |
| TF-04 | aggiungiTarga | già nel proprio profilo                                             | errore `TARGA_GIA_PRESENTE`, profilo invariato                        |
| TF-05 | aggiungiTarga | non valida                                                          | errore `TARGA_NON_VALIDA`, profilo invariato                          |
| TF-06 | rimuoviTarga  | presente, non unica                                                 | targa tolta dal profilo; il veicolo resta nel database per lo storico |
| TF-07 | rimuoviTarga  | unica targa                                                         | errore `ULTIMA_TARGA`, profilo invariato                              |
| TF-08 | rimuoviTarga  | non presente                                                        | errore `TARGA_NON_PRESENTE`, profilo invariato                        |
| TF-09 | rimuoviTarga  | veicolo in sosta Attiva, anche se avviata da un altro Automobilista | errore `TARGA_CON_SOSTA_ATTIVA`, profilo invariato                    |
