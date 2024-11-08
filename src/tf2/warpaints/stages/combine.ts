import { Node } from 'harmony-3d';
import { Range } from './parameters';
import { Stage } from './stage';
import { UniformRandomStream } from 'harmony-tf2-utils';

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

	computeRandomValuesThis(randomStream: UniformRandomStream) {
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
