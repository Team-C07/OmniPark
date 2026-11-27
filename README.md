# OmniPark

Prototipo di un servizio per la gestione della sosta urbana: mappa degli stalli in tempo reale, avvio e pagamento della sosta con wallet simulato, segnalazioni per gli Ausiliari del Traffico e gestione degli enti. Sensori IoT, telecamere ANPR e pagamenti sono simulati.

**Stack:** Next.js 16 · TypeScript · PostgreSQL 17 · Vitest · Node.js 26.13.0

**Stato:** ambiente di sviluppo, documentazione di analisi e regole per gli agenti pronti; sottosistemi in sviluppo.

## Avvio rapido

### Prerequisiti

| Strumento | Versione                                           |
| :-------- | :------------------------------------------------- |
| Git       | qualsiasi versione recente                         |
| Node.js   | 26.13.0, indicata in `.nvmrc` (con nvm: `nvm use`) |
| npm       | 11.x, incluso con Node.js 26                       |

### Installazione e avvio

```bash
git clone https://github.com/Team-C07/OmniPark.git
cd OmniPark
nvm use
npm ci
cp .env.example .env
# in .env: imposta DATABASE_URL, lascia OMNIPARK_AMBIENTE al valore segnaposto
npm run db:migrate
npm run dev
```

Su Windows (PowerShell) al posto di `cp` si usa `Copy-Item .env.example .env`. L'applicazione è su http://localhost:3000 e si arresta con `Ctrl + C`.

**Connessione al database.** Il database è PostgreSQL 17 su Neon. Lo sviluppo usa un unico database condiviso da tutto il team: il database `omnipark` del branch Neon `dev-teamc07`. La produzione è sul branch Neon `production`. L'applicazione e i comandi del database leggono la connessione solo da `DATABASE_URL`, nel file `.env`:

- usa la stringa **pooled** del branch `dev-teamc07` (host con `-pooler`);
- la stringa copiata da Neon termina con `?sslmode=require&channel_binding=require`: sostituiscila con `?sslmode=verify-full`;
- lascia `OMNIPARK_AMBIENTE` al valore segnaposto di `.env.example`, così `db:reset` resta bloccato.

I valori reali li distribuiscono i PM. Le credenziali del database di produzione le hanno solo i PM. Il file `.env` è ignorato da Git e non va mai condiviso: nel repository c'è solo `.env.example`, con i nomi delle variabili e valori segnaposto. Lint, test e build non si collegano al database e non richiedono `DATABASE_URL`.

Questa configurazione vale per lo sviluppo in locale. Anteprime e produzione su Vercel usano database diversi: vedi «Ambienti e pubblicazione».

**Migrazioni.** `npm run db:migrate` applica in ordine i file di `src/persistence/migrations/` non ancora applicati e li registra nella tabella `registro_migrazioni`. Se il database è aggiornato non fa nulla e lo dice. Poiché il database di sviluppo è condiviso, `db:migrate` su di esso si esegue solo dal branch `main` aggiornato, quindi solo con migrazioni già integrate. Una migrazione nuova si prova sul database di test (issue #5) oppure, finché non esiste, su un branch Neon temporaneo creato dai PM. Se il database condiviso si blocca, un PM esegue `db:reset` da `main`. Regole per i file:

- nome `NNNN_descrizione.sql`: 4 cifre da `0001`, descrizione in minuscolo con parole separate da `_`, versioni senza duplicati e successive all'ultima applicata;
- le migrazioni sono immutabili: una migrazione integrata nel `main` non si modifica, ogni cambiamento va in una nuova migrazione (il comando si blocca se il checksum di una migrazione applicata non corrisponde più al file);
- ogni file viene eseguito in una transazione insieme alla sua registrazione: non scrivere `BEGIN` o `COMMIT` nel file;
- le connessioni passano dal pooler di Neon in modalità transaction: niente stato di sessione, quindi niente `SET` fuori transazione (usa `SET LOCAL`), `LISTEN`/`NOTIFY` o `CREATE INDEX CONCURRENTLY`.

**Reset.** `npm run db:reset` elimina e ricrea lo schema `public` (con proprietario e privilegi predefiniti) e riapplica tutte le migrazioni: **tutti i dati del database vengono cancellati**, per tutto il team. Per questo `db:reset` lo eseguono solo i PM, dopo aver avvisato il team. Prima di agire il comando mostra host e nome del database. Parte solo se `OMNIPARK_AMBIENTE` vale `sviluppo` o `test`, e rifiuta comunque se è impostata `VERCEL_ENV` o se `NODE_ENV` vale `production`.

**Dati di esempio.** Il dataset dimostrativo è la migrazione `0002_dati_esempio.sql`: arriva con `db:migrate` ed è ricreato identico da `db:reset`, in tutti gli ambienti. Contiene tre enti (Gragnano, Fisciano, Baronissi) con aree, tariffe e 30 stalli su vie reali, un amministratore, cinque ausiliari (uno disattivato), cinque automobilisti con targhe e credito, e uno storico di soste, movimenti, verifiche e segnalazioni a date fisse. Non contiene soste in corso né stalli `Non disponibile`: li creano i simulatori e i test. Limite noto: lo stato `Libero` od `Occupato` degli stalli si basa su un'ultima rilevazione fissa (15/11/2026); con il timeout di 60 secondi di RF_IOT_2 gli stalli risultano `Sconosciuti` finché i simulatori dei sensori non inviano nuove rilevazioni.

**Database di test.** I test sul database (`npm run test:db`) usano un database personale sul branch Neon `dev-teamc07`, con nome `omnipark_<nome>_test`, indicato nella variabile `DATABASE_URL_TEST` del file `.env` (stringa pooled con `sslmode=verify-full`, come `DATABASE_URL`). All'inizio di ogni file di test il database viene ricreato con schema e dati di esempio, e ogni test gira in una transazione annullata alla fine: i dati di sviluppo non vengono mai toccati. Il comando rifiuta di partire se `DATABASE_URL_TEST` manca, se il nome del database non finisce con `_test` o se indica lo stesso database di `DATABASE_URL`. `npm test` e la CI non usano il database.

**Credenziali dimostrative.** Valgono solo per i dati di esempio. La password dell'amministratore (`marco.esposito@omnipark.example`) la comunicano i PM.

| Ruolo                    | Email                             | Ente      | Password                  |
| :----------------------- | :-------------------------------- | :-------- | :------------------------ |
| Ausiliario del Traffico  | `paolo.ferri@omnipark.example`    | Gragnano  | `Demo-Ausiliario-2026`    |
| Ausiliario del Traffico  | `sara.galli@omnipark.example`     | Gragnano  | `Demo-Ausiliario-2026`    |
| Ausiliario (disattivato) | `luca.russo@omnipark.example`     | Gragnano  | `Demo-Ausiliario-2026`    |
| Ausiliario del Traffico  | `anna.moretti@omnipark.example`   | Fisciano  | `Demo-Ausiliario-2026`    |
| Ausiliario del Traffico  | `giorgio.marino@omnipark.example` | Baronissi | `Demo-Ausiliario-2026`    |
| Automobilista            | `elena.bianchi@omnipark.example`  | —         | `Demo-Automobilista-2026` |
| Automobilista            | `marco.rossi@omnipark.example`    | —         | `Demo-Automobilista-2026` |
| Automobilista            | `luigi.verde@omnipark.example`    | —         | `Demo-Automobilista-2026` |
| Automobilista            | `giulia.romano@omnipark.example`  | —         | `Demo-Automobilista-2026` |
| Automobilista            | `davide.conte@omnipark.example`   | —         | `Demo-Automobilista-2026` |

## Comandi

| Comando                 | Cosa fa                                         |
| :---------------------- | :---------------------------------------------- |
| `npm run dev`           | avvia l'app in sviluppo                         |
| `npm run lint`          | analisi statica con ESLint                      |
| `npm run format`        | formatta i file con Prettier                    |
| `npm run format:check`  | controlla la formattazione                      |
| `npm test`              | esegue tutti i test una volta                   |
| `npm run test:watch`    | riesegue i test durante lo sviluppo             |
| `npm run test:coverage` | test con report di copertura in `coverage/`     |
| `npm run test:db`       | test sul database di test (`DATABASE_URL_TEST`) |
| `npm run build`         | build di produzione                             |
| `npm run db:migrate`    | applica le migrazioni non ancora applicate      |
| `npm run db:reset`      | ricrea lo schema e riapplica le migrazioni      |

## Ambienti e pubblicazione

| Ambiente   | Dove gira                            | Database (Neon)                                                         | Quando si aggiorna                                         |
| :--------- | :----------------------------------- | :---------------------------------------------------------------------- | :--------------------------------------------------------- |
| Locale     | `npm run dev`                        | branch `dev-teamc07`, database `omnipark` (condiviso dal team)          | a mano, con `db:migrate` da `main`                         |
| Anteprima  | Vercel, un indirizzo per ogni branch | branch `preview`, database `omnipark` (condiviso da tutte le anteprime) | a ogni push su un branch diverso da `main`, con o senza PR |
| Produzione | Vercel, dominio del progetto         | branch `production`, database `omnipark`                                | a ogni merge nel `main`                                    |

La pubblicazione è automatica con l'integrazione Git di Vercel. A ogni push Vercel esegue `npm run db:migrate && npm run build` (`vercel.json`): prima applica le migrazioni al database dell'ambiente, poi compila. Se una migrazione fallisce, la build fallisce e il deploy non va online: resta quello precedente. Le funzioni girano nella regione `fra1` (Francoforte), vicina a Neon (`eu-central-1`). L'app GitHub di Vercel pubblica nella PR il link all'anteprima e lo stato della build. `db:reset` non gira mai su Vercel: la guardia lo rifiuta quando è impostata `VERCEL_ENV`.

Le anteprime sono aperte, senza login di Vercel, perché le vedono il team e i docenti; i loro dati sono di prova e possono essere cancellati in qualsiasi momento.

Le stringhe di connessione di anteprima e produzione (pooled, con `sslmode=verify-full`) le impostano i PM nelle impostazioni di Vercel. Nel repository e nei segreti di GitHub non ci sono credenziali.

**Database delle anteprime condiviso.** Tutte le anteprime migrano lo stesso branch `preview`: anche un push senza PR crea un'anteprima e applica al branch `preview` le migrazioni del branch. Se le migrazioni di un branch non ancora integrato bloccano le build degli altri, nel log di build compare «Migrazione non riuscita» con uno di questi messaggi: «risulta applicata al database ma il file non esiste», «ha una versione inferiore all'ultima applicata» oppure «è stata modificata dopo essere stata applicata», seguito da «Database delle anteprime: … Un PM lo ripristina da production». In quel caso un PM ripristina il branch `preview` dal suo padre `production` dalla console di Neon e rilancia la build (Redeploy). Il ripristino cancella i dati di prova delle anteprime.

## Come si lavora

1. Un branch per task, con la chiave Jira nel nome: `OMP-<numero>-<descrizione>`. Mai lavorare su `main`.
2. Commit con la chiave Jira: `OMP-<numero>: descrizione`.
3. Ogni modifica entra con una Pull Request verso `main`, compilata secondo il modello in `.github/pull_request_template.md`.
4. La CI (`.github/workflows/ci.yml`) esegue installazione, lint, formattazione, test e build su ogni Pull Request: si integra solo con la CI verde.
5. Il merge richiede l'approvazione di un revisore diverso dall'autore.
6. Credenziali e stringhe di connessione non vanno mai nel repository.

### Sviluppo con agenti di programmazione

- Le regole per gli agenti sono in `AGENTS.md`; Claude Code le legge tramite `CLAUDE.md`.
- L'agente propone un piano e attende l'approvazione prima di modificare file.
- I test si scrivono con l'agente `.claude/agents/tester.md` a partire dalle specifiche `docs/test/cp_<servizio>.md`, senza leggere l'implementazione.
- Prima di aprire una Pull Request, l'agente `.claude/agents/revisore.md` confronta le modifiche con i modelli ed elenca le differenze.
- `.claude/settings.json` blocca le operazioni su issue e Pull Request e chiede conferma prima di commit, push e installazione di pacchetti.

## Documentazione

- Requisiti, casi d'uso e modelli di analisi: `docs/rad/` (indice dei requisiti in `docs/rad/requisiti.md`, tracciabilità in `docs/rad/tracciabilita.md`)
- Specifiche dei casi di test (category partition): `docs/test/`
- Regole per gli agenti: `AGENTS.md`

## Struttura

```text
.claude/            agenti con contesto separato e permessi
.github/            CI e modello delle Pull Request
docs/rad/           specifica di analisi
docs/test/          specifiche dei casi di test
src/app/            pagine e route API
src/presentation/   componenti dell'interfaccia
src/application/    logica dei casi d'uso, una cartella per sottosistema
src/persistence/    accesso ai dati (unico punto con SQL)
src/simulators/     simulatori di sensori, ANPR e pagamenti
src/lib/            codice provvisorio del setup iniziale
```
