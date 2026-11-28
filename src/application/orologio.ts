// Orologio condiviso del livello applicativo: i test lo sostituiscono per spostare il tempo
// senza attese reali.

export type Orologio = {
  adesso(): Date;
};

export const orologioDiSistema: Orologio = {
  adesso: () => new Date(),
};
