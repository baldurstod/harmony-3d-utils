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
    static paintIds: {};
    static nodeImageEditor: NodeImageEditor;
    static variables: any;
    static setTextureSize(textureSize: number): void;
    static setTeam(t: number): void;
    static getTeam(): number;
    static _getDefindex(CMsgProtoDefID: any): Promise<any>;
    static combinePaint(paintKitDefId: number, wearLevel: number, weaponDefIndex: string, outputTextureName: string, outputTexture: Texture, seed?: bigint): Promise<boolean>;
}

export declare const TextureCombinerEventTarget: EventTarget;

export declare class WarpaintEditor {
    #private;
    constructor();
    init(container: HTMLElement | ShadowRoot): void;
    getGui(): NodeImageEditorGui;
}

export declare class WeaponManager extends StaticEventTarget {
    #private;
    static weapons: {};
    static collections: {};
    static weaponName: string;
    static paintkitName: string;
    static asyncRequestId: number;
    static protoDefs: null;
    static shouldRequestItems: boolean;
    static itemsDef: null;
    static itemsReady: boolean;
    static containerPerWeapon: any;
    static currentItem?: WeaponManagerItem;
    static weaponId: number;
    static initPaintKitDefinitions(url: string): Promise<void>;
    static refreshPaintKitDefinitions(): Promise<void>;
    static initView(container?: HTMLElement): void;
    static getItemList(cMsgPaintKit_Definition: any): any;
    static refreshPaint(item: any): void;
    static refreshItem(item: WeaponManagerItem, clearQueue?: boolean): void;
}

declare interface WeaponManagerItem {
    id: string;
    paintKitId?: number;
    paintKitWear: number;
    paintKitSeed: bigint;
    sourceModel?: Source1ModelInstance | null;
}

export { }
