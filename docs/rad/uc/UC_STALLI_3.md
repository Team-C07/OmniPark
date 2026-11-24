# UC_STALLI_3: Salvare uno stallo o un'area tra i preferiti

- **Package:** NAV - Stalli e navigazione
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Ritrovare rapidamente gli stalli o le aree di sosta che usa più spesso.
- **Rilevanza:** Media (`RF_STALLI_3`)
- **Frequenza stimata:** Circa 20 salvataggi/giorno
- **Extension point:** Nessuno

## Entry condition

L'Automobilista, autenticato, dalla scheda di uno stallo chiede di salvare tra i preferiti lo stallo o la sua area di sosta (cfr. `MU_2`).

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Sceglie se salvare lo stallo o l'area di sosta a cui appartiene e conferma (cfr. `MU_2`).
2. **Sistema:** Verifica che lo stallo o l'area non sia già tra i preferiti.
3. **Sistema:** Lo salva tra i preferiti e conferma (cfr. `MU_2`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Lo stallo o l'area è già tra i preferiti: il Sistema ne informa l'Automobilista e il caso d'uso termina (**On success**).
- **3.a1:** Il salvataggio non riesce: il Sistema ne informa l'Automobilista (**On failure**).

## Exit condition

- **On success:** Lo stallo o l'area di sosta è tra i preferiti dell'Automobilista.
- **On failure:** I preferiti non cambiano e l'Automobilista ne è informato.
