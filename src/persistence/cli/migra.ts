// npm run db:migrate — applica le migrazioni non ancora registrate.
import { chiudiPool, ottieniPool } from "../db.ts";
import { applicaMigrazioni } from "../esecutoreMigrazioni.ts";
import { descriviEsito, indicazionePerAnteprima, messaggioDi } from "./messaggi.ts";

try {
  const esito = await applicaMigrazioni(ottieniPool());
  console.log(descriviEsito(esito));
} catch (errore) {
  console.error(`Migrazione non riuscita: ${messaggioDi(errore)}`);
  const indicazione = indicazionePerAnteprima(errore, process.env);
  if (indicazione) {
    console.error(indicazione);
  }
  process.exitCode = 1;
} finally {
  await chiudiPool();
}
