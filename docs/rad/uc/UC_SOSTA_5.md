# UC_SOSTA_5: Dichiarare il permesso per uno stallo riservato

- **Package:** SOSTA - Sosta
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Poter sostare nello stallo riservato a cui ha diritto.
- **Rilevanza:** Media (`RF_SOSTA_5`)
- **Frequenza stimata:** Circa 120 dichiarazioni/giorno
- **Relazioni:** Estende `UC_SOSTA_1` nel punto di estensione `Permesso dello stallo riservato`.
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Il Sistema raccoglie dichiarazione e foto ma non ne verifica l'autenticità: la verifica sul posto spetta all'Ausiliario del Traffico (`UC_OP_5`).

## Entry condition

`UC_SOSTA_1` raggiunge il punto di estensione `Permesso dello stallo riservato`, perché lo stallo è riservato a permesso esposto, e il Sistema chiede all'Automobilista la dichiarazione e la foto del permesso richiesto dal tipo di stallo (cfr. `MU_2`).

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Dichiara di esporre il permesso richiesto e carica la foto del permesso esposto.
2. **Sistema:** Verifica che la dichiarazione sia presente e che la foto sia un'immagine valida.
3. **Sistema:** Associa dichiarazione e foto alla sosta che si sta avviando e il flusso torna a `UC_SOSTA_1`.

## Flussi alternativi (Eccezioni)

- **1.a1:** L'Automobilista annulla: la sosta non è avviata (**On failure**).
- **2.a1:** Manca la dichiarazione oppure la foto manca o non è un'immagine valida: il Sistema lo segnala e si torna al passo 1.

## Exit condition

- **On success:** La dichiarazione e la foto del permesso sono associate alla sosta che si sta avviando e il flusso torna a `UC_SOSTA_1`.
- **On failure:** Senza dichiarazione e foto la sosta non è avviata.

## Special requirements

- **NRF_LEG_2:** Il Sistema non memorizza nel profilo dell'Automobilista informazioni sulla titolarità di permessi; la dichiarazione e la foto sono associate alla singola sosta ed eliminate al suo termine.
