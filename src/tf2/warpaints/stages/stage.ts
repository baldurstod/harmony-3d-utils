import { ApplySticker, Color, Graphics, Node, Source1TextureManager, Texture, TextureLookup, TextureManager } from 'harmony-3d';
import { UniformRandomStream } from 'harmony-tf2-utils';

let blackTexture: Texture;

export class Stage {
	static #textures = new Map<string, Promise<Texture | null>>();
	texturePath = '';
	specularTexturePath = '';
	node: Node;
	#firstChild: Stage | null = null;
	#nextSibling: Stage | null = null;

	constructor(node: Node) {
		this.node = node;
		if (!blackTexture) {
			Graphics.ready.then(() => {
				blackTexture = TextureManager.createFlatTexture({
					webgpuDescriptor: {
						size: {
							width: 1,
							height: 1,
						},
						format: 'rgba8unorm',
						usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
					},
					color: new Color(0, 0, 0)
				})
				blackTexture.addUser(1);
			});
		}
	}

	computeRandomValues(currentIndexObject: { currentIndex: number }, pRNGs: UniformRandomStream[], nRNGCount: number): void {
		if (this.computeRandomValuesThis(pRNGs[currentIndexObject.currentIndex]!)) {
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
		throw new Error('subclass me' + s.seed);
	}

	set firstChild(stage: Stage | null) {
		this.#firstChild = stage;
	}

	get firstChild(): Stage | null {
		return this.#firstChild;
	}

	set nextSibling(stage: Stage | null) {
		this.#nextSibling = stage;
	}

	get nextSibling(): Stage | null {
		return this.#nextSibling;
	}

	appendChildren(children: Stage[]): void {
		for (let i = children.length - 1; i >= 0; --i) {
			const childStage = children[i]!;
			//console.error(childStage);
			childStage.nextSibling = this.firstChild;
			this.firstChild = childStage;
		}
	}

	get displayName(): string {
		return this.constructor.name;
	}

	toString(tabs = ''): string {
		const ret = [];
		const tabs1 = tabs + '\t';
		ret.push(tabs + this.displayName);
		if (this.#firstChild) {
			ret.push(this.#firstChild.toString(tabs1));
		}
		if (this.#nextSibling) {
			ret.push(this.#nextSibling.toString(tabs));
		}

		return ret.join('\n');
	}

	linkNodes(): void {
		const node = this.node;
		const inputs = node.inputs.keys();

		let childStage = this.firstChild;
		while (childStage) {
			childStage.linkNodes();
			const input = inputs.next().value;
			const subNode = childStage.node;
			if (input) {
				node.setPredecessor(input, subNode, 'output');
			}
			childStage = childStage.nextSibling;
		}
	}

	async _setupTextures(): Promise<void> {
		const texturePath = this.texturePath;
		if (texturePath) {
			(this.node as ApplySticker | TextureLookup).inputTexture = await Stage.getTexture(texturePath);
			this.node.setParam('path', texturePath);
			this.node.invalidate();
		}
		const specularTexturePath = this.specularTexturePath;
		if (specularTexturePath) {
			try {
				const specular = this.node.getInput('specular');
				if (specular) {
					specular.value = await Stage.getSpecularTexture(texturePath);
				}
			} catch (e) {
				console.log(e);
			}
		}
	}

	async setupTextures(): Promise<void> {
		const promises = new Set()
		promises.add(this._setupTextures());
		let childStage = this.firstChild;
		while (childStage) {
			promises.add(childStage.setupTextures());
			childStage = childStage.nextSibling;
		}

		await Promise.all(promises);
	}

	static async getTexture(texturePath: string, def?: Texture): Promise<Texture | null> {
		if (!Stage.#textures.has(texturePath)) {
			const promise = Source1TextureManager.getInternalTexture('tf2', texturePath, 0, false, def, false);
			promise.then(texture => {
				if (texture) {
					texture.addUser(this);
				} else {
					Stage.#textures.delete(texturePath);
				}
			});
			Stage.#textures.set(texturePath, promise);
		}
		return await Stage.#textures.get(texturePath) ?? null;
	}

	static getSpecularTexture(specularTexturePath: string): Promise<Texture | null> {
		return this.getTexture(specularTexturePath, blackTexture);
	}
}
