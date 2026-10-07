type RGB = readonly [number, number, number];
declare function intToRgb(value: number, divide?: number): RGB;
declare function rgbToInt(rgb: RGB | undefined): number;
declare function indexedColorsToDict(indexedColors: readonly number[] | undefined): Map<number, RGB>;
/** Mount color index that a rider color index drives, or undefined if it doesn't map. */
declare function riderToMountIndex(riderIndex: number): number | undefined;
declare function indexedColorIndices(indexedColors?: readonly number[]): Set<number>;
declare function mergeIndexedColors(target: Map<number, RGB>, indexedColors?: readonly number[]): void;

declare const SubEntityCategory: {
    readonly UNUSED: 0;
    readonly PET: 1;
    readonly MOUNT_DRIVER: 2;
    readonly LIFTED_ENTITY: 3;
    readonly BASE_BACKGROUND: 4;
    readonly BASE_FOREGROUND: 6;
    readonly PET_FOLLOWER: 7;
    readonly UNDERWATER_BUBBLES: 8;
    readonly RIDER_LEG: 9;
    readonly CATEGORY_10: 10;
    readonly CATEGORY_11: 11;
    readonly CATEGORY_12: 12;
    readonly CATEGORY_13: 13;
    readonly CATEGORY_14: 14;
};
type SubEntityCategory = typeof SubEntityCategory[keyof typeof SubEntityCategory];

interface PPtr {
    m_FileID: number;
    m_PathID: string;
}
interface MonoBehaviour {
    m_Enabled: number;
    m_GameObject: PPtr;
    m_Name: string;
    m_Script: PPtr;
}
interface AnimatedObjectDefinition extends MonoBehaviour {
    defaultAnimationName: string;
    defaultAnimationLoops: number;
    defaultFrameRate: number;
    maxNodeCount: number;
    exposedNodeNames: string[];
    maskableNodes: MaskableNode[];
    boneAsset: PPtr;
    graphics: SkinAssetPartPair[];
    animations: Animation[];
    blankAnimations: string[];
}
interface SkinAssetPartPair {
    asset: PPtr;
    part: SkinAssetPart$1;
}
interface SkinAssetPart$1 {
    name: string;
    DisplayListEntry: DisplayListEntry[];
    skinChunks: SkinChunk[];
}
interface MaskableNode {
    name: string;
    graphicSymbolId: string;
}
interface Animation {
    name: string;
    data: PPtr;
    dataBytes: number[];
    bounds: Rectf;
}
interface Rectf {
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
}
interface SkinAsset extends MonoBehaviour {
    m_keys: string[];
    m_values: SkinAssetPart$1[];
    triangles: Uint16Array | number[];
    vertices: AnimationGeometryVertex[];
    referencedSymbols: string[];
    emptyCustomisations: string[];
    textures: PPtr[];
}
interface AnimationGeometryVertex {
    pos: Vector3f;
    uv: Vector2f;
    multiplicativeColor: number;
    additiveColor: number;
}
interface Vector2f {
    x: number;
    y: number;
}
interface Vector3f {
    x: number;
    y: number;
    z: number;
}
interface DisplayListEntry {
    symbolId: number;
    entries: number;
    transform: AnimTransform;
}
interface AnimTransform {
    rX: number;
    uX: number;
    rY: number;
    uY: number;
    tX: number;
    tY: number;
}
interface SkinChunk {
    startVertexIndex: number;
    indexCount: number;
    startIndexIndex: number;
    vertexCount: number;
    textureIndex: number;
    maskState: number;
}
interface I18n {
    fr: string;
    en: string;
    de: string;
    es: string;
    pt: string;
    id: number;
}
interface BodyData {
    id: number;
    skins: string;
    assetId: string;
    breed: number;
    gender: number;
    label: string;
    order: number;
    payable: boolean;
    availableAtCreation: boolean;
    nameId: I18n;
}
interface BreedsData {
    id: number;
    shortNameId: I18n;
    descriptionId: I18n;
    gameplayDescriptionId: I18n;
    maleLook: string;
    femaleLook: string;
    creatureBonesId: number;
    statsPointsForStrength: Array<WrappedListInt>;
    statsPointsForIntelligence: Array<WrappedListInt>;
    statsPointsForChance: Array<WrappedListInt>;
    statsPointsForAgility: Array<WrappedListInt>;
    statsPointsForVitality: Array<WrappedListInt>;
    statsPointsForWisdom: Array<WrappedListInt>;
    breedSpellsId: Array<number>;
    breedRoles: Array<BreedRoleByBreedData>;
    maleColors: Array<number>;
    femaleColors: Array<number>;
    complexity: number;
    sortIndex: number;
}
type WrappedListInt = Array<number>;
interface BreedRoleByBreedData {
    roleId: number;
    descriptionId: I18n;
    value: number;
    order: number;
}
declare enum SkinSlotRuleType {
    Default = 0,
    Breed = 1,
    BreedAndSex = 2,
    Face = 3
}
interface SlotRuleData {
    id: number;
    mask: number;
}
interface SkinSlotsRulesInfoData {
    slotRuleType: SkinSlotRuleType;
    slotRuleInfo: number;
    slotsRules: SlotRuleData[];
}
interface SkinSlotRuleData {
    skinId: number;
    slotRulesList: SkinSlotsRulesInfoData[];
}
type RawImageData = {
    data: Uint8Array | Uint8ClampedArray;
    width: number;
    height: number;
};
type TextureSource = ImageBitmap | RawImageData;
interface SkinBundle {
    skin: SkinAsset;
    images: TextureSource[];
}
interface BoneBundle {
    bone: AnimatedObjectDefinition;
    skin: SkinBundle;
}
interface AudioManagerLibrary {
    m_availablePlatformNames: string[];
    m_masterBankIndex: number;
    m_masterStringsBankIndex: number;
    m_masterBusIndex: number;
    m_bankInfoSet: BankInfoSet;
    m_eventInfoSet: EventInfoSet;
    m_busInfoSet: BusInfoSet;
    m_parameterInfoSet: ParameterInfoSet;
    m_banksEventsRelations: number[];
    m_eventsBanksRelations: number[];
    m_eventsParametersRelations: number[];
}
interface BankInfoSet {
    m_entries: BankInfo[];
}
interface BankInfo {
    guid: string;
    path: string;
    relationalEventIndex: number;
    relationalEventCount: number;
    flags: number;
}
interface EventInfoSet {
    m_entries: EventInfo[];
}
interface EventInfo {
    guid: string;
    path: string;
    relationalBankIndex: number;
    relationalBankCount: number;
    relationalParameterIndex: number;
    relationalParameterCount: number;
    length: number;
    minimumDistance: number;
    maximumDistance: number;
    flags: number;
}
interface BusInfoSet {
    m_entries: BusInfo[];
}
interface BusInfo {
    guid: string;
    path: string;
}
interface ParameterInfoSet {
    m_entries: ParameterInfo[];
}
interface ParameterInfo {
    guid: string;
    path: string;
    name: string;
    id1: number;
    id2: number;
    minimum: number;
    maximum: number;
    defaultValue: number;
    flags: number;
    labels: string[];
}
interface SoundBoneData {
    animSounds: Record<string, SoundAnimationData>;
}
interface SoundAnimationData {
    eventNames: string[];
    startFrames: string[];
    guids: string[];
    loopingEventNames: string[];
}
interface Playlist {
    entries: FmodTrigger[];
}
interface FmodTrigger {
    type: string;
    start: number;
    sampleFile: string;
    instrumentId: string;
    playlist?: Playlist;
}
interface FmodParameterInstrument {
    parameterRange: {
        min: number;
        max: number;
    };
    instrumentId: string;
    type: string;
    start?: number;
    sampleFile: string;
    playlist?: Playlist;
}
interface FmodParameterGroup {
    parameter: string;
    instruments: FmodParameterInstrument[];
}
interface FmodEvent {
    triggers: FmodTrigger[];
    parameterGroups: FmodParameterGroup[];
}

interface LookDict {
    bonesId: number;
    skins?: number[];
    scales?: number[];
    indexedColors?: number[];
    subEntities?: SubEntityLookDict[];
}
interface SubEntityLookDict {
    bindingPointCategory: keyof typeof SubEntityCategory;
    subEntityLook: LookDict;
}
declare class Look {
    bone: number;
    skins: number[];
    size: number;
    subEntities: Map<number, Map<number, Look>>;
    private color;
    readonly flatColorArray: Float32Array<ArrayBuffer>;
    private static readonly numberBaseDict;
    constructor(bone: number, skins?: number[], color?: Map<number, RGB>, size?: number);
    set Color(map: Map<number, RGB>);
    get Color(): ReadonlyMap<number, RGB>;
    setColor(index: number, value: RGB): void;
    private writeFlat;
    getPetColor(indexedColors?: readonly number[]): Map<number, RGB>;
    getRideableColor(isMount: boolean, kramelehone: boolean, indexedColors?: readonly number[]): Map<number, RGB>;
    get riderLook(): Look;
    get petLook(): Look | undefined;
    setSubEntity(category: SubEntityCategory, subLook: Look, index?: number): void;
    static fromString(lookString: string, numberBase?: number): Look;
    static fromStringAsync(lookString: string, injectColor?: boolean, numberBase?: number): Promise<Look>;
    static fromDict(lookDict: LookDict): Look;
    static fromB16String(hex: string): Look;
    private static extractDefaultConditionalLook;
    static parseConditionalLooks(lookString: string): Array<{
        look: string;
        index: number;
        condition: string;
    }>;
    injectColor(): Promise<void>;
    getBody(): Promise<BodyData | undefined>;
    getBreedAndSex(): Promise<number | undefined>;
    toB16String(): string;
    toDict(): LookDict;
    /** Deep structural copy: exact colors, size, bone and sub-entity category/index keys preserved. */
    clone(): Look;
    toString(): string;
    sameSkins(otherLook: Look): boolean;
}

declare const enum Directions {
    RIGHT = 0,
    DOWN_RIGHT = 1,
    DOWN = 2,
    DOWN_LEFT = 3,
    LEFT = 4,
    UP_LEFT = 5,
    UP = 6,
    UP_RIGHT = 7
}
declare function oppositeDirection(d: Directions): Directions | undefined;

declare function getAnimName(animations: string[], direction: Directions, bone: number, name?: string, raise?: boolean): [string, boolean];
declare function directionsByAnim(animations: Iterable<string>): Record<string, Directions[]>;

interface SoundEvent {
    soundPath: string;
    timestamp: number;
    startTime: number;
    frameCount: number;
}
declare class AudioManager {
    private readonly _guidMapping;
    private readonly _boneData;
    private constructor();
    static create(): Promise<AudioManager>;
    getSoundAnim(soundData: ReadonlyArray<readonly [string, number, number]>, fps?: number, breedKey?: number): Promise<SoundEvent[]>;
    private pushAudio;
    private resolveSoundPath;
}
declare function getAudioManager(): Promise<AudioManager>;

type ImageDecoder = (bytes: Uint8Array, path: string) => Promise<TextureSource>;
interface LoaderOptions {
    /** Load `version.json` and append the global `?t=<BuildDate>` cache-buster to JSON requests. Default `false`. */
    enableVersion?: boolean;
    /** Load `Content/Characters/table.json` and append per-asset `?t=` cache-busters to bone/skin/animation requests. Default `false`. */
    enableCharacterTable?: boolean;
    /** Enable the audio library (`audio_manager.json` / `AudioManagerLibrary.asset`). When off, no sound event is resolved. Default `false`. */
    enableAudio?: boolean;
}
interface DataConfig extends LoaderOptions {
    strategy: 'url' | 'fs' | 'LE';
    basePath: string;
    decodeImage?: ImageDecoder;
    ImageExtension?: 'png' | 'webp';
}
declare class HttpError extends Error {
    readonly status: number;
    constructor(status: number, path: string);
}
declare abstract class DataLoader {
    protected readonly _base: string;
    protected readonly _decodeImage: ImageDecoder | undefined;
    protected readonly _imgExtension: string;
    protected readonly _enableVersion: boolean;
    protected readonly _enableCharacterTable: boolean;
    protected readonly _enableAudio: boolean;
    constructor(basePath: string, imgExtension?: string, decodeImage?: ImageDecoder, options?: LoaderOptions);
    protected abstract bytes(path: string): Promise<Uint8Array>;
    protected abstract json<T>(path: string): Promise<T>;
    protected abstract binary(path: string): Promise<ArrayBuffer>;
    protected abstract imageBitmap(path: string): Promise<ImageBitmap>;
    protected image(path: string): Promise<TextureSource>;
    protected data<T>(name: string): Promise<Record<string, T>>;
    protected images(folder: string, textures: unknown[]): Promise<TextureSource[]>;
    protected loadSkinInternal(path: string): Promise<SkinBundle>;
    loadAnimationData(boneName: string, animName: string, isMapAnimation?: boolean): Promise<ArrayBuffer>;
    loadSkin(skinId: number): Promise<SkinBundle>;
    loadBone(boneName: string, isMapAnimation?: boolean): Promise<BoneBundle>;
    loadBodies(): Promise<Record<string, BodyData>>;
    loadBreeds(): Promise<Record<string, BreedsData>>;
    loadSkinSlots(): Promise<Record<string, SkinSlotRuleData>>;
    loadSoundBones(): Promise<Record<string, SoundBoneData>>;
    /** Whether the audio library may be loaded (`enableAudio`). */
    get audioEnabled(): boolean;
    loadAudioLib(): Promise<AudioManagerLibrary>;
    loadProcessedAudioLib(): Promise<Record<string, [string, number]>>;
    fmodEvent(eventPath: string, _: number): Promise<FmodEvent>;
    audioBytes(event: SoundEvent): Promise<ArrayBuffer>;
}
declare function toLoaderOptions(config: DataConfig): LoaderOptions;
declare function createDataLoader(config: DataConfig): DataLoader;
declare function setLoader(loader: DataLoader): DataLoader;
declare function configure(config: DataConfig): DataLoader;
declare function getLoader(): DataLoader;

/**
 * Column-major 3×3 matrix as a 9-element Float32Array.
 * | a00 a01 a02 |
 * | a10 a11 a12 |
 * | a20 a21 a22 |
 */
type Mat3 = Float32Array;
type Bounds2D = {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
};

declare class BinaryReader {
    private readonly _view;
    pos: number;
    constructor(buffer: ArrayBuffer);
    get u8(): number;
    get i8(): number;
    get u16(): number;
    get i16(): number;
    get i32(): number;
    get u32(): number;
    get f32(): number;
    get bool(): boolean;
    str(length: number): string;
    align(n: number): this;
    skip(n: number): this;
    readU16Multiple(count: number): number[];
    readI16Multiple(count: number): number[];
    readI32Multiple(count: number): number[];
    readF32Multiple(count: number): number[];
    readF32Array(count: number): Float32Array;
    readBoolMultiple(count: number): boolean[];
    readRgba(): [number, number, number, number];
}

type Color32 = readonly [number, number, number, number];
declare const enum FilterType {
    Blur = 0,
    Glow = 1,
    DropShadow = 2,
    ColorMatrix = 3
}
interface BlurFilter {
    blurX: number;
    blurY: number;
    numPasses: number;
}
interface GlowFilter {
    glowColor: Color32;
    blurX: number;
    blurY: number;
    strength: number;
    inner: boolean;
    knockout: boolean;
    compositeSource: boolean;
    numPasses: number;
}
interface DropShadowFilter {
    dropShadowColor: Color32;
    blurX: number;
    blurY: number;
    angle: number;
    distance: number;
    strength: number;
    inner: boolean;
    knockout: boolean;
    compositeSource: boolean;
    numPasses: number;
}
interface FlashFilters {
    filterOrder: FilterType[];
    blurFilters: BlurFilter[];
    glowFilters: GlowFilter[];
    dropShadowFilters: DropShadowFilter[];
    colorMatrices: Float32Array[];
}

declare class RenderState {
    tranfoMatrix: Mat3;
    spriteIndex: number;
    customisationIndex: number;
    childrenRecursiveCount: number;
    alpha: number;
    multiplicativeColor: Color32;
    additiveColor: Color32;
    maskFlags: number;
    blendMode: number;
    colorMatrix: Float32Array | null;
    flashFilter: FlashFilters | null;
    reset(): void;
    compute(data: BinaryReader): void;
    private computeExtendedFilterAndBlendState;
    private computeBlurFilter;
    private computeGlowFilter;
    private computeDropShadowFilter;
}

interface BoneResource {
    data: AnimatedObjectDefinition;
    boneAsset: SkinAsset;
    textureBase: number;
    textureCount: number;
}
interface SkinResource {
    skin: SkinAsset;
    textureBase: number;
    textureCount: number;
}
/**
 * Per-RendererContext pool of bone and skin resources shared by the root sprite and every sub-entity
 */
declare class AssetStore {
    private readonly _ctx;
    private readonly _bones;
    private readonly _skins;
    constructor(_ctx: RendererContext);
    bone(key: string, isMapAnimation: boolean): Promise<BoneResource>;
    private _loadBone;
    skin(id: number): Promise<SkinResource>;
    private _loadSkin;
    /** Free every bone/skin block not present in the live sets. Run once, from the root. */
    sweep(liveBones: ReadonlySet<string>, liveSkins: ReadonlySet<number>): void;
    /** Free everything (full teardown). */
    clear(): void;
    private _release;
}

/**
 * Owns the WebGL context (prefers WebGL2, falls back to WebGL1 + available
 * extensions) and all gl.* state.
 */
declare class RendererContext {
    readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
    readonly program: WebGLProgram;
    readonly maskProgram: WebGLProgram;
    readonly offset: {
        x: number;
        y: number;
    };
    /** Shared pool of bone/skin resources (parsed asset + GL texture block) for every sprite on this context. */
    readonly assetStore: AssetStore;
    private _textures;
    private _freeSlots;
    private _uniformCache;
    private _currentProgram;
    private _vao;
    private _vbo;
    private _ibo;
    private _buffersReady;
    private readonly _projection;
    private readonly _projTransfo;
    private readonly _backend;
    constructor(canvas: HTMLCanvasElement);
    /** False when vertex indices must be uploaded as Uint16Array (no OES_element_index_uint in WebGL1). */
    get supportsU32Indices(): boolean;
    private static readonly BLEND_KEYWORD;
    private static readonly fallbackBlend;
    useProgram(program: WebGLProgram): void;
    setupBlendMode(blendMode: number): void;
    private compatibleBlendMode;
    loadTexture(image: TextureSource, index?: number): number;
    unloadAllTextures(): void;
    /**
     * Upload a contiguous run of textures and return the base slot.
     * Reuses a previously freed run when one of the right size exists, otherwise grows the pool.
     */
    loadTextureBlock(images: TextureSource[]): number;
    /** Delete the GL textures in [base, base+count) and mark their slots reusable. */
    freeTextureBlock(base: number, count: number): void;
    /** Find a contiguous run of `count` reusable slots, else return the append index. */
    private _reserveBlock;
    get textureCount(): number;
    setBound(width: number, height: number, offsetX: number, offsetY: number, scale: number, flipX?: boolean, flipY?: boolean): void;
    setRenderUniforms(multiplicativeColor: readonly [number, number, number, number], additiveColor: readonly [number, number, number, number], customColor: Float32Array, colorMatrix: Float32Array | null): void;
    setRenderUniformsPerVertex(texture: number, transfo: Mat3): void;
    setMaskTransfo(transfo: Mat3, texture: number): void;
    /**
     * Upload vertex + index data into the shared streaming buffers, then draw.
     * Vertex layout (stride 20 bytes, all f32):
     *   offset 0:  in_pos (loc 0, vec3) — position.xy + color idx on .z
     *   offset 12: in_uv  (loc 1, vec2)
     */
    drawIndexed(vertexData: ArrayBuffer, indexData: Uint32Array | Uint16Array): void;
    private _initSharedBuffers;
    clear(): void;
    private _uniform;
    private _uniformForProgram;
    private _setUniform1i;
    private _setUniform2f;
    private _setUniformForProgram;
    private _createProgram;
    private _createShader;
}

declare class Vertexs {
    readonly textureId: number;
    readonly vertexData: ArrayBuffer;
    readonly indices: Uint32Array | Uint16Array;
    readonly mask: number;
    readonly bounds: Bounds2D;
    constructor(textureId: number, source: SkinAsset, startVertex: number, vertexCount: number, startIndex: number, indexCount: number, mask: number, useU32Indices: boolean);
    /** Transform bounding-box corners by mat and return [x0,y0,…,x3,y3]. */
    transformedBounds(mat: Mat3): Bounds2D;
    render(ctx: RendererContext, program: WebGLProgram): void;
}
declare class SkinAssetPart {
    readonly source: SkinAsset;
    readonly name: string;
    readonly entry: readonly DisplayListEntry[];
    readonly validSkinChunk: boolean;
    readonly transformMatrixEntry: readonly Mat3[];
    readonly skinChunks: readonly Vertexs[];
    constructor(stub: SkinAssetPart$1, source: SkinAsset, textureOffset: number, useU32Indices: boolean);
    getSymbolName(entry: DisplayListEntry): string | undefined;
    computeIndexUpdate(index: number, drawIndex: number): [nextIndex: number, nextDrawIndex: number];
    computeTransfo(index: number, transfo: Mat3 | null): Mat3;
    private _createTransfoMatrix;
    private _createSkinChunks;
}

interface NodeElementData {
    readonly transformation: Mat3;
    readonly vertexes: Vertexs;
}
interface NodeElementSprite {
    readonly sprite: DofusSprite;
    readonly name: string;
    readonly transformation: Mat3 | null;
}
type NodeElementGroup = readonly NodeElementData[] | readonly NodeElementSprite[];
interface NodeElement {
    readonly index: string;
    readonly data: readonly NodeElementGroup[];
}

type CustomPart = SkinAssetPart | NodeElementSprite | null;
type AssetPartResult = [found: boolean, part: CustomPart, isCustomised: boolean];
declare abstract class AssetManager {
    readonly look: Look;
    readonly openGl: RendererContext;
    isMapAnimation: boolean;
    data: AnimatedObjectDefinition;
    boneAsset: SkinAsset;
    animations: Map<string, Animation>;
    private _textureIndexDict;
    private _skinsDict;
    private _customSymbolRef;
    private _intendedEmpty;
    private _rulesEmpty;
    private _dictPartIndex;
    private _dictPartIndexCustom;
    private _dictPart;
    private _processedPart;
    protected constructor(look: Look, openGl: RendererContext, isMapAnimation?: boolean);
    protected _init(boneName?: string): Promise<void>;
    protected _getBone(boneName?: string): Promise<void>;
    private _getSkinDict;
    /** Record a skin's shared texture base under both lookup keys used while building parts. */
    private _setSkinOffset;
    private _getCustomSymbol;
    private _getEmptyCustomisation;
    private _getAnimationDict;
    private _getSkinAssetPartByIndex;
    private _getCustomSymbolName;
    protected _getSkinCustomAssetPart(symbolName: string): [CustomPart, boolean];
    private _getCarriedSubEntityNode;
    getSkinAssetPart(node: RenderState): AssetPartResult;
    processPart(part: SkinAssetPart | NodeElementSprite): NodeElement;
    private _iterEntry;
    private _walk;
    abstract getSubEntity(_index: string): DofusSprite | undefined;
    changeBone(boneName?: string, cleanCache?: boolean): Promise<void>;
    protected _clearCustomCaches(): void;
    changeSkins(newSkins: number[], cleanCache?: boolean): Promise<void>;
    /** Add the resources this manager currently references */
    collectResourceKeys(bones: Set<string>, skins: Set<number>): void;
    getSymbolNameIndex(symbolName: string | undefined, addIfNotExist?: boolean): number;
    customSymbolRefNames(): string[];
}

interface RenderContext {
    readonly multiplicativeColor: readonly [number, number, number, number];
    readonly additiveColor: readonly [number, number, number, number];
    readonly tranfoMatrix: Mat3;
    readonly blendMode: number;
    readonly alpha: number;
    readonly maskFlags: number;
    readonly customColor: Float32Array;
    readonly colorMatrix: Float32Array | null;
}

interface BufferElement {
    readonly context: RenderContext;
    readonly nodeElement: readonly NodeElementData[];
    readonly transforms: readonly Mat3[];
}
/**
 * Reference to a sub-sprite occurrence in a parent frame.
 */
interface BufferSubSpriteRef {
    readonly subSprite: DofusSprite;
    readonly subAnimName: string;
    readonly transform: Mat3;
    /** When subAnimLoop is false, sub stops after this many parent frames since the marker was emitted. */
    readonly maxParentFrame: number;
    readonly emittedAtParentFrame: number;
}
type BufferEntry = BufferElement | BufferSubSpriteRef;
type BufferFrames = Buffer[];
declare class Buffer extends Array<BufferEntry> {
    private _spriteIndex;
    appendNode(node: NodeElement, frameNb: number, state: RenderState, scaleMatrix: Mat3, customColor: Float32Array): void;
    private _appendSprite;
    private _pushSprite;
}

declare class MaskRenderer {
    private readonly _ctx;
    count: number;
    constructor(ctx: RendererContext);
    reset(): void;
    renderElement(bufferElement: BufferElement, parentTransform?: Mat3 | null): void;
    render(element: NodeElementData, transfo: Mat3): void;
    private _setup;
    private _disable;
}

declare class FrameRenderer {
    private readonly _openGl;
    private readonly _look;
    readonly mask: MaskRenderer;
    constructor(openGl: RendererContext, look: Look);
    /**
     * compute animation size
     */
    getAnimationSize(bounds: Rectf | null, localBounds: Bounds2D, compute?: boolean): [number, number, number, number];
    setRenderSize(scale: number, bounds: Rectf | null, localBounds: Bounds2D, compute?: boolean, forcedSize?: number, flipX?: boolean, flipY?: boolean): void;
    /**
     * Render one frame to the canvas.
     * `frameIndex` is the global tick counter — it is never reset.
     * so each sub-sprite loops at its own period via `frameIndex % subFrames.length`.
     */
    renderFrame(frames: BufferFrames, frameIndex: number): void;
    private _renderEntries;
    private _renderEntry;
    private _renderNode;
}

declare const LookChange: {
    /** Nothing requiring a buffer rebuild changed */
    readonly None: 0;
    /** only rebuilds this sprite's buffers + refreshes bounds. */
    readonly Soft: 1;
    /** parent must rebuild its buffers. */
    readonly Structural: 2;
};
type LookChange = typeof LookChange[keyof typeof LookChange];
declare class DofusSprite extends AssetManager {
    readonly parent: DofusSprite | null;
    readonly renderer: FrameRenderer;
    readonly subAnimLoop: boolean;
    readonly numberFrame: number | undefined;
    readonly startFrame: number;
    currentRendering: string | null;
    flip: boolean;
    private _subEntitySprites;
    private _animInstances;
    private _animationBuffer;
    private _animationBounds;
    private _subSpriteRenderingName;
    private constructor();
    /** Create and fully initialise a root DofusSprite. */
    static create(look: Look, canvas: HTMLCanvasElement, options?: {
        boneName?: string;
        numberFrame?: number;
        startFrame?: number;
        isMapAnimation?: boolean;
        subAnimLoop?: boolean;
    }): Promise<DofusSprite>;
    /** Internal factory for sub-entities (shares parent's RendererContext). */
    private static _createChild;
    /** Pre-create all sub-entity sprites declared in this look so createSubEntity() works synchronously. */
    private _preloadSubEntities;
    private _ensureSubEntity;
    /**
     * Pre-load the animation .dat,
     * then synchronously build and cache all frame buffers.
     * Returns the cached BufferFrames.
     */
    buildBuffer(animName: string): Promise<BufferFrames>;
    private _buildAnimInstance;
    private _buildBufferSync;
    /** Returns pre-built frames (throws if buildBuffer hasn't been called). */
    buffer(animName: string): BufferFrames;
    getLocalBounds(animName: string): Bounds2D;
    setupSubAnim(sprite: DofusSprite, key: string): void;
    private _applySubAnim;
    /** Prepare canvas size and pre-build buffers for an animation. */
    prepareAnimation(animName: string, scale: number, computeBounds?: boolean, flipX?: boolean, flipY?: boolean, forcedSize?: number): Promise<number>;
    resize(scale: number, forcedSize?: number): void;
    /** Render a single skin asset (by graphic index or symbol name) to the canvas. */
    renderSkinAsset(graphic?: number, symbolName?: string, scale?: number): void;
    /** Render frame `frameIndex` to the canvas. Call prepareAnimation first. */
    renderFrame(frameIndex: number): void;
    getFrameCount(animName: string): number;
    getAnimName(direction: Directions, name?: string, raise?: boolean): [string, boolean];
    availableDirections(): Record<string, Directions[]>;
    getMaxFrame(animName: string): Promise<number>;
    /**
     * Mutate this sprite to render `newLook`, re-fetching only what changed.
     * Returns the change level so a parent sprite knows whether its own buffers survive.
     */
    changeLook(newLook: Look, boneName?: string): Promise<LookChange>;
    private _refreshSubBuffers;
    /** Release every store resource not referenced by sprite and sub sprite. */
    private _sweepStore;
    collectResourceKeys(bones: Set<string>, skins: Set<number>): void;
    /**
     * Add/remove/update child sprites to match `newLook`.
     * Returns the strongest change among children: Structural when a child was
     * added/removed or changed bone, Soft when an existing child changed look.
     */
    private _changeSubEntities;
    getSubEntity(index: string): DofusSprite | undefined;
    private static subEntityKey;
    getSubEntitySprite(category: SubEntityCategory, typeIndex?: number): DofusSprite | undefined;
    /** Sound-bank key for the current animation (strip trailing direction index). */
    AnimSoundName(animName: string): string;
    /** All [soundName, boneId, sourceFrameCount] tuples for the current anim and sub-entities. */
    currentSoundData(): Array<[string, number, number]>;
    /** Resolve the current animation's sound events. */
    currentSoundEvents(): Promise<SoundEvent[]>;
}

interface AnimationLabel {
    frame: number;
    label: string;
}
declare class AnimationInstance {
    readonly frameCount: number;
    readonly nodeCount: number;
    readonly labelCount: number;
    readonly combinedNodeState: number;
    readonly labels: AnimationLabel[];
    readonly frameDataPositions: readonly number[];
    private readonly _data;
    private readonly _renderStates;
    private _renderStateFresh;
    constructor(data: BinaryReader);
    get renderStates(): readonly RenderState[];
    /** Yields frame indices, advancing internal render-state cursors as a side effect. */
    iterFrameData(maxFrame?: number, startFrame?: number): Iterable<number>;
    iterRenderStates(): IterableIterator<RenderState>;
    private _claimRenderStates;
}

declare function getAnimation(boneName: string, animation: Animation, isMapAnimation?: boolean): Promise<AnimationInstance>;

/**
 * Schedule sprite sound events through Web Audio.
 */
declare class SpriteAudioPlayer {
    private readonly _ctx;
    private readonly _gain;
    private readonly _cache;
    private _sources;
    private _lastEvents;
    private _lastBuffers;
    private _muted;
    constructor(ctx?: AudioContext);
    get context(): AudioContext;
    get muted(): boolean;
    set muted(value: boolean);
    stop(): void;
    playEvents(events: SoundEvent[]): Promise<void>;
    playForSprite(sprite: DofusSprite): Promise<void>;
    /** Decode (or reuse cached) AudioBuffers for the given events. */
    resolveBuffers(events: ReadonlyArray<SoundEvent>): Promise<(AudioBuffer | undefined)[]>;
    private _schedule;
    private _pushBuffer;
    replayOnLoop(frameIndex: number): Promise<void>;
    private _loadBuffer;
}

declare function saveToPng(canvas: HTMLCanvasElement, filename?: string): Promise<Blob>;
interface SaveWebpBrowserOptions {
    animName: string;
    scale?: number;
    flip?: boolean;
    forcedSize?: number;
    filename?: string;
    /** 0..1, passed to canvas.toBlob. Defaults to 0.9. */
    quality?: number;
    /** Loop count for animated WebP (0 = infinite). Defaults to 0. */
    loop?: number;
    /** Max concurrent frame encodes. Defaults to 4. */
    concurrency?: number;
}
/**
 * Record a sprite animation into an animated WebP Blob.
 *
 * Each frame is snapshotted from WebGL, handed to an OffscreenCanvas for WebP
 * encoding in parallel, then muxed into an animated WebP.
 */
declare function saveToWebp(sprite: DofusSprite, options: SaveWebpBrowserOptions): Promise<Blob>;
interface SaveWebmBrowserOptions {
    animName: string;
    scale?: number;
    flip?: boolean;
    forcedSize?: number;
    filename?: string;
    /** Mix sprite sound events into the recording. Defaults to true. */
    audio?: boolean;
    /** Reuse an existing SpriteAudioPlayer to share its decoded buffer cache. */
    audioPlayer?: SpriteAudioPlayer;
    /** Optional video bitrate hint passed to MediaRecorder. */
    videoBitsPerSecond?: number;
}
/**
 * Record a sprite animation (plus its sound events) into a WebM Blob.
 *
 * Picks WebCodecs when supported and falls back to MediaRecorder otherwise.
 */
declare function saveToWebm(sprite: DofusSprite, options: SaveWebmBrowserOptions): Promise<Blob>;
declare function encodeCurrentFrame(canvas: HTMLCanvasElement): Promise<Blob>;

interface SpritePlayOptions {
    animName?: string;
    scale?: number;
    forcedSize?: number;
    audio?: boolean;
    direction?: Directions;
    onFrame?: (frameIndex: number) => void;
    paused?: boolean;
    startFrame?: number;
}
/**
 * Drive a DofusSprite on a requestAnimationFrame loop locked to its fps,
 * with looping audio playback via a shared SpriteAudioPlayer.
 */
declare class SpritePlayback {
    private _rafId;
    private _audioPlayer;
    private _tick;
    private _paused;
    private _generation;
    private _lookQueue;
    private _lookTicket;
    private _sprite;
    private _baseAnimName;
    private _direction;
    private _scale;
    private _forcedSize;
    private _flip;
    private _frameIndex;
    private _resync;
    private _muted;
    get isPlaying(): boolean;
    get isPaused(): boolean;
    get isMuted(): boolean;
    get audioPlayer(): SpriteAudioPlayer | null;
    get direction(): Directions;
    get sprite(): DofusSprite | null;
    get scale(): number;
    get animation(): string | undefined;
    private _resolveAnim;
    play(sprite: DofusSprite, options?: SpritePlayOptions, resolved?: [string, boolean]): Promise<number>;
    replace(factory: () => Promise<DofusSprite>, options?: SpritePlayOptions): Promise<DofusSprite>;
    /**
     * Mutate the currently playing sprite to `newLook`
     * re-fetching only what changed
     * resume playback
     */
    replaceLook(newLook: Look, options?: SpritePlayOptions & {
        boneName?: string;
    }): Promise<DofusSprite>;
    /**
     * Resume from the current frame when the main animation is unchanged,
     */
    private _frameToKeep;
    /**
     * Render `newLook`: reuse the active sprite  when one exists, otherwise build a new one with `factory`
     */
    renderLook(newLook: Look, factory: () => Promise<DofusSprite>, options?: SpritePlayOptions & {
        boneName?: string;
    }): Promise<DofusSprite>;
    setDirection(direction: Directions, onFrame?: (frameIndex: number) => void): Promise<number>;
    toggle(): boolean;
    setMuted(muted: boolean): void;
    toggleMute(): boolean;
    setScale(scale: number): void;
    /**
     * Re-render the current frame in place
     */
    redraw(): void;
    pause(): void;
    resume(): void;
    stop(): void;
    capturePng(filename?: string): Promise<Blob>;
    captureWebp(filename?: string, overrides?: Partial<SaveWebpBrowserOptions>): Promise<Blob>;
    captureWebm(filename?: string, overrides?: Partial<SaveWebmBrowserOptions>): Promise<Blob>;
    offset(): {
        x: number;
        y: number;
    };
}

export { type Animation, AnimationInstance, type AnimationLabel, AudioManager, type DataConfig, DataLoader, Directions, DofusSprite, HttpError, type ImageDecoder, type LoaderOptions, Look, LookChange, type LookDict, type RGB, type RawImageData, type Rectf, RenderState, type SaveWebmBrowserOptions, type SaveWebpBrowserOptions, type SoundEvent, SpriteAudioPlayer, type SpritePlayOptions, SpritePlayback, SubEntityCategory, type TextureSource, configure, createDataLoader, directionsByAnim, encodeCurrentFrame, getAnimName, getAnimation, getAudioManager, getLoader, indexedColorIndices, indexedColorsToDict, intToRgb, mergeIndexedColors, oppositeDirection, rgbToInt, riderToMountIndex, saveToPng, saveToWebm, saveToWebp, setLoader, toLoaderOptions };
