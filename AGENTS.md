<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OmniPark

## Contesto

OmniPark è il prototipo di un servizio per la gestione della sosta urbana: mappa degli stalli in tempo reale, avvio e pagamento della sosta con wallet simulato, segnalazioni automatiche per gli Ausiliari del Traffico, gestione degli enti da parte dell'Amministratore. Sensori IoT, telecamere ANPR e pagamenti sono simulati.

La specifica è in `docs/rad/`: requisiti, casi d'uso, class diagram, sequence diagram, statechart e navigation path. Il codice deve corrispondere a questi modelli.

## Stack e comandi

- Node.js 26.13.0 (versione in `.nvmrc`), npm.
- Next.js 16 (App Router) con React 19 e TypeScript strict. Questa versione di Next.js è diversa da quella che conosci: segui il blocco qui sopra.
- PostgreSQL 17 con il pacchetto `pg` e SQL esplicito, senza ORM. La connessione si legge solo dalla variabile `DATABASE_URL`.
- Vitest con copertura V8, ESLint, Prettier, Tailwind CSS 4.
- Pubblicazione prevista su Vercel. Le funzioni serverless non restano accese e non condividono memoria: niente `setInterval`, job in background o stato condiviso in variabili globali.

| Comando                 | Uso                                       |
| :---------------------- | :---------------------------------------- |
| `npm ci`                | installazione dalle versioni del lockfile |
| `npm run dev`           | avvio in sviluppo                         |
| `npm run lint`          | analisi statica                           |
| `npm run format:check`  | controllo della formattazione             |
| `npm run format`        | formattazione dei file                    |
| `npm test`              | tutti i test, una volta                   |
| `npm run test:coverage` | test con report di copertura              |
| `npm run build`         | build di produzione                       |

## Struttura del repository

- `docs/rad/`: specifica di analisi. `docs/test/`: specifiche dei casi di test `cp_<servizio>.md`.
- `src/app/`: pagine e route API sottili. Leggono la richiesta, controllano la sessione, chiamano il sottosistema e rispondono. Nessuna logica di dominio e nessun SQL.
- `src/presentation/`: componenti React riusabili.
- `src/application/<sottosistema>/`: logica dei casi d'uso, una cartella per sottosistema (`utenti-accessi`, `gestione-stalli`, `gestione-soste`, `wallet`, `segnalazioni`, `amministrazione`). Niente SQL: si passa dallo strato di persistenza.
- `src/persistence/`: unico punto con SQL (connessione, migrazioni, accesso ai dati).
- `src/simulators/`: simulatori di sensori, ANPR e pagamenti. Parlano con l'applicazione solo tramite le API.
- `src/lib/`: codice provvisorio della configurazione iniziale. non aggiungere codice provvisorio in `src/lib/`; tutto il codice SQL e le migrazioni risiedono in `src/persistence/`. Non prenderli come modello e non aggiungere codice in `src/lib/`.
- I test stanno accanto al codice che verificano, con nome `*.test.ts` (configurazione in `vitest.config.ts`).

## Convenzioni

- Nomi di classi, attributi, operazioni e stati come in `docs/rad/class_analisi.puml`, nei casi d'uso e nei sequence diagram, in italiano. Nel codice TypeScript i nomi composti diventano camelCase (`occupazione rilevata` → `occupazioneRilevata`); nel database snake_case.
- Ruoli di boundary, control ed entity e direzione delle chiamate come in `docs/rad/sequence/convenzioni_bce.md`.
- Importi sempre in centesimi interi, per evitare errori di arrotondamento. Date e ore con fuso orario.
- Errori delle API in JSON nella forma `{ errore: { codice, messaggio } }`, con messaggi in italiano comprensibili all'utente.
- Test: un test per ogni test frame, con requisito e frame nel nome, per esempio `RF_SOSTA_1 · TF-07 · durata oltre il massimo → DURATA_NON_VALIDA`. L'esito atteso viene dal caso d'uso, non dal codice.
- Branch `OMP-<numero>-<descrizione>`, commit `OMP-<numero>: descrizione`.
- Se l'implementazione richiede di cambiare un modello in `docs/`, la modifica va nello stesso branch del codice, dopo l'approvazione.

## Regole

### Sempre

- Leggi i documenti indicati nel task prima di scrivere codice, e solo quelli che servono.
- Prima di modificare file proponi un piano: file da creare o modificare, metodi con le firme, test frame da coprire. Attendi l'approvazione esplicita.
- Usa i nomi dei modelli e rispetta `docs/rad/sequence/convenzioni_bce.md`.
- Scrivi SQL solo in `src/persistence/`.
- Lavora solo nel branch del task.
- Esegui `npm run lint`, `npm run format:check` e `npm test` prima di dichiarare concluso il lavoro.
- Fermati e chiedi se la specifica è incompleta, se due modelli sono in contrasto tra loro o se lo stesso errore persiste dopo 3 tentativi. Riporta cosa hai trovato invece di scegliere da solo.

### Chiedi prima

- Classi, attributi o metodi che non sono nel class diagram o nei sequence diagram.
- In quale sottosistema collocare il codice, finché il documento dei sottosistemi dell'SDD non è nel repository.
- Modifiche allo schema del database.
- Nuove dipendenze npm: vanno verificate (esistenza, manutenzione, licenza) prima dell'installazione.
- Modifiche fuori dall'ambito del piano approvato, compresi i file in `docs/`.
- Modifiche alla configurazione: `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.github/`, `package.json`, file di configurazione degli strumenti.

### Mai

- Operare su issue o Pull Request: crearle, modificarle, commentarle o chiuderle.
- Eseguire commit o push senza una richiesta esplicita nella sessione. Mai push su `main`.
- Modificare, disattivare o cancellare test esistenti per farli passare.
- Inserire credenziali, stringhe di connessione o dati personali reali nel codice, nei test o nei log. Non leggere i file `.env`.
- Implementare i requisiti rinviati o rifiutati elencati in fondo a `docs/rad/requisiti.md`.

## Quando un task è finito

- `npm run lint`, `npm run format:check`, `npm test` e `npm run build` terminano senza errori.
- Ogni test frame indicato nel task ha un test e i test passano.
- Nessun file è stato modificato fuori dal piano approvato.
- Le modifiche ai modelli, se approvate, sono nello stesso branch.
- Hai riassunto: file modificati, test frame coperti, tentativi falliti, punti aperti.

## Documenti di riferimento

Da leggere quando il task li indica, non tutti insieme.

- Requisiti approvati e rinviati: `docs/rad/requisiti.md`
- Tracciabilità requisiti → casi d'uso → sequence diagram: `docs/rad/tracciabilita.md`
- Casi d'uso: `docs/rad/uc/UC_<AREA>_<N>.md`
- Class diagram d'analisi: `docs/rad/class_analisi.puml`. Vincoli e attributi derivati: `docs/rad/vincoli_dominio.md`
- Sequence diagram: `docs/rad/sequence/sd_<area>_<n>.puml`, con `docs/rad/sequence/convenzioni_bce.md`
- Statechart di stallo, sosta e segnalazione: `docs/rad/statechart/scd_*.puml`, con `docs/rad/statechart/sincronizzazione_eventi.md`
- Navigation path: `docs/rad/navigation/np_*.puml`. Scenari: `docs/rad/scenari_ut.md`, `docs/rad/scenari_op_adm.md`
- Specifiche dei casi di test: `docs/test/cp_<servizio>.md`
- Agenti con contesto separato: `.claude/agents/tester.md` (test dai test frame), `.claude/agents/revisore.md` (confronto del codice con i modelli)
