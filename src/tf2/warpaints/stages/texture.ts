import { DEG_TO_RAD } from 'harmony-3d';
import { Stage } from './stage';
import { UniformRandomStream } from '../uniformrandomstream';
import { Range } from './parameters';


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
	texturePath: string = '';
}

export class TextureStage extends Stage {
	texturePath: string = '';
	parameters = new TextureStageParameters();

	computeRandomValuesThis(randomStream: UniformRandomStream): boolean {
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
