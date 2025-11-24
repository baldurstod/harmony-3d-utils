import { Node } from 'harmony-3d';
import { UniformRandomStream } from 'harmony-tf2-utils';
import { Range } from './parameters';
import { Stage } from './stage';

class CombineStageParameters {
	adjustBlack = new Range();
	adjustOffset = new Range(1, 1);
	adjustGamma = new Range(1, 1);
}

export class CombineStage extends Stage {
	combineMode: string;
	parameters = new CombineStageParameters();
	constructor(node: Node, combineMode: string) {
		super(node);
		this.combineMode = combineMode;
	}

	override computeRandomValuesThis(randomStream: UniformRandomStream): boolean {
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

	get displayName(): string {
		return this.combineMode;
	}
}
