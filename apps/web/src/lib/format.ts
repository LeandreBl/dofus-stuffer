import type { StatDefinition } from "@dofus/shared";

export const fmt = (value: number | undefined | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
        value,
      );
export const money = (value: number | undefined | null) =>
  value == null
    ? "Prix à renseigner"
    : value >= 1_000_000
      ? `${fmt(value / 1_000_000)} M kamas`
      : `${fmt(value)} kamas`;
// The game's legacy key is damagePercent, but Puissance is displayed in points.
export const statUnit = (stat?: StatDefinition) =>
  stat?.key === "damagePercent" ? "" : stat?.unit || "";
// randomUUID requires HTTPS outside localhost; criterion IDs also work on a LAN.
export const uid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
export const plainText = (value: string) =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
/** Accent- and case-insensitive text used by the search fields. */
export const searchable = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
