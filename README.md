# 🅿️ OmniPark

**Sistema prototipale per la gestione della sosta**
**Stack:** Next.js · TypeScript · PostgreSQL · Docker

> **Stato del progetto:** setup iniziale disponibile. La struttura dei sottosistemi (SDD-01), i dati di esempio e il simulatore non sono ancora definiti o completati.

## 📑 Indice

- [Avvio rapido](#-avvio-rapido)
- [Prerequisiti](#-prerequisiti)
- [Installazione passo per passo](#-installazione-passo-per-passo)
- [Comandi utili](#-comandi-utili)
- [Workflow Git e Jira](#-workflow-git-e-jira)
- [Definition of Done](#-definition-of-done)
- [Scelte tecniche](#-scelte-tecniche)
- [Struttura del progetto](#-struttura-del-progetto)
- [Attività ancora aperte](#-attività-ancora-aperte)

---

## 🚀 Avvio rapido

**Dopo aver clonato il repository e predisposto `.env`:**

```powershell

npm ci
docker compose up -d
npm run dev

```

- **Applicazione:** http://localhost:3000
- **Verifica database:** http://localhost:3000/api/health/db
- **Arresto di Next.js:** `Ctrl + C`
- **Arresto di PostgreSQL:** `docker compose down` (non cancella i dati)

Se è la prima installazione, segui tutti i passaggi della sezione seguente.

---

## ✅ Prerequisiti

| Strumento | Versione / indicazione |
| **Git** | Installato |
| **Node.js** | **22.23.4**, indicata in `.nvmrc` e `package.json` |
| **npm** | Gestore dipendenze; nel setup iniziale: **10.9.9** |
| **Docker + Compose** | Docker Desktop o Docker Engine, con motore attivo |
| **Editor** | Consigliato Visual Studio Code |

Controlla l'ambiente dal terminale:

```powershell

node -v
npm -v
docker --version
docker compose version
docker info

```

> PostgreSQL **non** va installato separatamente: viene avviato in un container Docker. Il file `.nvmrc` **non cambia automaticamente** la versione di Node.js installata.

---

## 🛠️ Installazione passo per passo

### 1. Clona il repository

```powershell

git clone https://github.com/Team-C07/OmniPark.git
cd OmniPark

```

Prima di modificare il codice, crea un **branch dedicato alla task**: non lavorare su `main`.

### 2. Controlla Node.js

```powershell

node -v

```

La versione richiesta è **22.23.4**. Se ne hai una diversa, installa o seleziona quella richiesta tramite il gestore di versioni Node adottato dal team.

### 3. Installa le dipendenze

```powershell

npm ci

```

`npm ci` usa il `package-lock.json` per installare le versioni concordate dal team.

### 4. Prepara le variabili d'ambiente

Crea il file locale `.env` a partire dal modello:

```powershell

Copy-Item .env.example .env

```

Apri `.env` e sostituisci il valore di esempio con una password **solo per lo sviluppo locale**:

```dotenv
POSTGRES_PASSWORD=la_tua_password_locale
DATABASE_URL="postgresql://omnipark:la_tua_password_locale@localhost:5432/omnipark"
```

**Regole importanti:**

- La password contenuta in `DATABASE_URL` deve corrispondere a `POSTGRES_PASSWORD`.
- Se la password contiene caratteri speciali, codificali correttamente nella URL.
- **Non inserire `.env` nel repository GitHub.** È ignorato da Git; `.env.example` invece va condiviso.
- Se il volume PostgreSQL è stato già inizializzato, cambiare `.env` **non aggiorna** automaticamente la password nel database esistente.

### 5. Avvia PostgreSQL

Avvia Docker Desktop, poi esegui:

```powershell

docker compose config --quiet
docker compose up -d
docker compose ps

```

Il servizio `db` deve risultare **healthy**. Per verificare che il database esista:

```powershell

docker compose exec db psql -U omnipark -d omnipark -c "SELECT current_database();"

```

**Risultato atteso:** `omnipark`.

Il database è accessibile sul computer tramite `127.0.0.1:5432`. I dati sono salvati nel volume Docker `postgres_data`.

### 6. Avvia Next.js

```powershell

npm run dev

```

Apri **http://localhost:3000**.

Per verificare il collegamento Next.js ↔ PostgreSQL, apri **http://localhost:3000/api/health/db**. In ambiente di sviluppo la risposta attesa è:

```json
{
  "status": "ok",
  "database": "omnipark"
}
```

> L'endpoint `/api/health/db` è diagnostico: la sua esposizione dovrà essere valutata prima di un eventuale rilascio pubblico.

### 7. Arresta l'ambiente

- **Next.js:** premi `Ctrl + C` nel terminale in cui esegue `npm run dev`.
- **PostgreSQL:** esegui `docker compose down`.
- **Attenzione:** `docker compose down -v` elimina anche il volume e quindi i dati locali: **non usarlo per un normale arresto**.

---

## 🧪 Comandi utili

| Comando                 | Cosa fa                                            |
| :---------------------- | :------------------------------------------------- |
| `npm run dev`           | Avvia l'app in modalità sviluppo                   |
| `npm run build`         | Verifica la build di produzione                    |
| `npm run lint`          | Controlla il codice con ESLint                     |
| `npm run format`        | Formatta i file con Prettier                       |
| `npm run format:check`  | Controlla la formattazione senza modificare i file |
| `npm test`              | Esegue tutti i test una volta                      |
| `npm run test:watch`    | Riesegue i test durante lo sviluppo                |
| `npm run test:coverage` | Esegue i test e genera il report V8                |
| `docker compose ps`     | Mostra lo stato dei container                      |

Il report HTML dei test viene salvato in `coverage/` e **non** deve essere aggiunto a Git.

**Coverage attuale:** la configurazione iniziale include soltanto `src/lib/**/*.ts`. I test di esempio dimostrano il funzionamento di Vitest, **non** il raggiungimento della soglia dell'80% richiesta da `NRF_SUP_3` sui componenti ad alta priorità.

---

## 🌿 Workflow Git e Jira

### Regole di collaborazione

1. **Un branch per task**, con la chiave Jira nel nome: per esempio `OMP-25-wallet`.
2. **Mai sviluppare direttamente su `main`.**
3. Ogni modifica entra attraverso una **Pull Request (PR)** verso `main`.
4. La PR deve spiegare **cosa cambia** e **come è stata verificata**.
5. La PR deve essere **approvata dal revisore assegnato alla task** prima del merge.
6. I commit devono essere chiari e limitati alla task svolta.

### Esempio di workflow

```powershell
git switch main
git pull origin main
git switch -c OMP-25-wallet

# Dopo le modifiche e i test:
git status
git add .
git commit -m "OMP-25: implementa wallet"
git push -u origin OMP-25-wallet
```

Poi apri una **Pull Request** su GitHub e richiedi la revisione.

> **Nota sui permessi:** puoi clonare e creare branch locali senza accesso Writer. Per pubblicare sul repository del team occorrono i permessi adeguati; altrimenti concorda con il PM l'utilizzo di un fork e di una PR. Controlla sempre `git status` prima di `git add .` per non includere file o credenziali indesiderate.

### Cosa scrivere nella Pull Request

```markdown
## Task Jira

OMP-XX — Titolo

## Modifiche

- Cosa è stato implementato

## Verifiche effettuate

- [ ] npm run lint
- [ ] npm run format:check
- [ ] npm test
- [ ] npm run test:coverage (quando pertinente)
- [ ] npm run build
- [ ] Test con dati di esempio
- [ ] Test con simulatore (quando disponibile e pertinente)

## Requisiti coperti

- RF_... — Test: ...

## Limiti / note

- ...

## Revisore

- ...
```

---

## ☑️ Definition of Done

Una **task di codice** è completata soltanto quando:

- [ ] La **Pull Request è stata approvata** dal revisore della task e integrata secondo il workflow del team.
- [ ] Per i **requisiti ad Alta priorità** interessati sono presenti test con l'**ID del requisito nel nome** (es. `RF_SOSTA_1 - avvio sosta`).
- [ ] I controlli pertinenti (`lint`, formattazione, test e build) sono superati.
- [ ] La funzionalità è stata verificata con **dati di esempio**.
- [ ] La funzionalità è stata verificata con il **simulatore** previsto, quando disponibile e applicabile; un test non eseguito non va dichiarato superato.
- [ ] Il **README è aggiornato** se cambiano installazione, configurazione, comandi o avvio.
- [ ] La PR riporta modifiche, requisiti coperti e prove svolte.

**Qualità dei test:** `NRF_SUP_3` richiede almeno **80% di coverage** per i componenti ad alta priorità. Il valore va misurato su quei componenti, non dedotto dai test dimostrativi del setup.

---

## 🧱 Scelte tecniche

| Tecnologia                | Motivazione                                                                |
| :------------------------ | :------------------------------------------------------------------------- |
| **Next.js 16**            | Frontend React e API/backend nello stesso progetto, senza backend separato |
| **TypeScript**            | Tipi statici per ridurre errori e facilitare lo sviluppo in team           |
| **PostgreSQL 17**         | Database relazionale persistente                                           |
| **Docker Compose**        | Avvio riproducibile del database con un comando                            |
| **Node.js 22.23.4 + npm** | Versione condivisa e dipendenze bloccate tramite `package-lock.json`       |
| **ESLint + Prettier**     | Stile coerente e controllo del codice                                      |
| **Vitest + V8 Coverage**  | Test automatici e misurazione della copertura                              |

### Documentazione ufficiale

- [Next.js — Documentazione](https://nextjs.org/docs)
- [PostgreSQL 17 — Documentazione](https://www.postgresql.org/docs/17/)
- [Docker Compose — Documentazione](https://docs.docker.com/compose/)

---

## 📁 Struttura del progetto

```text
OmniPark/
├── public/                  # Risorse statiche
├── src/
│   ├── app/                 # Interfaccia e API Next.js
│   │   └── api/health/db/   # Verifica della connessione al DB
│   └── lib/                 # Moduli condivisi e test iniziali
├── .env.example             # Modello delle variabili d'ambiente
├── .nvmrc                   # Versione Node.js condivisa
├── compose.yaml             # PostgreSQL tramite Docker
├── eslint.config.mjs        # Configurazione ESLint
├── .prettierrc.json         # Regole Prettier
├── .prettierignore          # Esclusioni Prettier
├── vitest.config.ts         # Test e coverage
├── package.json
└── package-lock.json
```

> ### Struttura dei sottosistemi

Il progetto è organizzato secondo la decomposizione architetturale descritta nel documento **OMP_SDD_0.1, §3.2**.

Sono state predisposte le cartelle dei seguenti sottosistemi:

- **Presentazione:** `src/presentation/`
- **Utenti e accessi:** `src/application/utenti-accessi/`
- **Gestione stalli:** `src/application/gestione-stalli/`
- **Gestione soste:** `src/application/gestione-soste/`
- **Wallet:** `src/application/wallet/`
- **Segnalazioni:** `src/application/segnalazioni/`
- **Amministrazione:** `src/application/amministrazione/`
- **Archivio dati:** `src/persistence/`
- **Simulatori:** `src/simulators/`

Le cartelle contengono inizialmente un file `.gitkeep` e saranno popolate durante lo sviluppo dei rispettivi componenti.

La cartella `src/app/` contiene il routing Next.js, mentre `src/lib/` contiene il codice già realizzato per il setup iniziale.

La struttura è basata sulla versione 0.1 dell'SDD e potrà essere aggiornata in seguito alle decisioni architetturali del team.

---

## 📌 Attività ancora aperte

- [ ] Definire e approvare i sottosistemi in **SDD-01**.
- [ ] Preparare **dati di esempio** riproducibili.
- [ ] Definire e integrare il **simulatore**.
- [ ] Ampliare i test dei requisiti ad Alta priorità e la coverage.
- [ ] Esaminare le segnalazioni delle dipendenze con `npm audit`, evitando aggiornamenti forzati non valutati.
- [ ] Verificare l'installazione su un **clone pulito** prima di chiudere la task di setup.
