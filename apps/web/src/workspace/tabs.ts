import { Coins, Layers3, Package, SlidersHorizontal, Swords } from "lucide-react";

export type Tab = "builder" | "equipment" | "spells" | "items" | "market";
// Shareable URLs per tab; any other path (/, /class/iop/) opens the workshop.
export const tabPaths: Record<Tab, string> = { builder: "/", equipment: "/build/", spells: "/damage/", items: "/items/", market: "/market/" };
export const tabFromPath = (path: string): Tab =>
  (Object.keys(tabPaths) as Tab[]).find((id) => id !== "builder" && tabPaths[id] === path.replace(/\/?$/, "/")) ?? "builder";
export const tabs = [
  { id: "builder", label: "Mon atelier", Icon: SlidersHorizontal },
  { id: "equipment", label: "Mon stuff", Icon: Layers3 },
  { id: "spells", label: "Mes dégâts", Icon: Swords },
  { id: "items", label: "Équipements", Icon: Package },
  { id: "market", label: "Marché", Icon: Coins },
] as const;
export const tabTitles: Record<Tab, string> = {
  builder: "Choisis tes envies. Classe tes priorités. Trouve l’équipement qui te ressemble.",
  equipment: "Compare les résultats ou compose ton équipement, pièce par pièce.",
  spells: "Explore ton grimoire et mesure ce que ton équipement change vraiment.",
  items: "Cherche un équipement, consulte ses effets, équipe-le, impose-le ou exclus-le de tes recherches.",
  market: "Des prix que tu maîtrises, pour estimer le coût de ton stuff.",
};
