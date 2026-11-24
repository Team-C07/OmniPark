import { connection, NextResponse } from "next/server";
import { verificaConnessioneDatabase } from "@/persistence/db";

export async function GET() {
  await connection();
  try {
    const database = await verificaConnessioneDatabase();
    return NextResponse.json({ status: "ok", database });
  } catch (error) {
    console.error("Errore PostgreSQL:", error);
    return NextResponse.json(
      { status: "error", message: "Database non raggiungibile" },
      { status: 503 },
    );
  }
}
