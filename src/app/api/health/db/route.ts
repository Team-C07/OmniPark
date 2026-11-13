import { connection, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  await connection();

  try {
    const result = await pool.query("SELECT current_database() AS database");

    return NextResponse.json({
      status: "ok",
      database: result.rows[0].database,
    });
  } catch (error) {
    console.error("Errore PostgreSQL:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "Database non raggiungibile",
      },
      { status: 503 },
    );
  }
}
