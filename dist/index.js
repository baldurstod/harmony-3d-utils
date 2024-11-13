import { Graphics, TextureManager, Source1TextureManager, DEG_TO_RAD, DEFAULT_TEXTURE_SIZE, NodeImageEditor, NodeImageEditorGui } from 'harmony-3d';
import { vec2 } from 'gl-matrix';
import { PaintKitDefinitions, getLegacyPaintKit, UniformRandomStream } from 'harmony-tf2-utils';
import { shadowRootStyle, createElement, I18n, hide, show, cloneEvent } from 'harmony-ui';

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
    #firstChild;
    #nextSibling;
    constructor(node) {
        this.node = node;
        if (!blackTexture) {
            new Graphics().ready.then(() => {
                blackTexture = TextureManager.createFlatTexture([0, 0, 0]);
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
        throw 'subclass me';
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
            let childStage = children[i];
            //console.error(childStage);
            childStage.nextSibling = this.firstChild;
            this.firstChild = childStage;
        }
    }
    get displayName() {
        return this.constructor.name;
    }
    toString(tabs = '') {
        let ret = [];
        let tabs1 = tabs + '\t';
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
        let node = this.node;
        let inputs = node.inputs.keys();
        let childStage = this.firstChild;
        while (childStage) {
            childStage.linkNodes();
            let input = inputs.next().value;
            let subNode = childStage.node;
            node.setPredecessor(input, subNode, 'output');
            childStage = childStage.nextSibling;
        }
    }
    async _setupTextures() {
        let texturePath = this.texturePath;
        if (texturePath) {
            this.node.inputTexture = await Stage.getTexture(texturePath);
            this.node.setParam('path', texturePath);
            this.node.invalidate();
        }
        let specularTexturePath = this.specularTexturePath;
        if (specularTexturePath) {
            try {
                this.node.getInput('specular').value = await Stage.getSpecularTexture(texturePath);
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
        return await Stage.#textures.get(texturePath);
    }
    static async getSpecularTexture(specularTexturePath) {
        return this.getTexture(specularTexturePath, blackTexture);
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
        let parameters = this.parameters;
        let adjustBlack = randomStream.randomFloat(parameters.adjustBlack.low, parameters.adjustBlack.high);
        let adjustOffset = randomStream.randomFloat(parameters.adjustOffset.low, parameters.adjustOffset.high);
        let adjustGamma = randomStream.randomFloat(parameters.adjustGamma.low, parameters.adjustGamma.high);
        let adjustWhite = adjustBlack + adjustOffset;
        let node = this.node;
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
        let parameters = this.parameters;
        let shouldFlipU = parameters.allowFlipU ? randomStream.randomInt(0, 1) != 0 : false;
        let shouldFlipV = parameters.allowFlipV ? randomStream.randomInt(0, 1) != 0 : false;
        let translateU = randomStream.randomFloat(parameters.translateU.low, parameters.translateU.high);
        let translateV = randomStream.randomFloat(parameters.translateV.low, parameters.translateV.high);
        let rotation = randomStream.randomFloat(parameters.rotation.low, parameters.rotation.high);
        let scaleUV = randomStream.randomFloat(parameters.scaleUV.low, parameters.scaleUV.high);
        let adjustBlack = randomStream.randomFloat(parameters.adjustBlack.low, parameters.adjustBlack.high);
        let adjustOffset = randomStream.randomFloat(parameters.adjustOffset.low, parameters.adjustOffset.high);
        let adjustGamma = randomStream.randomFloat(parameters.adjustGamma.low, parameters.adjustGamma.high);
        let adjustWhite = adjustBlack + adjustOffset;
        let node = this.node;
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

const TEXTURE_LOOKUP_NODE = 'texture lookup';
class SelectStageParameters {
}
class SelectStage extends Stage {
    nodeImageEditor;
    parameters = new SelectStageParameters();
    constructor(node, nodeImageEditor) {
        super(node);
        this.nodeImageEditor = nodeImageEditor;
    }
    computeRandomValuesThis(randomStream) {
        return false;
    }
    async _setupTextures() {
        let texturePath = this.texturePath;
        if (texturePath) {
            let lookupNode = this.nodeImageEditor.addNode(TEXTURE_LOOKUP_NODE);
            this.node.setPredecessor('input', lookupNode, 'output');
            lookupNode.inputTexture = await Stage.getTexture(texturePath);
            lookupNode.texturePath = texturePath;
            lookupNode.invalidate();
        }
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
        let parameters = this.parameters;
        const computeWeight = (accumulator, currentValue) => accumulator + currentValue.weight;
        let totalWeight = parameters.possibleStickers.reduce(computeWeight, 0);
        //console.error(totalWeight);
        let weight = randomStream.randomFloat(0.0, totalWeight);
        for (let [i, possibleSticker] of parameters.possibleStickers.entries()) {
            let thisWeight = possibleSticker.weight;
            if (weight < thisWeight) {
                this.choice = i;
                this.texturePath = parameters.possibleStickers[i].fileName;
                this.specularTexturePath = parameters.possibleStickers[i].fileName.replace(/.vtf$/, '') + '_s';
                break;
            }
            else {
                weight -= thisWeight;
            }
        }
        if (this.choice == undefined) {
            throw 'error';
        }
        let adjustBlack = randomStream.randomFloat(parameters.adjustBlack.low, parameters.adjustBlack.high);
        let adjustOffset = randomStream.randomFloat(parameters.adjustOffset.low, parameters.adjustOffset.high);
        let adjustGamma = randomStream.randomFloat(parameters.adjustGamma.low, parameters.adjustGamma.high);
        let adjustWhite = adjustBlack + adjustOffset;
        let node = this.node;
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

const texturePathPrefixRemoveMe = '../gamecontent/tf2/materials/'; //TODOv3 : put in constants
class TextureCombiner {
    static #instance;
    #textureSize = DEFAULT_TEXTURE_SIZE;
    #team = 0;
    paintIds = {};
    imageExtension = '.vtf';
    textureApplyStickerNode = 'apply_sticker';
    pixelArray = null;
    lookupNodes = new Map();
    nodeImageEditor = new NodeImageEditor();
    //static #nodeImageEditorGui?: NodeImageEditorGui;// = new NodeImageEditorGui(this.nodeImageEditor);
    variables = {};
    constructor() {
        if (TextureCombiner.#instance) {
            return TextureCombiner.#instance;
        }
        TextureCombiner.#instance = this;
    }
    /*
        static initNodeImageEditorGui(): NodeImageEditorGui {
            if (!this.#nodeImageEditorGui) {
                this.#nodeImageEditorGui = new NodeImageEditorGui(this.nodeImageEditor);
            }
            return this.#nodeImageEditorGui;
        }
            */
    setTextureSize(textureSize) {
        this.#textureSize = textureSize;
        this.nodeImageEditor.textureSize = textureSize;
    }
    set team(t) {
        this.#team = t;
    }
    get team() {
        return this.#team;
    }
    async _getDefindex(CMsgProtoDefID) {
        return PaintKitDefinitions.getDefinition(CMsgProtoDefID);
    }
    async combinePaint(paintKitDefId, wearLevel, weaponDefIndex, outputTextureName, outputTexture, seed = 0n) {
        this.lookupNodes = new Map();
        let combinePaintPromise = new Promise(async (resolve, reject) => {
            if (paintKitDefId != undefined && wearLevel != undefined && weaponDefIndex != undefined) {
                this.nodeImageEditor.removeAllNodes();
                this.nodeImageEditor.clearVariables();
                var paintKitDefinition = await this._getDefindex({ type: 9, defindex: paintKitDefId });
                if (paintKitDefinition) {
                    let item = null;
                    for (let itemDefinitionKey in paintKitDefinition) {
                        let itemDefinitionPerItem = paintKitDefinition[itemDefinitionKey];
                        let itemDefinitionTemplate = itemDefinitionPerItem.itemDefinitionTemplate;
                        if (itemDefinitionTemplate) {
                            let itemDefinition = await this._getDefindex(itemDefinitionTemplate);
                            if (itemDefinition?.itemDefinitionIndex == weaponDefIndex) {
                                item = itemDefinitionPerItem;
                                break;
                            }
                        }
                    }
                    if (!item) {
                        //For legacy warpaints
                        let items = paintKitDefinition['item'];
                        if (items) {
                            for (let it of items) {
                                let itemDefinition = await this._getDefindex(it.itemDefinitionTemplate);
                                if (getLegacyPaintKit(itemDefinition?.itemDefinitionIndex) == weaponDefIndex) {
                                    item = it;
                                    break;
                                }
                            }
                        }
                    }
                    if (item) {
                        let template = paintKitDefinition.operationTemplate; // || item.itemDefinitionTemplate;
                        if (!template) {
                            let itemDefinitionTemplate = await this._getDefindex(item.itemDefinitionTemplate);
                            if (itemDefinitionTemplate && itemDefinitionTemplate.definition && itemDefinitionTemplate.definition[wearLevel]) {
                                template = itemDefinitionTemplate.definition[wearLevel].operationTemplate;
                            }
                        }
                        if (template) {
                            let operationTemplate = await this._getDefindex(template);
                            //console.error(operationTemplate);//removeme
                            if (operationTemplate && operationTemplate.operationNode) {
                                await this.#setupVariables(paintKitDefinition, wearLevel, item);
                                let stage = await this.#processOperationNode(operationTemplate.operationNode[0]); //top level node has 1 operation
                                //console.error(stage.toString());
                                stage.linkNodes();
                                function GetSeed(seed) {
                                    let hilo = [];
                                    hilo.push(BigInt(0));
                                    hilo.push(BigInt(0));
                                    for (let i = 0n; i < 32n; ++i) {
                                        let i2 = 2n * i;
                                        for (let j = 0n; j < 2n; ++j) {
                                            hilo[Number(j)] |= (seed & (1n << (i2 + j))) >> (i + j);
                                        }
                                    }
                                    return hilo;
                                }
                                let hi, lo;
                                [hi, lo] = GetSeed(seed);
                                let randomStreams = [new UniformRandomStream(Number(hi) << 0), new UniformRandomStream(Number(lo) << 0)];
                                stage.computeRandomValues({ currentIndex: 0 }, randomStreams, randomStreams.length);
                                await stage.setupTextures();
                                let finalNode = stage.node;
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
                                                                    reject(false);
                                                                }*/
                                //let pixelArray = await node.getOutput('output').pixelArray;
                                //console.error(await node.toString());
                                //processPixelArray(pixelArray);
                                finalNode.redraw().then(() => resolve(true), () => reject(false));
                                return;
                            }
                        }
                    }
                    reject(false);
                }
            }
            else {
                reject(false);
            }
            /*if (!finalPromise) {
                reject(false);
            }*/
        });
        return combinePaintPromise;
    }
    async #setupVariables(paintKitDefinition, wearLevel, item) {
        this.variables = {};
        if (item) {
            if (item.data) {
                this.#addVariables(item.data.variable);
            }
            if (item.itemDefinitionTemplate) {
                let itemDefinition = await this._getDefindex(item.itemDefinitionTemplate);
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
        if (paintKitDefinition.header) {
            this.#addVariables2(paintKitDefinition.header.variables);
        }
    }
    #addVariables(variableArray) {
        if (variableArray) {
            for (let i = 0; i < variableArray.length; i++) {
                let v = variableArray[i];
                this.variables[v.variable] = v.string;
            }
        }
    }
    #addVariables2(variableArray) {
        if (variableArray) {
            for (let i = 0; i < variableArray.length; i++) {
                let v = variableArray[i];
                if ((v.inherit == false) || (this.variables[v.name] === undefined)) {
                    this.variables[v.name] = v.value;
                }
            }
        }
    }
    async #processOperationNodeArray(operationNodeArray /*, parentStage: Stage*/) {
        let chidren = [];
        for (var i = 0; i < operationNodeArray.length; i++) {
            let child = await this.#processOperationNode(operationNodeArray[i] /*, parentStage*/);
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
    #getStageName(stage) {
        switch (true) {
            case stage.textureLookup != undefined:
                return 'textureLookup';
            case stage.combineAdd != undefined:
                return 'combine_add';
            case stage.combineLerp != undefined:
                return 'combine_lerp';
            case stage.combineMultiply != undefined:
                return 'multiply';
            case stage.select != undefined:
                return 'select';
            case stage.applySticker != undefined:
                return 'applySticker';
            default:
                throw 'Unsuported stage';
        }
    }
    async #processOperationNode(operationNode /*, parentStage: Stage/*, parentStage*/ /*, inputs*/) {
        let subStage = null;
        if (operationNode.stage) {
            let stage = operationNode.stage;
            let stage2 = null;
            let s;
            switch (true) {
                case stage.textureLookup != undefined:
                    s = stage.textureLookup;
                    subStage = this.#processTextureStage(s);
                    stage2 = s;
                    break;
                case stage.combineAdd != undefined:
                case stage.combineLerp != undefined:
                case stage.combineMultiply != undefined:
                    s = stage.combineAdd || stage.combineLerp || stage.combineMultiply;
                    subStage = this.#processCombineStage(s, this.#getStageName(stage));
                    stage2 = s;
                    break;
                case stage.select != undefined:
                    s = stage.select;
                    subStage = this.#processSelectStage(s);
                    stage2 = s;
                    break;
                case stage.applySticker != undefined:
                    s = stage.applySticker;
                    subStage = this.#processApplyStickerStage(s);
                    stage2 = s;
                    break;
                default:
                    throw 'Unsuported stage';
            }
            if (stage2.operationNode) {
                let chidren = await this.#processOperationNodeArray(stage2.operationNode /*, subStage/*, node*/);
                if (subStage) {
                    subStage.appendChildren(chidren);
                }
            }
        }
        else if (operationNode.operationTemplate) {
            let template = await this._getDefindex(operationNode.operationTemplate);
            if (template && template.operationNode) {
                //console.error('template.operationNode', template.operationNode.length, template.operationNode);
                let chidren = await this.#processOperationNodeArray(template.operationNode /*, parentStage/*, node, inputs*/);
                return chidren;
            }
            else {
                throw 'Invalid template';
            }
        }
        else {
            throw 'Unsuported operationNode.operation_template';
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
    #processCombineStage(stage, combineMode) {
        let node = this.nodeImageEditor.addNode(combineMode);
        let combineStage = new CombineStage(node, combineMode);
        return combineStage;
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
    #processTextureStage(stage) {
        let node = null;
        var texture;
        if (this.#team == 0) {
            texture = stage.textureRed || stage.texture;
        }
        else {
            texture = stage.textureBlue || stage.texture;
        }
        let texturePath = this.#getVarField(texture);
        texturePath = texturePath.replace(/\.tga$/, '');
        if (texturePath) {
            texturePathPrefixRemoveMe + texturePath + this.imageExtension;
            if (!node) {
                node = this.nodeImageEditor.addNode(TEXTURE_LOOKUP_NODE);
                node.setParam('path', texturePath);
            }
        }
        if (!node) {
            return;
        }
        let textureStage = new TextureStage(node);
        textureStage.texturePath = texturePath;
        if (stage.adjustBlack) {
            ParseRangeThenDivideBy(textureStage.parameters.adjustBlack, this.#getVarField(stage.adjustBlack));
        }
        if (stage.adjustOffset) {
            ParseRangeThenDivideBy(textureStage.parameters.adjustOffset, this.#getVarField(stage.adjustOffset));
        }
        if (stage.adjustGamma) {
            ParseInverseRange(textureStage.parameters.adjustGamma, this.#getVarField(stage.adjustGamma));
        }
        if (stage.scaleUv) {
            ParseRange(textureStage.parameters.scaleUV, this.#getVarField(stage.scaleUv));
        }
        if (stage.rotation) {
            ParseRange(textureStage.parameters.rotation, this.#getVarField(stage.rotation));
        }
        if (stage.translateU) {
            ParseRange(textureStage.parameters.translateU, this.#getVarField(stage.translateU));
        }
        if (stage.translateV) {
            ParseRange(textureStage.parameters.translateV, this.#getVarField(stage.translateV));
        }
        if (stage.flipU) {
            textureStage.parameters.allowFlipU = this.#getVarField(stage.flipU) != 0;
        }
        if (stage.flipV) {
            textureStage.parameters.allowFlipV = this.#getVarField(stage.flipV) != 0;
        }
        return textureStage;
    }
    #processSelectStage(stage) {
        let selectParametersNode = this.nodeImageEditor.addNode('int array', { length: 16 });
        let selectNode = this.nodeImageEditor.addNode('select');
        let selectStage = new SelectStage(selectNode, this.nodeImageEditor);
        selectNode.setPredecessor('selectvalues', selectParametersNode, 'output');
        if (stage.groups) {
            selectStage.texturePath = this.#getVarField(stage.groups);
        }
        if (stage.select) {
            //selectNode.params.threshold = [];
            let arr = stage.select;
            for (let i = 0; i < arr.length; i++) {
                let varField = arr[i];
                let level = this.#getVarField(varField);
                selectParametersNode.setValue(i, parseInt(level));
            }
        }
        selectNode.invalidate();
        return selectStage;
    }
    #processApplyStickerStage(stage) {
        let applyStickerNode = this.nodeImageEditor.addNode(this.textureApplyStickerNode);
        let applyStickerStage = new ApplyStickerStage(applyStickerNode);
        if (stage.adjustBlack) {
            ParseRangeThenDivideBy(applyStickerStage.parameters.adjustBlack, this.#getVarField(stage.adjustBlack));
        }
        if (stage.adjustOffset) {
            ParseRangeThenDivideBy(applyStickerStage.parameters.adjustOffset, this.#getVarField(stage.adjustOffset));
        }
        if (stage.adjustGamma) {
            ParseInverseRange(applyStickerStage.parameters.adjustGamma, this.#getVarField(stage.adjustGamma));
        }
        if (stage.destBl) {
            ParseVec2(applyStickerStage.parameters.bl, this.#getVarField(stage.destBl));
        }
        if (stage.destTl) {
            ParseVec2(applyStickerStage.parameters.tl, this.#getVarField(stage.destTl));
        }
        if (stage.destTr) {
            ParseVec2(applyStickerStage.parameters.tr, this.#getVarField(stage.destTr));
        }
        if (stage.sticker) {
            let arr = stage.sticker;
            for (let i = 0; i < arr.length; i++) {
                let operationSticker = arr[i];
                let sticker = new Sticker();
                sticker.fileName = this.#getVarField(operationSticker.base);
                if (operationSticker.weight) {
                    sticker.weight = this.#getVarField(operationSticker.weight) * 1.0;
                }
                applyStickerStage.parameters.possibleStickers.push(sticker);
            }
        }
        else {
            throw 'No sticker defined';
        }
        applyStickerNode.invalidate();
        return applyStickerStage;
    }
    #getVarField(field) {
        if (!field) {
            return null;
        }
        if (field.variable) {
            let v = this.variables[field.variable];
            if (v) {
                return v;
            }
        }
        return field.string;
    }
}
function ParseRange(output, input) {
    input = input.trim();
    let range = input.split(/\s+/);
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
    input = input.trim();
    let range = input.split(' ');
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
    static #instance;
    #nodeImageEditorGui = new NodeImageEditorGui();
    constructor() {
        if (WarpaintEditor.#instance) {
            return WarpaintEditor.#instance;
        }
        WarpaintEditor.#instance = this;
    }
    init(container) {
        container.append(this.#nodeImageEditorGui.htmlElement);
        this.#nodeImageEditorGui.setNodeImageEditor(new TextureCombiner().nodeImageEditor);
    }
}

const WeaponManagerEventTarget = new EventTarget();
class WeaponManager {
    static #instance;
    #htmlWeaponsDiv;
    #htmlPaintsDiv;
    weapons = {};
    collections = {};
    weaponName = '';
    paintkitName = '';
    asyncRequestId = 0;
    _protoElements = {};
    protoDefs = null;
    shouldRequestItems = true;
    itemsDef = null;
    itemsReady = false;
    containerPerWeapon = {};
    #itemQueue = [];
    currentItem;
    weaponId = 0;
    constructor() {
        if (WeaponManager.#instance) {
            return WeaponManager.#instance;
        }
        WeaponManager.#instance = this;
    }
    async initPaintKitDefinitions(url) {
        let response = await fetch(url);
        this.protoDefs = await response.json();
        let definitions = await PaintKitDefinitions.getWarpaintDefinitions();
        if (definitions) {
            this._protoElements = definitions;
            let paintKitDefinitions = definitions[9];
            for (let paintKitDefId in paintKitDefinitions) {
                let definition = paintKitDefinitions[paintKitDefId];
                let token = this.protoDefs ? this.protoDefs[definition.locDesctoken] || definition.locDesctoken : definition.locDesctoken;
                this.#addPaintKit(definition, token);
            }
        }
    }
    initView(container) {
        this.#htmlWeaponsDiv = document.createElement('div');
        this.#htmlWeaponsDiv.className = 'weaponsDiv';
        this.#htmlPaintsDiv = document.createElement('div');
        this.#htmlPaintsDiv.className = 'paintsDiv';
        if (container) {
            container.appendChild(this.#htmlWeaponsDiv);
            container.appendChild(this.#htmlPaintsDiv);
        }
    }
    #addPaintKit(paintKit, descToken) {
        let cMsgPaintKit_Definition = this._protoElements[9][paintKit.header.defindex];
        let paintKitItemDefinitions = this._protoElements[8];
        if (cMsgPaintKit_Definition) {
            let itemList = this.getItemList(cMsgPaintKit_Definition);
            for (let weaponName in itemList) {
                let itemDefinition = paintKitItemDefinitions[itemList[weaponName]];
                if (itemDefinition) {
                    this.#addWeapon(paintKit, paintKit.header.defindex, weaponName, itemList[weaponName], itemDefinition.itemDefinitionIndex, descToken);
                }
            }
        }
        return;
    }
    #addWeapon(paintKit, weaponPaint, weapon, defindex, itemDefinitionIndex, descToken) {
        //let wep = this.itemsDef?.[itemDefinitionIndex] || this.itemsDef?.[itemDefinitionIndex + '~0'] ;
        let wep = { name: weapon };
        if (wep) {
            var weaponDiv = this.containerPerWeapon[wep.name];
            if (!weaponDiv) {
                weaponDiv = document.createElement('div');
                weaponDiv.className = 'weaponDiv';
                this.#htmlPaintsDiv?.appendChild(weaponDiv);
                this.containerPerWeapon[wep.name] = weaponDiv;
                //weaponDiv.innerHTML = wep.name;
                let input = document.createElement('input');
                input.className = 'displayNone';
                input.id = 'weapon-' + this.weaponId;
                input.name = 'accordion';
                input.type = 'radio';
                let label = document.createElement('label');
                label.htmlFor = 'weapon-' + this.weaponId;
                label.innerHTML = wep.name;
                let subContainer = document.createElement('div');
                subContainer.className = 'paintsDiv';
                weaponDiv.subContainer = subContainer;
                weaponDiv.appendChild(input);
                weaponDiv.appendChild(label);
                weaponDiv.appendChild(subContainer);
                ++this.weaponId;
            }
            weaponDiv.subContainer;
            //weaponDiv.weaponPaint = weaponPaint;
            weaponDiv.weapon = weapon;
            weaponDiv.itemDefinitionIndex = itemDefinitionIndex;
            this.#htmlWeaponsDiv?.appendChild(weaponDiv);
            //this.#addPaintKit2(paintKit, subContainer, weapon, itemDefinitionIndex);
            WeaponManagerEventTarget.dispatchEvent(new CustomEvent('addpaintkit', {
                detail: {
                    p1: itemDefinitionIndex,
                    p2: weaponPaint,
                    p3: weapon,
                    p4: descToken
                }
            }));
        }
    }
    /*
         #addPaintKit2(paintKit, parent, weapon, itemDefinitionIndex) {
            var paintKitDiv = document.createElement('div');
            parent.appendChild(paintKitDiv);
            paintKitDiv.className = 'paintDiv';
            //paintKitDiv.weaponPaint = paintKit.header.defindex;
            paintKitDiv.setAttribute('data-weapon-paint', paintKit.header.defindex);
            paintKitDiv.innerText = paintKit.header.name;
            //paintKitDiv.itemDefinitionIndex = itemDefinitionIndex;
            paintKitDiv.setAttribute('data-item-definition-index', itemDefinitionIndex);
            //paintKitDiv.weapon = weapon;
            paintKitDiv.setAttribute('data-weapon', weapon);
            /*paintKitDiv.modelplayer = paintKit.modelplayer;
            paintKitDiv.weaponName = paintKit.name;* /
            paintKitDiv.addEventListener('click', (event) => handlePaintClick());

        }
        /*
    /*
         handlePaintClick() {
            let currentModel = '';
            if (this.itemDefinitionIndex) {
                let itemDef = this.itemsDef[this.itemDefinitionIndex] || this.itemsDef[this.itemDefinitionIndex + '~0'];
                if (itemDef && itemDef.model_player) {
                    currentModel = itemDef.model_player;
                }
            }
            weaponName = this.weaponName;
            this.paintkitName = this.innerHTML;
            setupModels();
            weaponPaint = this.weaponPaint;
            weapon = this.weapon;
            this.refreshPaint();
        }*/
    /*
         handleWeaponClick() {
            currentModel = '';
            if (this.itemDefinitionIndex) {
                let itemDef = this.itemsDef[this.itemDefinitionIndex] || this.itemsDef[this.itemDefinitionIndex + '~0'];
                if (itemDef && itemDef.model_player) {
                    currentModel = itemDef.model_player;
                }
            }
            weaponName = this.weaponName;
            this.paintkitName = this.innerHTML;
            setupModels();
            weaponPaint = this.weaponPaint;
            weapon = this.weapon;
            this.refreshPaint();
        }
    */
    getItemList(cMsgPaintKit_Definition) {
        let itemList = {};
        for (let propertyName in cMsgPaintKit_Definition) {
            let paintKitDefinitionItem = cMsgPaintKit_Definition[propertyName];
            if (paintKitDefinitionItem) {
                if (propertyName == 'item') {
                    for (let i = 0; i < paintKitDefinitionItem.length; i++) {
                        let paintKitDefinitionItem2 = paintKitDefinitionItem[i];
                        if (paintKitDefinitionItem2.itemDefinitionTemplate) {
                            //itemList.push(paintKitDefinitionItem2.itemDefinitionTemplate.defindex);
                            itemList['item' + i] = paintKitDefinitionItem2.itemDefinitionTemplate.defindex;
                        }
                    }
                }
                else {
                    if (paintKitDefinitionItem.itemDefinitionTemplate) {
                        //itemList.push(paintKitDefinitionItem.itemDefinitionTemplate.defindex);
                        itemList[propertyName] = paintKitDefinitionItem.itemDefinitionTemplate.defindex;
                    }
                }
            }
        }
        return itemList;
    }
    refreshPaint(item) {
        this.refreshItem(item);
    }
    /*
         handleCollectionClick(event) {
            if (this.collectionBody.style.display == 'none') {
                this.collectionBody.style.display = null;
                this.collectionBody.style.display = '';
            } else {
                this.collectionBody.style.display = 'none';
            }
        }*/
    /*
         setWeapon(weapon) {
            this.weapon = weapon;
            this.refreshPaint();
        }*/
    refreshItem(item, clearQueue = false) {
        if (clearQueue) {
            this.#itemQueue = [];
        }
        this.#itemQueue.push(item);
        this.processNextItemInQueue();
    }
    processNextItemInQueue() {
        if (!this.currentItem && this.#itemQueue.length) {
            this.currentItem = this.#itemQueue.shift();
            let ci = this.currentItem;
            let { name: textureName, texture } = Source1TextureManager.addInternalTexture();
            texture.setAlphaBits(8);
            if (ci.paintKitId !== null) {
                let promise = new TextureCombiner().combinePaint(ci.paintKitId, ci.paintKitWear, ci.id.replace(/\~\d+/, ''), textureName, texture, ci.paintKitSeed);
                ci.sourceModel.materialsParams['WeaponSkin'] = textureName;
                //this._textureCombiner.nodeImageEditor.setOutputTextureName(textureName);
                promise.then((e) => {
                    //console.error('Promise processNextItemInQueue OK');
                    this.currentItem = null;
                    this.processNextItemInQueue();
                });
                promise.catch((e) => {
                    console.error('Promise processNextItemInQueue KO');
                    this.currentItem = null;
                    this.processNextItemInQueue();
                });
            }
            else {
                this.currentItem = null;
                this.processNextItemInQueue();
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

var repositoryEntryCSS = ".header {\n\tdisplay: flex;\n}\n\n.self {\n\tflex: 1;\n}\n\n.custom {\n\tdisplay: block;\n\tflex: 0;\n}\n";

class RepositoryEntryElement extends HTMLElement {
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
        customElements.define('harmony3d-repository-entry', RepositoryEntryElement);
        definedRepositoryEntry = true;
    }
}

var repositoryCSS = "";

var RepositoryDisplayMode;
(function (RepositoryDisplayMode) {
    RepositoryDisplayMode["Flat"] = "flat";
    RepositoryDisplayMode["Tree"] = "tree";
})(RepositoryDisplayMode || (RepositoryDisplayMode = {}));
class RepositoryElement extends HTMLElement {
    #shadowRoot;
    #repository;
    #displayMode = RepositoryDisplayMode.Flat;
    #filter;
    constructor() {
        super();
        this.#shadowRoot = this.attachShadow({ mode: 'closed' });
        shadowRootStyle(this.#shadowRoot, repositoryCSS);
    }
    setRepository(repository) {
        this.#repository = repository;
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
    async #updateHTML() {
        this.#shadowRoot.innerHTML = '';
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
    async #updateFlat(root) {
        defineRepositoryEntry();
        for (const entry of root.getAllChilds(this.#filter)) {
            const entryview = createElement('harmony3d-repository-entry', {
                parent: this.#shadowRoot,
                events: {
                    fileclick: (event) => this.dispatchEvent(cloneEvent(event)),
                    directoryclick: (event) => this.dispatchEvent(cloneEvent(event)),
                },
            });
            entryview.setRepositoryEntry(entry);
            this.dispatchEvent(new CustomEvent('entrycreated', { detail: { entry: entry, view: entryview } }));
        }
    }
    async #updateTree(root) {
        defineRepositoryEntry();
        const entryview = createElement('harmony3d-repository-entry', {
            parent: this.#shadowRoot,
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
        customElements.define('harmony3d-repository', RepositoryElement);
        definedRepository = true;
    }
}

export { RepositoryDisplayMode, RepositoryElement, RepositoryEntryElement, TextureCombiner, WarpaintEditor, WeaponManager, WeaponManagerEventTarget, defineRepository, defineRepositoryEntry };
