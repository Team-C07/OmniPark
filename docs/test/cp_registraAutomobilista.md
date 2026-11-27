# cp_registraAutomobilista

Specifica dei casi di test (category partition) del servizio Autenticazione, operazione `registraAutomobilista(email, password, targa)`.
Requisito: RF_AUTH_1 (registrazione dell'Automobilista), RF_AUTH_5 (targhe dell'Automobilista).

## Parametri e ambiente

- `email`: indirizzo con cui l'Automobilista accede.
- `password`: password in chiaro, salvata solo come hash.
- `targa`: prima targa del profilo, normalizzata prima dell'uso (maiuscole, senza spazi).
- Ambiente: utenti e veicoli già presenti nel database di test.

## Categorie e scelte

**Email**

1. nuova
2. già registrata [error]
3. formato non valido [error]

**Password**

1. meno di 8 caratteri [error]
2. esattamente 8 caratteri
3. più di 8 caratteri

**Targa**

1. valida, mai registrata
2. valida, scritta con minuscole e spazi [single]
3. non valida [error]
4. valida, già nel profilo di un altro Automobilista [single]

**Scrittura nel database**

1. riuscita
2. fallita durante la creazione del wallet [single]

## Frame ed esiti attesi

| Frame | Email              | Password      | Targa / Scrittura                            | Esito atteso                                                                                     |
| ----- | ------------------ | ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| TF-01 | nuova              | più di 8      | mai registrata                               | account Automobilista creato, targa nel profilo, wallet con saldo 0, sessione aperta (UC_AUTH_1) |
| TF-02 | nuova              | esattamente 8 | mai registrata                               | account creato                                                                                   |
| TF-03 | nuova              | più di 8      | minuscole e spazi                            | account creato, targa salvata normalizzata                                                       |
| TF-04 | nuova              | più di 8      | già di un altro Automobilista                | account creato; il veicolo è lo stesso nei due profili                                           |
| TF-05 | già registrata     | –             | –                                            | errore `EMAIL_GIA_REGISTRATA`, nessun dato scritto                                               |
| TF-06 | formato non valido | –             | –                                            | errore `EMAIL_NON_VALIDA`, nessun dato scritto                                                   |
| TF-07 | nuova              | meno di 8     | –                                            | errore `PASSWORD_TROPPO_CORTA`, nessun dato scritto                                              |
| TF-08 | nuova              | più di 8      | non valida                                   | errore `TARGA_NON_VALIDA`, nessun dato scritto                                                   |
| TF-09 | nuova              | più di 8      | mai registrata, scrittura del wallet fallita | errore del database, nessun dato scritto (né utente, né targa, né sessione)                      |

Le scelte [error] si provano una sola volta, con le altre categorie a un valore valido. «Nessun dato scritto» significa: nessun utente, nessuna associazione con la targa, nessun wallet e nessuna sessione. Il formato valido della targa è AB123CD (due lettere, tre cifre, due lettere).
