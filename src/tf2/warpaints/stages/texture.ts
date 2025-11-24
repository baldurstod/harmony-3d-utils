import { DEG_TO_RAD } from 'harmony-3d';
import { Stage } from './stage';
import { Range } from './parameters';
import { UniformRandomStream } from 'harmony-tf2-utils';


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

export class TextureStage extends Stage {
	texturePath = '';
	parameters = new TextureStageParameters();

	computeRandomValuesThis(randomStream: UniformRandomStream): boolean {
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
