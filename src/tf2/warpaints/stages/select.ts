import { Node, NodeImageEditor, TextureLookup } from 'harmony-3d';
import { Stage } from './stage';
import { UniformRandomStream } from '../uniformrandomstream';

export const TEXTURE_LOOKUP_NODE = 'texture lookup';

class SelectStageParameters { }

export class SelectStage extends Stage {
	nodeImageEditor: NodeImageEditor;
	parameters = new SelectStageParameters();
	constructor(node: Node, nodeImageEditor: NodeImageEditor) {
		super(node);
		this.nodeImageEditor = nodeImageEditor;
	}

	computeRandomValuesThis(randomStream: UniformRandomStream): boolean {
		return false;
	}

	async _setupTextures() {
		let texturePath = this.texturePath;
		if (texturePath) {
			let lookupNode = (this.nodeImageEditor.addNode(TEXTURE_LOOKUP_NODE) as TextureLookup);
			this.node.setPredecessor('input', lookupNode, 'output');
			lookupNode.inputTexture = await Stage.getTexture(texturePath);
			(lookupNode as any).texturePath = texturePath;
			lookupNode.invalidate();
		}
	}
}
