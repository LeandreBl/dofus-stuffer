"""Export native character models for the Linux web app, without modifying Dofus.

Requires UnityPy 1.25.4. Example:
python scripts/extract-character-assets.py /path/to/Dofus --mapping data/character-appearances.json
The mapping contains explicit item/skin ids; inventory icon ids are never used.
"""
import argparse
import hashlib
import json
import math
import re
import sys
import warnings
from pathlib import Path

# Also support the isolated extraction dependencies used on this workstation.
local_dependencies = Path(__file__).resolve().parent.parent / 'data/.cache/python-deps'
if local_dependencies.exists():
    sys.path.insert(0, str(local_dependencies))
import UnityPy
from UnityPy.export.Texture2DConverter import get_image_from_texture2d

parser = argparse.ArgumentParser()
parser.add_argument('client', type=Path)
parser.add_argument('--mapping', type=Path, default=Path('data/character-appearances.json'))
parser.add_argument('--output', type=Path, default=Path('apps/web/public/characters'))
args = parser.parse_args()
UnityPy.config.FALLBACK_UNITY_VERSION = '6000.3.16f1'
warnings.filterwarnings('ignore', message='No valid Unity version found.*')
content = args.client / 'Dofus_Data/StreamingAssets/Content'
version = re.search(r'^Version=(.+)$', (content.parent / 'version').read_text(), re.M).group(1).strip()
mapping = json.loads(args.mapping.read_text(encoding='utf8'))
revision = version + '-' + hashlib.sha256(args.mapping.read_bytes()).hexdigest()[:10]
output = args.output / revision
output.mkdir(parents=True, exist_ok=True)
previous = {}
previous_manifest = args.output / 'manifest.json'
if previous_manifest.exists():
    value = json.loads(previous_manifest.read_text(encoding='utf8'))
    if value.get('revision') == revision:
        previous = value

def write_json(path, value):
    def clean(data):
        if isinstance(data, float) and not math.isfinite(data):
            return None
        if isinstance(data, list):
            return [clean(v) for v in data]
        if isinstance(data, dict):
            return {k: clean(v) for k, v in data.items()}
        return data
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(clean(value), separators=(',', ':'), ensure_ascii=False, allow_nan=False), encoding='utf8')

def datacenter(name):
    env = UnityPy.load(str(content / f'Data/data_assets_{name}dataroot.asset.bundle'))
    root = next(o.read_typetree() for o in env.objects if o.type.name == 'MonoBehaviour')
    refs = {r['rid']: r['data'] for r in root.get('references', {}).get('RefIds', [])}
    def resolve(value):
        if isinstance(value, list):
            return [resolve(v) for v in value]
        if isinstance(value, dict):
            if set(value) == {'rid'}:
                return resolve(refs[value['rid']]) if value['rid'] in refs else None
            return {k: resolve(v) for k, v in value.items()}
        return value
    data = resolve(root['objectsById'])
    if isinstance(data, dict) and set(data) == {'m_keys', 'm_values'}:
        data = dict(zip(map(str, data['m_keys']), data['m_values']))
    # Unity serializes dictionaries as key/value entries.
    if isinstance(data, list):
        data = {str(entry['key']): entry['value'] for entry in data}
    if name == 'skinslotsrules' and previous.get('supplements'):
        old_file = output / f'Content/Data/{name}dataroot.json'
        if old_file.exists():
            old_rules = json.loads(old_file.read_text(encoding='utf8'))['objectsById']
            for supplement in previous['supplements']:
                for item_id in supplement['itemIds']:
                    for asset in [mapping['items'][str(item_id)]['male'], mapping['items'][str(item_id)]['female']]:
                        if str(asset) in old_rules:
                            data[str(asset)] = old_rules[str(asset)]
    write_json(output / f'Content/Data/{name}dataroot.json', {'objectsById': data})
    return data

def extract_skin(obj, folder):
    skin = obj.read_typetree()
    folder.mkdir(parents=True, exist_ok=True)
    for index, ref in enumerate(skin['textures']):
        if ref['m_FileID'] != 0:
            raise ValueError('External texture reference requires explicit resolution')
        texture = obj.assets_file.objects[ref['m_PathID']].read()
        get_image_from_texture2d(texture, False).save(folder / f'{index}.webp', lossless=True, method=0)
    for key in ['m_GameObject', 'm_Script']:
        skin.pop(key, None)
    skin['textures'] = [{} for _ in skin['textures']]
    write_json(folder / 'skin.json', skin)

def extract(kind, asset):
    folder = output / f'Content/Characters/{kind}/{asset}'
    marker = folder / ('bone.json' if kind == 'Bones' else 'skin.json')
    if marker.exists():
        if kind == 'Bones':
            write_json(marker, json.loads(marker.read_text(encoding='utf8')))
        return True
    prefix = 'bones_assets_bone_' if kind == 'Bones' else 'skins_assets_skin_'
    bundle = content / f'Characters/{kind}/{prefix}{str(asset).lower()}.bundle'
    if not bundle.exists():
        return False
    env = UnityPy.load(str(bundle))
    obj = env.container[f'{str(asset).lower()}.asset'].deref()
    if kind == 'Skins':
        extract_skin(obj, folder)
    else:
        bone = obj.read_typetree()
        extract_skin(obj.assets_file.objects[bone['boneAsset']['m_PathID']], folder)
        # A static preview needs idle/combat poses, not every combat animation.
        bone['animations'] = [a for a in bone['animations'] if a['name'].startswith(('AnimStatique', 'FX_'))]
        if not bone['animations']:
            raise ValueError(f'{asset}: no idle animation')
        for animation in bone['animations']:
            (folder / (animation['name'] + '.dat')).write_bytes(bytes(animation.pop('dataBytes')))
            animation.pop('data', None)
        for graphic in bone['graphics']:
            graphic.pop('asset', None)
        for key in ['m_GameObject', 'm_Script', 'boneAsset']:
            bone.pop(key, None)
        bone['m_Name'] = str(asset)
        write_json(marker, bone)
    return True

bodies = datacenter('bodies')
datacenter('skinslotsrules')
datacenter('breeds')
breeds = mapping['breeds']
skin_ids = set()
for breed in breeds.values():
    for look in breed.values():
        skin_ids.update(look['skins'])
if not extract('Bones', '1-static'):
    raise ValueError('Missing native character skeleton')
if not extract('Bones', '2'):
    raise ValueError('Missing native mounted character skeleton')
items = {}
missing = []
for index, (item_id, item) in enumerate(mapping['items'].items()):
    kind = 'Bones' if item['folder'] == 'bones' else 'Skins'
    if all(extract(kind, asset) for asset in set([item['male'], item['female']])):
        items[item_id] = item
    else:
        missing.append(int(item_id))
    if index % 100 == 0:
        print(f'Equipment appearances: {index}/{len(mapping["items"])}', flush=True)
for index, asset in enumerate(sorted(skin_ids)):
    if not extract('Skins', asset):
        raise ValueError(f'Missing character body/head {asset}')
    if index % 20 == 0:
        print(f'Character parts: {index}/{len(skin_ids)}', flush=True)
manifest = {'version': version, 'revision': revision, 'assetBase': f'/characters/{revision}/',
            'source': mapping['source'], 'breeds': breeds, 'items': items, 'missingItems': missing}
if previous.get('supplements'):
    manifest['supplements'] = previous['supplements']
write_json(args.output / 'manifest.json', manifest)
print(json.dumps({'version': version, 'items': len(items), 'missing': missing, 'output': str(output)}), flush=True)
