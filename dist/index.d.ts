import { NodeImageEditor } from 'harmony-3d';
import { Repository } from 'harmony-3d';
import { RepositoryEntry } from 'harmony-3d';
import { Texture } from 'harmony-3d';

export declare function defineRepository(): void;

export declare function defineRepositoryEntry(): void;

export declare enum RepositoryDisplayMode {
    Flat = "flat",
    Tree = "tree"
}

export declare class RepositoryElement extends HTMLElement {
    #private;
    constructor(repository?: Repository);
    setRepository(repository?: Repository): void;
    setDisplayMode(mode: RepositoryDisplayMode): void;
    attributeChangedCallback(name: string, oldValue: string, newValue: string): void;
    static get observedAttributes(): string[];
}

export declare class RepositoryEntryElement extends HTMLElement {
    #private;
    constructor();
    setRepositoryEntry(repositoryEntry?: RepositoryEntry): void;
}

export declare class TextureCombiner {
    #private;
    paintIds: {};
    imageExtension: string;
    textureApplyStickerNode: string;
    pixelArray: null;
    lookupNodes: Map<any, any>;
    nodeImageEditor: NodeImageEditor;
    variables: any;
    constructor();
    setTextureSize(textureSize: number): void;
    set team(t: number);
    get team(): number;
    _getDefindex(CMsgProtoDefID: any): Promise<any>;
    combinePaint(paintKitDefId: number, wearLevel: number, weaponDefIndex: string, outputTextureName: string, outputTexture: Texture, seed?: bigint): Promise<unknown>;
}

export declare class WarpaintEditor {
    #private;
    constructor();
    init(container: HTMLElement): void;
}

export declare class WeaponManager {
    #private;
    weapons: {};
    collections: {};
    weaponName: string;
    paintkitName: string;
    asyncRequestId: number;
    _protoElements: any;
    protoDefs: null;
    shouldRequestItems: boolean;
    itemsDef: null;
    itemsReady: boolean;
    containerPerWeapon: any;
    currentItem: any;
    weaponId: number;
    constructor();
    initPaintKitDefinitions(url: string): Promise<void>;
    initView(container?: HTMLElement): void;
    getItemList(cMsgPaintKit_Definition: any): any;
    refreshPaint(item: any): void;
    refreshItem(item: any, clearQueue?: boolean): void;
    processNextItemInQueue(): void;
}

export declare const WeaponManagerEventTarget: EventTarget;

export { }
