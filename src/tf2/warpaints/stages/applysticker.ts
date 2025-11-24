import { vec2 } from 'gl-matrix';
import { UniformRandomStream } from 'harmony-tf2-utils';
import { Range } from './parameters';
import { Stage } from './stage';

class ApplyStickerStageParameters {
	possibleStickers: Sticker[] = [];
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

	override computeRandomValuesThis(randomStream: UniformRandomStream): boolean {
		const parameters = this.parameters;

		const computeWeight = (accumulator: number, currentValue: Sticker): number => accumulator + currentValue.weight;
		const totalWeight = parameters.possibleStickers.reduce(computeWeight, 0);
		//console.error(totalWeight);

		let weight = randomStream.randomFloat(0.0, totalWeight);
		for (const [i, possibleSticker] of parameters.possibleStickers.entries()) {
			const thisWeight = possibleSticker.weight;
			if (weight < thisWeight) {
				this.choice = i;
				this.texturePath = parameters.possibleStickers[i]!.fileName;
				this.specularTexturePath = parameters.possibleStickers[i]!.fileName.replace(/\.vtf$/, '') + '_s';
				break;
			} else {
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
