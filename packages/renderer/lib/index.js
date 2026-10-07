import { CanvasSource, QUALITY_HIGH, BufferTarget, Output, WebMOutputFormat, AudioBufferSource } from 'mediabunny';

// src/look/colorUtilities.ts
function intToRgb(value, divide = 127) {
  return [(value >> 16 & 255) / divide, (value >> 8 & 255) / divide, (value & 255) / divide];
}
function rgbToInt(rgb) {
  if (!rgb) return 0;
  return Math.trunc(rgb[0] * 127) << 16 | Math.trunc(rgb[1] * 127) << 8 | Math.trunc(rgb[2] * 127);
}
function indexedColorsToDict(indexedColors) {
  if (!indexedColors) return /* @__PURE__ */ new Map();
  const result = /* @__PURE__ */ new Map();
  for (const i of indexedColors)
    result.set(i >>> 24 & 255, intToRgb(i));
  return result;
}
function dictToIndexedColors(colorDict) {
  const result = new Array(colorDict.size);
  let i = 0;
  for (const [key, value] of colorDict)
    result[i++] = key << 24 | rgbToInt(value);
  return result;
}
function arrayColorsToDict(arrayColors) {
  return new Map(arrayColors.map((c, index) => [index + 1, intToRgb(c)]));
}
var RIDER_MOUNT_INDICES = [3, 4, 5, 6];
function dictToMountColor(colorDict) {
  const result = /* @__PURE__ */ new Map();
  RIDER_MOUNT_INDICES.forEach((riderIndex, position) => {
    const value = colorDict.get(riderIndex);
    if (value) result.set(position + 1, value);
  });
  return result;
}
function riderToMountIndex(riderIndex) {
  const position = RIDER_MOUNT_INDICES.indexOf(riderIndex);
  return position === -1 ? void 0 : position + 1;
}
function indexedColorIndices(indexedColors) {
  return new Set(indexedColorsToDict(indexedColors).keys());
}
function mergeIndexedColors(target, indexedColors) {
  for (const [index, rgb] of indexedColorsToDict(indexedColors)) target.set(index, rgb);
}
function parseLookStringColor(value, base = 10) {
  const result = /* @__PURE__ */ new Map();
  for (const item of value.split(",")) {
    const parts = item.split("=");
    if (parts.length !== 2) continue;
    const idx = parseInt(parts[0], base);
    const raw = parts[1];
    const colorVal = raw.startsWith("#") ? parseInt(raw.slice(1), 16) : parseInt(raw, base);
    result.set(idx, intToRgb(colorVal));
  }
  return result;
}

// src/look/enums.ts
var SubEntityCategory = {
  UNUSED: 0,
  PET: 1,
  MOUNT_DRIVER: 2,
  LIFTED_ENTITY: 3,
  BASE_BACKGROUND: 4,
  BASE_FOREGROUND: 6,
  PET_FOLLOWER: 7,
  UNDERWATER_BUBBLES: 8,
  RIDER_LEG: 9,
  CATEGORY_10: 10,
  CATEGORY_11: 11,
  CATEGORY_12: 12,
  CATEGORY_13: 13,
  CATEGORY_14: 14
};

// src/data/loader.ts
var HttpError = class extends Error {
  status;
  constructor(status, path) {
    super(`HTTP ${status} fetching ${path}`);
    this.status = status;
  }
};
var DataLoader = class {
  _base;
  _decodeImage;
  _imgExtension;
  _enableVersion;
  _enableCharacterTable;
  _enableAudio;
  constructor(basePath, imgExtension = "png", decodeImage, options = {}) {
    this._base = basePath.endsWith("/") ? basePath : `${basePath}/`;
    this._decodeImage = decodeImage;
    this._imgExtension = imgExtension;
    this._enableVersion = options.enableVersion ?? false;
    this._enableCharacterTable = options.enableCharacterTable ?? false;
    this._enableAudio = options.enableAudio ?? false;
  }
  async image(path) {
    if (this._decodeImage) return this._decodeImage(await this.bytes(path), path);
    return this.imageBitmap(path);
  }
  async data(name) {
    const raw = await this.json(`${"Content/Data" /* Data */}/${name}.json`);
    return raw.objectsById;
  }
  images(folder, textures) {
    return Promise.all(textures.map((_, i) => this.image(`${folder}/${i}.${this._imgExtension}`)));
  }
  async loadSkinInternal(path) {
    const skin = await this.json(`${path}/skin.json`);
    return { skin, images: await this.images(path, skin.textures) };
  }
  async loadAnimationData(boneName, animName, isMapAnimation) {
    return this.binary(`${isMapAnimation ? "Content/Animations/Props" /* Animations */ : "Content/Characters/Bones" /* Bones */}/${boneName}/${animName}.dat`);
  }
  async loadSkin(skinId) {
    return this.loadSkinInternal(`${"Content/Characters/Skins" /* Skins */}/${skinId}`);
  }
  async loadBone(boneName, isMapAnimation) {
    const folder = `${isMapAnimation ? "Content/Animations/Props" /* Animations */ : "Content/Characters/Bones" /* Bones */}/${boneName}`;
    const skinPromise = this.loadSkinInternal(folder);
    const bonePromise = this.json(`${folder}/bone.json`);
    const [skin, bone] = await Promise.all([skinPromise, bonePromise]);
    return { bone, skin };
  }
  async loadBodies() {
    return this.data("bodiesdataroot" /* Body */);
  }
  async loadBreeds() {
    return this.data("breedsdataroot" /* Breed */);
  }
  async loadSkinSlots() {
    return this.data("skinslotsrulesdataroot" /* SkinSlot */);
  }
  async loadSoundBones() {
    return this.data("soundbonesdataroot" /* SoundBone */);
  }
  /** Whether the audio library may be loaded (`enableAudio`). */
  get audioEnabled() {
    return this._enableAudio;
  }
  async loadAudioLib() {
    if (!this._enableAudio) throw new Error("Audio is disabled. Pass enableAudio: true to configure().");
    return this.json(`${"aa" /* aa */}/${"Assets/Configuration/Audio/AudioManagerLibrary.asset" /* audioLib */}`);
  }
  async loadProcessedAudioLib() {
    if (!this._enableAudio) return {};
    return this.json(`${"Content/Audio/Banks/Desktop" /* Audio */}/${"audio_manager.json" /* processedAudioLib */}`);
  }
  async fmodEvent(eventPath, _) {
    return this.json(`${"Content/Audio/Banks/Desktop" /* Audio */}/${eventPath}/info.json`);
  }
  async audioBytes(event) {
    return this.binary(`${"Content/Audio/Banks/Desktop" /* Audio */}/${event.soundPath}`);
  }
};
var UrlLoader = class extends DataLoader {
  cacheTable;
  buildTime = 0;
  tablesReady = Promise.resolve();
  constructor(basePath, imgExtension = "png", decodeImage, options = {}) {
    super(basePath, imgExtension, decodeImage, options);
    this.cacheTable = { Bones: /* @__PURE__ */ new Map(), Skins: /* @__PURE__ */ new Map() };
    if (typeof window !== "undefined") {
      const tasks = [];
      if (this._enableCharacterTable) tasks.push(this.setCache());
      if (this._enableVersion) tasks.push(this.setBuildTime());
      if (tasks.length) this.tablesReady = Promise.all(tasks).then(() => {
      });
    }
  }
  async setCache() {
    try {
      const data = await this.json("Content/Characters/table.json" /* changeTable */);
      this.cacheTable = {
        Bones: new Map(Object.entries(data?.Bones ?? {})),
        Skins: new Map(Object.entries(data?.Skins ?? {}))
      };
    } catch (e) {
    }
  }
  async setBuildTime() {
    try {
      const data = await this.json(`${"version.json" /* version */}?t=${Date.now()}`);
      this.buildTime = data?.BuildDate ?? 0;
    } catch (e) {
    }
  }
  withBuildTime(path) {
    if (!this.buildTime || path.includes("?t=")) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}t=${this.buildTime}`;
  }
  async fetchRes(path) {
    const attempts = 3;
    for (let attempt = 1; ; attempt++) {
      let res;
      try {
        res = await fetch(this._base + path, { signal: AbortSignal.timeout(3e4) });
      } catch (err) {
        if (attempt >= attempts) throw err;
      }
      if (res) {
        if (res.ok) return res;
        if (res.status === 404 || attempt >= attempts) throw new HttpError(res.status, path);
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  async json(path) {
    return (await this.fetchRes(this.withBuildTime(path))).json();
  }
  async binary(path) {
    return (await this.fetchRes(path)).arrayBuffer();
  }
  async bytes(path) {
    const buf = await (await this.fetchRes(path)).arrayBuffer();
    return new Uint8Array(buf);
  }
  async imageBitmap(path) {
    const res = await this.fetchRes(path);
    const blob = await res.blob();
    return createImageBitmap(blob, { premultiplyAlpha: "none" });
  }
  async fmodEvent(eventPath, timestamp) {
    return this.json(`${"Content/Audio/Banks/Desktop" /* Audio */}/${eventPath}/info.json?t=${timestamp}`);
  }
  async audioBytes(event) {
    return this.binary(`${"Content/Audio/Banks/Desktop" /* Audio */}/${event.soundPath}?t=${event.timestamp}`);
  }
  /** `?t=<timestamp>` suffix from the change table, or "" when the table is disabled. */
  stamp(kind, key) {
    if (!this._enableCharacterTable) return "";
    return `?t=${this.cacheTable[kind].get(key) ?? 0}`;
  }
  async loadSkinWithCache(path, stamp) {
    const firstImage = this.image(`${path}/0.${this._imgExtension}${stamp}`);
    firstImage.catch(() => {
    });
    const skin = await this.json(`${path}/skin.json${stamp}`);
    if (skin.textures.length === 0) return { skin, images: [] };
    const images = [firstImage];
    for (let i = 1; i < skin.textures.length; i++) {
      images.push(this.image(`${path}/${i}.${this._imgExtension}${stamp}`));
    }
    return { skin, images: await Promise.all(images) };
  }
  async loadAnimationData(boneName, animName, isMapAnimation) {
    await this.tablesReady;
    const stamp = this.stamp("Bones", boneName);
    return this.binary(`${isMapAnimation ? "Content/Animations/Props" /* Animations */ : "Content/Characters/Bones" /* Bones */}/${boneName}/${animName}.dat${stamp}`);
  }
  async loadSkin(skinId) {
    await this.tablesReady;
    const stamp = this.stamp("Skins", String(skinId));
    return this.loadSkinWithCache(`${"Content/Characters/Skins" /* Skins */}/${skinId}`, stamp);
  }
  async loadBone(boneName, isMapAnimation) {
    await this.tablesReady;
    const stamp = this.stamp("Bones", boneName);
    const folder = `${isMapAnimation ? "Content/Animations/Props" /* Animations */ : "Content/Characters/Bones" /* Bones */}/${boneName}`;
    const skinPromise = this.loadSkinWithCache(folder, stamp);
    const bonePromise = this.json(`${folder}/bone.json${stamp}`);
    const [skin, bone] = await Promise.all([skinPromise, bonePromise]);
    return { bone, skin };
  }
};
var LiveExtractLoader = class extends UrlLoader {
  generated;
  apiUrl;
  constructor(basePath, imgExtension = "png", decodeImage, options = {}) {
    const cleanPath = basePath.endsWith("/") ? basePath : `${basePath}/`;
    super(`${cleanPath}static/Dofus_Data/StreamingAssets`, imgExtension, decodeImage, options);
    this.generated = { Bones: /* @__PURE__ */ new Set(), Skins: /* @__PURE__ */ new Set() };
    this.apiUrl = cleanPath;
  }
  async loadSkin(skinId) {
    if (!this.generated.Skins.has(String(skinId))) {
      await this.fetchResApi(`extract/skin/${skinId}`);
      this.generated.Skins.add(String(skinId));
    }
    return super.loadSkin(skinId);
  }
  async loadBone(boneName, isMapAnimation = false) {
    if (!this.generated.Bones.has(boneName)) {
      await this.fetchResApi(`extract/bone/${isMapAnimation}/${boneName}`);
      this.generated.Bones.add(boneName);
    }
    return super.loadBone(boneName, isMapAnimation);
  }
  async loadProcessedAudioLib() {
    return {};
  }
  async fetchResApi(path) {
    const res = await fetch(this.apiUrl + path);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${path}`);
    return res;
  }
};
function toLoaderOptions(config) {
  return {
    enableVersion: config.enableVersion,
    enableCharacterTable: config.enableCharacterTable,
    enableAudio: config.enableAudio
  };
}
function createDataLoader(config) {
  const options = toLoaderOptions(config);
  switch (config.strategy) {
    case "url":
      return new UrlLoader(config.basePath, config.ImageExtension, config.decodeImage, options);
    case "LE":
      return new LiveExtractLoader(config.basePath, config.ImageExtension, config.decodeImage, options);
    default:
      throw new Error(`Unknown loader strategy "${config.strategy}". The "fs" strategy is Node-only: import configure/createDataLoader from 'd3-ts-renderer/node' instead of 'd3-ts-renderer'.`);
  }
}
var _loader;
function setLoader(loader) {
  _loader = loader;
  return loader;
}
function configure(config) {
  return setLoader(createDataLoader(config));
}
function getLoader() {
  if (!_loader) {
    throw new Error("DataLoader not configured. Call configure({strategy, basePath}) before using the renderer.");
  }
  return _loader;
}

// src/data/body.ts
var Body = class _Body {
  data;
  skinMapping;
  constructor(data) {
    this.data = /* @__PURE__ */ new Map();
    for (const value of Object.values(data)) this.data.set(value.id, value);
    this.skinMapping = /* @__PURE__ */ new Map();
    for (const v of this.data.values()) this.skinMapping.set(Number(v.skins), v);
  }
  static async create() {
    const data = await getLoader().loadBodies();
    return new _Body(data);
  }
};
var _bodiesPromise;
function getBodies() {
  return _bodiesPromise ??= Body.create();
}

// src/utilities.ts
function getEnumKeyByValue(enumObject, value) {
  return Object.keys(enumObject).find((key) => enumObject[key] === value);
}

// src/data/breed.ts
var Breed = class _Breed {
  data;
  constructor(data) {
    this.data = /* @__PURE__ */ new Map();
    for (const value of Object.values(data)) this.data.set(value.id, value);
  }
  static async create() {
    const data = await getLoader().loadBreeds();
    return new _Breed(data);
  }
};
var _breedsPromise;
function getBreeds() {
  return _breedsPromise ??= Breed.create();
}

// src/look/look.ts
var Look = class _Look {
  bone;
  skins;
  size;
  subEntities;
  color;
  flatColorArray = new Float32Array(48);
  static numberBaseDict = { A: 10, G: 16, Z: 36 };
  constructor(bone, skins = [], color = /* @__PURE__ */ new Map(), size = 1) {
    this.bone = bone;
    this.skins = skins;
    this.color = color;
    this.size = size;
    this.subEntities = /* @__PURE__ */ new Map();
    this.writeFlat();
  }
  set Color(map) {
    this.color = new Map(map);
    this.writeFlat();
  }
  get Color() {
    return this.color;
  }
  setColor(index, value) {
    this.color.set(index, value);
    if (index < 0 || index >= 16) return;
    this.flatColorArray[index * 3] = value[0];
    this.flatColorArray[index * 3 + 1] = value[1];
    this.flatColorArray[index * 3 + 2] = value[2];
  }
  writeFlat() {
    for (let i = 0; i < 16; i++) {
      const c = this.color.get(i) ?? [1, 1, 1];
      this.flatColorArray[i * 3] = c[0];
      this.flatColorArray[i * 3 + 1] = c[1];
      this.flatColorArray[i * 3 + 2] = c[2];
    }
  }
  getPetColor(indexedColors) {
    return new Map([...this.color, ...indexedColorsToDict(indexedColors)]);
  }
  getRideableColor(isMount, kramelehone, indexedColors) {
    const color = indexedColorsToDict(indexedColors);
    if (isMount && !kramelehone) return color;
    const riderColor = dictToMountColor(this.color);
    return isMount ? new Map([...color, ...riderColor]) : new Map([...riderColor, ...color]);
  }
  get riderLook() {
    return this.subEntities.get(SubEntityCategory.MOUNT_DRIVER)?.get(0) ?? this;
  }
  get petLook() {
    return this.subEntities.get(SubEntityCategory.PET)?.get(0);
  }
  setSubEntity(category, subLook, index = 0) {
    let categoryEntities = this.subEntities.get(category);
    if (!categoryEntities) {
      categoryEntities = /* @__PURE__ */ new Map();
      this.subEntities.set(category, categoryEntities);
    }
    categoryEntities.set(index, subLook);
  }
  static fromString(lookString, numberBase = 10) {
    let s = lookString;
    let base = numberBase;
    if (s.startsWith("[")) {
      const closeBracket = s.indexOf("]");
      const header = s.slice(1, closeBracket);
      s = s.slice(closeBracket + 1);
      const headerParts = header.split(",");
      base = _Look.numberBaseDict[headerParts[1] ?? ""] ?? 10;
    }
    if (s.includes(",{")) s = _Look.extractDefaultConditionalLook(s);
    const inner = s.startsWith("{") ? s.slice(1) : s;
    const stripped = inner.endsWith("}") ? inner.slice(0, -1) : inner;
    const [boneStr, skinsStr, colorStr, sizeStr, ...subEntitiesStrSplit] = stripped.split("|");
    const subEntitiesStr = subEntitiesStrSplit.join("|");
    const bone = boneStr ? parseInt(boneStr ?? "0", base) : 0;
    const skins = skinsStr ? skinsStr.split(",").map((i) => parseInt(i, base)) : [];
    const color = colorStr ? parseLookStringColor(colorStr, base) : /* @__PURE__ */ new Map();
    const size = sizeStr ? parseInt(sizeStr, base) / 100 : 1;
    const look = new _Look(bone, skins, color, size);
    if (subEntitiesStr) {
      const rawSubEntities = subEntitiesStr.endsWith("}") ? subEntitiesStr.slice(0, -1) : subEntitiesStr;
      for (const chunk of rawSubEntities.split("}")) {
        const cleanedChunk = chunk.startsWith(",") ? chunk.slice(1) : chunk;
        const eqIdx = cleanedChunk.indexOf("=");
        const header2 = cleanedChunk.slice(0, eqIdx);
        const body = cleanedChunk.slice(eqIdx + 1) + "}";
        const atIdx = header2.indexOf("@");
        const category = parseInt(header2.slice(0, atIdx), base);
        const bindingIndex = parseInt(header2.slice(atIdx + 1), base);
        const subLook = _Look.fromString(body);
        let catMap = look.subEntities.get(category);
        if (!catMap) {
          catMap = /* @__PURE__ */ new Map();
          look.subEntities.set(category, catMap);
        }
        catMap.set(bindingIndex, subLook);
      }
    }
    return look;
  }
  static async fromStringAsync(lookString, injectColor = false, numberBase = 10) {
    const look = _Look.fromString(lookString, numberBase);
    if (injectColor) await look.injectColor();
    return look;
  }
  static fromDict(lookDict) {
    const look = new _Look(
      lookDict.bonesId,
      lookDict.skins ? [...lookDict.skins] : [],
      indexedColorsToDict(lookDict.indexedColors),
      (lookDict.scales?.[0] ?? 100) / 100
    );
    for (const sub of lookDict.subEntities ?? []) {
      const category = SubEntityCategory[sub.bindingPointCategory] ?? 0;
      let catMap = look.subEntities.get(category);
      if (!catMap) {
        catMap = /* @__PURE__ */ new Map();
        look.subEntities.set(category, catMap);
      }
      const index = catMap.size;
      catMap.set(index, _Look.fromDict(sub.subEntityLook));
    }
    return look;
  }
  static fromB16String(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return _Look.fromString(new TextDecoder().decode(bytes));
  }
  static extractDefaultConditionalLook(lookString) {
    const conditionalLook = lookString.split(",{").map((s) => (s.endsWith("}") ? s.slice(0, -1) : s).split("$"));
    const found = conditionalLook.find((i) => i[1].endsWith(";"));
    return found ? found[0] : conditionalLook[0][0];
  }
  static parseConditionalLooks(lookString) {
    return lookString.split(",{").map((s) => {
      const clean = s.endsWith("}") ? s.slice(0, -1) : s;
      const looks = clean.startsWith("{") ? clean : "{" + clean;
      const [look, conditions] = looks.split("$");
      const parts = conditions.split(";");
      return { look: `${look}}`, index: Number(parts[0]), condition: parts[parts.length - 1] };
    });
  }
  async injectColor() {
    if (this.color.size < 6) {
      const body = await this.getBody();
      if (body) {
        const breeds = await getBreeds();
        const breed = breeds.data.get(body.breed);
        if (breed) {
          const colors = body.gender == 1 ? breed.femaleColors : breed.maleColors;
          const colorsMap = arrayColorsToDict(colors);
          for (const [index, color] of colorsMap) {
            if (!this.color.has(index)) this.setColor(index, color);
          }
        }
      }
    }
    for (const subEntityMap of this.subEntities.values()) {
      for (const subEntity of subEntityMap.values()) {
        await subEntity.injectColor();
      }
    }
  }
  async getBody() {
    if (this.skins.length == 0) return void 0;
    const bodies = await getBodies();
    return bodies.skinMapping.get(this.skins[0]);
  }
  async getBreedAndSex() {
    const body = await this.getBody();
    if (body) return 2 * body.breed + body.gender;
  }
  toB16String() {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(this.toString());
    const hexArray = new Array(bytes.length);
    for (let i = 0; i < bytes.length; i++)
      hexArray[i] = bytes[i].toString(16).padStart(2, "0");
    return hexArray.join("");
  }
  toDict() {
    const subEntities = [];
    for (const [category, subEntityMap] of this.subEntities) {
      for (const subEntity of subEntityMap.values())
        subEntities.push({
          bindingPointCategory: getEnumKeyByValue(SubEntityCategory, category) ?? "UNUSED",
          subEntityLook: subEntity.toDict()
        });
    }
    return {
      bonesId: this.bone,
      skins: this.skins,
      scales: [Math.floor(this.size * 100)],
      indexedColors: dictToIndexedColors(this.color),
      subEntities
    };
  }
  /** Deep structural copy: exact colors, size, bone and sub-entity category/index keys preserved. */
  clone() {
    const copy = new _Look(
      this.bone,
      [...this.skins],
      new Map(this.color),
      this.size
    );
    for (const [category, subMap] of this.subEntities) {
      const catCopy = /* @__PURE__ */ new Map();
      for (const [index, sub] of subMap) catCopy.set(index, sub.clone());
      copy.subEntities.set(category, catCopy);
    }
    return copy;
  }
  toString() {
    const components = [
      this.bone ? String(this.bone) : "",
      this.skins.map((skin) => String(skin)).join(","),
      Array.from(this.color, ([i, color]) => `${i}=${rgbToInt(color)}`).join(","),
      String(Math.floor(this.size * 100))
    ];
    if (this.subEntities) {
      const subEntities = [];
      for (const [category, subEntityDict] of this.subEntities) {
        for (const [index, subEntity] of subEntityDict) {
          subEntities.push(`${category}@${index}=${subEntity.toString()}`);
        }
      }
      components.push(subEntities.join(""));
    }
    return `{${components.join("|")}}`;
  }
  sameSkins(otherLook) {
    if (this.skins.length !== otherLook.skins.length) return false;
    const skins = [...this.skins].sort((x, y) => x - y);
    const otherSkins = [...otherLook.skins].sort((x, y) => x - y);
    return skins.every((val, i) => val === otherSkins[i]);
  }
};

// src/data/directions.ts
var Directions = /* @__PURE__ */ ((Directions3) => {
  Directions3[Directions3["RIGHT"] = 0] = "RIGHT";
  Directions3[Directions3["DOWN_RIGHT"] = 1] = "DOWN_RIGHT";
  Directions3[Directions3["DOWN"] = 2] = "DOWN";
  Directions3[Directions3["DOWN_LEFT"] = 3] = "DOWN_LEFT";
  Directions3[Directions3["LEFT"] = 4] = "LEFT";
  Directions3[Directions3["UP_LEFT"] = 5] = "UP_LEFT";
  Directions3[Directions3["UP"] = 6] = "UP";
  Directions3[Directions3["UP_RIGHT"] = 7] = "UP_RIGHT";
  return Directions3;
})(Directions || {});
var oppositeMapping = {
  [0 /* RIGHT */]: 4 /* LEFT */,
  [1 /* DOWN_RIGHT */]: 3 /* DOWN_LEFT */,
  [3 /* DOWN_LEFT */]: 1 /* DOWN_RIGHT */,
  [4 /* LEFT */]: 0 /* RIGHT */,
  [5 /* UP_LEFT */]: 7 /* UP_RIGHT */,
  [7 /* UP_RIGHT */]: 5 /* UP_LEFT */
};
function oppositeDirection(d) {
  return oppositeMapping[d];
}
function flipAnimNameString(animName) {
  const idx = animName.lastIndexOf("_");
  if (idx === -1) return animName;
  const name = animName.slice(0, idx);
  const dirStr = animName.slice(idx + 1);
  const opp = oppositeDirection(Number(dirStr));
  if (opp === void 0) return animName;
  return `${name}_${opp}`;
}

// src/data/animation.ts
function getAnimName(animations, direction, bone, name, raise = true) {
  const baseName = name === void 0 ? bone === 1 ? "AnimStatiqueExplo0" : "AnimStatique" : name;
  const candidate = `${baseName}_${direction}`;
  if (animations.includes(candidate)) return [candidate, false];
  const opp = oppositeDirection(direction);
  if (opp !== void 0) {
    const flipped = `${baseName}_${opp}`;
    if (animations.includes(flipped)) return [flipped, true];
  }
  if (name === void 0) {
    for (const d of opp !== void 0 ? [direction, opp] : [direction]) {
      const found = animations.find((k) => k.endsWith(`_${d}`));
      if (found) return [found, d !== direction];
    }
    if (animations.length > 0) return [animations[0], false];
  } else if (!raise) return getAnimName(animations, direction, bone, void 0, true);
  throw new Error(
    `Cannot find animation '${baseName}' for direction ${direction}. Available: ${animations.join(", ")}`
  );
}
function directionsByAnim(animations) {
  const sets = {};
  for (const key of animations) {
    const i = key.lastIndexOf("_");
    if (i < 0) continue;
    const dir = Number(key.slice(i + 1));
    if (!Number.isInteger(dir)) continue;
    const base = key.slice(0, i);
    const set = sets[base] ??= /* @__PURE__ */ new Set();
    set.add(dir);
    const opp = oppositeDirection(dir);
    if (opp !== void 0) set.add(opp);
  }
  const out = {};
  for (const [base, set] of Object.entries(sets)) out[base] = [...set].sort((a, b) => a - b);
  return out;
}
function getRelatedChildAnim(animations, animParent) {
  const cleanString = animParent.replace(/(Explo|Combat)\d+/, "");
  if (animations.includes(cleanString)) return [cleanString, false];
  const lastUnderscore = animParent.lastIndexOf("_");
  if (lastUnderscore === -1) return [void 0, false];
  const baseName = animParent.slice(0, lastUnderscore);
  const orientation = animParent.slice(lastUnderscore + 1);
  const found = childAnimName(animations, baseName, orientation);
  if (found) return [found, false];
  if (/^\d+$/.test(orientation)) {
    const oppDir = oppositeDirection(parseInt(orientation));
    if (oppDir !== void 0) {
      const found2 = childAnimName(animations, baseName, String(oppDir));
      if (found2) return [found2, true];
    }
  }
  if (animations.length > 0) return [animations[0], false];
  return [void 0, false];
}
function childAnimName(animations, baseName, orientation) {
  const candidates = [
    `${baseName}Explo0_${orientation}`,
    `${baseName}_${orientation}`,
    `AnimStatiqueExplo0_${orientation}`,
    `AnimStatique_${orientation}`,
    `FX_${orientation}`
  ];
  return candidates.find((c) => animations.includes(c));
}

// src/readers/binaryReader.ts
var BinaryReader = class {
  _view;
  pos = 0;
  constructor(buffer) {
    this._view = new DataView(buffer);
  }
  get u8() {
    return this._view.getUint8(this.pos++);
  }
  get i8() {
    return this._view.getInt8(this.pos++);
  }
  get u16() {
    const v = this._view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  get i16() {
    const v = this._view.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }
  get i32() {
    const v = this._view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  get u32() {
    const v = this._view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  get f32() {
    const v = this._view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  get bool() {
    return this.u8 !== 0;
  }
  str(length) {
    const bytes = new Uint8Array(this._view.buffer, this.pos, length);
    this.pos += length;
    return new TextDecoder().decode(bytes);
  }
  align(n) {
    const rem = this.pos % n;
    if (rem !== 0) this.pos += n - rem;
    return this;
  }
  skip(n) {
    this.pos += n;
    return this;
  }
  readU16Multiple(count) {
    return Array.from({ length: count }, () => this.u16);
  }
  readI16Multiple(count) {
    return Array.from({ length: count }, () => this.i16);
  }
  readI32Multiple(count) {
    return Array.from({ length: count }, () => this.i32);
  }
  readF32Multiple(count) {
    return Array.from({ length: count }, () => this.f32);
  }
  readF32Array(count) {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = this.f32;
    return arr;
  }
  readBoolMultiple(count) {
    return Array.from({ length: count }, () => this.u8 !== 0);
  }
  readRgba() {
    return [this.i8 / 127, this.i8 / 127, this.i8 / 127, this.i8 / 127];
  }
};
function fourcc(buf, offset) {
  return String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
}
function readU16LE(buf, o) {
  return buf[o] | buf[o + 1] << 8;
}
function readU24LE(buf, o) {
  return buf[o] | buf[o + 1] << 8 | buf[o + 2] << 16;
}
function readU32LE(buf, o) {
  return (buf[o] | buf[o + 1] << 8 | buf[o + 2] << 16 | buf[o + 3] * 16777216) >>> 0;
}
function writeFourCC(buf, o, s) {
  buf[o] = s.charCodeAt(0);
  buf[o + 1] = s.charCodeAt(1);
  buf[o + 2] = s.charCodeAt(2);
  buf[o + 3] = s.charCodeAt(3);
}
function writeU16LE(buf, o, v) {
  buf[o] = v & 255;
  buf[o + 1] = v >>> 8 & 255;
}
function writeU24LE(buf, o, v) {
  buf[o] = v & 255;
  buf[o + 1] = v >>> 8 & 255;
  buf[o + 2] = v >>> 16 & 255;
}
function writeU32LE(buf, o, v) {
  buf[o] = v & 255;
  buf[o + 1] = v >>> 8 & 255;
  buf[o + 2] = v >>> 16 & 255;
  buf[o + 3] = v >>> 24 & 255;
}
function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// src/readers/flashFilters.ts
function emptyFlashFilters() {
  return {
    filterOrder: [],
    blurFilters: [],
    glowFilters: [],
    dropShadowFilters: [],
    colorMatrices: []
  };
}

// src/math.ts
function mat3Identity() {
  return new Float32Array([
    1,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    1
  ]);
}
function mat3From(a00, a01, a02, a10, a11, a12, a20, a21, a22) {
  return new Float32Array([
    a00,
    a10,
    a20,
    a01,
    a11,
    a21,
    a02,
    a12,
    a22
  ]);
}
function mat3Scale(s) {
  return mat3From(s, 0, 0, 0, s, 0, 0, 0, 1);
}
function mat3Mul(a, b) {
  return mat3MulInto(new Float32Array(9), a, b);
}
function mat3MulInto(out, a, b) {
  const a00 = a[0], a10 = a[1], a20 = a[2];
  const a01 = a[3], a11 = a[4], a21 = a[5];
  const a02 = a[6], a12 = a[7], a22 = a[8];
  const b00 = b[0], b10 = b[1], b20 = b[2];
  const b01 = b[3], b11 = b[4], b21 = b[5];
  const b02 = b[6], b12 = b[7], b22 = b[8];
  out[0] = a00 * b00 + a01 * b10 + a02 * b20;
  out[1] = a10 * b00 + a11 * b10 + a12 * b20;
  out[2] = a20 * b00 + a21 * b10 + a22 * b20;
  out[3] = a00 * b01 + a01 * b11 + a02 * b21;
  out[4] = a10 * b01 + a11 * b11 + a12 * b21;
  out[5] = a20 * b01 + a21 * b11 + a22 * b21;
  out[6] = a00 * b02 + a01 * b12 + a02 * b22;
  out[7] = a10 * b02 + a11 * b12 + a12 * b22;
  out[8] = a20 * b02 + a21 * b12 + a22 * b22;
  return out;
}
function mat3FlipX(m) {
  m[0] = -m[0];
  m[1] = -m[1];
  m[2] = -m[2];
  return m;
}
function mat3Translation(m, scale) {
  return mat3From(
    1,
    0,
    scale * m[6],
    0,
    1,
    scale * m[7],
    0,
    0,
    1
  );
}
function transformAABB(b, m) {
  const a00 = m[0], a01 = m[3], a02 = m[6];
  const a10 = m[1], a11 = m[4], a12 = m[7];
  const { xMin, yMin, xMax, yMax } = b;
  const x1 = a00 * xMin + a01 * yMin + a02;
  const y1 = a10 * xMin + a11 * yMin + a12;
  const x2 = a00 * xMax + a01 * yMin + a02;
  const y2 = a10 * xMax + a11 * yMin + a12;
  const x3 = a00 * xMax + a01 * yMax + a02;
  const y3 = a10 * xMax + a11 * yMax + a12;
  const x4 = a00 * xMin + a01 * yMax + a02;
  const y4 = a10 * xMin + a11 * yMax + a12;
  return {
    xMin: Math.min(x1, x2, x3, x4),
    yMin: Math.min(y1, y2, y3, y4),
    xMax: Math.max(x1, x2, x3, x4),
    yMax: Math.max(y1, y2, y3, y4)
  };
}

// src/readers/renderState.ts
var RenderState = class {
  tranfoMatrix = mat3Identity();
  spriteIndex = -1;
  customisationIndex = -1;
  childrenRecursiveCount = -1;
  alpha = 1;
  multiplicativeColor = [1, 1, 1, 1];
  additiveColor = [0, 0, 0, 0];
  maskFlags = 0;
  blendMode = 0;
  colorMatrix = null;
  flashFilter = null;
  reset() {
    this.tranfoMatrix = mat3Identity();
    this.spriteIndex = -1;
    this.customisationIndex = -1;
    this.childrenRecursiveCount = -1;
    this.alpha = 1;
    this.multiplicativeColor = [1, 1, 1, 1];
    this.additiveColor = [0, 0, 0, 0];
    this.maskFlags = 0;
    this.blendMode = 0;
    this.colorMatrix = null;
    this.flashFilter = null;
  }
  compute(data) {
    const num = data.u8;
    if (num & 2 /* SpriteOpacity */) this.alpha = data.u8 / 127;
    data.align(4);
    if (num & (1 /* SpriteIndex */ | 32 /* CustomisationIndex */)) {
      this.spriteIndex = data.i16;
      this.customisationIndex = data.i16;
      this.childrenRecursiveCount = data.i16;
      data.align(4);
    }
    if (num & 4 /* SpriteColorMultiply */) this.multiplicativeColor = data.readRgba();
    if (num & 8 /* SpriteColorAdditive */) this.additiveColor = data.readRgba();
    if (num & 16 /* Matrix */) {
      this.tranfoMatrix = mat3From(
        data.f32,
        data.f32,
        data.f32,
        data.f32,
        data.f32,
        data.f32,
        0,
        0,
        1
      );
    }
    if (num & 64 /* Mask */) {
      this.maskFlags = data.u8;
      data.skip(3);
    }
    if (num & 128 /* ExtendedFilterAndBlendModes */) {
      this.flashFilter = emptyFlashFilters();
      this.computeExtendedFilterAndBlendState(data);
    }
  }
  computeExtendedFilterAndBlendState(data) {
    const num = data.u8;
    this.blendMode = data.u8;
    data.skip(2);
    if (num & 64 /* ColorMatrixFilter */) this.colorMatrix = data.readF32Array(20);
    const filterCount = data.u8;
    for (let i = 0; i < filterCount; i++) {
      const value = data.u8;
      data.align(4);
      if (value & 1 /* DropShadowFilter */) this.computeDropShadowFilter(data);
      if (value & 2 /* BlurFilter */) this.computeBlurFilter(data);
      if (value & 4 /* GlowFilter */) this.computeGlowFilter(data);
    }
    data.align(4);
  }
  computeBlurFilter(data) {
    if (!this.flashFilter) return;
    this.flashFilter.blurFilters.push({ blurX: data.f32, blurY: data.f32, numPasses: data.i32 });
    this.flashFilter.filterOrder.push(0 /* Blur */);
  }
  computeGlowFilter(data) {
    if (!this.flashFilter) return;
    this.flashFilter.glowFilters.push({
      glowColor: data.readRgba(),
      blurX: data.f32,
      blurY: data.f32,
      strength: data.f32,
      inner: data.bool,
      knockout: data.bool,
      compositeSource: data.bool,
      numPasses: data.skip(1).u32
    });
    this.flashFilter.filterOrder.push(1 /* Glow */);
  }
  computeDropShadowFilter(data) {
    if (!this.flashFilter) return;
    this.flashFilter.dropShadowFilters.push({
      dropShadowColor: data.readRgba(),
      blurX: data.f32,
      blurY: data.f32,
      angle: data.f32,
      distance: data.f32,
      strength: data.f32,
      inner: data.bool,
      knockout: data.bool,
      compositeSource: data.bool,
      numPasses: data.skip(1).u32
    });
    this.flashFilter.filterOrder.push(2 /* DropShadow */);
  }
};

// src/readers/animationInstance.ts
var AnimationInstance = class {
  frameCount;
  nodeCount;
  labelCount;
  combinedNodeState;
  labels;
  frameDataPositions;
  _data;
  _renderStates;
  _renderStateFresh = true;
  constructor(data) {
    this.frameCount = data.u16;
    this.nodeCount = data.u16;
    this.labelCount = data.u16;
    this.combinedNodeState = data.u8;
    this.labels = [];
    data.pos = 8;
    for (let i = 0; i < this.labelCount; i++) {
      const frame = data.u16;
      const label = data.str(data.u8);
      data.align(2);
      this.labels.push({ frame, label });
    }
    data.align(4);
    this.frameDataPositions = data.readI32Multiple(this.frameCount);
    this._data = data;
    this._renderStates = Array.from({ length: this.nodeCount }, () => new RenderState());
  }
  get renderStates() {
    return this._renderStates;
  }
  /** Yields frame indices, advancing internal render-state cursors as a side effect. */
  *iterFrameData(maxFrame, startFrame = 0) {
    this._claimRenderStates();
    const limit = maxFrame ?? this.frameCount;
    const start = startFrame < 0 ? Math.max(this.frameCount + startFrame, 0) : startFrame;
    if (start > 0) {
      for (let i = 0; i < start; i++) {
        this._data.pos = this.frameDataPositions[i];
        for (const _ of this.iterRenderStates()) {
        }
      }
    }
    for (let i = 0; i < limit; i++) {
      this._data.pos = this.frameDataPositions[(i + start) % this.frameCount];
      yield i;
    }
  }
  *iterRenderStates() {
    for (let i = 0; i < this.nodeCount; i++) {
      const state = this._renderStates[this._data.i16];
      state.compute(this._data);
      yield state;
    }
  }
  _claimRenderStates() {
    if (!this._renderStateFresh) for (let i = 0; i < this._renderStates.length; i++) this._renderStates[i].reset();
    this._renderStateFresh = false;
  }
};

// src/data/boneLoader.ts
async function getBoneData(boneName, isMapAnimation) {
  const loader = getLoader();
  try {
    return await loader.loadBone(boneName, isMapAnimation);
  } catch (err) {
    if (boneName === "666") throw err;
    try {
      return await loader.loadBone("666");
    } catch {
      throw err;
    }
  }
}
async function getAnimation(boneName, animation, isMapAnimation) {
  const data = await getLoader().loadAnimationData(boneName, animation.name, isMapAnimation);
  return new AnimationInstance(new BinaryReader(data));
}

// src/renderer/nodeStructure.ts
function isDataGroup(group) {
  const first = group[0];
  return first !== void 0 && "vertexes" in first;
}
function isSpriteGroup(group) {
  const first = group[0];
  return first !== void 0 && "sprite" in first;
}

// src/renderer/skinAssetPart.ts
var VERTEX_STRIDE = 20;
function buildVertexBufferWithBounds(source, startVertex, vertexCount) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  const buf = new ArrayBuffer(vertexCount * VERTEX_STRIDE);
  const view = new DataView(buf);
  for (let i = 0; i < vertexCount; i++) {
    const v = source.vertices[startVertex + i];
    view.setFloat32(i * VERTEX_STRIDE, v.pos.x, true);
    view.setFloat32(i * VERTEX_STRIDE + 4, v.pos.y, true);
    view.setFloat32(i * VERTEX_STRIDE + 8, v.pos.z, true);
    view.setFloat32(i * VERTEX_STRIDE + 12, v.uv.x, true);
    view.setFloat32(i * VERTEX_STRIDE + 16, v.uv.y, true);
    if (v.pos.x < xMin) xMin = v.pos.x;
    if (v.pos.y < yMin) yMin = v.pos.y;
    if (v.pos.x > xMax) xMax = v.pos.x;
    if (v.pos.y > yMax) yMax = v.pos.y;
  }
  return { buffer: buf, bounds: { xMin, yMin, xMax, yMax } };
}
var Vertexs = class {
  textureId;
  vertexData;
  indices;
  mask;
  bounds;
  constructor(textureId, source, startVertex, vertexCount, startIndex, indexCount, mask, useU32Indices) {
    this.textureId = textureId;
    this.mask = mask;
    const { buffer, bounds } = buildVertexBufferWithBounds(source, startVertex, vertexCount);
    this.vertexData = buffer;
    this.bounds = bounds;
    const tris = source.triangles.slice(startIndex, startIndex + indexCount);
    this.indices = useU32Indices ? new Uint32Array(tris) : new Uint16Array(tris);
  }
  /** Transform bounding-box corners by mat and return [x0,y0,…,x3,y3]. */
  transformedBounds(mat) {
    return transformAABB(this.bounds, mat);
  }
  render(ctx, program) {
    ctx.useProgram(program);
    ctx.drawIndexed(this.vertexData, this.indices);
  }
};
var SkinAssetPart = class {
  source;
  name;
  entry;
  validSkinChunk;
  transformMatrixEntry;
  skinChunks;
  constructor(stub, source, textureOffset, useU32Indices) {
    this.source = source;
    this.name = stub.name;
    this.entry = stub.DisplayListEntry;
    this.validSkinChunk = stub.skinChunks.some((c) => c.vertexCount > 0);
    this.transformMatrixEntry = this._createTransfoMatrix(stub.DisplayListEntry);
    this.skinChunks = this._createSkinChunks(stub, source, textureOffset, useU32Indices);
  }
  getSymbolName(entry) {
    return this.source.referencedSymbols[entry.symbolId];
  }
  computeIndexUpdate(index, drawIndex) {
    const nextIndex = index + 1;
    const endIndex = nextIndex + Math.max(this.entry[index].entries, 0);
    let newDrawIndex = drawIndex;
    for (const e of this.entry.slice(nextIndex, endIndex)) {
      if (e.entries === -1) newDrawIndex++;
    }
    return [endIndex, newDrawIndex];
  }
  computeTransfo(index, transfo) {
    const m = this.transformMatrixEntry[index];
    if (!m) return mat3Identity();
    return transfo === null ? m : mat3Mul(transfo, m);
  }
  _createTransfoMatrix(entries) {
    return entries.map((e) => {
      const t = e.transform;
      return mat3From(
        t.rX,
        -t.rY,
        t.tX,
        -t.uX,
        t.uY,
        -t.tY,
        0,
        0,
        1
      );
    });
  }
  _createSkinChunks(stub, source, textureOffset, useU32Indices) {
    return stub.skinChunks.map((s) => new Vertexs(s.textureIndex + textureOffset, source, s.startVertexIndex, s.vertexCount, s.startIndexIndex, s.indexCount, s.maskState, useU32Indices));
  }
};

// src/data/skinLoader.ts
async function getSkin(skinId) {
  return getLoader().loadSkin(skinId);
}

// src/renderer/assetStore.ts
var AssetStore = class {
  constructor(_ctx) {
    this._ctx = _ctx;
  }
  _ctx;
  _bones = /* @__PURE__ */ new Map();
  _skins = /* @__PURE__ */ new Map();
  bone(key, isMapAnimation) {
    const existing = this._bones.get(key);
    if (existing) return existing.promise;
    const entry = { promise: this._loadBone(key, isMapAnimation) };
    entry.promise.then((r) => entry.resolved = r).catch(() => this._bones.delete(key));
    this._bones.set(key, entry);
    return entry.promise;
  }
  async _loadBone(resolvedName, isMapAnimation) {
    const { bone, skin } = await getBoneData(resolvedName, isMapAnimation);
    const textureBase = this._ctx.loadTextureBlock(skin.images);
    return { data: bone, boneAsset: skin.skin, textureBase, textureCount: skin.images.length };
  }
  skin(id) {
    const existing = this._skins.get(id);
    if (existing) return existing.promise;
    const entry = { promise: this._loadSkin(id) };
    entry.promise.then((r) => entry.resolved = r).catch(() => this._skins.delete(id));
    this._skins.set(id, entry);
    return entry.promise;
  }
  async _loadSkin(id) {
    const { skin, images } = await getSkin(id);
    const textureBase = this._ctx.loadTextureBlock(images);
    return { skin, textureBase, textureCount: images.length };
  }
  /** Free every bone/skin block not present in the live sets. Run once, from the root. */
  sweep(liveBones, liveSkins) {
    for (const [key, entry] of [...this._bones]) {
      if (!liveBones.has(key)) this._release(this._bones, key, entry);
    }
    for (const [id, entry] of [...this._skins]) {
      if (!liveSkins.has(id)) this._release(this._skins, id, entry);
    }
  }
  /** Free everything (full teardown). */
  clear() {
    this.sweep(/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set());
  }
  _release(map, key, entry) {
    map.delete(key);
    if (entry.resolved) this._ctx.freeTextureBlock(entry.resolved.textureBase, entry.resolved.textureCount);
    else entry.promise.then((r) => this._ctx.freeTextureBlock(r.textureBase, r.textureCount)).catch(() => {
    });
  }
};

// src/data/skinSlots.ts
var slotEnumNames = {
  0: "Bandeau_",
  1: "BandeauB_",
  2: "Barbe_",
  3: "Chapeau_",
  4: "ChapeauB_",
  5: "cheveux_",
  20: "Frange_",
  6: "Custo_",
  7: "Oreille_d_",
  8: "Oreille_g_",
  9: "Oreille_",
  10: "Oreille_b_",
  11: "Masque_",
  12: "MasqueB_",
  13: "NatteHaute_",
  16: "Natte_",
  17: "NatteB_",
  19: "Natte_Basse_",
  14: "Patte_d_",
  15: "Patte_g_",
  18: "Patte_0",
  21: "Tete_OL_"
};
var SkinSlot = class _SkinSlot {
  _slotRules;
  constructor(data) {
    this._slotRules = /* @__PURE__ */ new Map();
    for (const [skinId, entry] of Object.entries(data)) {
      const skinRules = /* @__PURE__ */ new Map();
      for (const elem of entry.slotRulesList) {
        let byType = skinRules.get(elem.slotRuleType);
        if (!byType) {
          byType = /* @__PURE__ */ new Map();
          skinRules.set(elem.slotRuleType, byType);
        }
        byType.set(elem.slotRuleInfo, elem.slotsRules);
      }
      this._slotRules.set(Number(skinId), skinRules);
    }
  }
  static async create() {
    const data = await getLoader().loadSkinSlots();
    return new _SkinSlot(data);
  }
  slotFromBody(skins, body) {
    if (skins.length <= 2 || body === void 0) return /* @__PURE__ */ new Set();
    return this.getSkinSlot(skins.slice(2), body.breed, body.gender, skins[1]);
  }
  getSkinSlot(skins, breed, sex, face) {
    const breedAndSex = 2 * breed + sex;
    const slotSet = /* @__PURE__ */ new Set();
    const rules = [
      [3 /* Face */, face],
      [2 /* BreedAndSex */, breedAndSex],
      [1 /* Breed */, breed],
      [0 /* Default */, 0]
    ];
    for (const skin of skins) {
      const skinData = this._slotRules.get(skin);
      if (!skinData) continue;
      const slot = this.slotFromRules(skinData, rules);
      if (slot) this.updateSlotSet(slot, slotSet);
    }
    return slotSet;
  }
  slotFromRules(slotSkin, rules) {
    for (const [ruleType, key] of rules) {
      const slot = slotSkin.get(ruleType)?.get(key);
      if (slot) return slot;
    }
    return void 0;
  }
  updateSlotSet(slotRules, slotSet) {
    for (const slotRule of slotRules) {
      const skipTest = (slotRule.mask & 1) === 0;
      for (let i = 0; i < 5; i++) {
        if (skipTest || (slotRule.mask & 1 << (i + 1 & 31)) === 0) {
          const index = i > 2 ? i + 2 : i;
          const name = slotEnumNames[slotRule.id];
          if (name) slotSet.add(`${name}${index}`);
        }
      }
    }
  }
};
var _skinSlotsPromise;
function getSkinSlots() {
  return _skinSlotsPromise ??= SkinSlot.create();
}

// src/renderer/assetManager.ts
function skipMissingSkin(err) {
  if (!(err instanceof HttpError && err.status === 404)) throw err;
}
var AssetManager = class {
  look;
  openGl;
  isMapAnimation;
  data;
  boneAsset;
  animations;
  _textureIndexDict = /* @__PURE__ */ new Map();
  _skinsDict = /* @__PURE__ */ new Map();
  _customSymbolRef = /* @__PURE__ */ new Map();
  _intendedEmpty = /* @__PURE__ */ new Set();
  _rulesEmpty = /* @__PURE__ */ new Set();
  _dictPartIndex = /* @__PURE__ */ new Map();
  _dictPartIndexCustom = /* @__PURE__ */ new Map();
  _dictPart = /* @__PURE__ */ new Map();
  _processedPart = /* @__PURE__ */ new Map();
  constructor(look, openGl, isMapAnimation) {
    this.look = look;
    this.openGl = openGl;
    this.isMapAnimation = isMapAnimation ?? false;
  }
  async _init(boneName) {
    await Promise.all([this._getBone(boneName), this._getSkinDict()]);
    this._getCustomSymbol();
    this._getEmptyCustomisation();
    const [skinSlots, body] = await Promise.all([getSkinSlots(), this.look.getBody()]);
    this._rulesEmpty = skinSlots.slotFromBody(this.look.skins, body);
    this.animations = this._getAnimationDict();
  }
  // ── Initialisation helpers ────────────────────────────────────────────────────
  async _getBone(boneName) {
    const resolved = boneName ?? (this.look.bone !== 1 ? String(this.look.bone) : "1-static");
    const r = await this.openGl.assetStore.bone(resolved, this.isMapAnimation);
    this.data = r.data;
    this.boneAsset = r.boneAsset;
    this._textureIndexDict.set("main", r.textureBase);
  }
  async _getSkinDict() {
    const results = /* @__PURE__ */ new Map();
    await Promise.all(
      this.look.skins.map(async (skinId) => {
        try {
          const r = await this.openGl.assetStore.skin(skinId);
          this._setSkinOffset(skinId, r);
          results.set(skinId, r.skin);
        } catch (err) {
          skipMissingSkin(err);
        }
      })
    );
    for (const skinId of this.look.skins) {
      const skin = results.get(skinId);
      if (skin !== void 0) this._skinsDict.set(skinId, skin);
    }
  }
  /** Record a skin's shared texture base under both lookup keys used while building parts. */
  _setSkinOffset(skinId, r) {
    this._textureIndexDict.set(String(skinId), r.textureBase);
    this._textureIndexDict.set(r.skin.m_Name, r.textureBase);
  }
  _getCustomSymbol() {
    this._customSymbolRef.clear();
    for (const skin of this._skinsDict.values()) {
      for (const symbol of skin.m_keys) this._customSymbolRef.set(symbol, skin);
      for (const empty of skin.emptyCustomisations) this._customSymbolRef.delete(empty);
    }
  }
  _getEmptyCustomisation() {
    this._intendedEmpty.clear();
    for (const skin of this._skinsDict.values()) {
      for (const e of skin.emptyCustomisations) this._intendedEmpty.add(e);
    }
  }
  _getAnimationDict() {
    return new Map(this.data.animations.map((a) => [a.name, a]));
  }
  // ── Asset resolution ──────────────────────────────────────────────────────────
  _getSkinAssetPartByIndex(index) {
    if (index < 0 || index >= this.data.graphics.length) return null;
    const cached = this._dictPartIndex.get(index);
    if (cached) return cached;
    const graphic = this.data.graphics[index];
    const textureOffset = this._textureIndexDict.get("main");
    const part = new SkinAssetPart(graphic.part, this.boneAsset, textureOffset, this.openGl.supportsU32Indices);
    this._dictPartIndex.set(index, part);
    return part;
  }
  _getCustomSymbolName(customIndex) {
    return this.data.exposedNodeNames[customIndex];
  }
  _getSkinCustomAssetPart(symbolName) {
    const cached = this._dictPartIndexCustom.get(symbolName);
    if (cached) return cached;
    if (this._rulesEmpty.has(symbolName)) {
      const r2 = [null, true];
      this._dictPartIndexCustom.set(symbolName, r2);
      return r2;
    }
    if (symbolName.startsWith("carried_")) {
      const node = this._getCarriedSubEntityNode(symbolName);
      if (node) {
        const r2 = [node, true];
        this._dictPartIndexCustom.set(symbolName, r2);
        return r2;
      }
    } else {
      const skin = this._customSymbolRef.get(symbolName);
      if (skin) {
        const textureOffset = this._textureIndexDict.get(skin.m_Name);
        const stub = skin.m_values[skin.m_keys.indexOf(symbolName)];
        const part = new SkinAssetPart(stub, skin, textureOffset, this.openGl.supportsU32Indices);
        const r2 = [part, true];
        this._dictPartIndexCustom.set(symbolName, r2);
        return r2;
      }
    }
    const r = [null, this._intendedEmpty.has(symbolName)];
    this._dictPartIndexCustom.set(symbolName, r);
    return r;
  }
  _getCarriedSubEntityNode(index) {
    const sprite = this.getSubEntity(index);
    if (!sprite) return null;
    return { sprite, name: index, transformation: null };
  }
  getSkinAssetPart(node) {
    if (node.spriteIndex === -1 && node.customisationIndex === -1) return [false, null, false];
    const key = `${Math.max(-2, node.customisationIndex)}:${Math.max(-1, node.spriteIndex)}`;
    const cached = this._dictPart.get(key);
    if (cached) return cached;
    let isCustomised = false;
    let graphic = this._getSkinAssetPartByIndex(node.spriteIndex);
    if (node.customisationIndex !== -1) {
      if (graphic === null) {
        const symbolName = this._getCustomSymbolName(node.customisationIndex);
        if (symbolName) [graphic, isCustomised] = this._getSkinCustomAssetPart(symbolName);
      } else {
        [graphic, isCustomised] = this._getSkinCustomAssetPart(graphic.name);
      }
    }
    const result = graphic === null ? [false, null, isCustomised] : [graphic instanceof SkinAssetPart ? graphic.validSkinChunk : true, graphic, isCustomised];
    this._dictPart.set(key, result);
    return result;
  }
  // ── Part processing ───────────────────────────────────────────────────────────
  processPart(part) {
    const name = part.name;
    const cached = this._processedPart.get(name);
    if (cached) return cached;
    const data = part instanceof SkinAssetPart ? this._iterEntry(part) : [[part]];
    const node = { index: name, data };
    this._processedPart.set(name, node);
    return node;
  }
  _iterEntry(assetPart) {
    const elements = this._walk(assetPart, null);
    const groups = [];
    let i = 0;
    while (i < elements.length) {
      const key = elements[i]?.vertexes?.mask;
      let j = i + 1;
      while (j < elements.length && elements[j]?.vertexes?.mask === key) j++;
      groups.push(elements.slice(i, j));
      i = j;
    }
    return groups;
  }
  _walk(part, transformation) {
    const result = [];
    let index = 0;
    let drawIndex = 0;
    while (index < part.entry.length) {
      const entry = part.entry[index];
      if (entry.entries === -1) {
        const vertex = part.skinChunks[drawIndex];
        if (vertex !== void 0) {
          result.push({ transformation: transformation ?? mat3Identity(), vertexes: vertex });
          drawIndex++;
        }
        index++;
        continue;
      }
      if (entry.symbolId < 0) {
        index++;
        continue;
      }
      const symbolName = part.getSymbolName(entry);
      if (!symbolName || part.name === symbolName) {
        index++;
        continue;
      }
      const [newPart, isCustomised] = this._getSkinCustomAssetPart(symbolName);
      if (newPart === null && !isCustomised) {
        index++;
        continue;
      }
      if (newPart instanceof SkinAssetPart) {
        if (newPart.source === part.source) {
          index++;
          continue;
        }
        const transfo = part.computeTransfo(index, transformation);
        const sub = this._walk(newPart, transfo);
        if (sub.length > 0) result.push(...sub);
      } else if (newPart !== null) {
        const transfo = part.computeTransfo(index, transformation);
        result.push({ sprite: newPart.sprite, name: newPart.name, transformation: transfo });
      }
      [index, drawIndex] = part.computeIndexUpdate(index, drawIndex);
    }
    return result;
  }
  async changeBone(boneName, cleanCache = true) {
    await this._getBone(boneName);
    this.animations = this._getAnimationDict();
    if (cleanCache) this._clearCustomCaches();
  }
  _clearCustomCaches() {
    this._dictPartIndexCustom.clear();
    this._dictPartIndex.clear();
    this._dictPart.clear();
    this._processedPart.clear();
  }
  async changeSkins(newSkins, cleanCache = true) {
    for (const id of this.look.skins) {
      if (!newSkins.includes(id)) {
        this._skinsDict.delete(id);
        this._textureIndexDict.delete(String(id));
      }
    }
    await Promise.all(newSkins.map(async (id) => {
      if (this._skinsDict.has(id)) return;
      try {
        const r = await this.openGl.assetStore.skin(id);
        this._setSkinOffset(id, r);
        this._skinsDict.set(id, r.skin);
      } catch (err) {
        skipMissingSkin(err);
      }
    }));
    const ordered = /* @__PURE__ */ new Map();
    for (const id of newSkins) {
      const skin = this._skinsDict.get(id);
      if (skin !== void 0) ordered.set(id, skin);
    }
    this._skinsDict = ordered;
    this.look.skins = [...newSkins];
    this._getCustomSymbol();
    this._getEmptyCustomisation();
    const [skinSlots, body] = await Promise.all([getSkinSlots(), this.look.getBody()]);
    this._rulesEmpty = skinSlots.slotFromBody(this.look.skins, body);
    if (cleanCache) this._clearCustomCaches();
  }
  /** Add the resources this manager currently references */
  collectResourceKeys(bones, skins) {
    bones.add(this.data.m_Name);
    for (const id of this.look.skins) skins.add(id);
  }
  getSymbolNameIndex(symbolName, addIfNotExist = false) {
    if (!symbolName || !this._customSymbolRef.has(symbolName)) return -1;
    const idx = this.data.exposedNodeNames.indexOf(symbolName);
    if (idx !== -1) return idx;
    if (!addIfNotExist) return -1;
    this.data.exposedNodeNames.push(symbolName);
    return this.data.exposedNodeNames.length - 1;
  }
  customSymbolRefNames() {
    return [...this._customSymbolRef.keys()];
  }
};

// src/renderer/context.ts
function renderContextFromState(state, scaleMatrix, customColor, mask) {
  return {
    multiplicativeColor: state.multiplicativeColor,
    additiveColor: state.additiveColor,
    tranfoMatrix: mat3Mul(scaleMatrix, state.tranfoMatrix),
    blendMode: state.blendMode,
    alpha: state.alpha,
    maskFlags: mask !== 0 ? mask : state.maskFlags,
    customColor,
    colorMatrix: state.colorMatrix
  };
}

// src/renderer/buffer.ts
function isSubSpriteRef(entry) {
  return entry.subSprite !== void 0;
}
function computeTransforms(ctx, elements) {
  return elements.map((e) => mat3Mul(ctx.tranfoMatrix, e.transformation));
}
function makeBufferElement(ctx, elements) {
  const transforms = computeTransforms(ctx, elements);
  return { context: ctx, nodeElement: elements, transforms };
}
var Buffer = class extends Array {
  _spriteIndex = /* @__PURE__ */ new Map();
  appendNode(node, frameNb, state, scaleMatrix, customColor) {
    for (const group of node.data) {
      if (isDataGroup(group)) {
        const ctx = renderContextFromState(state, scaleMatrix, customColor, group[0].vertexes.mask);
        this.push(makeBufferElement(ctx, group));
      } else if (isSpriteGroup(group)) {
        for (const spriteNode of group) {
          this._appendSprite(spriteNode, frameNb, state.tranfoMatrix);
        }
      }
    }
  }
  _appendSprite(node, frameNb, transfo) {
    const subSprite = node.sprite;
    if (!subSprite.parent) return;
    const parent = subSprite.parent;
    if (!subSprite.currentRendering) {
      parent.setupSubAnim(subSprite, node.name);
      if (!subSprite.currentRendering) return;
    }
    const scaleWithOffset = mat3Translation(transfo, parent.look.size);
    let transformMatrix = node.transformation === null ? scaleWithOffset : mat3Mul(scaleWithOffset, node.transformation);
    if (subSprite.flip) mat3FlipX(transformMatrix);
    const maxParentFrame = subSprite.subAnimLoop ? Number.POSITIVE_INFINITY : subSprite.buffer(subSprite.currentRendering).length;
    const ref = {
      subSprite,
      subAnimName: subSprite.currentRendering,
      transform: transformMatrix,
      maxParentFrame,
      emittedAtParentFrame: frameNb
    };
    this._pushSprite(node.name, ref);
  }
  // Avoid duplicate sub-sprite mounting when the same carrier appears multiple times.
  _pushSprite(name, ref) {
    const existing = this._spriteIndex.get(name);
    if (existing !== void 0) {
      this.splice(existing, 1);
      for (const [n, i] of this._spriteIndex) if (i > existing) this._spriteIndex.set(n, i - 1);
    }
    this._spriteIndex.set(name, this.length);
    this.push(ref);
  }
};
function computeBufferLocalBounds(frames) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const frame of frames) {
    for (const entry of frame) {
      if (isSubSpriteRef(entry)) {
        const local = entry.subSprite.getLocalBounds(entry.subAnimName);
        if (!isFinite(local.xMin)) continue;
        const aabb = transformAABB(local, entry.transform);
        if (aabb.xMin < xMin) xMin = aabb.xMin;
        if (aabb.yMin < yMin) yMin = aabb.yMin;
        if (aabb.xMax > xMax) xMax = aabb.xMax;
        if (aabb.yMax > yMax) yMax = aabb.yMax;
        continue;
      }
      for (let i = 0; i < entry.nodeElement.length; i++) {
        const corners = entry.nodeElement[i].vertexes.transformedBounds(entry.transforms[i]);
        if (corners.xMin < xMin) xMin = corners.xMin;
        if (corners.yMin < yMin) yMin = corners.yMin;
        if (corners.xMax > xMax) xMax = corners.xMax;
        if (corners.yMax > yMax) yMax = corners.yMax;
      }
    }
  }
  return { xMin, yMin, xMax, yMax };
}

// src/renderer/maskRenderer.ts
var MaskRenderer = class {
  _ctx;
  count = 0;
  constructor(ctx) {
    this._ctx = ctx;
  }
  reset() {
    this.count = 0;
  }
  renderElement(bufferElement, parentTransform = null) {
    this._setup(bufferElement.context.maskFlags);
    for (let i = 0; i < bufferElement.nodeElement.length; i++) {
      const elem = bufferElement.nodeElement[i];
      const local = bufferElement.transforms[i];
      const transfo = parentTransform === null ? local : mat3Mul(parentTransform, local);
      this._ctx.setMaskTransfo(transfo, elem.vertexes.textureId);
      elem.vertexes.render(this._ctx, this._ctx.maskProgram);
    }
    this._disable();
  }
  render(element, transfo) {
    this._setup(element.vertexes.mask);
    this._ctx.setMaskTransfo(transfo, element.vertexes.textureId);
    element.vertexes.render(this._ctx, this._ctx.maskProgram);
    this._disable();
  }
  _setup(mask) {
    const gl = this._ctx.gl;
    gl.disable(gl.BLEND);
    gl.enable(gl.STENCIL_TEST);
    gl.colorMask(false, false, false, false);
    if (mask === 1 /* SetMask */) {
      gl.stencilFunc(gl.ALWAYS, 0, 255);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      this.count++;
    } else {
      gl.stencilFunc(gl.ALWAYS, 0, 255);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR);
      this.count--;
    }
  }
  _disable() {
    const gl = this._ctx.gl;
    gl.colorMask(true, true, true, true);
    gl.enable(gl.BLEND);
  }
};

// src/renderer/frameRenderer.ts
var FrameRenderer = class {
  _openGl;
  _look;
  mask;
  constructor(openGl, look) {
    this._openGl = openGl;
    this._look = look;
    this.mask = new MaskRenderer(openGl);
  }
  /**
   * compute animation size
   */
  getAnimationSize(bounds, localBounds, compute = false) {
    const hasValidBounds = bounds !== null && bounds.width !== null;
    if (!hasValidBounds || compute) {
      if (!isFinite(localBounds.xMin)) return [1, 1, 0, 0];
      return [
        localBounds.xMax - localBounds.xMin,
        localBounds.yMax - localBounds.yMin,
        localBounds.xMin,
        localBounds.yMin
      ];
    }
    const s = this._look.size;
    return [(bounds.width ?? 1) * s, (bounds.height ?? 1) * s, (bounds.x ?? 0) * s, (bounds.y ?? 0) * s];
  }
  setRenderSize(scale, bounds, localBounds, compute = false, forcedSize, flipX = false, flipY = false) {
    let [w, h, ox, oy] = this.getAnimationSize(bounds, localBounds, compute);
    if (forcedSize) {
      const maxDim = Math.max(w, h);
      if (maxDim > 0) {
        scale *= forcedSize / maxDim;
        ox -= (maxDim - w) / 2;
        oy -= (maxDim - h) / 2;
        w = maxDim;
        h = maxDim;
      }
    }
    this._openGl.setBound(w, h, ox, oy, scale, flipX, flipY);
  }
  /**
   * Render one frame to the canvas.
   * `frameIndex` is the global tick counter — it is never reset.
   * so each sub-sprite loops at its own period via `frameIndex % subFrames.length`.
   */
  renderFrame(frames, frameIndex) {
    this._openGl.clear();
    this.mask.reset();
    this._renderEntries(frames, frameIndex, null);
  }
  _renderEntries(frames, frameIndex, parentTransform) {
    if (frames.length === 0) return;
    const buffer = frames[frameIndex % frames.length];
    if (!buffer) return;
    for (const entry of buffer) {
      this._renderEntry(entry, frameIndex, parentTransform);
    }
  }
  _renderEntry(entry, frameIndex, parentTransform) {
    if (isSubSpriteRef(entry)) {
      if (frameIndex - entry.emittedAtParentFrame >= entry.maxParentFrame) return;
      const subFrames = entry.subSprite.buffer(entry.subAnimName);
      if (subFrames.length === 0) return;
      const childTransform = parentTransform === null ? entry.transform : mat3Mul(parentTransform, entry.transform);
      this._renderEntries(subFrames, frameIndex, childTransform);
      return;
    }
    switch (entry.context.maskFlags) {
      case 0 /* NONE */:
        this._openGl.gl.disable(this._openGl.gl.STENCIL_TEST);
        this._renderNode(entry, parentTransform);
        break;
      case 4 /* ClearMask */:
      case 1 /* SetMask */:
        this.mask.renderElement(entry, parentTransform);
        break;
      case 2 /* ObeyMask */:
        this._openGl.gl.enable(this._openGl.gl.STENCIL_TEST);
        this._openGl.gl.stencilFunc(this._openGl.gl.EQUAL, this.mask.count, 255);
        this._openGl.gl.stencilOp(this._openGl.gl.KEEP, this._openGl.gl.KEEP, this._openGl.gl.KEEP);
        this._renderNode(entry, parentTransform);
        break;
    }
  }
  _renderNode(bufferElement, parentTransform) {
    const ctx = bufferElement.context;
    this._openGl.setupBlendMode(ctx.blendMode);
    this._openGl.setRenderUniforms(ctx.multiplicativeColor, ctx.additiveColor, ctx.customColor, ctx.colorMatrix);
    for (let i = 0; i < bufferElement.nodeElement.length; i++) {
      const element = bufferElement.nodeElement[i];
      const local = bufferElement.transforms[i];
      const transfo = parentTransform === null ? local : mat3Mul(parentTransform, local);
      this._openGl.setRenderUniformsPerVertex(element.vertexes.textureId, transfo);
      element.vertexes.render(this._openGl, this._openGl.program);
    }
  }
};

// src/renderer/shaders.ts
var RENDER_VERT = `
precision highp float;
precision highp int;

attribute vec3 in_pos;
attribute vec2 in_uv;

varying vec2 uv;
varying vec4 process_multiplicative_color;

uniform vec4 multiplicative_color;
uniform mat3 transfo;
uniform vec3 custom_color[16];

void main() {
    vec2 scale_pos = (transfo * vec3(in_pos.xy, 1.0)).xy;
    gl_Position = vec4(scale_pos, 0.0, 1.0);
    uv = in_uv;
    int idx = int(in_pos.z + 0.5);
    process_multiplicative_color = idx != 0 ? multiplicative_color * vec4(custom_color[idx], 1.0) : multiplicative_color;
}
`;
var RENDER_FRAG = `
precision highp float;
precision highp int;

uniform sampler2D Texture;
uniform vec4 additive_color;
uniform int FLASH_BLEND;
uniform bool FLASH_FILTER_COLOR_MATRIX;
uniform vec4 _ColorMatrix[5];

varying vec2 uv;
varying vec4 process_multiplicative_color;

void main() {
    vec4 texColor = texture2D(Texture, uv);
    if (texColor.a < 0.01) discard;

    texColor = texColor * process_multiplicative_color + additive_color;

    if (FLASH_FILTER_COLOR_MATRIX) {
        vec4 tmp;
        tmp.x = dot(texColor, _ColorMatrix[0]);
        tmp.y = dot(texColor, _ColorMatrix[1]);
        tmp.z = dot(texColor, _ColorMatrix[2]);
        tmp.w = dot(texColor, _ColorMatrix[3]);
        texColor = tmp + _ColorMatrix[4];
    }

    vec4 outColor;
    if (FLASH_BLEND == 0) {
        outColor = texColor;
    } else if (FLASH_BLEND == 1) {
        // MULTIPLY keyword
        outColor.rgb = texColor.aaa * (texColor.rgb - vec3(1.0)) + vec3(1.0);
        outColor.a = texColor.a;
    } else if (FLASH_BLEND == 2) {
        // SCREEN keyword
        outColor.rgb = texColor.aaa * texColor.rgb;
        outColor.a = texColor.a;
    } else {
        // INVERT keyword (FLASH_BLEND == 3)
        outColor = texColor.aaaa;
    }
    gl_FragColor = outColor;
}
`;
var MASK_VERT = `
precision highp float;

attribute vec3 in_pos;
attribute vec2 in_uv;

varying vec2 uv;

uniform mat3 transfo_m;


void main() {
  vec2 scale_pos = (transfo_m * vec3(in_pos.xy, 1.0)).xy;
  gl_Position = vec4(scale_pos, 0.0, 1.0);
  uv = in_uv;
}
`;
var MASK_FRAG = `
precision highp float;

uniform sampler2D Texture_m;
varying vec2 uv;

void main() {
  if (texture2D(Texture_m, uv).a < 0.1) discard;
  gl_FragColor = vec4(0.0);
}
`;

// src/renderer/rendererContext.ts
var ATTR_LOC_POS = 0;
var ATTR_LOC_UV = 1;
var GLBackend = class {
  static _buildBlendModes(gl, MIN, MAX) {
    const ADD = gl.FUNC_ADD;
    const RSUB = gl.FUNC_REVERSE_SUBTRACT;
    const SA = gl.SRC_ALPHA;
    const OMSA = gl.ONE_MINUS_SRC_ALPHA;
    const OMDA = gl.ONE_MINUS_DST_ALPHA;
    const ONE = gl.ONE;
    const ZERO = gl.ZERO;
    const DST_COLOR = gl.DST_COLOR;
    const OMSC = gl.ONE_MINUS_SRC_COLOR;
    const OMDC = gl.ONE_MINUS_DST_COLOR;
    return {
      [0 /* Normal */]: [SA, OMSA, OMDA, ONE, ADD, ADD],
      [1 /* Normal_Alternative */]: [SA, OMSA, OMDA, ONE, ADD, ADD],
      [2 /* Layer */]: [SA, OMSA, OMDA, ONE, ADD, ADD],
      [11 /* Alpha */]: [SA, OMSA, OMDA, ONE, ADD, ADD],
      [3 /* Multiply */]: [DST_COLOR, ZERO, OMDA, ONE, ADD, ADD],
      [4 /* Screen */]: [ONE, OMSC, OMDA, ONE, ADD, ADD],
      [5 /* Lighten */]: [ONE, ONE, OMDA, ONE, MAX, MAX],
      [6 /* Darken */]: [ONE, ONE, OMDA, ONE, MIN, MIN],
      [8 /* Add */]: [SA, ONE, OMDA, ONE, ADD, ADD],
      [9 /* Subtract */]: [ONE, ONE, OMDA, ONE, RSUB, RSUB],
      [10 /* Invert */]: [OMDC, OMSA, OMDA, ONE, ADD, ADD],
      [12 /* Erase */]: [ZERO, OMSA, OMDA, ONE, ADD, ADD],
      [15 /* PreMultiplied */]: [ONE, OMSA, OMDA, ONE, ADD, ADD]
    };
  }
};
var WebGL2Backend = class extends GLBackend {
  gl;
  hasVAO = true;
  supportsU32Indices = true;
  indexType;
  blendModes;
  constructor(gl) {
    super();
    this.gl = gl;
    this.indexType = gl.UNSIGNED_INT;
    this.blendModes = GLBackend._buildBlendModes(gl, gl.MIN, gl.MAX);
  }
  createVAO() {
    return this.gl.createVertexArray();
  }
  bindVAO(v) {
    this.gl.bindVertexArray(v);
  }
};
var WebGL1Backend = class extends GLBackend {
  gl;
  hasVAO;
  supportsU32Indices;
  indexType;
  blendModes;
  _vaoExt;
  constructor(gl) {
    super();
    const vao = gl.getExtension("OES_vertex_array_object");
    const uint = gl.getExtension("OES_element_index_uint");
    const minmax = gl.getExtension("EXT_blend_minmax");
    console.log(`WebGL1 extension: vao ${!!vao}, uint ${!!uint}, minmax ${!!minmax}`);
    this.gl = gl;
    this._vaoExt = vao;
    this.hasVAO = !!vao;
    this.supportsU32Indices = !!uint;
    this.indexType = uint ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    this.blendModes = GLBackend._buildBlendModes(gl, minmax ? minmax.MIN_EXT : gl.FUNC_ADD, minmax ? minmax.MAX_EXT : gl.FUNC_ADD);
  }
  createVAO() {
    return this._vaoExt ? this._vaoExt.createVertexArrayOES() : null;
  }
  bindVAO(v) {
    if (this._vaoExt) this._vaoExt.bindVertexArrayOES(v);
  }
};
var RendererContext = class _RendererContext {
  gl;
  program;
  maskProgram;
  offset = { x: 0, y: 0 };
  /** Shared pool of bone/skin resources (parsed asset + GL texture block) for every sprite on this context. */
  assetStore = new AssetStore(this);
  _textures = [];
  _freeSlots = /* @__PURE__ */ new Set();
  _uniformCache = /* @__PURE__ */ new Map();
  _currentProgram = null;
  // Shared streaming buffers reused across every draw.
  // Attribute pointers and the element-array binding are baked into the VAO once;
  // each draw just re-uploads vertex + index data.
  _vao = null;
  _vbo = null;
  _ibo = null;
  _buffersReady = false;
  _projection = mat3Identity();
  _projTransfo = mat3Identity();
  _backend;
  constructor(canvas) {
    const opts = { stencil: true, alpha: true, premultipliedAlpha: false, depth: false };
    const gl2 = canvas.getContext("webgl2", opts);
    if (gl2) {
      this._backend = new WebGL2Backend(gl2);
    } else {
      const gl1 = canvas.getContext("webgl", opts);
      if (!gl1) throw new Error("WebGL is not supported in this browser.");
      console.log("WebGL2 is not supported. Falling back to WebGL1");
      this._backend = new WebGL1Backend(gl1);
    }
    this.gl = this._backend.gl;
    this.program = this._createProgram(RENDER_VERT, RENDER_FRAG);
    this.maskProgram = this._createProgram(MASK_VERT, MASK_FRAG);
    this.gl.enable(this.gl.BLEND);
  }
  /** False when vertex indices must be uploaded as Uint16Array (no OES_element_index_uint in WebGL1). */
  get supportsU32Indices() {
    return this._backend.supportsU32Indices;
  }
  static BLEND_KEYWORD = {
    [10 /* Invert */]: 3 /* INVERT */,
    [3 /* Multiply */]: 1 /* MULTIPLY */,
    [6 /* Darken */]: 1 /* MULTIPLY */,
    [4 /* Screen */]: 2 /* SCREEN */,
    [5 /* Lighten */]: 2 /* SCREEN */,
    [9 /* Subtract */]: 2 /* SCREEN */
  };
  static fallbackBlend = /* @__PURE__ */ new Set([2 /* Layer */, 7 /* Difference */, 11 /* Alpha */, 12 /* Erase */, 13 /* Overlay */, 14 /* Hardlight */]);
  useProgram(program) {
    if (this._currentProgram !== program) {
      this.gl.useProgram(program);
      this._currentProgram = program;
    }
  }
  setupBlendMode(blendMode) {
    const compatibleBLendMode = this.compatibleBlendMode(blendMode);
    const params = this._backend.blendModes[compatibleBLendMode];
    if (!params) throw new Error(`Unsupported blend mode: ${blendMode}`);
    const gl = this.gl;
    this.useProgram(this.program);
    gl.blendFuncSeparate(params[0], params[1], params[2], params[3]);
    gl.blendEquationSeparate(params[4], params[5]);
    this._setUniform1i("FLASH_BLEND", _RendererContext.BLEND_KEYWORD[compatibleBLendMode] ?? 0 /* NONE */);
  }
  compatibleBlendMode(blendMode) {
    return _RendererContext.fallbackBlend.has(blendMode) ? 5 : blendMode;
  }
  // ── textures ─────────────────────────────────────────────────────────────────
  loadTexture(image, index) {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error("Failed to create WebGL texture.");
    const slot = index !== void 0 ? index : this._textures.length;
    this._freeSlots.delete(slot);
    gl.activeTexture(gl.TEXTURE0 + slot);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if ("data" in image) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (index !== void 0 && index < this._textures.length) {
      const old = this._textures[index];
      if (old) gl.deleteTexture(old);
      this._textures[index] = tex;
    } else {
      this._textures.push(tex);
    }
    return slot;
  }
  unloadAllTextures() {
    for (const tex of this._textures) if (tex) this.gl.deleteTexture(tex);
    this._textures = [];
    this._freeSlots.clear();
  }
  /**
   * Upload a contiguous run of textures and return the base slot.
   * Reuses a previously freed run when one of the right size exists, otherwise grows the pool.
   */
  loadTextureBlock(images) {
    const base = this._reserveBlock(images.length);
    for (let i = 0; i < images.length; i++) this.loadTexture(images[i], base + i);
    return base;
  }
  /** Delete the GL textures in [base, base+count) and mark their slots reusable. */
  freeTextureBlock(base, count) {
    for (let i = base; i < base + count; i++) {
      const tex = this._textures[i];
      if (tex) {
        this.gl.deleteTexture(tex);
        this._textures[i] = null;
      }
      if (i < this._textures.length) this._freeSlots.add(i);
    }
  }
  /** Find a contiguous run of `count` reusable slots, else return the append index. */
  _reserveBlock(count) {
    if (count <= 0) return this._textures.length;
    if (this._freeSlots.size >= count) {
      if (count === 1) {
        const slot = this._freeSlots.values().next().value;
        this._freeSlots.delete(slot);
        return slot;
      }
      const sorted = [...this._freeSlots].sort((a, b) => a - b);
      let runLen = 1;
      for (let i = 1; i < sorted.length; i++) {
        runLen = sorted[i] === sorted[i - 1] + 1 ? runLen + 1 : 1;
        if (runLen === count) {
          const base = sorted[i] - count + 1;
          for (let s = base; s < base + count; s++) this._freeSlots.delete(s);
          return base;
        }
      }
    }
    return this._textures.length;
  }
  get textureCount() {
    return this._textures.length;
  }
  // ── bounds / size ─────────────────────────────────────────────────────────────
  setBound(width, height, offsetX, offsetY, scale, flipX = false, flipY = false) {
    const gl = this.gl;
    const w = Math.ceil(width * scale / 2) * 2;
    const h = Math.ceil(height * scale / 2) * 2;
    gl.canvas.width = w;
    gl.canvas.height = h;
    gl.viewport(0, 0, w, h);
    this.offset.x = (flipX ? offsetX + width : -offsetX) * scale;
    this.offset.y = (height + offsetY) * scale;
    const sfx = flipX ? -2 / width : 2 / width;
    const sfy = flipY ? -2 / height : 2 / height;
    const p = this._projection;
    p[0] = sfx;
    p[1] = 0;
    p[2] = 0;
    p[3] = 0;
    p[4] = sfy;
    p[5] = 0;
    p[6] = -(flipX ? offsetX + width : offsetX) * sfx - 1;
    p[7] = -(flipY ? offsetY + height : offsetY) * sfy - 1;
    p[8] = 1;
  }
  // ── per-draw uniforms ─────────────────────────────────────────────────────────
  setRenderUniforms(multiplicativeColor, additiveColor, customColor, colorMatrix) {
    const gl = this.gl;
    this.useProgram(this.program);
    gl.uniform4fv(this._uniform("multiplicative_color"), multiplicativeColor);
    gl.uniform4fv(this._uniform("additive_color"), additiveColor);
    gl.uniform3fv(this._uniform("custom_color"), customColor);
    if (colorMatrix) {
      this._setUniform1i("FLASH_FILTER_COLOR_MATRIX", 1);
      gl.uniform4fv(this._uniform("_ColorMatrix"), colorMatrix);
    } else {
      this._setUniform1i("FLASH_FILTER_COLOR_MATRIX", 0);
    }
  }
  setRenderUniformsPerVertex(texture, transfo) {
    this.useProgram(this.program);
    this._setUniform1i("Texture", texture);
    mat3MulInto(this._projTransfo, this._projection, transfo);
    this.gl.uniformMatrix3fv(this._uniform("transfo"), false, this._projTransfo);
  }
  setMaskTransfo(transfo, texture) {
    const gl = this.gl;
    this.useProgram(this.maskProgram);
    mat3MulInto(this._projTransfo, this._projection, transfo);
    this.gl.uniformMatrix3fv(this._uniformForProgram(this.maskProgram, "transfo_m"), false, this._projTransfo);
    gl.uniform1i(this._uniformForProgram(this.maskProgram, "Texture_m"), texture);
  }
  // ── draw call helpers ─────────────────────────────────────────────────────────
  /**
   * Upload vertex + index data into the shared streaming buffers, then draw.
   * Vertex layout (stride 20 bytes, all f32):
   *   offset 0:  in_pos (loc 0, vec3) — position.xy + color idx on .z
   *   offset 12: in_uv  (loc 1, vec2)
   */
  drawIndexed(vertexData, indexData) {
    const gl = this.gl;
    if (!this._buffersReady) this._initSharedBuffers();
    if (this._backend.hasVAO) {
      this._backend.bindVAO(this._vao);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
      gl.enableVertexAttribArray(ATTR_LOC_POS);
      gl.vertexAttribPointer(ATTR_LOC_POS, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(ATTR_LOC_UV);
      gl.vertexAttribPointer(ATTR_LOC_UV, 2, gl.FLOAT, false, 20, 12);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STREAM_DRAW);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STREAM_DRAW);
    gl.drawElements(gl.TRIANGLES, indexData.length, this._backend.indexType, 0);
  }
  _initSharedBuffers() {
    const gl = this.gl;
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    if (!vbo || !ibo) throw new Error("Failed to allocate GL buffers.");
    this._vbo = vbo;
    this._ibo = ibo;
    if (this._backend.hasVAO) {
      const vao = this._backend.createVAO();
      if (!vao) throw new Error("Failed to allocate VAO.");
      this._vao = vao;
      this._backend.bindVAO(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(ATTR_LOC_POS);
      gl.vertexAttribPointer(ATTR_LOC_POS, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(ATTR_LOC_UV);
      gl.vertexAttribPointer(ATTR_LOC_UV, 2, gl.FLOAT, false, 20, 12);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    }
    this._buffersReady = true;
  }
  clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);
  }
  // ── private helpers ───────────────────────────────────────────────────────────
  _uniform(name) {
    return this._uniformForProgram(this.program, name);
  }
  _uniformForProgram(prog, name) {
    let progCache = this._uniformCache.get(prog);
    if (!progCache) {
      progCache = /* @__PURE__ */ new Map();
      this._uniformCache.set(prog, progCache);
    }
    let loc = progCache.get(name);
    if (!loc) {
      const l = this.gl.getUniformLocation(prog, name) ?? this.gl.getUniformLocation(prog, `${name}[0]`);
      if (!l) throw new Error(`Uniform '${name}' not found in shader.`);
      loc = l;
      progCache.set(name, loc);
    }
    return loc;
  }
  _setUniform1i(name, value) {
    this.gl.uniform1i(this._uniform(name), value);
  }
  _setUniform2f(name, x, y) {
    this.gl.uniform2f(this._uniform(name), x, y);
  }
  _setUniformForProgram(prog, name, fn) {
    try {
      fn(this._uniformForProgram(prog, name));
    } catch {
    }
  }
  _createProgram(vert, frag) {
    const gl = this.gl;
    const vs = this._createShader(gl.VERTEX_SHADER, vert);
    const fs = this._createShader(gl.FRAGMENT_SHADER, frag);
    const prog = gl.createProgram();
    if (!prog) throw new Error("Failed to create WebGL program.");
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, ATTR_LOC_POS, "in_pos");
    gl.bindAttribLocation(prog, ATTR_LOC_UV, "in_uv");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }
  _createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}
---
${source}`);
    }
    return shader;
  }
};

// src/data/audio.ts
var BARKS_LABEL = [19, 18, 13, 12, 33, 32, 15, 14, 7, 6, 3, 2, 35, 34, 17, 16, 5, 4, 37, 36, 25, 24, 27, 26, 23, 22, 21, 20, 9, 8, 31, 30, 11, 10, 29, 28, 41, 40];
var AudioManager = class _AudioManager {
  _guidMapping;
  _boneData;
  constructor(audio_lib, boneData) {
    const bones = /* @__PURE__ */ new Map();
    for (const [id, value] of Object.entries(boneData)) bones.set(Number(id), value);
    this._boneData = bones;
    this._guidMapping = audio_lib;
  }
  static async create() {
    const loader = getLoader();
    if (!loader.audioEnabled) return new _AudioManager(/* @__PURE__ */ new Map(), {});
    let audio_lib;
    try {
      const processed = await loader.loadProcessedAudioLib();
      audio_lib = new Map(Object.entries(processed));
    } catch (err) {
      const lib = await loader.loadAudioLib();
      audio_lib = new Map(lib.m_eventInfoSet.m_entries.map((i) => [i.guid, [i.path.replace(/^event:\//, ""), 0]]));
    }
    const bones = await loader.loadSoundBones();
    return new _AudioManager(audio_lib, bones);
  }
  async getSoundAnim(soundData, fps = 60, breedKey) {
    const result = [];
    const loader = getLoader();
    for (const [anim, boneId, frameCount] of soundData) {
      const boneSound = this._boneData.get(boneId);
      if (!boneSound) continue;
      const animSound = boneSound.animSounds[anim];
      if (!animSound) continue;
      const count = Math.min(animSound.guids.length, animSound.startFrames.length);
      for (let i = 0; i < count; i++) {
        const guid = animSound.guids[i];
        const startFrames = animSound.startFrames[i];
        const eventInfo = this._guidMapping.get(guid);
        if (!eventInfo) continue;
        const [eventPath, timestamp] = eventInfo;
        let eventData;
        try {
          eventData = await loader.fmodEvent(eventPath, timestamp);
        } catch {
          continue;
        }
        if (!eventData) continue;
        for (const trigger of eventData.triggers) this.pushAudio(result, trigger, eventPath, startFrames, fps, timestamp, frameCount);
        if (breedKey !== void 0) {
          const paramIndex = BARKS_LABEL.indexOf(breedKey);
          if (paramIndex === -1) continue;
          for (const parameters of eventData.parameterGroups) {
            if (parameters.parameter !== "Player/Classes_Barks") continue;
            const param = parameters.instruments.find(
              (p) => paramIndex >= p.parameterRange.min && paramIndex < p.parameterRange.max
            );
            if (param) this.pushAudio(result, param, eventPath, startFrames, fps, timestamp, frameCount);
          }
        }
      }
    }
    return result;
  }
  pushAudio(result, trigger, eventPath, startFrames, fps, timestamp, frameCount) {
    const soundPath = this.resolveSoundPath(eventPath, trigger);
    if (!soundPath) return;
    const start = trigger.start ?? 0;
    for (const startFrame of startFrames.split("|")) {
      const startTime = (parseInt(startFrame, 10) - 1) / fps + start;
      result.push({ soundPath, timestamp, startTime, frameCount });
    }
  }
  resolveSoundPath(eventPath, trigger) {
    if (trigger.type === "Waveform") {
      return `${eventPath}/${trigger.sampleFile}`;
    }
    if (trigger.type === "Multi" && trigger.playlist) {
      const sound = trigger.playlist.entries.find((e) => e.type === "Waveform");
      if (!sound) return null;
      return `${eventPath}/${trigger.instrumentId}/${sound.sampleFile}`;
    }
    return null;
  }
};
var _audioManagerPromise;
function getAudioManager() {
  return _audioManagerPromise ??= AudioManager.create();
}

// src/renderer/dofusSprite.ts
var LookChange = {
  /** Nothing requiring a buffer rebuild changed */
  None: 0,
  /** only rebuilds this sprite's buffers + refreshes bounds. */
  Soft: 1,
  /** parent must rebuild its buffers. */
  Structural: 2
};
var DofusSprite = class _DofusSprite extends AssetManager {
  parent;
  renderer;
  subAnimLoop;
  numberFrame;
  startFrame;
  currentRendering = null;
  flip = false;
  _subEntitySprites = /* @__PURE__ */ new Map();
  _animInstances = /* @__PURE__ */ new Map();
  _animationBuffer = /* @__PURE__ */ new Map();
  _animationBounds = /* @__PURE__ */ new Map();
  // store sub animation name to avoid re resolved them
  // (after first prepareAnimation call, currentRendering is set only for main sprite not sub)
  _subSpriteRenderingName = /* @__PURE__ */ new Map();
  constructor(look, openGl, parent, numberFrame, startFrame = 0, isAnimMap, subAnimLoop = true) {
    super(look, openGl, isAnimMap);
    this.parent = parent;
    this.renderer = new FrameRenderer(openGl, look);
    this.subAnimLoop = subAnimLoop;
    this.numberFrame = numberFrame;
    this.startFrame = startFrame;
  }
  // ── Factory ───────────────────────────────────────────────────────────────────
  /** Create and fully initialise a root DofusSprite. */
  static async create(look, canvas, options = {}) {
    const ctx = new RendererContext(canvas);
    ctx.unloadAllTextures();
    const sprite = new _DofusSprite(look, ctx, null, options.numberFrame, options.startFrame ?? 0, options.isMapAnimation, options.subAnimLoop);
    await Promise.all([sprite._init(options.boneName), sprite._preloadSubEntities()]);
    return sprite;
  }
  /** Internal factory for sub-entities (shares parent's RendererContext). */
  static async _createChild(look, openGl, parent, numberFrame) {
    const sprite = new _DofusSprite(look, openGl, parent, numberFrame, parent.startFrame, parent.isMapAnimation, parent.subAnimLoop);
    await Promise.all([sprite._init(), sprite._preloadSubEntities()]);
    return sprite;
  }
  /** Pre-create all sub-entity sprites declared in this look so createSubEntity() works synchronously. */
  async _preloadSubEntities() {
    const tasks = [];
    for (const [category, subEntities] of this.look.subEntities) {
      for (const [typeIndex, subLook] of subEntities) {
        const index = _DofusSprite.subEntityKey(category, typeIndex);
        tasks.push(this._ensureSubEntity(subLook, index).then(() => void 0));
      }
    }
    await Promise.all(tasks);
  }
  async _ensureSubEntity(subLook, index) {
    const existing = this._subEntitySprites.get(index);
    if (existing) return existing;
    const nb = this.subAnimLoop ? this.numberFrame : void 0;
    const sprite = await _DofusSprite._createChild(subLook, this.openGl, this, nb);
    this._subEntitySprites.set(index, sprite);
    return sprite;
  }
  // ── Buffer building ───────────────────────────────────────────────────────────
  /**
   * Pre-load the animation .dat,
   * then synchronously build and cache all frame buffers.
   * Returns the cached BufferFrames.
   */
  async buildBuffer(animName) {
    const cached = this._animationBuffer.get(animName);
    if (cached) return cached;
    const parentTask = this._buildAnimInstance(animName);
    const loadTasks = [parentTask];
    for (const [key, subSprite] of this._subEntitySprites) {
      const [childAnim, flip] = getRelatedChildAnim([...subSprite.animations.keys()], animName);
      if (childAnim) {
        this._applySubAnim(subSprite, key, flip, childAnim);
        if (!subSprite._animationBuffer.has(childAnim))
          loadTasks.push(subSprite.buildBuffer(childAnim).then(() => void 0));
      } else subSprite.currentRendering = null;
    }
    await Promise.all(loadTasks);
    const frames = this._buildBufferSync(animName);
    this._animationBuffer.set(animName, frames);
    this._animationBounds.set(animName, computeBufferLocalBounds(frames));
    return frames;
  }
  async _buildAnimInstance(animName) {
    const cached = this._animInstances.get(animName);
    if (cached) return cached;
    if (!this.animations.has(animName)) throw new Error(`Animation '${animName}' not found`);
    const anim = this.animations.get(animName);
    const instance = await getAnimation(this.data.m_Name, anim, this.isMapAnimation);
    this._animInstances.set(animName, instance);
    return instance;
  }
  _buildBufferSync(animName) {
    const animMeta = this._animInstances.get(animName);
    if (!animMeta) throw new Error(`Animation instance '${animName}' not loaded`);
    const scaleMatrix = mat3Scale(this.look.size);
    const framesBuffer = [];
    for (const frameNumber of animMeta.iterFrameData(this.numberFrame, this.startFrame)) {
      const buf = new Buffer();
      const stateIter = animMeta.iterRenderStates();
      for (const node of stateIter) {
        const [found, skinPart, isCustomised] = this.getSkinAssetPart(node);
        if (skinPart !== null && found) {
          const part = this.processPart(skinPart);
          buf.appendNode(part, frameNumber, node, scaleMatrix, this.look.flatColorArray);
        }
        if (isCustomised && node.childrenRecursiveCount > 0) {
          let skip = node.childrenRecursiveCount;
          while (skip-- > 0) stateIter.next();
        }
      }
      framesBuffer.push(buf);
    }
    return framesBuffer;
  }
  /** Returns pre-built frames (throws if buildBuffer hasn't been called). */
  buffer(animName) {
    const frames = this._animationBuffer.get(animName);
    if (!frames) throw new Error(`Frames for '${animName}' not ready. Call buildBuffer first.`);
    return frames;
  }
  getLocalBounds(animName) {
    const bounds = this._animationBounds.get(animName);
    if (!bounds) throw new Error(`Bounds for '${animName}' not ready. Call buildBuffer first.`);
    return bounds;
  }
  setupSubAnim(sprite, key) {
    if (this.currentRendering !== null) {
      const [name, flip] = getRelatedChildAnim([...sprite.animations.keys()], this.currentRendering);
      if (!name) return;
      this._applySubAnim(sprite, key, flip, name);
    }
  }
  _applySubAnim(sprite, key, flip, name) {
    let innerMap = this._subSpriteRenderingName.get(this.currentRendering);
    if (!innerMap) {
      innerMap = /* @__PURE__ */ new Map();
      this._subSpriteRenderingName.set(this.currentRendering, innerMap);
    }
    innerMap.set(key, name);
    sprite.currentRendering = name;
    sprite.flip = flip && !this.flip;
  }
  // ── Rendering ─────────────────────────────────────────────────────────────────
  /** Prepare canvas size and pre-build buffers for an animation. */
  async prepareAnimation(animName, scale, computeBounds = false, flipX = false, flipY = false, forcedSize) {
    if (!this.animations.has(animName)) {
      const flipped = flipAnimNameString(animName);
      if (!this.animations.has(flipped))
        throw new Error(`Animation '${animName}' not found`);
      flipX = true;
      animName = flipped;
    }
    this.flip = flipX;
    this.currentRendering = animName;
    const buffers = await this.buildBuffer(animName);
    const anim = this.animations.get(animName);
    this.renderer.setRenderSize(scale, anim.bounds, this.getLocalBounds(animName), computeBounds, forcedSize, flipX, flipY);
    return buffers.length;
  }
  resize(scale, forcedSize) {
    if (!this.currentRendering) return;
    const anim = this.animations.get(this.currentRendering);
    if (!anim) return;
    this.renderer.setRenderSize(scale, anim.bounds, this.getLocalBounds(this.currentRendering), true, forcedSize, this.flip, false);
  }
  /** Render a single skin asset (by graphic index or symbol name) to the canvas. */
  renderSkinAsset(graphic = -1, symbolName, scale = 1) {
    const customIndex = this.getSymbolNameIndex(symbolName, true);
    if (graphic < 0 && customIndex < 0) {
      throw new Error(`You must to define: graphic (0-${this.data.graphics.length - 1}) or symbolName ${this.customSymbolRefNames().join(", ")}`);
    }
    const state = new RenderState();
    state.spriteIndex = graphic;
    state.customisationIndex = customIndex;
    const [found, skinPart] = this.getSkinAssetPart(state);
    if (!found || skinPart === null) {
      throw new Error(`Graphic ${graphic} not found or ${symbolName} not found in the skin asset`);
    }
    const processedPart = this.processPart(skinPart);
    const buffer = new Buffer();
    buffer.appendNode(processedPart, 1, state, mat3Identity(), this.look.flatColorArray);
    const frames = [buffer];
    this.renderer.setRenderSize(scale, null, computeBufferLocalBounds(frames), true);
    this.renderer.renderFrame(frames, 0);
  }
  /** Render frame `frameIndex` to the canvas. Call prepareAnimation first. */
  renderFrame(frameIndex) {
    if (!this.currentRendering) throw new Error("Call prepareAnimation first.");
    const frames = this.buffer(this.currentRendering);
    this.renderer.renderFrame(frames, frameIndex);
  }
  getFrameCount(animName) {
    return this._animationBuffer.get(animName)?.length ?? 0;
  }
  getAnimName(direction, name, raise = true) {
    return getAnimName([...this.animations.keys()], direction, this.look.bone, name, raise);
  }
  availableDirections() {
    return directionsByAnim(this.animations.keys());
  }
  async getMaxFrame(animName) {
    if (!this.animations.has(animName)) return 0;
    const instance = await this._buildAnimInstance(animName);
    const counts = [instance?.frameCount ?? 0];
    for (const [, subSprite] of this._subEntitySprites) {
      const [childAnim] = getRelatedChildAnim([...subSprite.animations.keys()], animName);
      if (childAnim) counts.push(await subSprite.getMaxFrame(childAnim));
    }
    return Math.max(0, ...counts);
  }
  /**
   * Mutate this sprite to render `newLook`, re-fetching only what changed.
   * Returns the change level so a parent sprite knows whether its own buffers survive.
   */
  async changeLook(newLook, boneName) {
    const boneChanged = newLook.bone !== this.look.bone || (boneName ?? String(newLook.bone) !== this.data.m_Name);
    const skinsChanged = !this.look.sameSkins(newLook);
    const sizeChanged = newLook.size !== this.look.size;
    const tasks = [];
    if (sizeChanged) this.look.size = newLook.size;
    if (boneChanged) {
      this.look.bone = newLook.bone;
      tasks.push(this.changeBone(boneName, false).then(() => this._animInstances.clear()));
    }
    if (skinsChanged) tasks.push(this.changeSkins(newLook.skins, false));
    this.look.Color = new Map(newLook.Color);
    const subPromise = this._changeSubEntities(newLook);
    tasks.push(subPromise);
    await Promise.all(tasks);
    const subChange = await subPromise;
    if (boneChanged || skinsChanged || subChange === LookChange.Structural) this._clearCustomCaches();
    const selfChanged = boneChanged || skinsChanged || sizeChanged;
    if (selfChanged || subChange === LookChange.Structural) {
      this._animationBuffer.clear();
      this._animationBounds.clear();
      this._subSpriteRenderingName.clear();
    } else if (subChange === LookChange.Soft) {
      await this._refreshSubBuffers();
    }
    if (this.parent === null) this._sweepStore();
    if (boneChanged) return LookChange.Structural;
    return selfChanged || subChange !== LookChange.None ? LookChange.Soft : LookChange.None;
  }
  async _refreshSubBuffers() {
    const tasks = [];
    for (const animName of this._animationBuffer.keys()) {
      const mounted = this._subSpriteRenderingName.get(animName);
      if (!mounted) continue;
      for (const [key, childAnim] of mounted) {
        const sprite = this._subEntitySprites.get(key);
        if (sprite && !sprite._animationBuffer.has(childAnim))
          tasks.push(sprite.buildBuffer(childAnim));
      }
    }
    await Promise.all(tasks);
    for (const [animName, frames] of this._animationBuffer)
      this._animationBounds.set(animName, computeBufferLocalBounds(frames));
  }
  /** Release every store resource not referenced by sprite and sub sprite. */
  _sweepStore() {
    const bones = /* @__PURE__ */ new Set();
    const skins = /* @__PURE__ */ new Set();
    this.collectResourceKeys(bones, skins);
    this.openGl.assetStore.sweep(bones, skins);
  }
  collectResourceKeys(bones, skins) {
    super.collectResourceKeys(bones, skins);
    for (const sprite of this._subEntitySprites.values()) sprite.collectResourceKeys(bones, skins);
  }
  /**
   * Add/remove/update child sprites to match `newLook`.
   * Returns the strongest change among children: Structural when a child was
   * added/removed or changed bone, Soft when an existing child changed look.
   */
  async _changeSubEntities(newLook) {
    const desiredKeys = /* @__PURE__ */ new Set();
    const tasks = [];
    let change = LookChange.None;
    for (const [category, subEntities] of newLook.subEntities) {
      for (const [typeIndex, subLook] of subEntities) {
        const key = _DofusSprite.subEntityKey(category, typeIndex);
        desiredKeys.add(key);
        const existing = this._subEntitySprites.get(key);
        if (existing) {
          tasks.push(existing.changeLook(subLook).then((c) => {
            if (c > change) change = c;
          }));
        } else {
          change = LookChange.Structural;
          tasks.push(this._ensureSubEntity(subLook, key).then(() => void 0));
        }
      }
    }
    for (const [key] of [...this._subEntitySprites]) {
      if (desiredKeys.has(key)) continue;
      change = LookChange.Structural;
      this._subEntitySprites.delete(key);
    }
    await Promise.all(tasks);
    this.look.subEntities = newLook.subEntities;
    return change;
  }
  getSubEntity(index) {
    return this._subEntitySprites.get(index);
  }
  static subEntityKey(category, typeIndex) {
    return `carried_${category}_${typeIndex}`;
  }
  getSubEntitySprite(category, typeIndex = 0) {
    return this._subEntitySprites.get(_DofusSprite.subEntityKey(category, typeIndex));
  }
  // ── Audio ─────────────────────────────────────────────────────────────────────
  /** Sound-bank key for the current animation (strip trailing direction index). */
  AnimSoundName(animName) {
    const idx = animName.lastIndexOf("_");
    const baseAnim = idx === -1 ? animName : animName.slice(0, idx);
    return this.look.bone === 1 ? `${this.data.m_Name}/${baseAnim}` : baseAnim;
  }
  /** All [soundName, boneId, sourceFrameCount] tuples for the current anim and sub-entities. */
  currentSoundData() {
    const soundKeys = [];
    const anim = this.currentRendering;
    if (!anim) return soundKeys;
    const instance = this._animInstances.get(anim);
    if (!instance) return soundKeys;
    const nbFrame = instance.frameCount;
    const name = this.AnimSoundName(anim);
    soundKeys.push([name, this.look.bone, nbFrame]);
    const subentity = this._subSpriteRenderingName.get(anim);
    if (!subentity) return soundKeys;
    for (const [index, animName] of subentity) {
      const subSprite = this._subEntitySprites.get(index);
      if (!subSprite) continue;
      subSprite.currentRendering = animName;
      soundKeys.push(...subSprite.currentSoundData());
    }
    return soundKeys;
  }
  /** Resolve the current animation's sound events. */
  async currentSoundEvents() {
    const keys = this.currentSoundData();
    if (keys.length === 0) return [];
    const manager = await getAudioManager();
    const breedAndSex = await this.look.getBreedAndSex();
    return manager.getSoundAnim(keys, this.data.defaultFrameRate, breedAndSex);
  }
};

// src/browser/audio.ts
var SpriteAudioPlayer = class {
  _ctx;
  _gain;
  _cache = /* @__PURE__ */ new Map();
  _sources = [];
  _lastEvents = [];
  _lastBuffers = [];
  _muted = false;
  constructor(ctx) {
    this._ctx = ctx ?? new AudioContext();
    this._gain = this._ctx.createGain();
    this._gain.connect(this._ctx.destination);
  }
  get context() {
    return this._ctx;
  }
  get muted() {
    return this._muted;
  }
  set muted(value) {
    this._muted = value;
    this._gain.gain.value = value ? 0 : 1;
  }
  stop() {
    for (const src of this._sources) try {
      src.stop();
    } catch {
    }
    this._sources = [];
  }
  async playEvents(events) {
    this.stop();
    this._lastEvents = events;
    this._lastBuffers = [];
    if (events.length === 0) return;
    if (this._ctx.state === "suspended") await this._ctx.resume();
    const buffers = await this.resolveBuffers(events);
    this._lastBuffers = buffers;
    this._schedule(events, buffers);
  }
  async playForSprite(sprite) {
    const events = await sprite.currentSoundEvents();
    await this.playEvents(events);
  }
  /** Decode (or reuse cached) AudioBuffers for the given events. */
  async resolveBuffers(events) {
    return Promise.all(events.map((e) => this._loadBuffer(e).catch(() => void 0)));
  }
  _schedule(events, buffers) {
    const startAt = this._ctx.currentTime;
    for (let i = 0; i < events.length; i++) {
      const buf = buffers[i];
      if (!buf) continue;
      this._pushBuffer(buf, startAt, events[i]);
    }
  }
  _pushBuffer(buffer, currentTime, event) {
    const src = this._ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this._gain);
    src.start(currentTime + Math.max(0, event.startTime));
    this._sources.push(src);
  }
  async replayOnLoop(frameIndex) {
    if (this._lastEvents.length === 0 || frameIndex === 0) return;
    const toPlay = [];
    for (let i = 0; i < this._lastEvents.length; i++) {
      const event = this._lastEvents[i];
      const buffer = this._lastBuffers[i];
      if (!buffer) continue;
      if (frameIndex % event.frameCount !== 0) continue;
      toPlay.push({ event, buffer });
    }
    if (toPlay.length === 0) return;
    if (this._ctx.state === "suspended") await this._ctx.resume();
    const startAt = this._ctx.currentTime;
    for (const { buffer, event } of toPlay) this._pushBuffer(buffer, startAt, event);
  }
  async _loadBuffer(event) {
    let pending = this._cache.get(event.soundPath);
    if (!pending) {
      pending = (async () => this._ctx.decodeAudioData(await getLoader().audioBytes(event)))();
      this._cache.set(event.soundPath, pending);
    }
    return pending;
  }
};
async function saveToPng(canvas, filename) {
  const blob = await encodeCurrentFrame(canvas);
  if (filename) downloadBlob(blob, filename);
  return blob;
}
async function saveToWebp(sprite, options) {
  const { animName, scale = 1, forcedSize, filename, quality = 0.9, loop = 0, concurrency = 4, flip = false } = options;
  await sprite.prepareAnimation(animName, scale, true, flip, false, forcedSize);
  const frameCount = await sprite.getMaxFrame(sprite.currentRendering);
  if (frameCount === 0) throw new Error(`Animation '${animName}' has no frames`);
  const canvas = sprite.openGl.gl.canvas;
  const gl = getGl(canvas);
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const rawFrames = [];
  for (let i = 0; i < frameCount; i++) {
    sprite.renderFrame(i);
    const pixels = new Uint8ClampedArray(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    flipYInPlace(pixels, width, height);
    rawFrames.push(pixels);
  }
  const pool = createEncoderPool(Math.min(concurrency, rawFrames.length), width, height);
  const frameBlobs = new Array(rawFrames.length);
  let next = 0;
  const workers = pool.map(async (ctx) => {
    while (true) {
      const i = next++;
      if (i >= rawFrames.length) return;
      frameBlobs[i] = await encodeFrameWebp(ctx, rawFrames[i], quality);
    }
  });
  await Promise.all(workers);
  const parsedFrames = await Promise.all(frameBlobs.map((b) => parseWebp(b)));
  const frameDurMs = Math.max(1, Math.round(1e3 / sprite.data.defaultFrameRate));
  const blob = muxAnimatedWebp(parsedFrames, width, height, frameDurMs, loop);
  if (filename) downloadBlob(blob, filename);
  return blob;
}
var WEBM_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm"
];
async function saveToWebm(sprite, options) {
  const wantsAudio = options.audio !== false;
  if (isWebCodecsAvailable(wantsAudio)) {
    try {
      return await saveToWebmWithWebCodecs(sprite, options, "keep");
    } catch (err) {
      console.warn("saveToWebm: WebCodecs alpha encode failed, retrying without alpha:", err);
      try {
        return await saveToWebmWithWebCodecs(sprite, options, "discard");
      } catch (err2) {
        console.warn("saveToWebm: WebCodecs path failed, falling back to MediaRecorder:", err2);
      }
    }
  }
  return saveToWebmWithMediaRecorder(sprite, options);
}
function isWebCodecsAvailable(includeAudio) {
  const videoOk = typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined" && typeof EncodedVideoChunk !== "undefined";
  if (!videoOk) return false;
  if (!includeAudio) return true;
  return typeof AudioEncoder !== "undefined" && typeof AudioData !== "undefined" && typeof OfflineAudioContext !== "undefined";
}
async function saveToWebmWithWebCodecs(sprite, options, alphaMode) {
  const { animName, scale = 1, forcedSize, filename, audio = true, audioPlayer, videoBitsPerSecond, flip = false } = options;
  await sprite.prepareAnimation(animName, scale, true, flip, false, forcedSize);
  const frameCount = await sprite.getMaxFrame(sprite.currentRendering);
  if (frameCount === 0) throw new Error(`Animation '${animName}' has no frames`);
  const canvas = sprite.openGl.gl.canvas;
  const frameDurSec = 1 / sprite.data.defaultFrameRate;
  const totalDurSec = frameCount * frameDurSec;
  const videoSource = new CanvasSource(canvas, { codec: "vp9", bitrate: videoBitsPerSecond ?? QUALITY_HIGH, alpha: alphaMode });
  const target = new BufferTarget();
  const output = new Output({ format: new WebMOutputFormat(), target });
  output.addVideoTrack(videoSource, { frameRate: sprite.data.defaultFrameRate });
  let audioSource = null;
  let audioBuffer = null;
  if (audio) {
    const events = await sprite.currentSoundEvents();
    if (events.length > 0) {
      const player = audioPlayer ?? new SpriteAudioPlayer();
      const buffers = await player.resolveBuffers(events);
      audioBuffer = await mixSoundEventsToAudioBuffer(events, buffers, totalDurSec);
      audioSource = new AudioBufferSource({ codec: "opus", bitrate: 128e3 });
      output.addAudioTrack(audioSource);
    }
  }
  await output.start();
  for (let i = 0; i < frameCount; i++) {
    sprite.renderFrame(i);
    await videoSource.add(i * frameDurSec, frameDurSec);
  }
  videoSource.close();
  if (audioSource) {
    await audioSource.add(audioBuffer);
    audioSource.close();
  }
  await output.finalize();
  const bytes = new Uint8Array(target.buffer);
  const blob = new Blob([bytes], { type: "video/webm" });
  if (filename) downloadBlob(blob, filename);
  return blob;
}
async function mixSoundEventsToAudioBuffer(events, buffers, durationSec) {
  const sampleRate = 48e3;
  const ctx = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);
  for (let i = 0; i < events.length; i++) {
    const buf = buffers[i];
    if (!buf) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(Math.max(0, events[i].startTime));
  }
  return ctx.startRendering();
}
async function saveToWebmWithMediaRecorder(sprite, options) {
  const { animName, scale = 1, forcedSize, filename, audio = true, audioPlayer, videoBitsPerSecond, flip = false } = options;
  await sprite.prepareAnimation(animName, scale, true, flip, false, forcedSize);
  const frameCount = await sprite.getMaxFrame(sprite.currentRendering);
  if (frameCount === 0) throw new Error(`Animation '${animName}' has no frames`);
  const canvas = sprite.openGl.gl.canvas;
  const captureStream = canvas.captureStream;
  if (typeof captureStream !== "function") throw new Error("HTMLCanvasElement.captureStream is not available");
  const msPerFrame = 1e3 / sprite.data.defaultFrameRate;
  let stream = captureStream.call(canvas, 0);
  let videoTrack = stream.getVideoTracks()[0];
  const supportsRequestFrame = !!videoTrack && typeof videoTrack.requestFrame === "function";
  if (!supportsRequestFrame) {
    for (const t of stream.getTracks()) t.stop();
    stream = captureStream.call(canvas, sprite.data.defaultFrameRate);
    videoTrack = stream.getVideoTracks()[0];
  }
  const events = audio ? await sprite.currentSoundEvents() : [];
  const player = events.length > 0 ? audioPlayer ?? new SpriteAudioPlayer() : null;
  let audioDest = null;
  let audioBuffers = [];
  if (player) {
    audioBuffers = await player.resolveBuffers(events);
    audioDest = player.context.createMediaStreamDestination();
    for (const track of audioDest.stream.getAudioTracks()) stream.addTrack(track);
  }
  const mimeType = pickWebmMime();
  const recorder = new MediaRecorder(stream, videoBitsPerSecond !== void 0 ? { mimeType, videoBitsPerSecond } : { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start();
  if (player && audioDest) {
    const ctx = player.context;
    if (ctx.state === "suspended") await ctx.resume();
    const startAt = ctx.currentTime + 0.05;
    for (let i = 0; i < events.length; i++) {
      const buf = audioBuffers[i];
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(audioDest);
      src.start(startAt + Math.max(0, events[i].startTime));
    }
  }
  const startTime = performance.now();
  for (let i = 0; i < frameCount; i++) {
    const nextAt = startTime + i * msPerFrame;
    const delay = Math.max(0, nextAt - performance.now());
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    sprite.renderFrame(i);
    if (supportsRequestFrame) videoTrack.requestFrame();
  }
  const tailMs = Math.max(300, Math.ceil(msPerFrame * 4));
  if (supportsRequestFrame) {
    const tailStart = performance.now();
    while (performance.now() - tailStart < tailMs) {
      videoTrack.requestFrame();
      await new Promise((r) => setTimeout(r, msPerFrame));
    }
  } else {
    await new Promise((r) => setTimeout(r, tailMs));
  }
  recorder.requestData();
  await new Promise((r) => setTimeout(r, 50));
  recorder.stop();
  await stopped;
  for (const track of stream.getTracks()) track.stop();
  const blob = new Blob(chunks, { type: mimeType });
  if (filename) downloadBlob(blob, filename);
  return blob;
}
function getGl(canvas) {
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) throw new Error("Canvas has no WebGL context");
  return gl;
}
function flipYInPlace(pixels, width, height) {
  const rowBytes = width * 4;
  const tmp = new Uint8ClampedArray(rowBytes);
  for (let y = 0; y < height >> 1; y++) {
    const top = y * rowBytes;
    const bot = (height - 1 - y) * rowBytes;
    tmp.set(pixels.subarray(top, top + rowBytes));
    pixels.copyWithin(top, bot, bot + rowBytes);
    pixels.set(tmp, bot);
  }
}
async function encodeCurrentFrame(canvas) {
  const gl = getGl(canvas);
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const pixels = new Uint8ClampedArray(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  flipYInPlace(pixels, width, height);
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx2d = off.getContext("2d");
  if (!ctx2d) throw new Error("Failed to create 2D canvas context");
  ctx2d.putImageData(new ImageData(pixels, width, height), 0, 0);
  return new Promise((resolve, reject) => {
    off.toBlob((b) => b ? resolve(b) : reject(new Error(`toBlob failed`)));
  });
}
function createEncoderPool(n, width, height) {
  const pool = [];
  const hasOffscreen = typeof OffscreenCanvas !== "undefined";
  for (let i = 0; i < n; i++) {
    if (hasOffscreen) {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Failed to create OffscreenCanvas 2D context");
      pool.push({ canvas: c, ctx, image: new ImageData(width, height) });
    } else {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Failed to create 2D canvas context");
      pool.push({ canvas: c, ctx, image: new ImageData(width, height) });
    }
  }
  return pool;
}
async function encodeFrameWebp(enc, pixels, quality) {
  enc.image.data.set(pixels);
  enc.ctx.putImageData(enc.image, 0, 0);
  if ("convertToBlob" in enc.canvas) {
    return enc.canvas.convertToBlob({ type: "image/webp", quality });
  }
  return new Promise((resolve, reject) => {
    enc.canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob(webp) failed")), "image/webp", quality);
  });
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function pickWebmMime() {
  for (const m of WEBM_MIME_CANDIDATES) if (MediaRecorder.isTypeSupported(m)) return m;
  throw new Error("No supported WebM mime type available in this browser");
}
async function parseWebp(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.length < 12 || fourcc(buf, 0) !== "RIFF" || fourcc(buf, 8) !== "WEBP") {
    throw new Error("Encoder did not produce a WebP blob");
  }
  let width = 0, height = 0, hasAlpha = false;
  let alph;
  let main;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const tag = fourcc(buf, offset);
    const size = readU32LE(buf, offset + 4);
    const dataStart = offset + 8;
    const chunkEnd = dataStart + size + (size & 1);
    if (tag === "VP8X") {
      hasAlpha = (buf[dataStart] & 16) !== 0;
      width = 1 + readU24LE(buf, dataStart + 4);
      height = 1 + readU24LE(buf, dataStart + 7);
    } else if (tag === "ALPH") {
      hasAlpha = true;
      alph = buf.subarray(offset, chunkEnd);
    } else if (tag === "VP8 ") {
      if (width === 0) {
        width = readU16LE(buf, dataStart + 6) & 16383;
        height = readU16LE(buf, dataStart + 8) & 16383;
      }
      main = buf.subarray(offset, chunkEnd);
      break;
    } else if (tag === "VP8L") {
      const b1 = buf[dataStart + 1];
      const b2 = buf[dataStart + 2];
      const b3 = buf[dataStart + 3];
      const b4 = buf[dataStart + 4];
      if (width === 0) {
        width = 1 + (b1 | (b2 & 63) << 8);
        height = 1 + (b2 >> 6 | b3 << 2 | (b4 & 15) << 10);
      }
      hasAlpha = hasAlpha || (b4 & 16) !== 0;
      main = buf.subarray(offset, chunkEnd);
      break;
    }
    offset = chunkEnd;
  }
  if (!main) throw new Error("WebP has no VP8/VP8L chunk");
  const body = alph ? concatBytes(alph, main) : main;
  return { width, height, hasAlpha, body };
}
function muxAnimatedWebp(frames, width, height, frameDurMs, loop) {
  const hasAlpha = frames.some((f) => f.hasAlpha);
  const anmfChunks = [];
  for (const f of frames) anmfChunks.push(buildAnmfChunk(f, frameDurMs));
  const vp8x = buildVp8xChunk(width, height, hasAlpha);
  const anim = buildAnimChunk(loop);
  let total = 12;
  total += vp8x.length + anim.length;
  for (const c of anmfChunks) total += c.length;
  const out = new Uint8Array(total);
  writeFourCC(out, 0, "RIFF");
  writeU32LE(out, 4, total - 8);
  writeFourCC(out, 8, "WEBP");
  let w = 12;
  out.set(vp8x, w);
  w += vp8x.length;
  out.set(anim, w);
  w += anim.length;
  for (const c of anmfChunks) {
    out.set(c, w);
    w += c.length;
  }
  return new Blob([out], { type: "image/webp" });
}
function buildVp8xChunk(width, height, hasAlpha) {
  const chunk = new Uint8Array(8 + 10);
  writeFourCC(chunk, 0, "VP8X");
  writeU32LE(chunk, 4, 10);
  let flags = 2;
  if (hasAlpha) flags |= 16;
  chunk[8] = flags;
  writeU24LE(chunk, 12, width - 1);
  writeU24LE(chunk, 15, height - 1);
  return chunk;
}
function buildAnimChunk(loop) {
  const chunk = new Uint8Array(8 + 6);
  writeFourCC(chunk, 0, "ANIM");
  writeU32LE(chunk, 4, 6);
  writeU16LE(chunk, 12, loop & 65535);
  return chunk;
}
function buildAnmfChunk(frame, durationMs) {
  const dataSize = 16 + frame.body.length;
  const padded = dataSize + (dataSize & 1);
  const chunk = new Uint8Array(8 + padded);
  writeFourCC(chunk, 0, "ANMF");
  writeU32LE(chunk, 4, dataSize);
  writeU24LE(chunk, 8, 0);
  writeU24LE(chunk, 11, 0);
  writeU24LE(chunk, 14, frame.width - 1);
  writeU24LE(chunk, 17, frame.height - 1);
  writeU24LE(chunk, 20, durationMs);
  chunk[23] = 1;
  chunk.set(frame.body, 24);
  return chunk;
}

// src/browser/playback.ts
var SpritePlayback = class {
  _rafId = null;
  _audioPlayer = null;
  _tick = null;
  _paused = false;
  _generation = 0;
  _lookQueue = Promise.resolve();
  _lookTicket = 0;
  _sprite = null;
  _baseAnimName;
  _direction = 1 /* DOWN_RIGHT */;
  _scale = 1;
  _forcedSize;
  _flip = false;
  _frameIndex = 0;
  _resync = false;
  _muted = false;
  get isPlaying() {
    return this._rafId !== null;
  }
  get isPaused() {
    return this._paused;
  }
  get isMuted() {
    return this._muted;
  }
  get audioPlayer() {
    return this._audioPlayer;
  }
  get direction() {
    return this._direction;
  }
  get sprite() {
    return this._sprite;
  }
  get scale() {
    return this._scale;
  }
  get animation() {
    return this._baseAnimName;
  }
  _resolveAnim(sprite, options) {
    const animName = options.animName;
    if (options.direction !== void 0 || !animName) {
      return sprite.getAnimName(options.direction ?? 1 /* DOWN_RIGHT */, animName, false);
    }
    return [animName, false];
  }
  async play(sprite, options = {}, resolved) {
    const wasPaused = options.paused ?? this._paused;
    this.stop();
    const gen = this._generation;
    const { scale = 1, forcedSize, audio = true, onFrame, startFrame = 0 } = options;
    const startAudio = audio && !wasPaused;
    this._sprite = sprite;
    this._direction = options.direction ?? 1 /* DOWN_RIGHT */;
    this._scale = scale;
    this._forcedSize = forcedSize;
    const [fullName, flip] = resolved ?? this._resolveAnim(sprite, options);
    this._baseAnimName = fullName.slice(0, fullName.lastIndexOf("_"));
    this._flip = flip;
    const frameCount = await sprite.prepareAnimation(fullName, scale, true, flip, false, forcedSize);
    if (gen !== this._generation) return frameCount;
    const fps = sprite.data.defaultFrameRate;
    const msPerFrame = 1e3 / fps;
    if (startAudio) {
      this._audioPlayer ??= new SpriteAudioPlayer();
      this._audioPlayer.muted = this._muted;
      this._audioPlayer.playForSprite(sprite).catch(() => {
      });
    }
    let firstFrameDone = false;
    this._frameIndex = startFrame > 0 ? startFrame : 0;
    this._resync = true;
    let startTime = 0;
    const tick = (time) => {
      if (gen !== this._generation) return;
      this._rafId = requestAnimationFrame(tick);
      if (this._resync) {
        startTime = time - this._frameIndex * msPerFrame;
        this._resync = false;
      }
      const target = Math.floor((time - startTime) / msPerFrame);
      if (target < this._frameIndex) return;
      this._frameIndex = target;
      sprite.renderFrame(this._frameIndex);
      this._audioPlayer?.replayOnLoop(this._frameIndex).catch(() => {
      });
      onFrame?.(this._frameIndex);
      this._frameIndex++;
      if (!firstFrameDone) {
        firstFrameDone = true;
        if (wasPaused) this.pause();
      }
    };
    this._tick = tick;
    this._paused = false;
    this._rafId = requestAnimationFrame(tick);
    return frameCount;
  }
  async replace(factory, options = {}) {
    const wasPaused = this._paused;
    this.stop();
    const sprite = await factory();
    await this.play(sprite, { ...options, paused: wasPaused });
    return sprite;
  }
  /**
   * Mutate the currently playing sprite to `newLook`
   * re-fetching only what changed
   * resume playback
   */
  async replaceLook(newLook, options = {}) {
    const sprite = this._sprite;
    if (!sprite) throw new Error("Playback is not active");
    const wasPaused = this._paused;
    const { startFrame, resolved } = this._frameToKeep(newLook, options);
    this.stop();
    await sprite.changeLook(newLook, options.boneName);
    await this.play(sprite, { ...options, paused: wasPaused, startFrame }, resolved ?? void 0);
    return sprite;
  }
  /**
   * Resume from the current frame when the main animation is unchanged,
   */
  _frameToKeep(newLook, options) {
    const none = { startFrame: 0, resolved: null };
    const sprite = this._sprite;
    if (!sprite) return none;
    if (!this.isPlaying && !this._paused) return none;
    if (newLook.bone !== sprite.look.bone) return none;
    if ((options.boneName ?? String(newLook.bone)) !== sprite.data.m_Name) return none;
    if ((options.direction ?? 1 /* DOWN_RIGHT */) !== this._direction) return none;
    try {
      const resolved = this._resolveAnim(sprite, options);
      const base = resolved[0].slice(0, resolved[0].lastIndexOf("_"));
      return { startFrame: base === this._baseAnimName ? this._frameIndex : 0, resolved };
    } catch {
      return none;
    }
  }
  /**
   * Render `newLook`: reuse the active sprite  when one exists, otherwise build a new one with `factory`
   */
  async renderLook(newLook, factory, options = {}) {
    const ticket = ++this._lookTicket;
    const prev = this._lookQueue;
    const task = (async () => {
      await prev;
      if (ticket !== this._lookTicket && this._sprite) return this._sprite;
      return this._sprite ? this.replaceLook(newLook, options) : this.replace(factory, options);
    })();
    this._lookQueue = task.then(() => void 0, () => void 0);
    return task;
  }
  async setDirection(direction, onFrame) {
    if (!this._sprite || !this._baseAnimName) return 0;
    return this.play(this._sprite, { direction, animName: this._baseAnimName, onFrame, scale: this._scale, forcedSize: this._forcedSize });
  }
  toggle() {
    if (this._paused) this.resume();
    else this.pause();
    return this._paused;
  }
  setMuted(muted) {
    this._muted = muted;
    if (this._audioPlayer) this._audioPlayer.muted = muted;
  }
  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }
  setScale(scale) {
    if (!this._sprite) return;
    this._scale = scale;
    this._sprite.resize(scale, this._forcedSize);
    this.redraw();
  }
  /**
   * Re-render the current frame in place
   */
  redraw() {
    if (!this._sprite?.currentRendering) return;
    const frame = this._frameIndex > 0 ? this._frameIndex - 1 : this._frameIndex;
    this._sprite.renderFrame(frame);
  }
  pause() {
    if (this._rafId === null || this._paused) return;
    cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this._paused = true;
    this._audioPlayer?.context.suspend().catch(() => {
    });
  }
  resume() {
    if (!this._paused || this._tick === null) return;
    this._paused = false;
    this._resync = true;
    this._audioPlayer?.context.resume().catch(() => {
    });
    this._rafId = requestAnimationFrame(this._tick);
  }
  stop() {
    this._generation++;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._tick = null;
    this._paused = false;
    this._sprite = null;
    this._frameIndex = 0;
    this._audioPlayer?.stop();
  }
  async capturePng(filename) {
    const sprite = this._sprite;
    if (!sprite) throw new Error("Playback is not active");
    const wasPlaying = this._rafId !== null;
    if (wasPlaying) this.pause();
    this.redraw();
    const promise = saveToPng(sprite.openGl.gl.canvas, filename);
    if (wasPlaying) this.resume();
    return promise;
  }
  async captureWebp(filename, overrides) {
    const sprite = this._sprite;
    if (!sprite || !this._baseAnimName) throw new Error("Playback is not active");
    const wasPlaying = this._rafId !== null;
    if (wasPlaying) this.pause();
    try {
      return await saveToWebp(sprite, {
        animName: `${this._baseAnimName}_${this._direction}`,
        scale: this._scale,
        forcedSize: this._forcedSize,
        filename,
        ...overrides
      });
    } finally {
      if (wasPlaying) this.resume();
    }
  }
  async captureWebm(filename, overrides) {
    const sprite = this._sprite;
    if (!sprite || !this._baseAnimName) throw new Error("Playback is not active");
    const wasPlaying = this._rafId !== null;
    if (wasPlaying) this.pause();
    try {
      return await saveToWebm(sprite, {
        animName: `${this._baseAnimName}_${this._direction}`,
        scale: this._scale,
        forcedSize: this._forcedSize,
        audioPlayer: this._audioPlayer ?? void 0,
        filename,
        ...overrides
      });
    } finally {
      if (wasPlaying) this.resume();
    }
  }
  offset() {
    return this._sprite?.openGl.offset ?? { x: 0, y: 0 };
  }
};

export { AudioManager, Directions, DofusSprite, HttpError, Look, LookChange, SpriteAudioPlayer, SpritePlayback, SubEntityCategory, configure, createDataLoader, directionsByAnim, encodeCurrentFrame, getAnimName, getAnimation, getAudioManager, getLoader, indexedColorIndices, indexedColorsToDict, intToRgb, mergeIndexedColors, oppositeDirection, rgbToInt, riderToMountIndex, saveToPng, saveToWebm, saveToWebp, setLoader, toLoaderOptions };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map