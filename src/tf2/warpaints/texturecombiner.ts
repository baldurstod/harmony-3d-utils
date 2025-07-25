import { vec2 } from 'gl-matrix';
import { NodeImageEditor, DEFAULT_TEXTURE_SIZE, Texture, IntArrayNode, Node } from 'harmony-3d';
import { Range } from './stages/parameters';
import { Stage } from './stages/stage';
import { CombineStage } from './stages/combine';
import { TextureStage } from './stages/texture';
import { SelectStage, TEXTURE_LOOKUP_NODE } from './stages/select';
import { ApplyStickerStage, Sticker } from './stages/applysticker';
import { getLegacyPaintKit, PaintKitDefinitions, UniformRandomStream } from 'harmony-tf2-utils';

const texturePathPrefixRemoveMe = '../gamecontent/tf2/materials/';//TODOv3 : put in constants

export const TextureCombinerEventTarget = new EventTarget();

export type PaintDoneEvent = {
	paintKitDefId: number,
	wearLevel: number,
	weaponDefIndex: string,
	outputTextureName: string,
	outputTexture: Texture,
	seed: bigint,
	node: Node,
}

export class TextureCombiner {
	static #instance: TextureCombiner;
	#textureSize = DEFAULT_TEXTURE_SIZE;
	#team = 0;
	paintIds = {};
	imageExtension = '.vtf';
	textureApplyStickerNode = 'apply_sticker';
	pixelArray = null;
	lookupNodes = new Map();
	nodeImageEditor = new NodeImageEditor();
	//static #nodeImageEditorGui?: NodeImageEditorGui;// = new NodeImageEditorGui(this.nodeImageEditor);
	variables: any = {};

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

	setTextureSize(textureSize: number) {
		this.#textureSize = textureSize;
		this.nodeImageEditor.textureSize = textureSize;
	}

	set team(t) {
		this.#team = t;
	}

	get team() {
		return this.#team;
	}

	async _getDefindex(CMsgProtoDefID: any) {
		return PaintKitDefinitions.getDefinition(CMsgProtoDefID);
	}

	async combinePaint(paintKitDefId: number, wearLevel: number, weaponDefIndex: string, outputTextureName: string, outputTexture: Texture, seed: bigint = 0n): Promise<boolean> {
		this.lookupNodes = new Map();
		let combinePaintPromise = new Promise<boolean>(async resolve => {
			let finalPromise;
			if (paintKitDefId != undefined && wearLevel != undefined && weaponDefIndex != undefined) {
				this.nodeImageEditor.removeAllNodes();
				this.nodeImageEditor.clearVariables();

				var paintKitDefinition = await this._getDefindex({ type: 9, defindex: paintKitDefId });
				if (paintKitDefinition) {
					let item = null;
					for (let itemDefinitionKey in paintKitDefinition) {
						let itemDefinitionPerItem = paintKitDefinition[itemDefinitionKey];
						let itemDefinitionTemplate = itemDefinitionPerItem.itemDefinitionTemplate ?? itemDefinitionPerItem.item_definition_template;
						if (itemDefinitionTemplate) {
							let itemDefinition = await this._getDefindex(itemDefinitionTemplate);
							if ((itemDefinition?.itemDefinitionIndex ?? itemDefinition?.item_definition_index) == weaponDefIndex) {
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
								let itemDefinition = await this._getDefindex(it.itemDefinitionTemplate ?? it.item_definition_template);
								if (getLegacyPaintKit(itemDefinition?.itemDefinitionIndex ?? itemDefinition?.item_definition_index) == weaponDefIndex) {
									item = it;
									break;
								}
							}
						}
					}

					if (item) {
						let template = paintKitDefinition.operationTemplate ?? paintKitDefinition.operation_template;// || item.itemDefinitionTemplate;
						if (!template) {
							let itemDefinitionTemplate = await this._getDefindex(item.itemDefinitionTemplate ?? item.item_definition_template);
							if (itemDefinitionTemplate && itemDefinitionTemplate.definition && itemDefinitionTemplate.definition[wearLevel]) {
								template = itemDefinitionTemplate.definition[wearLevel].operationTemplate ?? itemDefinitionTemplate.definition[wearLevel].operation_template;
							}
						}
						if (template) {
							let operationTemplate = await this._getDefindex(template);
							//console.error(operationTemplate);//removeme
							if (operationTemplate && (operationTemplate.operationNode ?? operationTemplate.operation_node)) {
								await this.#setupVariables(paintKitDefinition, wearLevel, item);
								let stage = await this.#processOperationNode((operationTemplate.operationNode ?? operationTemplate.operation_node)[0]);//top level node has 1 operation
								//console.error(stage.toString());
								(stage as Stage).linkNodes();


								function GetSeed(seed: bigint) {
									let hilo: Array<bigint> = [];
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

								let hi, lo
								[hi, lo] = GetSeed(seed);
								let randomStreams = [new UniformRandomStream(Number(hi) << 0), new UniformRandomStream(Number(lo) << 0)];

								(stage as Stage).computeRandomValues({ currentIndex: 0 }, randomStreams, randomStreams.length);
								await (stage as Stage).setupTextures();
								let finalNode = (stage as Stage).node;
								finalNode.autoRedraw = true;
								let finalOutput = finalNode.getOutput('output')._value = outputTexture;

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
								await finalNode.redraw()
								TextureCombinerEventTarget.dispatchEvent(new CustomEvent<PaintDoneEvent>('paintdone', {
									detail: {
										paintKitDefId: paintKitDefId,
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
			} else {
				resolve(false);
			}
			/*if (!finalPromise) {
				resolve(false);
			}*/
		});
		return combinePaintPromise;
	}

	async #setupVariables(paintKitDefinition: any, wearLevel: number, item: any) {
		this.variables = {};

		if (item) {
			if (item.data) {
				this.#addVariables(item.data.variable);
			}
			if (item.itemDefinitionTemplate ?? item.item_definition_template) {
				let itemDefinition = await this._getDefindex(item.itemDefinitionTemplate ?? item.item_definition_template)
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

	#addVariables(variableArray: Array<any>) {
		if (variableArray) {
			for (let i = 0; i < variableArray.length; i++) {
				let v = variableArray[i];
				this.variables[v.variable] = v.string;
			}
		}
	}

	#addVariables2(variableArray: Array<any>) {
		if (variableArray) {
			for (let i = 0; i < variableArray.length; i++) {
				let v = variableArray[i];
				if ((v.inherit == false) || (this.variables[v.name] === undefined)) {
					this.variables[v.name] = v.value;
				}
			}
		}
	}

	async #processOperationNodeArray(operationNodeArray: Array<any>/*, parentStage: Stage*/) {
		let chidren: Array<Stage> = [];
		for (var i = 0; i < operationNodeArray.length; i++) {
			let child = await this.#processOperationNode(operationNodeArray[i]/*, parentStage*/);
			if (child instanceof Array) {
				chidren.push(...child);
			} else {
				if (child) {
					chidren.push(child);
				}
			}
		}
		return chidren;
	}


	#getStageName(stage: any) {
		switch (true) {
			case stage.textureLookup != undefined:
			case stage.texture_lookup != undefined:
				return 'textureLookup';
				break;
			case stage.combineAdd != undefined:
			case stage.combine_add != undefined:
				return 'combine_add';
				break;
			case stage.combineLerp != undefined:
			case stage.combine_lerp != undefined:
				return 'combine_lerp';
				break;
			case stage.combineMultiply != undefined:
			case stage.combine_multiply != undefined:
				return 'multiply';
				break;
			case stage.select != undefined:
				return 'select';
				break;
			case stage.applySticker != undefined:
			case stage.apply_sticker != undefined:
				return 'applySticker';
				break;
			default:
				throw 'Unsuported stage';
		}

	}

	async #processOperationNode(operationNode: any/*, parentStage: Stage/*, parentStage*//*, inputs*/): Promise<Stage | undefined | Array<Stage>> {
		let subStage = null;
		if (operationNode.stage) {
			let stage = operationNode.stage;
			let stage2 = null;
			let s;
			switch (true) {
				case stage.textureLookup != undefined:
				case stage.texture_lookup != undefined:
					s = stage.textureLookup ?? stage.texture_lookup;
					subStage = this.#processTextureStage(s);
					stage2 = s;
					break;
				case stage.combineAdd != undefined:
				case stage.combine_add != undefined:
				case stage.combineLerp != undefined:
				case stage.combine_lerp != undefined:
				case stage.combineMultiply != undefined:
				case stage.combine_multiply != undefined:
					s = stage.combineAdd || stage.combine_add || stage.combineLerp || stage.combine_lerp || stage.combineMultiply || stage.combine_multiply;
					subStage = this.#processCombineStage(s, this.#getStageName(stage));
					stage2 = s;
					break;
				case stage.select != undefined:
					s = stage.select;
					subStage = this.#processSelectStage(s);
					stage2 = s;
					break;
				case stage.applySticker != undefined:
				case stage.apply_sticker != undefined:
					s = stage.applySticker ?? stage.apply_sticker;
					subStage = this.#processApplyStickerStage(s);
					stage2 = s;
					break;
				default:
					throw 'Unsuported stage';
			}
			if (stage2.operationNode ?? stage2.operation_node) {
				let chidren = await this.#processOperationNodeArray(stage2.operationNode ?? stage2.operation_node/*, subStage/*, node*/);
				if (subStage) {
					subStage.appendChildren(chidren);
				}
			}

		} else if (operationNode.operationTemplate ?? operationNode.operation_template) {
			let template = await this._getDefindex(operationNode.operationTemplate ?? operationNode.operation_template);
			if (template && (template.operationNode ?? template.operation_node)) {
				//console.error('template.operationNode', template.operationNode.length, template.operationNode);
				let chidren = await this.#processOperationNodeArray(template.operationNode ?? template.operation_node/*, parentStage/*, node, inputs*/);
				return chidren;
			} else {
				throw 'Invalid template';
			}
		} else {
			throw 'Unsuported operationNode.operation_template';
		}
		/*
				if (false && subStage && node) {
					let input = inputs.next().value;
					console.error(input);
					node.setPredecessor(input, subNode, 'output');
				}*//* else {
console.error('node or subnode is null', node, subNode);
}*/
		return subStage;
	}

	#processCombineStage(stage: any, combineMode: string) {
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

	#processTextureStage(stage: any) {
		let node = null;

		var texture;
		if (this.#team == 0) {
			texture = (stage.textureRed ?? stage.texture_red) || stage.texture;
		} else {
			texture = (stage.textureBlue ?? stage.texture_blue) || stage.texture;
		}

		let texturePath = this.#getVarField(texture);
		texturePath = texturePath.replace(/\.tga$/, '');
		if (texturePath) {
			let imageSrc = texturePathPrefixRemoveMe + texturePath + this.imageExtension;
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
			textureStage.parameters.allowFlipU = this.#getVarField(stage.flipU ?? stage.flip_u) != 0;
		}
		if (stage.flipV ?? stage.flip_v) {
			textureStage.parameters.allowFlipV = this.#getVarField(stage.flipV ?? stage.flip_v) != 0
		}


		return textureStage;
	}

	#processSelectStage(stage: any) {
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
				(selectParametersNode as IntArrayNode).setValue(i, parseInt(level));
			}
		}

		selectNode.invalidate();
		return selectStage;
	}

	#processApplyStickerStage(stage: any) {
		let applyStickerNode = this.nodeImageEditor.addNode(this.textureApplyStickerNode);
		let applyStickerStage = new ApplyStickerStage(applyStickerNode);

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
		} else {
			throw 'No sticker defined';
		}
		applyStickerNode.invalidate();
		return applyStickerStage;
	}

	#getVarField(field: any) {
		if (!field) { return null; }
		if (field.variable) {
			let v = this.variables[field.variable];
			if (v) {
				return v;
			}
		}
		return field.string;
	}
}

function ParseRange(output: Range, input: string) {
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

function ParseVec2(output: vec2, input: string) {
	input = input.trim();
	let range = input.split(' ');

	if (range.length == 2) {
		output[0] = Number(range[0]);
		output[1] = Number(range[1]);
	}
}

function ParseInverseRange(output: Range, input: string) {
	ParseRange(output, input);
	if (output.low) {
		output.low = 1.0 / output.low;
	}
	if (output.high) {
		output.high = 1.0 / output.high;
	}
}

function ParseRangeThenDivideBy(output: Range, input: string, div = 255) {
	ParseRange(output, input);
	output.low /= div;
	output.high /= div;

}
