import { NodeImageEditor } from 'harmony-3d';
import { NodeImageEditorGui } from 'harmony-3d';
import { Texture } from 'harmony-3d';

export declare class TextureCombiner {
    #private;
    static paintIds: {};
    static imageExtension: string;
    static textureApplyStickerNode: string;
    static pixelArray: null;
    static lookupNodes: Map<any, any>;
    static nodeImageEditor: NodeImageEditor;
    static nodeImageEditorGui: NodeImageEditorGui;
    static variables: any;
    static setTextureSize(textureSize: number): void;
    static set team(t: number);
    static get team(): number;
    static _getDefindex(CMsgProtoDefID: any): Promise<any>;
    static combinePaint(paintKitDefId: number, wearLevel: number, weaponDefIndex: string, outputTextureName: string, outputTexture: Texture, seed?: bigint): Promise<unknown>;
}

export { }
