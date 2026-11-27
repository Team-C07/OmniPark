# cp_autorizzaPagamento — specifica di prova (category partition)

Servizio «Pagamento simulato» del sottosistema Simulatori (SDD, par. 3.2). Requisiti: RF_WALLET_1 (ricarica simulata), RD_04 (nessuna transazione reale).

## Servizio

`autorizzaPagamento(automobilista, importo)`: autorizza un pagamento di `importo` centesimi per l'automobilista indicato e restituisce `APPROVATO` oppure `RIFIUTATO`. Un importo non intero o non positivo non è un rifiuto ma un errore di input: la promise restituita dal servizio è rifiutata con un errore di dominio con codice `IMPORTO_NON_VALIDO`.

Configurazione usata nei frame (ambiente):

- soglia massima: 10.000 centesimi (100 €);
- automobilisti di prova: `"9999"`;
- latenza simulata: 0 ms, salvo dove il frame dice altrimenti.

File di test da creare: `src/simulators/pagamento/autorizzaPagamento.test.ts`.

## Categorie e scelte

| Parametro / ambiente | Categoria      | Scelte                                                                                                                                   |
| :------------------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| importo              | valore         | zero [error] · negativo [error] · non intero [error] · 1 centesimo [single] · intermedio · uguale alla soglia [single] · oltre la soglia |
| automobilista        | tipo           | ordinario · di prova [single]                                                                                                            |
| latenza              | configurazione | assente · configurata [single]                                                                                                           |

Vincoli: le scelte [error] e [single] compaiono in un solo frame; nei frame [error] l'automobilista è ordinario e la latenza assente.

## Test frame

| Frame | importo               | automobilista       | latenza                 | Esito atteso                     |
| :---- | :-------------------- | :------------------ | :---------------------- | :------------------------------- |
| TF-01 | 0                     | ordinario (`"1"`)   | assente                 | errore `IMPORTO_NON_VALIDO`      |
| TF-02 | -500                  | ordinario (`"1"`)   | assente                 | errore `IMPORTO_NON_VALIDO`      |
| TF-03 | 150.5                 | ordinario (`"1"`)   | assente                 | errore `IMPORTO_NON_VALIDO`      |
| TF-04 | 1                     | ordinario (`"1"`)   | assente                 | `APPROVATO`                      |
| TF-05 | 2000 (taglio da 20 €) | ordinario (`"1"`)   | assente                 | `APPROVATO`                      |
| TF-06 | 10000                 | ordinario (`"1"`)   | assente                 | `APPROVATO`                      |
| TF-07 | 10001                 | ordinario (`"1"`)   | assente                 | `RIFIUTATO`                      |
| TF-08 | 1000                  | di prova (`"9999"`) | assente                 | `RIFIUTATO`                      |
| TF-09 | 1000                  | ordinario (`"1"`)   | 500 ms (orologio finto) | `APPROVATO`, non prima di 500 ms |

Nomi dei test: `RF_WALLET_1 · TF-07 · importo oltre la soglia → RIFIUTATO`.
