import { Node, NodeEventType, NodeImageEditor, NodeParamChangedEvent, NodeParamOrigin, TextureLookup } from 'harmony-3d';
import { Stage } from './stage';

export const TEXTURE_LOOKUP_NODE = 'texture lookup';

class SelectStageParameters { }

export class SelectStage extends Stage {
	nodeImageEditor: NodeImageEditor;
	parameters = new SelectStageParameters();
	#textureSize: number;

	constructor(node: Node, nodeImageEditor: NodeImageEditor, textureSize: number) {
		super(node);
		this.nodeImageEditor = nodeImageEditor;
		this.#textureSize = textureSize;
	}

	override computeRandomValuesThis(): boolean {
		return false;
	}

	override async _setupTextures(): Promise<void> {
		const texturePath = this.texturePath;
		if (texturePath) {
			const lookupNode = this.nodeImageEditor.addNode(TEXTURE_LOOKUP_NODE, { textureSize: this.#textureSize }) as TextureLookup;
			this.node.setPredecessor('input', lookupNode, 'output');
			const texture = await Stage.getTexture(texturePath);
			if (texture) {
				lookupNode.inputTexture = texture;
			}
			//(lookupNode as any).texturePath = texturePath;
			lookupNode.invalidate();

			lookupNode.addEventListener(NodeEventType.ParamChanged, (event) => {
				(async () => {
					const detail = (event as CustomEvent<NodeParamChangedEvent>).detail;
					if (detail.paramName === 'path' && detail.origin === NodeParamOrigin.Gui) {
						const texture = await Stage.getTexture(detail.newValue as string);
						if (texture) {
							lookupNode.inputTexture = texture;
							lookupNode.revalidate({ updatePreview: true });
						}
					}
				})()
			});

		}
	}
}
