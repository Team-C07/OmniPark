// npm run db:migrate — applica le migrazioni non ancora registrate.
import { chiudiPool, ottieniPool } from "../db.ts";
import { applicaMigrazioni } from "../esecutoreMigrazioni.ts";
import { descriviEsito, messaggioDi } from "./messaggi.ts";

try {
  const esito = await applicaMigrazioni(ottieniPool());
  console.log(descriviEsito(esito));
} catch (errore) {
  console.error(`Migrazione non riuscita: ${messaggioDi(errore)}`);
  process.exitCode = 1;
} finally {
  await chiudiPool();
}
