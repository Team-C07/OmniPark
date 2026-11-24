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
npm run dev
```

Su Windows (PowerShell) al posto di `cp` si usa `Copy-Item .env.example .env`. L'applicazione è su http://localhost:3000 e si arresta con `Ctrl + C`.

Il file `.env` contiene la variabile `DATABASE_URL`. Per ora il valore di esempio basta: lint, test e build non si collegano al database. La connessione a PostgreSQL 17 su Neon e i comandi del database arrivano con il task del database (OMP-31), che aggiornerà questa sezione. Il file `.env` è ignorato da Git e non va mai condiviso: nel repository c'è solo `.env.example`.

## Comandi

| Comando                 | Cosa fa                                     |
| :---------------------- | :------------------------------------------ |
| `npm run dev`           | avvia l'app in sviluppo                     |
| `npm run lint`          | analisi statica con ESLint                  |
| `npm run format`        | formatta i file con Prettier                |
| `npm run format:check`  | controlla la formattazione                  |
| `npm test`              | esegue tutti i test una volta               |
| `npm run test:watch`    | riesegue i test durante lo sviluppo         |
| `npm run test:coverage` | test con report di copertura in `coverage/` |
| `npm run build`         | build di produzione                         |

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
