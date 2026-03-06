import { AnimatedTexture } from 'harmony-3d';
import { Node as Node_2 } from 'harmony-3d';
import { NodeImageEditor } from 'harmony-3d';
import { NodeImageEditorGui } from 'harmony-3d';
import { Repository } from 'harmony-3d';
import { RepositoryEntry } from 'harmony-3d';
import { RepositoryFilter } from 'harmony-3d';
import { Source1ModelInstance } from 'harmony-3d';
import { StaticEventTarget } from 'harmony-utils';
import { Texture } from 'harmony-3d';
import { Timeline } from 'harmony-3d';
import { UniformRandomStream } from 'harmony-tf2-utils';

export declare type AddWarpaintEvent = {
    p1: number;
    p2: number;
    p3: string;
    p4: string;
};

export declare type CombinePaintResult = {
    texture: AnimatedTexture;
    materialOverride: string;
};

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

export declare enum RepositoryDisplayMode {
    Flat = "flat",
    Tree = "tree"
}

export declare class Stage {
    #private;
    texturePath: string;
    specularTexturePath: string;
    node: Node_2;
    constructor(node: Node_2);
    computeRandomValues(currentIndexObject: {
        currentIndex: number;
    }, pRNGs: UniformRandomStream[], nRNGCount: number): void;
    computeRandomValuesThis(s: UniformRandomStream): boolean;
    set firstChild(stage: Stage | null);
    get firstChild(): Stage | null;
    set nextSibling(stage: Stage | null);
    get nextSibling(): Stage | null;
    appendChildren(children: Stage[]): void;
    get displayName(): string;
    toString(tabs?: string): string;
    linkNodes(): void;
    _setupTextures(): Promise<void>;
    setupTextures(): Promise<void>;
    static getTexture(texturePath: string, def?: Texture): Promise<Texture | null>;
    static getSpecularTexture(specularTexturePath: string): Promise<Texture | null>;
}

export declare class TextureCombiner {
    #private;
    static paintIds: {};
    static nodeImageEditor: NodeImageEditor;
    static variables: any;
    static setTextureSize(textureSize: number): void;
    static _getDefindex(CMsgProtoDefID: any): Promise<any>;
    static combinePaint(warpaintDefId: number, wearLevel: number, weaponDefIndex: string, team: number, seed: bigint | undefined, updatePreview: boolean, textureSize?: number): Promise<CombinePaintResult | null>;
}

export declare const TextureCombinerEventTarget: EventTarget;

export declare type WarpaintDoneEvent = {
    warpaintDefId: number;
    wearLevel: number;
    weaponDefIndex: string;
    seed: bigint;
    node: Node_2;
};

export declare class WarpaintEditor {
    #private;
    static init(container: HTMLElement | ShadowRoot): void;
    static getGui(): NodeImageEditorGui;
}

export declare class WeaponManager extends StaticEventTarget {
    #private;
    static weapons: {};
    static collections: {};
    static weaponName: string;
    static warpaintName: string;
    static asyncRequestId: number;
    static protoDefs: null;
    static shouldRequestItems: boolean;
    static itemsDef: null;
    static itemsReady: boolean;
    static containerPerWeapon: Record<string, HTMLElement>;
    static currentItem?: WeaponManagerItem;
    static weaponId: number;
    static initWarpaintDefinitions(url: string): Promise<void>;
    static refreshWarpaintDefinitions(): Promise<void>;
    static initView(container?: HTMLElement): void;
    static getItemList(cMsgWarpaintDefinition: any): any;
    static refreshWarpaint(item: WeaponManagerItem, clearQueue?: boolean): void;
}

export declare enum WeaponManagerEvents {
    AddWarpaint = "addwarpaint",
    Started = "started",
    Success = "success",
    Failure = "failure"
}

export declare interface WeaponManagerItem {
    id: string;
    warpaintId: number;
    warpaintWear: number;
    warpaintSeed: bigint;
    model: Source1ModelInstance | null;
    userData?: any;
    team: number;
    textureSize?: number;
    updatePreview: boolean;
}

export { }
