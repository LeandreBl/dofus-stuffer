"""Read static Dofus Unity data without launching or modifying the game.

Usage: python scripts/extract-local-game-data.py /path/to/Dofus --output data/.cache/local-client.json
Requires UnityPy 1.25.4. Only the resulting catalogue is needed by the deployed Linux app.
"""
import argparse
import hashlib
import json
import re
import struct
from pathlib import Path
import UnityPy

parser = argparse.ArgumentParser()
parser.add_argument('client', type=Path)
parser.add_argument('--output', type=Path, default=Path('data/.cache/local-client.json'))
parser.add_argument('--unity-version', default='6000.3.16f1')
args = parser.parse_args()
UnityPy.config.FALLBACK_UNITY_VERSION = args.unity_version
content = args.client / 'Dofus_Data/StreamingAssets/Content'
version_file = content.parent / 'version'
version = re.search(r'^Version=(.+)$', version_file.read_text(), re.M).group(1).strip()

def strings(path):
    data = path.read_bytes()
    language_length = data[0]
    start = 1 + language_length
    count = struct.unpack_from('<i', data, start)[0]
    index_start = start + 4
    if count <= 0 or index_start + count*8 > len(data):
        raise ValueError('Invalid language index')
    result = {}
    for key, offset in struct.iter_unpack('<ii', data[index_start:index_start+count*8]):
        length, shift = 0, 0
        while True:
            value = data[offset]
            offset += 1
            length |= (value & 127) << shift
            if value < 128:
                break
            shift += 7
            if shift > 28:
                raise ValueError('Invalid string length')
        result[key] = data[offset:offset+length].decode('utf8')
    return result

translations = {'fr': strings(content/'I18n/fr.bin'), 'en': strings(content/'I18n/en.bin')}
if translations['fr'].get(515828) != 'Remueur':
    raise ValueError('French i18n control failed')
sources = []

def extract(resource, root_name):
    path = content / f'Data/data_assets_{root_name}dataroot.asset.bundle'
    environment = UnityPy.load(str(path))
    objects = [o.read_typetree() for o in environment.objects if o.type.name == 'MonoBehaviour']
    if len(objects) != 1:
        raise ValueError(f'{resource}: expected one data root')
    tree = objects[0]
    references = {ref['rid']: ref for ref in tree.get('references', {}).get('RefIds', [])}
    # Resolve 64-bit reference ids in Python, before JSON is consumed by JavaScript.
    def resolve(value, parents=()):
        if isinstance(value, list):
            return [resolve(v, parents) for v in value]
        if not isinstance(value, dict):
            return value
        if set(value) == {'rid'}:
            rid = value['rid']
            if rid < 0:
                return None
            if rid in parents or rid not in references:
                raise ValueError(f'{resource}: invalid/cyclic reference {rid}')
            ref = references[rid]
            data = resolve(ref['data'], (*parents, rid))
            data['className'] = ref['type']['class']
            return data
        result = {key: resolve(v, parents) for key,v in value.items()}
        for key in ['name','description','shortName','longName','gameplayDescription']:
            if f'{key}Id' in result:
                text_id = int(result[f'{key}Id'])
                result[key] = {lang: values.get(text_id, '') for lang,values in translations.items()}
        return result
    values = [resolve(v) for v in tree['objectsById']['m_values']]
    for key, value in zip(tree['objectsById']['m_keys'], values):
        if 'id' not in value:
            value['id'] = key
    if all('id' in v for v in values) and len({v['id'] for v in values}) != len(values):
        raise ValueError(f'{resource}: duplicate id')
    sources.append({'resource':resource,'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'count':len(values)})
    return values

names = {'breeds':'breeds','characteristics':'characteristics','effects':'effects','item-types':'itemtypes',
         'spell-variants':'spellvariants','spell-types':'spelltypes','spells':'spells','spell-levels':'spelllevels',
         'items':'items','item-sets':'itemsets','servers':'servers',
         'spell-scripts':'spellscripts','spell-states':'spellstates','monsters':'monsters'}
resources = {}
for resource, root_name in names.items():
    resources[resource] = extract(resource, root_name)
    print(f'{resource}: {len(resources[resource])}')
result = {'version':version,'source':'Ankama installed client static data','unityVersion':args.unity_version,'resources':resources,'sourceFiles':sources,
          'languageFiles':[{'language':lang,'sha256':hashlib.sha256((content/f'I18n/{lang}.bin').read_bytes()).hexdigest()} for lang in translations]}
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(f'Exported {version} to {args.output}')
