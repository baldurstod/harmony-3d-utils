import { NodeImageEditor } from 'harmony-3d';
import { Texture } from 'harmony-3d';

export declare function getLegacyPaintKit(id: number): string | number;

export declare class PaintKitDefinitions {
    #private;
    static warpaintDefinitionsPromise: Promise<any>;
    static warpaintDefinitions: any;
    static setWarpaintDefinitionsURL(url: string): void;
    static getWarpaintDefinitions(): Promise<any>;
    static setWarpaintDefinitions(warpaintDefinitions: any): void;
    static getDefinition(cMsgProtoDefID: any): Promise<any>;
}

export declare function setLegacyPaintKit(oldId: number, newId: string): void;

export declare class TextureCombiner {
    #private;
    static paintIds: {};
    static imageExtension: string;
    static textureApplyStickerNode: string;
    static pixelArray: null;
    static lookupNodes: Map<any, any>;
    static nodeImageEditor: NodeImageEditor;
    static variables: any;
    static setTextureSize(textureSize: number): void;
    static set team(t: number);
    static get team(): number;
    static _getDefindex(CMsgProtoDefID: any): Promise<any>;
    static combinePaint(paintKitDefId: number, wearLevel: number, weaponDefIndex: string, outputTextureName: string, outputTexture: Texture, seed?: bigint): Promise<unknown>;
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
