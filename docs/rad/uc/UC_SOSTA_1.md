# UC_SOSTA_1: Avviare la sosta in uno stallo occupato

- **Package:** SOSTA - Sosta
- **Attori partecipanti:** Automobilista (principale)
- **Interesse dell'attore:** Regolarizzare la sosta del proprio veicolo pagando con il wallet virtuale.
- **Rilevanza:** Elevata (`RF_SOSTA_1`, `RF_SOSTA_6`, `RF_WALLET_2`)
- **Frequenza stimata:** Circa 3.600 soste/giorno
- **Extension point:**
  - `Permesso dello stallo riservato` (dopo il passo 2): <se lo stallo è riservato a permesso esposto, `UC_SOSTA_5`>
  - `Credito insufficiente` (al passo 5): <se il credito non basta e l'Automobilista sceglie di ricaricare, `UC_WALLET_1`>

## Regole di dominio e contesto

- La sosta si avvia per uno stallo che il sensore rileva `Occupato`, con una targa del profilo e una durata entro il massimo previsto dalla tariffa dello stallo.
- L'importo è calcolato sulla parte di durata che cade nella fascia a pagamento.
- Negli stalli per persone con disabilità la sosta è gratuita (`RD_06`); negli stalli rosa si paga la tariffa come negli altri (`RD_07`).

## Entry condition

L'Automobilista, autenticato, seleziona lo stallo `Occupato` dal proprio veicolo e chiede di avviare la sosta (cfr. `MU_2`).

## Flusso di eventi (Scenario principale)

1. **Automobilista:** Sceglie una targa del profilo e la durata della sosta (cfr. `MU_2`).
2. **Sistema:** Verifica che lo stallo sia `Occupato`, che la durata non superi la durata massima dello stallo e che per la targa non ci sia già una sosta `Attiva`.
3. **Sistema:** Calcola l'importo secondo la tariffa dello stallo e mostra importo e orario di scadenza (cfr. `MU_2`).
4. **Automobilista:** Conferma l'avvio e il pagamento.
5. **Sistema:** Verifica che il credito del wallet sia sufficiente e addebita l'importo.
6. **Sistema:** Registra la sosta come `Attiva`, imposta lo stallo su `Non disponibile` e conferma l'orario di scadenza (cfr. `MU_2`).

## Flussi alternativi (Eccezioni)

- **2.a1:** Lo stallo non è `Occupato` (`Libero`, `Non disponibile` o `Sconosciuto`): il Sistema non consente l'avvio (**On failure**).
- **2.a2:** La durata supera la durata massima dello stallo: il Sistema lo segnala e si torna al passo 1.
- **2.a3:** Per la targa esiste già una sosta `Attiva`: il Sistema ne informa l'Automobilista (**On failure**).
- **2.a4:** Lo stallo è riservato a permesso esposto: nel punto di estensione `Permesso dello stallo riservato` si esegue extend (`UC_SOSTA_5`); se si conclude, si prosegue dal passo 3 con importo `0,00 €` negli stalli per persone con disabilità e con la tariffa dello stallo negli stalli rosa; altrimenti la sosta non è avviata (**On failure**).
- **4.a1:** L'Automobilista annulla: nessuna sosta è avviata (**On failure**).
- **5.a1:** Il credito non è sufficiente: il Sistema non addebita l'importo e propone la ricarica. Nel punto di estensione `Credito insufficiente` l'Automobilista può eseguire extend (`UC_WALLET_1`) e si torna al passo 4; se rinuncia, la sosta non è avviata (**On failure**).

## Exit condition

- **On success:** Per la targa scelta esiste una sosta `Attiva` con orario di scadenza, l'importo è addebitato sul wallet e registrato come movimento, lo stallo è `Non disponibile`.
- **On failure:** Nessuna sosta è avviata, nessun importo è addebitato e lo stato dello stallo non cambia.

## Special requirements

- **NRF_USA_2:** L'Automobilista avvia e paga la sosta con al massimo 3 interazioni dalla schermata principale.
- **NRF_LEG_1:** L'importo applica tariffe, fasce orarie ed esenzioni del tipo di stallo.
- **NRF_AFF_3:** Una sosta confermata non va persa in caso di interruzione o riavvio del servizio.
- **NRF_USA_1:** La schermata di avvio della sosta non presenta violazioni dei livelli A e AA delle WCAG 2.2 rilevabili da uno strumento automatico.
