import { Node as Node_2 } from 'harmony-3d';
import { NodeImageEditor } from 'harmony-3d';
import { NodeImageEditorGui } from 'harmony-3d';
import { Repository } from 'harmony-3d';
import { RepositoryEntry } from 'harmony-3d';
import { RepositoryFilter } from 'harmony-3d';
import { Source1ModelInstance } from 'harmony-3d';
import { Texture } from 'harmony-3d';
import { Timeline } from 'harmony-3d';

export declare function defineRepository(): void;

export declare function defineRepositoryEntry(): void;

export declare function defineTimelineElement(): void;

export declare class HTMLRepositoryElement extends HTMLElement {
    #private;
    constructor();
    setRepository(repository?: Repository): void;
    setFilter(filter?: RepositoryFilter): void;
    setDisplayMode(mode: RepositoryDisplayMode): void;
    adoptStyleSheet(styleSheet: CSSStyleSheet): void;
    attributeChangedCallback(name: string, oldValue: string, newValue: string): void;
    static get observedAttributes(): string[];
}

export declare class HTMLRepositoryEntryElement extends HTMLElement {
    #private;
    constructor();
    setRepositoryEntry(repositoryEntry?: RepositoryEntry): void;
}

export declare class HTMLTimelineElement extends HTMLElement {
    #private;
    constructor();
    setTimeline(timeline?: Timeline): void;
    setTimeOffset(offset: number): void;
}

export declare type PaintDoneEvent = {
    paintKitDefId: number;
    wearLevel: number;
    weaponDefIndex: string;
    outputTextureName: string;
    outputTexture: Texture;
    seed: bigint;
    node: Node_2;
};

export declare enum RepositoryDisplayMode {
    Flat = "flat",
    Tree = "tree"
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
    combinePaint(paintKitDefId: number, wearLevel: number, weaponDefIndex: string, outputTextureName: string, outputTexture: Texture, seed?: bigint): Promise<boolean>;
}

export declare const TextureCombinerEventTarget: EventTarget;

export declare class WarpaintEditor {
    #private;
    constructor();
    init(container: HTMLElement | ShadowRoot): void;
    getGui(): NodeImageEditorGui;
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
    currentItem?: WeaponManagerItem;
    weaponId: number;
    constructor();
    initPaintKitDefinitions(url: string): Promise<void>;
    refreshPaintKitDefinitions(): Promise<void>;
    initView(container?: HTMLElement): void;
    getItemList(cMsgPaintKit_Definition: any): any;
    refreshPaint(item: any): void;
    refreshItem(item: WeaponManagerItem, clearQueue?: boolean): void;
    processNextItemInQueue(): void;
}

export declare const WeaponManagerEventTarget: EventTarget;

declare interface WeaponManagerItem {
    id: string;
    paintKitId?: number;
    paintKitWear: number;
    paintKitSeed: bigint;
    sourceModel?: Source1ModelInstance | null;
}

export { }
