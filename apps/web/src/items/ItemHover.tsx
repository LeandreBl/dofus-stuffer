import type { HTMLAttributes, ReactElement } from "react";
import type { Catalog, EquipmentItem, OptimizationRequest } from "@dofus/shared";
import { HoverCard } from "../components/HoverCard";
import { ItemSummary } from "./ItemSummary";

export function ItemHover({ item, catalog, request, issues, note, children }: {
  item?: EquipmentItem; catalog: Catalog; request: OptimizationRequest; issues?: string[]; note?: string;
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  return <HoverCard interactive label={item && `Aperçu de ${item.name}`} content={item && <ItemSummary item={item} catalog={catalog} request={request} issues={issues} note={note} />}>{children}</HoverCard>;
}
