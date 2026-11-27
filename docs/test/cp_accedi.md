# cp_accedi

Specifica dei casi di test (category partition) del servizio Autenticazione, operazioni `accedi(email, password)` ed `esci(sessione)`.
Requisito: RF_AUTH_4 (accesso e uscita dal sistema).

## Parametri e ambiente

- `email`, `password`: credenziali dell'utente.
- `sessione`: token restituito da `accedi`.
- Ambiente: nel database di test esistono un Automobilista, un Ausiliario attivo, un Ausiliario disattivato e un Amministratore.

## Categorie e scelte: accedi

**Account**

1. Automobilista
2. Ausiliario del Traffico attivo
3. Ausiliario del Traffico disattivato [error]
4. Amministratore
5. inesistente [error]

**Password**

1. corretta
2. errata [error]

## Categorie e scelte: esci

**Sessione**

1. valida
2. inesistente o già chiusa [single]

## Frame ed esiti attesi

| Frame | Operazione | Account                | Password / Sessione      | Esito atteso                                                                            |
| ----- | ---------- | ---------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| TF-01 | accedi     | Automobilista          | corretta                 | sessione aperta, ruolo `AUTOMOBILISTA`                                                  |
| TF-02 | accedi     | Ausiliario attivo      | corretta                 | sessione aperta, ruolo `AUSILIARIO_DEL_TRAFFICO` con il suo ente                        |
| TF-03 | accedi     | Amministratore         | corretta                 | sessione aperta, ruolo `AMMINISTRATORE`                                                 |
| TF-04 | accedi     | Automobilista          | errata                   | errore `CREDENZIALI_NON_VALIDE`, nessuna sessione                                       |
| TF-05 | accedi     | inesistente            | –                        | errore `CREDENZIALI_NON_VALIDE` (stesso errore della password errata), nessuna sessione |
| TF-06 | accedi     | Ausiliario disattivato | corretta                 | errore `ACCOUNT_DISATTIVATO`, nessuna sessione                                          |
| TF-07 | esci       | –                      | valida                   | sessione chiusa; usata dopo l'uscita risulta `SESSIONE_NON_VALIDA`                      |
| TF-08 | esci       | –                      | inesistente o già chiusa | nessun errore, nessun effetto                                                           |

Con password errata un Ausiliario disattivato riceve `CREDENZIALI_NON_VALIDE`: lo stato dell'account si rivela solo a chi conosce la password.
