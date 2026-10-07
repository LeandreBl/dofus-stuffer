import { type Catalog, type ExoStat } from "@dofus/shared";

export function parsePriceImport(content: string, format: "json" | "csv", catalog: Catalog, server: string): {
  values: Record<string, number>;
  exoCosts: Partial<Record<ExoStat, number>>;
} {
  let incoming: unknown = {};
  let incomingExos: unknown = {};
  if (format === "json") {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Le fichier ne contient pas de liste de prix.");
    const book = parsed as Record<string, unknown>;
    if (book.server && book.server !== server) throw new Error(`Ce fichier concerne ${String(book.server)}. Sélectionne ce serveur avant de l’importer.`);
    if ("exoValues" in book || "ownedExoKeys" in book) throw new Error("Ce fichier utilise des prix d’objets FM. Réimporte les prix des objets dans values et renseigne les suppléments PA / PM séparément dans exoCosts.");
    const structured = "values" in book || "exoCosts" in book || "server" in book;
    incoming = structured ? book.values ?? {} : book;
    incomingExos = book.exoCosts ?? {};
  } else {
    const rows: Record<string, number> = {};
    for (const [index, line] of content.trim().split(/\r?\n/).entries()) {
      const [id, price] = line.split(/[;,\t]/).map((value) => value.trim().replace(/^"|"$/g, ""));
      if (index === 0 && !/^\d+$/.test(id)) continue;
      if (!/^\d+$/.test(id) || price === undefined || price === "" || !Number.isFinite(Number(price))) throw new Error(`Ligne ${index + 1} invalide. Format attendu : id;prix`);
      rows[id] = Number(price);
    }
    incoming = rows;
  }
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new Error("Le fichier ne contient pas de liste de prix.");
  if (!incomingExos || typeof incomingExos !== "object" || Array.isArray(incomingExos)) throw new Error("La table des suppléments exotiques est invalide.");
  const items = new Map(catalog.items.map((item) => [item.id, item]));
  const validPrice = (price: unknown): price is number => typeof price === "number" && Number.isFinite(price) && price >= 0 && price <= 100_000_000_000;
  const values: Record<string, number> = {};
  for (const [id, price] of Object.entries(incoming)) {
    if (!/^[1-9]\d*$/.test(id) || !items.has(Number(id))) throw new Error(`L’objet ${id} ne figure pas dans ce catalogue.`);
    if (!validPrice(price)) throw new Error(`Prix invalide pour l’objet ${id}.`);
    values[id] = price;
  }
  const exoCosts: Partial<Record<ExoStat, number>> = {};
  for (const [key, price] of Object.entries(incomingExos)) {
    if (key !== "actionPoints" && key !== "movementPoints") throw new Error(`Bonus exotique inconnu : ${key}.`);
    if (!validPrice(price)) throw new Error(`Supplément invalide pour ${key}.`);
    exoCosts[key] = price;
  }
  if (!Object.keys(values).length && !Object.keys(exoCosts).length) throw new Error("Aucun prix trouvé dans ce fichier.");
  return { values, exoCosts };
}
