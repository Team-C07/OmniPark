# UC_ADM_1: Consultare il riepilogo di un ente cliente

- **Package:** ADM - Amministrazione
- **Attori partecipanti:** Amministratore (principale)
- **Interesse dell'attore:** Controllare l'andamento del servizio presso ciascun ente cliente.
- **Rilevanza:** Media (RF_ADM_1)
- **Frequenza stimata:** Circa 5 usi/giorno
- **Extension point:** Nessuno

## Regole di dominio e contesto

- Il riepilogo è in sola lettura: mostra il numero di stalli gestiti, di soste attive e di segnalazioni aperte.
- Per «segnalazioni aperte» nel riepilogo si intendono tutte quelle non ancora chiuse (quindi sia `Aperta` sia `Presa in carico`).

## Entry condition

Questo caso d'uso inizia quando l'Amministratore, autenticato, richiede il riepilogo degli enti clienti.

## Flusso di eventi (Scenario principale)

1. **Amministratore:** Richiede il riepilogo degli enti clienti.
2. **Sistema:** Mostra l'elenco degli enti clienti (cfr. `MU_5`).
3. **Amministratore:** Seleziona un ente cliente.
4. **Sistema:** Mostra il numero di stalli gestiti, di soste attive e di segnalazioni aperte dell'ente selezionato (cfr. `MU_5`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Non ci sono enti clienti: il Sistema ne informa l'Amministratore e il caso d'uso termina (**On success**).
- **4.a1:** Le informazioni dell'ente non sono disponibili: il Sistema informa l'Amministratore che il riepilogo non può essere completato (**On failure**).
- **4.a2:** L'Amministratore seleziona un altro ente cliente: si torna al passo 3.

## Exit condition

- **On success:** L'Amministratore ha consultato, per l'ente cliente scelto, il numero di stalli gestiti, di soste attive e di segnalazioni aperte, senza modificare alcun dato.
- **On failure:** Il riepilogo non è disponibile e l'Amministratore ne è informato.

## Special requirements

- **NRF_USA_1:** La schermata di panoramica degli enti (`MU_5`) non presenta violazioni dei livelli A e AA delle WCAG 2.2 rilevabili da uno strumento automatico di verifica.
