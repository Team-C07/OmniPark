export function calcolaCostoSosta(minuti: number, tariffaOraria: number): number {
  if (minuti < 0 || tariffaOraria < 0) {
    throw new Error("I valori non possono essere negativi");
  }

  return (minuti / 60) * tariffaOraria;
}
