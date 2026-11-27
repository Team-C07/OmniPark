// Hash delle password (scrypt, formato PHC come i dati di esempio) e token di sessione.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const LN = 15;
const R = 8;
const P = 3;
const BYTE_SALE = 16;
const BYTE_CHIAVE = 32;
const BYTE_TOKEN = 32;
const MARGINE_MEMORIA = 1024 * 1024;

const FORMATO_HASH = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

/**
 * Hash valido nel formato ma che non corrisponde ad alcuna password: si verifica quando l'email
 * non esiste, così il tempo di risposta non rivela se l'account c'è.
 */
export const HASH_FITTIZIO = `$scrypt$ln=${LN},r=${R},p=${P}$${"A".repeat(22)}$${"A".repeat(43)}`;

function derivaChiave(
  password: string,
  sale: Buffer,
  parametri: { ln: number; r: number; p: number },
  lunghezza: number,
): Promise<Buffer> {
  const N = 2 ** parametri.ln;
  const { r, p } = parametri;
  // Il maxmem predefinito di Node (32 MiB) non basta per questi parametri.
  const maxmem = 128 * r * (N + p + 2) + MARGINE_MEMORIA;
  return new Promise((risolvi, rifiuta) => {
    scrypt(password, sale, lunghezza, { N, r, p, maxmem }, (errore, chiave) => {
      if (errore) {
        rifiuta(errore);
      } else {
        risolvi(chiave);
      }
    });
  });
}

function base64SenzaPadding(dati: Buffer): string {
  return dati.toString("base64").replace(/=+$/, "");
}

export async function calcolaHashPassword(password: string): Promise<string> {
  const sale = randomBytes(BYTE_SALE);
  const chiave = await derivaChiave(password, sale, { ln: LN, r: R, p: P }, BYTE_CHIAVE);
  return `$scrypt$ln=${LN},r=${R},p=${P}$${base64SenzaPadding(sale)}$${base64SenzaPadding(chiave)}`;
}

/** Confronta la password con l'hash in tempo costante; false se l'hash non è nel formato atteso. */
export async function verificaPassword(password: string, hash: string): Promise<boolean> {
  const parti = FORMATO_HASH.exec(hash);
  if (!parti) {
    return false;
  }
  const [, ln, r, p, sale, attesa] = parti;
  const chiaveAttesa = Buffer.from(attesa, "base64");
  const chiave = await derivaChiave(
    password,
    Buffer.from(sale, "base64"),
    { ln: Number(ln), r: Number(r), p: Number(p) },
    chiaveAttesa.length,
  );
  return timingSafeEqual(chiave, chiaveAttesa);
}

/** Token di sessione da consegnare al client: nel database va solo il suo hash. */
export function generaToken(): string {
  return randomBytes(BYTE_TOKEN).toString("base64url");
}

/** Hash sha256 del token, in 64 caratteri esadecimali (colonna sessione.hash_token). */
export function calcolaHashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
