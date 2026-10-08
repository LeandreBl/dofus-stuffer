// Shareable selections live in the query (?spell=, ?item=); replaceState keeps them out of history.
export const urlParam = (key: string) => Number(new URLSearchParams(location.search).get(key)) || undefined;
export function setUrlParam(key: string, value?: number) {
  const url = new URL(location.href);
  if (value) url.searchParams.set(key, String(value));
  else url.searchParams.delete(key);
  if (url.href !== location.href) history.replaceState(null, "", url);
}
