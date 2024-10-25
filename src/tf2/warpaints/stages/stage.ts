import { ApplySticker, Graphics, Node, Source1TextureManager, Texture, TextureLookup, TextureManager } from 'harmony-3d';
import { UniformRandomStream } from '../uniformrandomstream';

let blackTexture: Texture;

Graphics.ready.then(() => {
	blackTexture = TextureManager.createFlatTexture([0, 0, 0])
	blackTexture.addUser(1);
});

export class Stage {
	static #textures = new Map();
	texturePath: string = '';
	specularTexturePath: string = '';
	node: Node;
	#firstChild?: Stage;
	#nextSibling?: Stage;
	constructor(node: Node) {
		this.node = node;
	}

	computeRandomValues(currentIndexObject: { currentIndex: number }, pRNGs: Array<UniformRandomStream>, nRNGCount: number) {
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

	computeRandomValuesThis(s: UniformRandomStream): boolean {
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

	appendChildren(children: Array<Stage>) {
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

	toString(tabs = ''): string {
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
			(this.node as ApplySticker | TextureLookup).inputTexture = await Stage.getTexture(texturePath);
			this.node.setParam('path', texturePath);
			this.node.invalidate();
		}
		let specularTexturePath = this.specularTexturePath;
		if (specularTexturePath) {
			try {
				this.node.getInput('specular').value = await Stage.getSpecularTexture(texturePath);
			} catch (e) {
				console.log(e);
			}
		}
	}

	async setupTextures() {
		const promises = new Set()
		promises.add(this._setupTextures());
		let childStage = this.firstChild;
		while (childStage) {
			promises.add(childStage.setupTextures());
			childStage = childStage.nextSibling;
		}

		await Promise.all(promises);
	}

	static async getTexture(texturePath: string, def?: Texture) {
		if (!Stage.#textures.has(texturePath)) {
			const promise = Source1TextureManager.getTextureAsync('tf2', texturePath, 0, false, def, false);
			promise.then(texture => {
				if (texture) {
					texture.addUser(this);
				} else {
					Stage.#textures.delete(texturePath);
				}
			});
			Stage.#textures.set(texturePath, promise);
		}
		return await Stage.#textures.get(texturePath);
	}

	static async getSpecularTexture(specularTexturePath: string) {
		return this.getTexture(specularTexturePath, blackTexture);
	}
}
