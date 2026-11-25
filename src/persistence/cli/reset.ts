// npm run db:reset — elimina e ricrea lo schema, poi applica le migrazioni.
// Consentito solo con OMNIPARK_AMBIENTE=sviluppo o test (vedi guardiaReset.ts).
import { chiudiPool, ottieniPool } from "../db.ts";
import { resettaDatabase } from "../esecutoreMigrazioni.ts";
import { descriviDestinazione, verificaResetConsentito } from "../guardiaReset.ts";
import { descriviEsito, messaggioDi } from "./messaggi.ts";

// La guardia si verifica prima di creare il pool: se il reset non è consentito,
// non si apre nessuna connessione.
const guardia = verificaResetConsentito(process.env);

if (!guardia.consentito) {
  console.error(guardia.motivo);
  process.exitCode = 1;
} else {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL non configurata");
    }
    const { host, database } = descriviDestinazione(databaseUrl);
    console.log(`Reset (ambiente ${guardia.ambiente}) del database "${database}" su ${host}.`);
    const esito = await resettaDatabase(ottieniPool());
    console.log("Schema public ricreato.");
    console.log(descriviEsito(esito));
  } catch (errore) {
    console.error(`Reset non riuscito: ${messaggioDi(errore)}`);
    process.exitCode = 1;
  } finally {
    await chiudiPool();
  }
}
