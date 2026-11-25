import { connection, NextResponse } from "next/server";
import { verificaConnessione } from "@/persistence/db";

export async function GET() {
  // Con cacheComponents la route verrebbe prerenderizzata durante la build:
  // connection() la rende dinamica, così il database si interroga solo a ogni richiesta.
  await connection();

  try {
    const { database } = await verificaConnessione();

    return NextResponse.json({ status: "ok", database });
  } catch (error) {
    console.error("Errore PostgreSQL:", error instanceof Error ? error.message : error);

    return NextResponse.json(
      {
        errore: {
          codice: "DATABASE_NON_RAGGIUNGIBILE",
          messaggio: "Il database non è raggiungibile. Riprova più tardi.",
        },
      },
      { status: 503 },
    );
  }
}
