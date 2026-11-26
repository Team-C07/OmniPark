import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Test sul database di test (npm run test:db). Le variabili arrivano dal file .env
// (DATABASE_URL_TEST e, per il controllo di sicurezza, DATABASE_URL); come con node --env-file,
// una variabile già presente nell'ambiente prevale su quella del file.
const variabiliDaFile = Object.fromEntries(
  Object.entries(loadEnv("test", process.cwd(), "")).filter(
    ([nome]) => process.env[nome] === undefined,
  ),
);

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    // I file condividono lo stesso database: uno alla volta, mai in parallelo.
    fileParallelism: false,
    env: variabiliDaFile,
    // Il reset del database remoto all'inizio di ogni file richiede qualche secondo.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
