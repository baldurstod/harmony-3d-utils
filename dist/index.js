import { Graphics, TextureManager, Color, Source1TextureManager, DEG_TO_RAD, DEFAULT_TEXTURE_SIZE, NodeImageEditor, NodeImageEditorGui, TimelineElementType } from 'harmony-3d';
import { WarpaintDefinitions, getLegacyWarpaint, UniformRandomStream } from 'harmony-tf2-utils';
import { vec2 } from 'gl-matrix';
import { createElement, shadowRootStyle, show, hide, I18n, cloneEvent } from 'harmony-ui';
import { StaticEventTarget } from 'harmony-utils';
import { closeSVG } from 'harmony-svg';

class Range {
    low;
    high;
    constructor(low = 0, high = 0) {
        this.low = low;
        this.high = high;
    }
}

let blackTexture;
class Stage {
    static #textures = new Map();
    texturePath = '';
    specularTexturePath = '';
    node;
    #firstChild = null;
    #nextSibling = null;
    constructor(node) {
        this.node = node;
        if (!blackTexture) {
            Graphics.ready.then(() => {
                blackTexture = TextureManager.createFlatTexture(new Color(0, 0, 0));
                blackTexture.addUser(1);
            });
        }
    }
    computeRandomValues(currentIndexObject, pRNGs, nRNGCount) {
        if (this.computeRandomValuesThis(pRNGs[currentIndexObject.currentIndex])) {
            currentIndexObject.currentIndex = (currentIndexObject.currentIndex + 1) % nRNGCount;
        }
        if (this.#firstChild) {
            this.#firstChild.computeRandomValues(currentIndexObject, pRNGs, nRNGCount);
        }
        if (this.#nextSibling) {
            this.#nextSibling.computeRandomValues(currentIndexObject, pRNGs, nRNGCount);
        }
    }
    computeRandomValuesThis(s) {
        throw new Error('subclass me' + s.seed);
    }
    set firstChild(stage) {
        this.#firstChild = stage;
    }
    get firstChild() {
        return this.#firstChild;
    }
    set nextSibling(stage) {
        this.#nextSibling = stage;
    }
    get nextSibling() {
        return this.#nextSibling;
    }
    appendChildren(children) {
        for (let i = children.length - 1; i >= 0; --i) {
            const childStage = children[i];
            //console.error(childStage);
            childStage.nextSibling = this.firstChild;
            this.firstChild = childStage;
        }
    }
    get displayName() {
        return this.constructor.name;
    }
    toString(tabs = '') {
        const ret = [];
        const tabs1 = tabs + '\t';
        ret.push(tabs + this.displayName);
        if (this.#firstChild) {
            ret.push(this.#firstChild.toString(tabs1));
        }
        if (this.#nextSibling) {
            ret.push(this.#nextSibling.toString(tabs));
        }
        return ret.join('\n');
    }
    linkNodes() {
        const node = this.node;
        const inputs = node.inputs.keys();
        let childStage = this.firstChild;
        while (childStage) {
            childStage.linkNodes();
            const input = inputs.next().value;
            const subNode = childStage.node;
            if (input) {
                node.setPredecessor(input, subNode, 'output');
            }
            childStage = childStage.nextSibling;
        }
    }
    async _setupTextures() {
        const texturePath = this.texturePath;
        if (texturePath) {
            this.node.inputTexture = await Stage.getTexture(texturePath);
            this.node.setParam('path', texturePath);
            this.node.invalidate();
        }
        const specularTexturePath = this.specularTexturePath;
        if (specularTexturePath) {
            try {
                const specular = this.node.getInput('specular');
                if (specular) {
                    specular.value = await Stage.getSpecularTexture(texturePath);
                }
            }
            catch (e) {
                console.log(e);
            }
        }
    }
    async setupTextures() {
        const promises = new Set();
        promises.add(this._setupTextures());
        let childStage = this.firstChild;
        while (childStage) {
            promises.add(childStage.setupTextures());
            childStage = childStage.nextSibling;
        }
        await Promise.all(promises);
    }
    static async getTexture(texturePath, def) {
        if (!Stage.#textures.has(texturePath)) {
            const promise = Source1TextureManager.getTextureAsync('tf2', texturePath, 0, false, def, false);
            promise.then(texture => {
                if (texture) {
                    texture.addUser(this);
                }
                else {
                    Stage.#textures.delete(texturePath);
                }
            });
            Stage.#textures.set(texturePath, promise);
        }
        return await Stage.#textures.get(texturePath) ?? null;
    }
    static getSpecularTexture(specularTexturePath) {
        return this.getTexture(specularTexturePath, blackTexture);
    }
}

class ApplyStickerStageParameters {
    possibleStickers = [];
    adjustBlack = new Range();
    adjustOffset = new Range(1, 1);
    adjustGamma = new Range(1, 1);
    bl = vec2.create();
    tl = vec2.create();
    tr = vec2.create();
}
class Sticker {
    fileName = '';
    weight = 1.0;
}
class ApplyStickerStage extends Stage {
    parameters = new ApplyStickerStageParameters();
    choice;
    computeRandomValuesThis(randomStream) {
        const parameters = this.parameters;
        const computeWeight = (accumulator, currentValue) => accumulator + currentValue.weight;
        const totalWeight = parameters.possibleStickers.reduce(computeWeight, 0);
        //console.error(totalWeight);
        let weight = randomStream.randomFloat(0.0, totalWeight);
        for (const [i, possibleSticker] of parameters.possibleStickers.entries()) {
            const thisWeight = possibleSticker.weight;
            if (weight < thisWeight) {
                this.choice = i;
                this.texturePath = parameters.possibleStickers[i].fileName;
                this.specularTexturePath = parameters.possibleStickers[i].fileName.replace(/\.vtf$/, '') + '_s';
                break;
            }
            else {
                weight -= thisWeight;
            }
        }
        if (this.choice == undefined) {
            throw new Error('error');
        }
        const adjustBlack = randomStream.randomFloat(parameters.adjustBlack.low, parameters.adjustBlack.high);
        const adjustOffset = randomStream.randomFloat(parameters.adjustOffset.low, parameters.adjustOffset.high);
        const adjustGamma = randomStream.randomFloat(parameters.adjustGamma.low, parameters.adjustGamma.high);
        const adjustWhite = adjustBlack + adjustOffset;
        const node = this.node;
        /*node.params.adjustBlack = adjustBlack;
        node.params.adjustWhite = adjustWhite;
        node.params.adjustGamma = adjustGamma;*/
        node.setParam('adjust black', adjustBlack);
        node.setParam('adjust white', adjustWhite);
        node.setParam('adjust gamma', adjustGamma);
        node.setParam('bottom left', parameters.bl);
        node.setParam('top left', parameters.tl);
        node.setParam('top right', parameters.tr);
        //vec2.copy(node.params.bl, parameters.bl);
        //vec2.copy(node.params.tl, parameters.tl);
        //vec2.copy(node.params.tr, parameters.tr);
        node.invalidate();
        return true;
    }
}

class CombineStageParameters {
    adjustBlack = new Range();
    adjustOffset = new Range(1, 1);
    adjustGamma = new Range(1, 1);
}
class CombineStage extends Stage {
    combineMode;
    parameters = new CombineStageParameters();
    constructor(node, combineMode) {
        super(node);
        this.combineMode = combineMode;
    }
    computeRandomValuesThis(randomStream) {
        const parameters = this.parameters;
        const adjustBlack = randomStream.randomFloat(parameters.adjustBlack.low, parameters.adjustBlack.high);
        const adjustOffset = randomStream.randomFloat(parameters.adjustOffset.low, parameters.adjustOffset.high);
        const adjustGamma = randomStream.randomFloat(parameters.adjustGamma.low, parameters.adjustGamma.high);
        const adjustWhite = adjustBlack + adjustOffset;
        const node = this.node;
        /*node.params.adjustBlack = adjustBlack;
        node.params.adjustWhite = adjustWhite;
        node.params.adjustGamma = adjustGamma;*/
        node.setParam('adjust black', adjustBlack);
        node.setParam('adjust white', adjustWhite);
        node.setParam('adjust gamma', adjustGamma);
        return true;
    }
    get displayName() {
        return this.combineMode;
    }
}

const TEXTURE_LOOKUP_NODE = 'texture lookup';
class SelectStageParameters {
}
class SelectStage extends Stage {
    nodeImageEditor;
    parameters = new SelectStageParameters();
    #textureSize;
    constructor(node, nodeImageEditor, textureSize) {
        super(node);
        this.nodeImageEditor = nodeImageEditor;
        this.#textureSize = textureSize;
    }
    computeRandomValuesThis() {
        return false;
    }
    async _setupTextures() {
        const texturePath = this.texturePath;
        if (texturePath) {
            const lookupNode = this.nodeImageEditor.addNode(TEXTURE_LOOKUP_NODE, { textureSize: this.#textureSize });
            this.node.setPredecessor('input', lookupNode, 'output');
            const texture = await Stage.getTexture(texturePath);
            if (texture) {
                lookupNode.inputTexture = texture;
            }
            //(lookupNode as any).texturePath = texturePath;
            lookupNode.invalidate();
        }
    }
}

class TextureStageParameters {
    adjustBlack = new Range();
    adjustOffset = new Range(1, 1);
    adjustGamma = new Range(1, 1);
    rotation = new Range();
    translateU = new Range();
    translateV = new Range();
    scaleUV = new Range(1, 1);
    allowFlipU = false;
    allowFlipV = false;
    texturePath = '';
}
class TextureStage extends Stage {
    texturePath = '';
    parameters = new TextureStageParameters();
    computeRandomValuesThis(randomStream) {
        const parameters = this.parameters;
        const shouldFlipU = parameters.allowFlipU ? randomStream.randomInt(0, 1) != 0 : false;
        const shouldFlipV = parameters.allowFlipV ? randomStream.randomInt(0, 1) != 0 : false;
        const translateU = randomStream.randomFloat(parameters.translateU.low, parameters.translateU.high);
        const translateV = randomStream.randomFloat(parameters.translateV.low, parameters.translateV.high);
        const rotation = randomStream.randomFloat(parameters.rotation.low, parameters.rotation.high);
        const scaleUV = randomStream.randomFloat(parameters.scaleUV.low, parameters.scaleUV.high);
        const adjustBlack = randomStream.randomFloat(parameters.adjustBlack.low, parameters.adjustBlack.high);
        const adjustOffset = randomStream.randomFloat(parameters.adjustOffset.low, parameters.adjustOffset.high);
        const adjustGamma = randomStream.randomFloat(parameters.adjustGamma.low, parameters.adjustGamma.high);
        const adjustWhite = adjustBlack + adjustOffset;
        const node = this.node;
        node.setParam('adjust black', adjustBlack);
        node.setParam('adjust white', adjustWhite);
        node.setParam('adjust gamma', adjustGamma);
        node.setParam('rotation', rotation * DEG_TO_RAD);
        node.setParam('translate u', translateU);
        node.setParam('translate v', translateV);
        node.setParam('scale u', scaleUV * (shouldFlipU ? -1 : 1));
        node.setParam('scale v', scaleUV * (shouldFlipV ? -1 : 1));
        node.setParam('path', parameters.texturePath);
        node.invalidate();
        return true;
    }
}

//const texturePathPrefixRemoveMe = '../gamecontent/tf2/materials/';//TODOv3 : put in constants
const TextureCombinerEventTarget = new EventTarget();
class TextureCombiner {
    static #textureSize = DEFAULT_TEXTURE_SIZE;
    static paintIds = {}; // TODO: turn to map ?
    static #imageExtension = '.vtf';
    static #textureApplyStickerNode = 'apply_sticker';
    static #lookupNodes = new Map();
    static nodeImageEditor = new NodeImageEditor();
    static variables = {};
    static setTextureSize(textureSize) {
        this.#textureSize = textureSize;
        this.nodeImageEditor.textureSize = textureSize;
    }
    static async _getDefindex(CMsgProtoDefID) {
        return WarpaintDefinitions.getDefinition(CMsgProtoDefID);
    }
    static async combinePaint(warpaintDefId, wearLevel, weaponDefIndex, outputTextureName, outputTexture, team, seed = 0n, textureSize = this.#textureSize) {
        this.#lookupNodes = new Map();
        const combinePaintFunction = async (resolve) => {
            //let finalPromise;
            if (warpaintDefId != undefined && wearLevel != undefined && weaponDefIndex != undefined) {
                this.nodeImageEditor.removeAllNodes();
                this.nodeImageEditor.clearVariables();
                const warpaintDefinition = await this._getDefindex({ type: 9, defindex: warpaintDefId });
                if (warpaintDefinition) {
                    let item = null;
                    for (const itemDefinitionKey in warpaintDefinition) {
                        const itemDefinitionPerItem = warpaintDefinition[itemDefinitionKey];
                        const itemDefinitionTemplate = itemDefinitionPerItem.itemDefinitionTemplate ?? itemDefinitionPerItem.item_definition_template;
                        if (itemDefinitionTemplate) {
                            const itemDefinition = await this._getDefindex(itemDefinitionTemplate);
                            if ((itemDefinition?.itemDefinitionIndex ?? itemDefinition?.item_definition_index) == weaponDefIndex) {
                                item = itemDefinitionPerItem;
                                break;
                            }
                        }
                    }
                    if (!item) {
                        //For legacy warpaints
                        const items = warpaintDefinition['item'];
                        if (items) {
                            for (const it of items) {
                                const itemDefinition = await this._getDefindex(it.itemDefinitionTemplate ?? it.item_definition_template);
                                if (getLegacyWarpaint(itemDefinition?.itemDefinitionIndex ?? itemDefinition?.item_definition_index) == weaponDefIndex) {
                                    item = it;
                                    break;
                                }
                            }
                        }
                    }
                    if (item) {
                        let template = warpaintDefinition.operationTemplate ?? warpaintDefinition.operation_template; // || item.itemDefinitionTemplate;
                        if (!template) {
                            const itemDefinitionTemplate = await this._getDefindex(item.itemDefinitionTemplate ?? item.item_definition_template);
                            if (itemDefinitionTemplate && itemDefinitionTemplate.definition && itemDefinitionTemplate.definition[wearLevel]) {
                                template = itemDefinitionTemplate.definition[wearLevel].operationTemplate ?? itemDefinitionTemplate.definition[wearLevel].operation_template;
                            }
                        }
                        if (template) {
                            const operationTemplate = await this._getDefindex(template);
                            //console.error(operationTemplate);//removeme
                            if (operationTemplate && (operationTemplate.operationNode ?? operationTemplate.operation_node)) {
                                await this.#setupVariables(warpaintDefinition, wearLevel, item);
                                const stage = await this.#processOperationNode((operationTemplate.operationNode ?? operationTemplate.operation_node)[0], { team, textureSize }); //top level node has 1 operation
                                //console.error(stage.toString());
                                stage.linkNodes();
                                function GetSeed(seed) {
                                    const hilo = [BigInt(0), BigInt(0)];
                                    for (let i = 0n; i < 32n; ++i) {
                                        const i2 = 2n * i;
                                        for (let j = 0n; j < 2n; ++j) {
                                            hilo[Number(j)] |= (seed & (1n << (i2 + j))) >> (i + j);
                                        }
                                    }
                                    return hilo;
                                }
                                const [hi, lo] = GetSeed(seed);
                                const randomStreams = [new UniformRandomStream(Number(hi) << 0), new UniformRandomStream(Number(lo) << 0)];
                                stage.computeRandomValues({ currentIndex: 0 }, randomStreams, randomStreams.length);
                                await stage.setupTextures();
                                const finalNode = stage.node;
                                finalNode.autoRedraw = true;
                                finalNode.getOutput('output')._value = outputTexture;
                                /*
                                                                let processPixelArray = (pixelArray) => {
                                                                    this.pixelArray = pixelArray;
                                                                    if (outputTextureName) {
                                                                        //Source1TextureManager.addInternalTexture(this.#textureSize, this.#textureSize, pixelArray, outputTextureName);
                                                                        resolve(true);
                                                                        return;
                                                                    }
                                                                    resolve(false);
                                                                }*/
                                //let pixelArray = await node.getOutput('output').pixelArray;
                                //console.error(await node.toString());
                                //processPixelArray(pixelArray);
                                await finalNode.redraw();
                                TextureCombinerEventTarget.dispatchEvent(new CustomEvent('paintdone', {
                                    detail: {
                                        warpaintDefId: warpaintDefId,
                                        wearLevel: wearLevel,
                                        weaponDefIndex: weaponDefIndex,
                                        outputTextureName: outputTextureName,
                                        outputTexture: outputTexture,
                                        seed: seed,
                                        node: finalNode,
                                    }
                                }));
                                resolve(true);
                                return;
                            }
                        }
                    }
                    resolve(false);
                }
            }
            else {
                resolve(false);
            }
            /*if (!finalPromise) {
                resolve(false);
            }*/
        };
        const combinePaintPromise = new Promise(resolve => { combinePaintFunction(resolve); });
        return combinePaintPromise;
    }
    static async #setupVariables(warpaintDefinition, wearLevel, item) {
        this.variables = {};
        if (item) {
            if (item.data) {
                this.#addVariables(item.data.variable);
            }
            if (item.itemDefinitionTemplate ?? item.item_definition_template) {
                const itemDefinition = await this._getDefindex(item.itemDefinitionTemplate ?? item.item_definition_template);
                if (itemDefinition) {
                    if (itemDefinition.definition && itemDefinition.definition[wearLevel]) {
                        this.#addVariables(itemDefinition.definition[wearLevel].variable);
                    }
                    if (itemDefinition.header) {
                        this.#addVariables2(itemDefinition.header.variables);
                    }
                }
            }
        }
        if (warpaintDefinition.header) {
            this.#addVariables2(warpaintDefinition.header.variables);
        }
    }
    static #addVariables(variableArray) {
        if (variableArray) {
            for (const v of variableArray) {
                //const v = variableArray[i];
                this.variables[v.variable] = v.string;
            }
        }
    }
    static #addVariables2(variableArray) {
        if (variableArray) {
            for (const v of variableArray) {
                //const v = variableArray[i];
                if ((v.inherit == false) || (this.variables[v.name] === undefined)) {
                    this.variables[v.name] = v.value;
                }
            }
        }
    }
    static async #processOperationNodeArray(operationNodeArray, context /*, parentStage: Stage*/) {
        const chidren = [];
        for (const operationNode of operationNodeArray) {
            const child = await this.#processOperationNode(operationNode, context /*, parentStage*/);
            if (child instanceof Array) {
                chidren.push(...child);
            }
            else {
                if (child) {
                    chidren.push(child);
                }
            }
        }
        return chidren;
    }
    static #getStageName(stage) {
        switch (true) {
            case stage.textureLookup != undefined:
            case stage.texture_lookup != undefined:
                return 'textureLookup';
            case stage.combineAdd != undefined:
            case stage.combine_add != undefined:
                return 'combine_add';
            case stage.combineLerp != undefined:
            case stage.combine_lerp != undefined:
                return 'combine_lerp';
            case stage.combineMultiply != undefined:
            case stage.combine_multiply != undefined:
                return 'multiply';
            case stage.select != undefined:
                return 'select';
            case stage.applySticker != undefined:
            case stage.apply_sticker != undefined:
                return 'applySticker';
            default:
                throw new Error('Unsuported stage');
        }
    }
    static async #processOperationNode(operationNode, context /*, parentStage: Stage/*, parentStage*/ /*, inputs*/) {
        let subStage = null;
        if (operationNode.stage) {
            const stage = operationNode.stage;
            let stage2 = null;
            let s;
            switch (true) {
                case stage.textureLookup != undefined:
                case stage.texture_lookup != undefined:
                    s = stage.textureLookup ?? stage.texture_lookup;
                    subStage = this.#processTextureStage(s, context);
                    stage2 = s;
                    break;
                case stage.combineAdd != undefined:
                case stage.combine_add != undefined:
                case stage.combineLerp != undefined:
                case stage.combine_lerp != undefined:
                case stage.combineMultiply != undefined:
                case stage.combine_multiply != undefined:
                    s = stage.combineAdd || stage.combine_add || stage.combineLerp || stage.combine_lerp || stage.combineMultiply || stage.combine_multiply;
                    subStage = this.#processCombineStage(s, this.#getStageName(stage), context);
                    stage2 = s;
                    break;
                case stage.select != undefined:
                    s = stage.select;
                    subStage = this.#processSelectStage(s, context);
                    stage2 = s;
                    break;
                case stage.applySticker != undefined:
                case stage.apply_sticker != undefined:
                    s = stage.applySticker ?? stage.apply_sticker;
                    subStage = this.#processApplyStickerStage(s, context);
                    stage2 = s;
                    break;
                default:
                    throw new Error('Unsuported stage');
            }
            if (stage2.operationNode ?? stage2.operation_node) {
                const chidren = await this.#processOperationNodeArray(stage2.operationNode ?? stage2.operation_node, context /*, subStage/*, node*/);
                if (subStage) {
                    subStage.appendChildren(chidren);
                }
            }
        }
        else if (operationNode.operationTemplate ?? operationNode.operation_template) {
            const template = await this._getDefindex(operationNode.operationTemplate ?? operationNode.operation_template);
            if (template && (template.operationNode ?? template.operation_node)) {
                //console.error('template.operationNode', template.operationNode.length, template.operationNode);
                const chidren = await this.#processOperationNodeArray(template.operationNode ?? template.operation_node, context /*, parentStage/*, node, inputs*/);
                return chidren;
            }
            else {
                throw new Error('Invalid template');
            }
        }
        else {
            throw new Error('Unsuported operationNode.operation_template');
        }
        /*
                if (false && subStage && node) {
                    let input = inputs.next().value;
                    console.error(input);
                    node.setPredecessor(input, subNode, 'output');
                }*/ /* else {
console.error('node or subnode is null', node, subNode);
}*/
        return subStage;
    }
    static #processCombineStage(stage, combineMode, context) {
        const node = this.nodeImageEditor.addNode(combineMode, { textureSize: context.textureSize });
        if (node) {
            return new CombineStage(node, combineMode);
        }
        return null;
    }
    /*
        async processCombineMultiplyStage(stage) {
            let node = this.nodeImageEditor.addNode('multiply');
            console.error('multiply');
            node.predecessorIndex = 0;
            /*if (stage.operationNode) {
                await this.#processOperationNodeArray(stage.operationNode, node);
            } else {
                throw 'Invalid stage';
            }* /
            return node;
        }

        async processCombineAddStage(stage) {
            let node = this.nodeImageEditor.addNode('combine_add');
            console.error('combine_add');
            node.predecessorIndex = 0;
            /*if (stage.operationNode) {
                await this.#processOperationNodeArray(stage.operationNode, node);
            } else {
                throw 'Invalid stage';
            }* /
            return node;
        }

        async processCombineLerpStage(stage) {
            let node = this.nodeImageEditor.addNode('combine_lerp');
            console.error('combine_lerp');
            node.predecessorIndex = 0;
            /*if (stage.operationNode) {
                await this.#processOperationNodeArray(stage.operationNode, node);
            } else {
                throw 'Invalid stage';
            }* /
            return node;
        }*/
    static #processTextureStage(stage, context) {
        let node = null;
        let texture;
        if (context.team == 0) {
            texture = (stage.textureRed ?? stage.texture_red) || stage.texture;
        }
        else {
            texture = (stage.textureBlue ?? stage.texture_blue) || stage.texture;
        }
        let texturePath = this.#getVarField(texture) ?? '';
        texturePath = texturePath.replace(/\.tga$/, '');
        if (texturePath) {
            //texturePathPrefixRemoveMe + texturePath + this.#imageExtension;
            if (!node) {
                node = this.nodeImageEditor.addNode(TEXTURE_LOOKUP_NODE, { textureSize: context.textureSize });
                node?.setParam('path', texturePath);
            }
        }
        if (!node) {
            return null;
        }
        const textureStage = new TextureStage(node);
        textureStage.texturePath = texturePath;
        if (stage.adjustBlack ?? stage.adjust_black) {
            ParseRangeThenDivideBy(textureStage.parameters.adjustBlack, this.#getVarField(stage.adjustBlack ?? stage.adjust_black));
        }
        if (stage.adjustOffset ?? stage.adjust_offset) {
            ParseRangeThenDivideBy(textureStage.parameters.adjustOffset, this.#getVarField(stage.adjustOffset ?? stage.adjust_offset));
        }
        if (stage.adjustGamma ?? stage.adjust_gamma) {
            ParseInverseRange(textureStage.parameters.adjustGamma, this.#getVarField(stage.adjustGamma ?? stage.adjust_gamma));
        }
        if (stage.scaleUv ?? stage.scale_uv) {
            ParseRange(textureStage.parameters.scaleUV, this.#getVarField(stage.scaleUv ?? stage.scale_uv));
        }
        if (stage.rotation) {
            ParseRange(textureStage.parameters.rotation, this.#getVarField(stage.rotation));
        }
        if (stage.translateU ?? stage.translate_u) {
            ParseRange(textureStage.parameters.translateU, this.#getVarField(stage.translateU ?? stage.translate_u));
        }
        if (stage.translateV ?? stage.translate_v) {
            ParseRange(textureStage.parameters.translateV, this.#getVarField(stage.translateV ?? stage.translate_v));
        }
        if (stage.flipU ?? stage.flip_u) {
            textureStage.parameters.allowFlipU = Number(this.#getVarField(stage.flipU ?? stage.flip_u) ?? 0) != 0;
        }
        if (stage.flipV ?? stage.flip_v) {
            textureStage.parameters.allowFlipV = Number(this.#getVarField(stage.flipV ?? stage.flip_v) ?? 0) != 0;
        }
        return textureStage;
    }
    static #processSelectStage(stage, context) {
        const selectParametersNode = this.nodeImageEditor.addNode('int array', { length: 16, textureSize: context.textureSize });
        if (!selectParametersNode) {
            return null;
        }
        const selectNode = this.nodeImageEditor.addNode('select', { textureSize: context.textureSize });
        if (!selectNode) {
            return null;
        }
        const selectStage = new SelectStage(selectNode, this.nodeImageEditor, context.textureSize);
        selectNode.setPredecessor('selectvalues', selectParametersNode, 'output');
        if (stage.groups) {
            selectStage.texturePath = this.#getVarField(stage.groups) ?? '';
        }
        if (stage.select) {
            //selectNode.params.threshold = [];
            const arr = stage.select;
            for (let i = 0; i < arr.length; i++) {
                const varField = arr[i];
                const level = this.#getVarField(varField) ?? '0';
                selectParametersNode.setValue(i, parseInt(level));
            }
        }
        selectNode.invalidate();
        return selectStage;
    }
    static #processApplyStickerStage(stage, context) {
        const applyStickerNode = this.nodeImageEditor.addNode(this.#textureApplyStickerNode, { textureSize: context.textureSize });
        if (!applyStickerNode) {
            return null;
        }
        const applyStickerStage = new ApplyStickerStage(applyStickerNode);
        if (stage.adjustBlack ?? stage.adjust_black) {
            ParseRangeThenDivideBy(applyStickerStage.parameters.adjustBlack, this.#getVarField(stage.adjustBlack ?? stage.adjust_black));
        }
        if (stage.adjustOffset ?? stage.adjust_offset) {
            ParseRangeThenDivideBy(applyStickerStage.parameters.adjustOffset, this.#getVarField(stage.adjustOffset ?? stage.adjust_offset));
        }
        if (stage.adjustGamma ?? stage.adjust_gamma) {
            ParseInverseRange(applyStickerStage.parameters.adjustGamma, this.#getVarField(stage.adjustGamma ?? stage.adjust_gamma));
        }
        if (stage.destBl ?? stage.dest_bl) {
            ParseVec2(applyStickerStage.parameters.bl, this.#getVarField(stage.destBl ?? stage.dest_bl));
        }
        if (stage.destTl ?? stage.dest_tl) {
            ParseVec2(applyStickerStage.parameters.tl, this.#getVarField(stage.destTl ?? stage.dest_tl));
        }
        if (stage.destTr ?? stage.dest_tr) {
            ParseVec2(applyStickerStage.parameters.tr, this.#getVarField(stage.destTr ?? stage.dest_tr));
        }
        if (stage.sticker) {
            const arr = stage.sticker;
            for (const operationSticker of arr) {
                //const operationSticker = arr[i];
                const sticker = new Sticker();
                sticker.fileName = this.#getVarField(operationSticker.base) ?? '';
                if (operationSticker.weight) {
                    sticker.weight = Number(this.#getVarField(operationSticker.weight) ?? 1);
                }
                applyStickerStage.parameters.possibleStickers.push(sticker);
            }
        }
        else {
            throw new Error('No sticker defined');
        }
        applyStickerNode.invalidate();
        return applyStickerStage;
    }
    static #getVarField(field) {
        if (!field) {
            return null;
        }
        if (field.variable) {
            const v = this.variables[field.variable];
            if (v) {
                return v;
            }
        }
        return field.string;
    }
}
function ParseRange(output, input) {
    if (!input) {
        output.low = 0;
        output.high = 0;
        return;
    }
    input = input.trim();
    const range = input.split(/\s+/);
    switch (range.length) {
        case 1:
            output.low = Number(range[0]);
            output.high = output.low;
            break;
        case 2:
            output.low = Number(range[0]);
            output.high = Number(range[1]);
            break;
        default:
            console.error('Wrong range expression : ', input);
            break;
    }
}
function ParseVec2(output, input) {
    if (!input) {
        output[0] = 0;
        output[1] = 0;
        return;
    }
    input = input.trim();
    const range = input.split(' ');
    if (range.length == 2) {
        output[0] = Number(range[0]);
        output[1] = Number(range[1]);
    }
}
function ParseInverseRange(output, input) {
    ParseRange(output, input);
    if (output.low) {
        output.low = 1.0 / output.low;
    }
    if (output.high) {
        output.high = 1.0 / output.high;
    }
}
function ParseRangeThenDivideBy(output, input, div = 255) {
    ParseRange(output, input);
    output.low /= div;
    output.high /= div;
}

class WarpaintEditor {
    static #nodeImageEditorGui = new NodeImageEditorGui();
    static init(container) {
        container.append(this.#nodeImageEditorGui.htmlElement);
        this.#nodeImageEditorGui.setNodeImageEditor(TextureCombiner.nodeImageEditor);
    }
    static getGui() {
        return this.#nodeImageEditorGui;
    }
}

var WeaponManagerEvents;
(function (WeaponManagerEvents) {
    WeaponManagerEvents["AddWarpaint"] = "addwarpaint";
    WeaponManagerEvents["Started"] = "started";
    WeaponManagerEvents["Success"] = "success";
    WeaponManagerEvents["Failure"] = "failure";
})(WeaponManagerEvents || (WeaponManagerEvents = {}));
class WeaponManager extends StaticEventTarget {
    static #htmlWeaponsDiv;
    static #htmlPaintsDiv;
    static weapons = {};
    static collections = {};
    static weaponName = '';
    static warpaintName = '';
    static asyncRequestId = 0;
    static #protoElements = {};
    static protoDefs = null;
    static shouldRequestItems = true;
    static itemsDef = null;
    static itemsReady = false;
    static containerPerWeapon = {};
    static #itemQueue = [];
    static currentItem;
    static weaponId = 0;
    static async initWarpaintDefinitions(url) {
        const response = await fetch(url);
        this.protoDefs = await response.json();
        await this.refreshWarpaintDefinitions();
    }
    static async refreshWarpaintDefinitions() {
        const definitions = await WarpaintDefinitions.getWarpaintDefinitions();
        if (definitions) {
            this.#protoElements = definitions;
            const warpaintDefinitions = definitions[9];
            for (const warpaintDefId in warpaintDefinitions) {
                const definition = warpaintDefinitions[warpaintDefId];
                const token = this.protoDefs ? this.protoDefs[(definition.locDesctoken ?? definition.loc_desctoken)] || (definition.locDesctoken ?? definition.loc_desctoken) : (definition.locDesctoken ?? definition.loc_desctoken);
                this.#addWarpaint(definition, token);
            }
        }
    }
    static initView(container) {
        this.#htmlWeaponsDiv = document.createElement('div');
        this.#htmlWeaponsDiv.className = 'weaponsDiv';
        this.#htmlPaintsDiv = document.createElement('div');
        this.#htmlPaintsDiv.className = 'paintsDiv';
        if (container) {
            container.appendChild(this.#htmlWeaponsDiv);
            container.appendChild(this.#htmlPaintsDiv);
        }
    }
    static #addWarpaint(warpaint, descToken) {
        const cMsgWarpaintDefinition = this.#protoElements[9][warpaint.header.defindex];
        const warpaintItemDefinitions = this.#protoElements[8];
        if (cMsgWarpaintDefinition) {
            const itemList = this.getItemList(cMsgWarpaintDefinition);
            for (const weaponName in itemList) {
                const itemDefinition = warpaintItemDefinitions[itemList[weaponName]];
                if (itemDefinition) {
                    this.#addWeapon(warpaint, warpaint.header.defindex, weaponName, itemList[weaponName], itemDefinition.itemDefinitionIndex ?? itemDefinition.item_definition_index, descToken);
                }
            }
        }
        return;
    }
    static #addWeapon(warpaint, weaponPaint, weapon, defindex, itemDefinitionIndex, descToken) {
        //let wep = this.itemsDef?.[itemDefinitionIndex] || this.itemsDef?.[itemDefinitionIndex + '~0'] ;
        const wep = { name: weapon };
        if (wep) {
            let weaponDiv = this.containerPerWeapon[wep.name];
            if (!weaponDiv) {
                weaponDiv = createElement('div');
                weaponDiv.className = 'weaponDiv';
                this.#htmlPaintsDiv?.appendChild(weaponDiv);
                this.containerPerWeapon[wep.name] = weaponDiv;
                //weaponDiv.innerHTML = wep.name;
                const input = document.createElement('input');
                input.className = 'displayNone';
                input.id = 'weapon-' + this.weaponId;
                input.name = 'accordion';
                input.type = 'radio';
                const label = document.createElement('label');
                label.htmlFor = 'weapon-' + this.weaponId;
                label.innerText = wep.name;
                const subContainer = document.createElement('div');
                subContainer.className = 'paintsDiv';
                weaponDiv /*TODO: create a map*/.subContainer = subContainer;
                weaponDiv.appendChild(input);
                weaponDiv.appendChild(label);
                weaponDiv.appendChild(subContainer);
                ++this.weaponId;
            }
            //const subContainer = weaponDiv.subContainer;
            //weaponDiv.weaponPaint = weaponPaint;
            weaponDiv /*TODO: create a map*/.weapon = weapon;
            weaponDiv /*TODO: create a map*/.itemDefinitionIndex = itemDefinitionIndex;
            this.#htmlWeaponsDiv?.appendChild(weaponDiv);
            this.dispatchEvent(new CustomEvent(WeaponManagerEvents.AddWarpaint, {
                detail: {
                    p1: itemDefinitionIndex,
                    p2: weaponPaint,
                    p3: weapon,
                    p4: descToken
                }
            }));
        }
    }
    static getItemList(cMsgWarpaintDefinition) {
        const itemList = {};
        for (const propertyName in cMsgWarpaintDefinition) {
            const warpaintDefinitionItem = cMsgWarpaintDefinition[propertyName];
            if (warpaintDefinitionItem) {
                if (propertyName == 'item') {
                    for (let i = 0; i < warpaintDefinitionItem.length; i++) {
                        const warpaintDefinitionItem2 = warpaintDefinitionItem[i];
                        if (warpaintDefinitionItem2.itemDefinitionTemplate ?? warpaintDefinitionItem2.item_definition_template) {
                            itemList['item' + i] = (warpaintDefinitionItem2.itemDefinitionTemplate ?? warpaintDefinitionItem2.item_definition_template).defindex;
                        }
                    }
                }
                else {
                    if (warpaintDefinitionItem.itemDefinitionTemplate ?? warpaintDefinitionItem.item_definition_template) {
                        itemList[propertyName] = (warpaintDefinitionItem.itemDefinitionTemplate ?? warpaintDefinitionItem.item_definition_template).defindex;
                    }
                }
            }
        }
        return itemList;
    }
    static refreshWarpaint(item, clearQueue = false) {
        if (clearQueue) {
            this.#itemQueue = [];
        }
        this.#itemQueue.push(item);
        this.#processNextItemInQueue();
    }
    static #processNextItemInQueue() {
        const mc = new MessageChannel();
        mc.port1.onmessage = () => { this.#processNextItemInQueue2(); };
        mc.port2.postMessage(null);
    }
    static async #processNextItemInQueue2() {
        if (!this.currentItem && this.#itemQueue.length) {
            this.currentItem = this.#itemQueue.shift();
            const ci = this.currentItem;
            const textureName = `#warpaint_${ci.id.replace(/\~\d+/, '')}_${ci.warpaintId}_${ci.warpaintWear}_${ci.warpaintSeed}_${ci.team}`;
            const existingTexture = await Source1TextureManager.getTextureAsync(ci.model?.sourceModel.repository ?? '', textureName, 0, false);
            if (existingTexture) {
                ci.model?.setMaterialParam('WeaponSkin', textureName);
                this.currentItem = undefined;
                this.#processNextItemInQueue();
                return;
            }
            const { /*name: textureName,*/ texture } = Source1TextureManager.addInternalTexture(ci.model?.sourceModel.repository ?? '', textureName);
            texture.setAlphaBits(8);
            if (ci.warpaintId !== undefined) {
                this.dispatchEvent(new CustomEvent(WeaponManagerEvents.Started, { detail: ci }));
                const promise = TextureCombiner.combinePaint(ci.warpaintId, ci.warpaintWear, ci.id.replace(/\~\d+/, ''), textureName, texture.getFrame(0), ci.team, ci.warpaintSeed, ci.textureSize);
                ci.model?.setMaterialParam('WeaponSkin', textureName);
                //this._textureCombiner.nodeImageEditor.setOutputTextureName(textureName);
                promise.then(() => {
                    this.dispatchEvent(new CustomEvent(WeaponManagerEvents.Success, { detail: ci }));
                    this.currentItem = undefined;
                    this.#processNextItemInQueue();
                });
                promise.catch((e) => {
                    this.dispatchEvent(new CustomEvent(WeaponManagerEvents.Failure, { detail: ci }));
                    console.error('Promise processNextItemInQueue KO', e);
                    this.currentItem = undefined;
                    this.#processNextItemInQueue();
                });
            }
            else {
                this.currentItem = undefined;
                this.#processNextItemInQueue();
            }
        }
    }
}
/*
const collections = {
'concealedkiller':'Concealed Killer Collection',
'craftsmann':'Craftsmann Collection',
'teufort':'Teufort Collection',
'powerhouse':'Powerhouse Collection',
'harvest':'Harvest',
'pyroland':'Pyroland',
'gentlemanne':'Gentlemanne',
'warbird':'Warbird',
'weaponcase':'Weapon cases',
}*/
/*
const wearLevel = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle Scarred'];

WeaponManager.weapons = {
flamethrower : 7,
grenadelauncher : 8,
knife : 9,
medigun : 10,
minigun : 11,
pistol : 12,
revolver : 13,
rocketlauncher : 14,
scattergun : 15,
shotgun : 16,
smg : 17,
sniperrifle : 18,
stickybomb_launcher : 19,
ubersaw : 20,
wrench : 21,
amputator : 22,
atom_launcher : 23,
back_scratcher : 24,
battleaxe : 25,
bazaar_sniper : 26,
blackbox : 27,
claidheamohmor : 28,
crusaders_crossbow : 29,
degreaser : 30,
demo_cannon : 31,
demo_sultan_sword : 32,
detonator : 33,
gatling_gun : 34,
holymackerel : 35,
jag : 36,
lochnload : 37,
powerjack : 38,
quadball : 39,
reserve_shooter : 40,
riding_crop : 41,
russian_riot : 42,
scimitar : 43,
scorch_shot : 44,
shortstop : 45,
soda_popper : 46,
tele_shotgun : 47,
tomislav : 48,
trenchgun : 49,
winger_pistol : 50
}
*/

var timelineCSS = ":host {\n\tdisplay: flex;\n\twidth: 100%;\n\tbackground-color: black;\n\tflex-direction: column;\n\tuser-select: none;\n\t--group-padding: var(--harmony3d-timeline-group-padding, 0.5rem);\n\t--clip-height: var(--harmony3d-timeline-clip-height, 2rem);\n\t--time-scale: var(--harmony3d-timeline-time-scale, 2rem);\n\n\t--ruler-num-c: #888;\n\t--ruler-num-fz: 10px;\n\t--ruler-num-pi: 0.75ch;\n\t--ruler-unit: 1px;\n\t--ruler-x: 1;\n\t--ruler-y: 1;\n\n\t--ruler1-bdw: 1px;\n\t--ruler1-c: #BBB;\n\t--ruler1-h: 8px;\n\t--ruler1-space: 5;\n\n\t--ruler2-bdw: 1px;\n\t--ruler2-c: #BBB;\n\t--ruler2-h: 20px;\n\t--ruler2-space: 50;\n\n\t--timeline-offset-x: 0;\n}\n\n.timeline {\n\tbackground-color: blueviolet;\n\tposition: relative;\n}\n\n.group {\n\tbackground-color: chocolate;\n}\n\n.channel {\n\tbackground-color: darkgreen;\n}\n\n.group>.content {\n\t/*padding: 1rem;*/\n\tborder: 0.05rem solid;\n}\n\n.channel>.content {\n\theight: 2rem;\n\toverflow: auto;\n}\n\n.clip {\n\tbackground-color: darkmagenta;\n\tdisplay: inline-block;\n\tposition: absolute;\n}\n\n.clip .content {\n\toverflow: hidden;\n\twhite-space: nowrap;\n\ttext-overflow: ellipsis;\n\n}\n\n\n.ruler-x {\n\tcursor: grab;\n\tposition: relative;\n\t/* Low ticks */\n\t--ruler1-bdw: 1px;\n\t--ruler1-c: #BBB;\n\t--ruler1-h: 8px;\n\t--ruler1-space: 5;\n\n\t/* Tall ticks */\n\t--ruler2-bdw: 1px;\n\t--ruler2-c: #BBB;\n\t--ruler2-h: 20px;\n\t--ruler2-space: 50;\n\n\n\tbackground-image:\n\t\tlinear-gradient(90deg, var(--ruler1-c) 0 var(--ruler1-bdw), transparent 0),\n\t\tlinear-gradient(90deg, var(--ruler2-c) 0 var(--ruler2-bdw), transparent 0);\n\tbackground-repeat: repeat-x;\n\tbackground-size:\n\t\tcalc(var(--ruler-unit) * var(--ruler1-space)) var(--ruler1-h),\n\t\tcalc(var(--ruler-unit) * var(--ruler2-space)) var(--ruler2-h);\n\tbackground-position-x: calc(var(--ruler-unit) * var(--timeline-offset-x)), calc(var(--ruler-unit) * var(--timeline-offset-x));\n\t--offset-count: round(down, var(--timeline-offset-x), var(--ruler2-space));\n\t--offset-count: round(down, var(--timeline-offset-x) / var(--ruler2-space), 1);\n\n\tpadding-left: calc(var(--ruler-unit) * (var(--timeline-offset-x) - var(--offset-count) * var(--ruler2-space)));\n\tcolor: var(--ruler-num-c);\n\tcounter-reset: d calc(-1 - var(--offset-count));\n\tdisplay: flex;\n\tfont-size: var(--ruler-num-fz);\n\theight: var(--ruler2-h);\n\tinset-block-start: 0;\n\t/*inset-inline-start: calc(var(--ruler-unit) * var(--ruler2-space));*/\n\tline-height: 1;\n\tlist-style: none;\n\tmargin: 0;\n\topacity: var(--ruler-x);\n\toverflow: hidden;\n\t/*padding: 0;*/\n\tposition: relative;\n\twidth: 100%;\n}\n\n.ruler-x.grabbing {\n\tcursor: grabbing;\n}\n\n\n\n.ruler-x li {\n\talign-self: flex-end;\n\tcounter-increment: d;\n\tflex: 0 0 calc(var(--ruler-unit) * var(--ruler2-space));\n\tpointer-events: none;\n}\n\n.ruler-x li::after {\n\tcontent: counter(d);\n\tline-height: 1;\n\tpadding-inline-start: var(--ruler-num-pi);\n}\n\n.cursor {\n\tposition: absolute;\n\theight: 100%;\n\twidth: 1rem;\n}\n";

class HTMLTimelineElement extends HTMLElement {
    #shadowRoot;
    #htmlContainer;
    #htmlRuler;
    #htmlContent;
    #htmlCursor;
    #childs = new Map();
    #timeline;
    #timescale = 30;
    #timeOffset = 0;
    #startTimeOffset = 0;
    #dragRuler = false;
    #dragRulerStartOffsetX = 0;
    constructor() {
        super();
        this.#shadowRoot = this.attachShadow({ mode: 'closed' });
        shadowRootStyle(this.#shadowRoot, timelineCSS);
        this.#htmlContainer = createElement('div', {
            class: 'timeline',
            parent: this.#shadowRoot,
            childs: [
                this.#htmlRuler = createElement('ul', {
                    class: 'ruler-x',
                    innerHTML: '<li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li>',
                    events: {
                        mousedown: (event) => this.#startDragRuler(event),
                    }
                }),
                this.#htmlContent = createElement('div', { class: 'content' }),
                this.#htmlCursor = createElement('div', { class: 'cursor' }),
            ]
        });
        document.addEventListener('mousemove', (event) => this.#handleMouseMove(event));
        document.addEventListener('mouseup', () => this.#handleMouseUp());
    }
    setTimeline(timeline) {
        this.#timeline = timeline;
        this.#updateHTML();
    }
    #updateElement(element) {
        if (element == this.#timeline) {
            this.#updateHTML();
        }
        else {
            switch (element.type) {
                case TimelineElementType.Group:
                    this.#updateGroup(element);
                    break;
                case TimelineElementType.Channel:
                    this.#updateChannel(element);
                    break;
                case TimelineElementType.Clip:
                    this.#updateClip(element);
                    break;
                default:
                    //throw 'code this case ' + this.#timeline.type;
                    console.error('code this case ' + element.type);
            }
        }
    }
    #updateHTML() {
        //this.#htmlHeader.innerText = '';
        this.#htmlContent.innerText = '';
        if (!this.#timeline) {
            return;
        }
        this.#updateTime();
        //this.#htmlHeader.innerText = (this.#timeline as TimelineElement).getPropertyValue('name');
        const root = this.#timeline?.getRoot();
        if (!root) {
            return;
        }
        const h = this.#getChild(root);
        if (h) {
            this.#htmlContent.replaceChildren(h.html);
        }
        this.#updateElement(root);
    }
    #updateTime() {
        //const rect = this.#htmlTimeline.getBoundingClientRect();
        //const width = rect.width;
        //const ticks =
    }
    #updateGroup(group) {
        const htmlGroup = this.#getChild(group);
        if (!htmlGroup) {
            return;
        }
        //this.#htmlContainer.classList.add('group');
        const name = group.getName();
        if (name) {
            show(htmlGroup.htmlHeader);
            htmlGroup.htmlHeader.innerText = name;
        }
        else {
            hide(htmlGroup.htmlHeader);
        }
        for (const child of group.getChilds()) {
            const h = this.#getChild(child);
            if (h) {
                //this.#htmlContent.replaceChildren(h.html);
                htmlGroup.htmlContent.append(h.html);
                this.#updateElement(child);
            }
        }
    }
    #updateChannel(channel) {
        const htmlChannel = this.#getChild(channel);
        if (!htmlChannel) {
            return;
        }
        //this.#htmlContainer.classList.add('group');
        const name = channel.getName();
        if (name) {
            show(htmlChannel.htmlHeader);
            htmlChannel.htmlHeader.innerText = name;
        }
        else {
            hide(htmlChannel.htmlHeader);
        }
        for (const clip of channel.getClips()) {
            const h = this.#getChild(clip);
            if (h) {
                //this.#htmlContent.replaceChildren(h.html);
                htmlChannel.htmlContent.append(h.html);
                this.#updateElement(clip);
            }
        }
        /*
        this.#htmlContainer.classList.add('channel');
        const name = (this.#timeline as TimelineChannel).getPropertyValue('name') as string;
        if (name) {
            show(this.#htmlHeader);
            this.#htmlHeader.innerText = name;
        } else {
            hide(this.#htmlHeader);
        }
            */
    }
    #updateClip(clip) {
        const htmlClip = this.#getChild(clip);
        if (!htmlClip) {
            return;
        }
        htmlClip.html.innerText = clip.getName();
        htmlClip.html.style.left = `${clip.getStartTime()}px`;
        htmlClip.html.style.width = `${clip.getLength()}px`;
        /*
        this.#htmlContainer.classList.add('clip');
        const name = (this.#timeline as TimelineClip).getPropertyValue('name') as string;
        if (name) {
            show(this.#htmlHeader);
            this.#htmlHeader.innerText = name;
        } else {
            hide(this.#htmlHeader);
        }

        */
    }
    #getChild(element) {
        let html /*TODO: fix type*/ = this.#childs.get(element);
        if (!html) {
            //html = createElement('div') as HTMLTimelineElement;
            //html.setTimelineElement(element);
            html = this.#createChild(element);
            this.#childs.set(element, html);
        }
        return html;
    }
    #createChild(element) {
        let htmlHeader, htmlContent;
        switch (element.type) {
            case TimelineElementType.Group:
                const htmlGroup = createElement('div', {
                    class: 'group',
                    childs: [
                        htmlHeader = createElement('div', { class: 'header' }),
                        htmlContent = createElement('div', { class: 'content' }),
                    ]
                });
                return {
                    html: htmlGroup,
                    htmlHeader: htmlHeader,
                    htmlContent: htmlContent,
                };
            case TimelineElementType.Channel:
                const htmlChannel = createElement('div', {
                    class: 'channel',
                    childs: [
                        htmlHeader = createElement('div', { class: 'header' }),
                        htmlContent = createElement('div', { class: 'content' }),
                    ]
                });
                return {
                    html: htmlChannel,
                    htmlHeader: htmlHeader,
                    htmlContent: htmlContent,
                };
            case TimelineElementType.Clip:
                const htmlClip = createElement('div', {
                    class: 'clip',
                    childs: [
                        htmlHeader = createElement('div', { class: 'header' }),
                        htmlContent = createElement('div', { class: 'content' }),
                    ]
                });
                return {
                    html: htmlClip,
                    htmlHeader: htmlHeader,
                    htmlContent: htmlContent,
                };
            default:
                //throw 'code this case ' + this.#timeline.type;
                console.error('code this case ' + element.type);
        }
    }
    setTimeOffset(offset) {
        this.#htmlContainer.style.setProperty('--timeline-offset-x', String(offset));
        this.#timeOffset = offset;
    }
    #startDragRuler(event) {
        if (this.#dragRuler) {
            return;
        }
        this.#htmlRuler.classList.add('grabbing');
        this.#dragRuler = true;
        this.#dragRulerStartOffsetX = event.offsetX;
        this.#startTimeOffset = this.#timeOffset;
    }
    #handleMouseMove(event) {
        if (!this.#dragRuler) {
            return;
        }
        this.#moveRuler(event.offsetX);
    }
    #handleMouseUp() {
        if (!this.#dragRuler) {
            return;
        }
        this.#htmlRuler.classList.remove('grabbing');
        this.#dragRuler = false;
    }
    #moveRuler(offsetX) {
        this.setTimeOffset(this.#startTimeOffset + offsetX - this.#dragRulerStartOffsetX);
    }
}
let definedTimelineElement = false;
function defineTimelineElement() {
    if (window.customElements && !definedTimelineElement) {
        customElements.define('harmony3d-timeline', HTMLTimelineElement);
        definedTimelineElement = true;
    }
}

var repositoryCSS = ":host {\n\tuser-select: none;\n\tpadding: 0.5rem;\n\tmargin: 0.5rem;\n\tdisplay: flex;\n\tflex-direction: column;\n\tborder: 0.1rem solid;\n}\n\n.header {\n\tdisplay: flex;\n}\n\n.title {\n\tflex: 1;\n}\n\n.close {\n\tcursor: pointer;\n}\n";

var repositoryEntryCSS = ":host {\n\t--hover-bg-color: var(--harmony3d-repository-hover-bg-color, red);\n\tuser-select: none;\n}\n\n.header {\n\tdisplay: flex;\n}\n\n.header:hover {\n\tbackground-color: var(--hover-bg-color);\n}\n\n.self {\n\tflex: 1;\n}\n\n.custom {\n\tdisplay: block;\n\tflex: 0;\n}\n";

class HTMLRepositoryEntryElement extends HTMLElement {
    #shadowRoot;
    #repositoryEntry;
    #htmlSelf;
    #htmlChilds;
    #expanded = false;
    constructor() {
        super();
        this.#shadowRoot = this.attachShadow({ mode: 'closed' });
        shadowRootStyle(this.#shadowRoot, repositoryEntryCSS);
        createElement('div', {
            class: 'header',
            parent: this.#shadowRoot,
            childs: [
                this.#htmlSelf = createElement('div', {
                    class: 'self',
                    events: {
                        click: () => this.#click(),
                    },
                }),
                createElement('slot', {
                    class: 'custom',
                    name: 'custom',
                    parent: this.#shadowRoot,
                })
            ],
        });
        this.#htmlChilds = createElement('div', {
            class: 'childs',
            parent: this.#shadowRoot,
            hidden: true
        });
        I18n.observeElement(this.#shadowRoot);
    }
    setRepositoryEntry(repositoryEntry) {
        this.#repositoryEntry = repositoryEntry;
        this.#updateHTML();
    }
    #updateHTML() {
        this.#htmlSelf.innerText = this.#repositoryEntry?.getName() ?? '';
        this.#htmlChilds.innerText = '';
        if (this.#repositoryEntry) {
            for (const entry of this.#repositoryEntry.getChilds()) {
                const entryview = createElement('harmony3d-repository-entry', {
                    parent: this.#htmlChilds,
                });
                entryview.setRepositoryEntry(entry);
            }
        }
    }
    #click() {
        if (!this.#repositoryEntry) {
            return;
        }
        if (this.#repositoryEntry.isDirectory()) {
            this.#toggle();
            this.dispatchEvent(new CustomEvent('directoryclick', { detail: this.#repositoryEntry }));
        }
        else {
            this.dispatchEvent(new CustomEvent('fileclick', { detail: this.#repositoryEntry }));
        }
    }
    #toggle() {
        if (this.#expanded) {
            this.#collapse();
        }
        else {
            this.#expand();
        }
    }
    #collapse() {
        hide(this.#htmlChilds);
        this.#expanded = false;
        this.dispatchEvent(new CustomEvent('collapse', { detail: this.#repositoryEntry }));
    }
    #expand() {
        show(this.#htmlChilds);
        this.#expanded = true;
        this.dispatchEvent(new CustomEvent('expand', { detail: this.#repositoryEntry }));
    }
}
let definedRepositoryEntry = false;
function defineRepositoryEntry() {
    if (window.customElements && !definedRepositoryEntry) {
        customElements.define('harmony3d-repository-entry', HTMLRepositoryEntryElement);
        definedRepositoryEntry = true;
    }
}

var RepositoryDisplayMode;
(function (RepositoryDisplayMode) {
    RepositoryDisplayMode["Flat"] = "flat";
    RepositoryDisplayMode["Tree"] = "tree";
})(RepositoryDisplayMode || (RepositoryDisplayMode = {}));
class HTMLRepositoryElement extends HTMLElement {
    #shadowRoot;
    #htmlTitle;
    #htmlActive;
    #htmlEntries;
    #repository;
    #displayMode = RepositoryDisplayMode.Flat;
    #filter;
    constructor() {
        super();
        this.#shadowRoot = this.attachShadow({ mode: 'closed' });
        shadowRootStyle(this.#shadowRoot, repositoryCSS);
        createElement('div', {
            parent: this.#shadowRoot,
            class: 'header',
            childs: [
                this.#htmlTitle = createElement('div', { class: 'title' }),
                this.#htmlActive = createElement('harmony-switch', {
                    class: 'active',
                    state: true,
                    $change: (event) => {
                        if (this.#repository) {
                            this.#repository.active = event.target.state;
                        }
                    },
                }),
                createElement('div', {
                    class: 'close',
                    parent: this.#shadowRoot,
                    child: createElement('span', { innerHTML: closeSVG }),
                    events: {
                        click: () => {
                            this.remove();
                            this.dispatchEvent(new CustomEvent('close'));
                        },
                    },
                }),
            ]
        });
        this.#htmlEntries = createElement('div', {
            parent: this.#shadowRoot,
        });
    }
    setRepository(repository) {
        this.#repository = repository;
        if (repository) {
            repository.active = this.#htmlActive.state;
        }
        this.#updateHTML();
    }
    setFilter(filter) {
        this.#filter = filter;
        this.#updateHTML();
    }
    setDisplayMode(mode) {
        this.#displayMode = mode;
        this.#updateHTML();
    }
    adoptStyleSheet(styleSheet) {
        this.#shadowRoot.adoptedStyleSheets.push(styleSheet);
    }
    async #updateHTML() {
        this.#htmlTitle.innerText = this.#repository?.name ?? '';
        this.#htmlEntries.innerText = '';
        if (!this.#repository) {
            return;
        }
        const response = await this.#repository.getFileList();
        if (response.error) {
            return;
        }
        if (!response.root) {
            return;
        }
        defineRepositoryEntry();
        switch (this.#displayMode) {
            case RepositoryDisplayMode.Flat:
                this.#updateFlat(response.root);
                break;
            case RepositoryDisplayMode.Tree:
                this.#updateTree(response.root);
                break;
        }
    }
    #updateFlat(root) {
        defineRepositoryEntry();
        for (const entry of root.getAllChilds(this.#filter)) {
            const entryview = createElement('harmony3d-repository-entry', {
                parent: this.#htmlEntries,
                events: {
                    fileclick: (event) => this.dispatchEvent(cloneEvent(event)),
                    directoryclick: (event) => this.dispatchEvent(cloneEvent(event)),
                },
            });
            entryview.setRepositoryEntry(entry);
            this.dispatchEvent(new CustomEvent('entrycreated', { detail: { entry: entry, view: entryview } }));
        }
    }
    #updateTree(root) {
        defineRepositoryEntry();
        const entryview = createElement('harmony3d-repository-entry', {
            parent: this.#htmlEntries,
            events: {
                fileclick: (event) => this.dispatchEvent(cloneEvent(event)),
                directoryclick: (event) => this.dispatchEvent(cloneEvent(event)),
            },
        });
        entryview.setRepositoryEntry(root);
        this.dispatchEvent(new CustomEvent('entrycreated', { detail: { entry: root, view: entryview } }));
    }
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case 'display-mode':
                this.setDisplayMode(newValue);
                break;
        }
    }
    static get observedAttributes() {
        return ['display-mode'];
    }
}
let definedRepository = false;
function defineRepository() {
    if (window.customElements && !definedRepository) {
        customElements.define('harmony3d-repository', HTMLRepositoryElement);
        definedRepository = true;
    }
}

export { HTMLRepositoryElement, HTMLRepositoryEntryElement, HTMLTimelineElement, RepositoryDisplayMode, TextureCombiner, TextureCombinerEventTarget, WarpaintEditor, WeaponManager, WeaponManagerEvents, defineRepository, defineRepositoryEntry, defineTimelineElement };
