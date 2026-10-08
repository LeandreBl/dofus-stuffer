/** Where a displayed price comes from: the player's own value wins over the automatic one. */
export const priceSourceLabel = (custom: number | undefined, automatic: number | undefined) =>
  custom !== undefined ? "Prix personnalisé" : automatic !== undefined ? "Prix automatique" : "Aucun prix disponible";
