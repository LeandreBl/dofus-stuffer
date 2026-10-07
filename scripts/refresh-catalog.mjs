/** Build a candidate catalogue from a versioned public DofusDude release.
 * The active catalogue and the web image bundle are never modified here.
 */
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const runFile = promisify(execFile);
const RELEASE_API = 'https://api.github.com/repos/dofusdude/dofus3-main/releases/latest';
const DOWNLOAD_ROOT = 'https://github.com/dofusdude/dofus3-main/releases/download/';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function compareGameVersions(left, right) {
  const parts = value => {
    if (typeof value !== 'string' || !/^\d+\.\d+\.\d+\.\d+(?:\+patch-[\w.]+)?$/.test(value)) throw new Error(`Version du jeu inconnue : ${value}`);
    return value.split('+')[0].split('.').map(Number);
  };
  const a = parts(left), b = parts(right);
  for (let i=0; i<4; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}

// Unity reference identifiers exceed Number.MAX_SAFE_INTEGER. Node's source text
// reviver preserves them exactly, before any map lookup can collapse adjacent ids.
// The maintenance image uses Node 24; unsupported runtimes fail without publishing.
export function parseUnityJson(text) {
  return JSON.parse(text, (key, value, context) => {
    if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
      if (!context?.source || !/^-?\d+$/.test(context.source)) throw new Error('Node 24 est requis pour les références Unity 64 bits.');
      return context.source;
    }
    return value;
  });
}

export function resolveUnityResource(tree, translations, accept = () => true) {
  const unwrap = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && Array.isArray(value.Array) ? value.Array : value;
  const refs = new Map();
  for (const ref of unwrap(tree.references?.RefIds) ?? []) {
    const key = String(ref.rid);
    if (refs.has(key)) throw new Error(`Référence Unity dupliquée : ${key}`);
    refs.set(key, ref);
  }
  function expand(value, parents = new Set()) {
    value = unwrap(value);
    if (Array.isArray(value)) return value.map(entry => expand(entry, parents));
    if (!value || typeof value !== 'object') return value;
    if (Object.keys(value).length === 1 && Object.hasOwn(value, 'rid')) {
      const key = String(value.rid);
      if (key.startsWith('-')) return null;
      if (parents.has(key) || !refs.has(key)) throw new Error(`Référence Unity absente ou cyclique : ${key}`);
      const ref = refs.get(key);
      const data = expand(ref.data, new Set([...parents, key]));
      return { ...data, className: ref.type.class };
    }
    const result = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, expand(entry, parents)]));
    for (const key of ['name','description','shortName','longName','gameplayDescription']) {
      if (Object.hasOwn(result, `${key}Id`)) result[key] = Object.fromEntries(Object.entries(translations).map(([language, entries]) => [language, entries[String(result[`${key}Id`])] ?? '']));
    }
    return result;
  }
  const roots = unwrap(tree.objectsById?.m_values);
  if (!Array.isArray(roots) || !roots.length) throw new Error('Ressource Unity vide ou incompatible.');
  const result = [];
  const ids = new Set();
  for (const root of roots) {
    const data = refs.get(String(root.rid))?.data;
    if (!data) throw new Error(`Racine Unity absente : ${root.rid}`);
    if (!accept(data)) continue;
    const value = expand(root);
    if (!Number.isSafeInteger(value.id) || ids.has(value.id)) throw new Error('Identifiant de donnée absent ou dupliqué.');
    ids.add(value.id);
    result.push(value);
  }
  return result;
}

async function readResponse(url, fetcher, maxBytes) {
  let current = new URL(url), response;
  const signal = AbortSignal.timeout(90000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (current.protocol !== 'https:' || current.username || current.password) throw new Error('La source du catalogue doit utiliser HTTPS.');
    response = await fetcher(current.href, { redirect:'manual', headers: { 'User-Agent':'DofusStuffer-weekly-update/1.0', Accept:'application/json' }, signal });
    if (![301,302,303,307,308].includes(response.status)) break;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || redirects === 5) throw new Error('Redirection du catalogue invalide.');
    current = new URL(location, current);
  }
  if (!response.ok) throw new Error(`Source de catalogue indisponible (HTTP ${response.status}).`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Source de catalogue trop volumineuse.');
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > maxBytes) throw new Error('Source de catalogue trop volumineuse.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

export async function refreshCatalog({ output, current, fetcher = fetch }) {
  const outputPath = resolve(output), currentPath = resolve(current);
  if (outputPath.toLowerCase() === currentPath.toLowerCase()) throw new Error('Le candidat doit être distinct du catalogue actif.');
  const active = JSON.parse(await readFile(currentPath, 'utf8'));
  const release = JSON.parse((await readResponse(RELEASE_API, fetcher, 4_000_000)).toString('utf8'));
  if (release.draft || release.prerelease || !/^\d+\.\d+\.\d+\.\d+$/.test(release.tag_name)) throw new Error('La source ne fournit pas une version stable du jeu.');
  const sourceVersion = release.tag_name;
  const comparison = compareGameVersions(sourceVersion, active.version);
  if (comparison <= 0) return { status: comparison ? 'older' : 'unchanged', message: comparison ? 'La source est plus ancienne ; le catalogue actif est conservé.' : 'Le catalogue utilise déjà la dernière version publiée.', sourceVersion };

  const assets = new Map((release.assets ?? []).map(asset => [asset.name, asset]));
  const sources = [];
  async function load(file) {
    const asset = assets.get(file);
    const expectedUrl = `${DOWNLOAD_ROOT}${sourceVersion}/${file}`;
    if (!asset || asset.browser_download_url !== expectedUrl) throw new Error(`Fichier officiel de release absent : ${file}`);
    const buffer = await readResponse(expectedUrl, fetcher, 140_000_000);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    if (asset.digest && asset.digest !== `sha256:${sha256}`) throw new Error(`Empreinte invalide : ${file}`);
    sources.push({ file, sha256, url:expectedUrl });
    return parseUnityJson(buffer.toString('utf8'));
  }
  const translations = {};
  for (const language of ['fr','en']) {
    const data = await load(`${language}.json`);
    if (!data.entries || !Object.keys(data.entries).length) throw new Error(`Traductions ${language} absentes.`);
    translations[language] = data.entries;
  }
  const resources = {};
  async function resource(key, accept) {
    const tree = await load(`${key.replaceAll('-','_')}.json`);
    resources[key] = resolveUnityResource(tree, translations, accept);
  }
  for (const key of ['breeds','characteristics','effects','item-types','spell-variants','spell-types']) await resource(key);
  const playableIds = new Set(resources.breeds.flatMap(breed => breed.breedSpellsId));
  const breedIds = new Set(resources.breeds.map(breed => breed.id));
  for (const variant of resources['spell-variants']) if (breedIds.has(variant.breedId)) for (const id of variant.spellIds) playableIds.add(id);
  const commonTypes = new Set(resources['spell-types'].filter(type => type.id <= 30 && /commun|spécial/i.test(type.longName?.fr ?? '')).map(type => type.id));
  // Internal spells, summon attacks and state bonuses are needed by simulation.
  await resource('spells');
  const levelIds = new Set(resources.spells.flatMap(spell => spell.spellLevels));
  await resource('spell-levels', level => levelIds.has(level.id));
  for (const key of ['spell-states','monsters']) {
    if (assets.has(`${key.replaceAll('-','_')}.json`)) await resource(key);
    else if (active.combatStates?.length || active.summons?.length) throw new Error(`Données de simulation absentes : ${key}. Le catalogue actif est conservé.`);
  }
  const wearable = new Set(resources['item-types'].filter(type => type.categoryId === 0 && [1,2,3,4,5,7,10,11,12,13].includes(type.superTypeId)).map(type => type.id));
  await resource('items', item => wearable.has(item.typeId));
  const setIds = new Set(resources.items.map(item => item.itemSetId));
  await resource('item-sets', set => setIds.has(set.id));
  // Servers are not published in these exports. Keep the active, explicit list.
  resources.servers = active.servers.map((name, index) => ({id:index+1, gameTypeId:0, name:{fr:name}}));

  await mkdir(dirname(outputPath), { recursive:true });
  const stage = await mkdtemp(join(dirname(outputPath), '.catalog-refresh-'));
  try {
    const nativePath = join(stage, 'native.json');
    await writeFile(nativePath, JSON.stringify({ version:sourceVersion, source:`https://github.com/dofusdude/dofus3-main/releases/tag/${sourceVersion}`, resources, sourceFiles:sources, languageFiles:sources.filter(source=>/^(fr|en)\.json$/.test(source.file)) }));
    try {
      await runFile(process.execPath, [join(ROOT,'scripts/import-game-data.mjs'), `--local-client-data=${nativePath}`, `--expected-version=${sourceVersion}`, `--output-root=${stage}`, `--current-catalog=${currentPath}`, '--skip-assets', '--offline'], {timeout:180000, maxBuffer:4_000_000, windowsHide:true});
    } catch (error) {
      throw new Error(`Échec de normalisation du catalogue : ${String(error.stderr || error.message).slice(-1500)}`);
    }
    const candidate = JSON.parse(await readFile(join(stage,'data/catalog.json'),'utf8'));
    for (const key of ['classes','stats','spells','items','sets']) {
      if (!candidate[key]?.length || candidate[key].length < (active[key]?.length ?? 0) * 0.75) throw new Error(`Catalogue incomplet : ${key}. Le catalogue actif est conservé.`);
    }
    candidate.warnings.push('Liste des serveurs conservée du catalogue précédent ; les exports de la source ne la fournissent pas.');
    if ([...candidate.classes,...candidate.spells,...candidate.items].some(record=>!record.icon)) candidate.warnings.push('Les nouvelles icônes indisponibles utilisent un repère neutre jusqu’à la prochaine mise à jour des visuels.');
    // Exclusive create also protects an existing active file reached through a symlink.
    await writeFile(outputPath, JSON.stringify(candidate), {flag:'wx'});
    return {status:'updated', message:`Catalogue ${sourceVersion} préparé depuis les exports DofusDude.`, sourceVersion};
  } finally {
    // Only remove the unique staging directory created by this invocation.
    if (dirname(stage) === dirname(outputPath) && basename(stage).startsWith('.catalog-refresh-')) await rm(stage,{recursive:true,force:true});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const option = name => { const index=args.indexOf(name); if(index<0 || !args[index+1] || args[index+1].startsWith('--')) throw new Error(`Argument requis : ${name}`); return args[index+1]; };
    console.log(JSON.stringify(await refreshCatalog({output:option('--output'), current:option('--current')})));
  } catch (error) {
    console.error(error.message);
    process.exitCode=1;
  }
}
