import { vec2 } from 'gl-matrix';
import { Stage } from './stage';
import { UniformRandomStream } from '../uniformrandomstream';
import { Range } from './parameters';

class ApplyStickerStageParameters {
	possibleStickers: Array<Sticker> = [];
	adjustBlack = new Range();
	adjustOffset = new Range(1, 1);
	adjustGamma = new Range(1, 1);
	bl = vec2.create();
	tl = vec2.create();
	tr = vec2.create();
}

export class Sticker {
	fileName = '';
	weight = 1.0;
}

export class ApplyStickerStage extends Stage {
	parameters = new ApplyStickerStageParameters();
	choice?: number;

	computeRandomValuesThis(randomStream: UniformRandomStream) {
		let parameters = this.parameters;

		const computeWeight = (accumulator: number, currentValue: Sticker) => accumulator + currentValue.weight;
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
			} else {
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
