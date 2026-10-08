import type { Catalog } from "@dofus/shared";

/** Known servers plus the current one, which may come from an imported profile. */
export function ServerSelect({ id, catalog, server, onChange }: {
  id?: string;
  catalog: Catalog;
  server: string;
  onChange: (server: string) => void;
}) {
  return (
    <select id={id} value={server} onChange={(event) => onChange(event.target.value)}>
      {Array.from(new Set([server, ...catalog.servers])).map((entry) => (
        <option key={entry}>{entry}</option>
      ))}
    </select>
  );
}
