import { Source1ModelInstance, Source1TextureManager } from 'harmony-3d';
import { WarpaintDefinitions } from 'harmony-tf2-utils';
import { StaticEventTarget } from 'harmony-utils';
import { TextureCombiner } from './texturecombiner';

const definitionsPerType = {
	6: { s: 'CMsgVariableDefinition', d: null },
	7: { s: 'CMsgPaintKit_Operation', d: null },
	8: { s: 'CMsgPaintKit_ItemDefinition', d: null },
	9: { s: 'CMsgPaintKit_Definition', d: null },
	10: { s: 'CMsgHeaderOnly', d: null },
};

export interface WeaponManagerItem {
	id: string;
	warpaintId: number;
	warpaintWear: number;
	warpaintSeed: bigint;
	model: Source1ModelInstance | null;
	userData?: any;
	team: number;
	textureSize?: number;
}

export enum WeaponManagerEvents {
	AddWarpaint = 'addwarpaint',
	Started = 'started',
	Success = 'success',
	Failure = 'failure',
}

export type AddWarpaintEvent = {
	p1: number,
	p2: number,
	p3: string,
	p4: string,
}

export class WeaponManager extends StaticEventTarget {
	static #htmlWeaponsDiv?: HTMLElement;
	static #htmlPaintsDiv?: HTMLElement;
	static weapons = {};
	static collections = {};
	static weaponName = '';
	static warpaintName = '';
	static asyncRequestId = 0;
	static #protoElements: any = {};
	static protoDefs = null;
	static shouldRequestItems = true;
	static itemsDef = null;
	static itemsReady = false;
	static containerPerWeapon: any = {};
	static #itemQueue: Array<WeaponManagerItem> = [];
	static currentItem?: WeaponManagerItem;
	static weaponId = 0;

	static async initWarpaintDefinitions(url: string) {
		let response = await fetch(url);
		this.protoDefs = await response.json();
		await this.refreshWarpaintDefinitions();
	}

	static async refreshWarpaintDefinitions() {
		let definitions = await WarpaintDefinitions.getWarpaintDefinitions();
		if (definitions) {
			this.#protoElements = definitions;
			let warpaintDefinitions = definitions[9];
			for (let warpaintDefId in warpaintDefinitions) {
				let definition = warpaintDefinitions[warpaintDefId];
				let token = this.protoDefs ? this.protoDefs[(definition.locDesctoken ?? definition.loc_desctoken)] || (definition.locDesctoken ?? definition.loc_desctoken) : (definition.locDesctoken ?? definition.loc_desctoken);

				this.#addWarpaint(definition, token);
			}
		}
	}

	static initView(container?: HTMLElement) {
		this.#htmlWeaponsDiv = document.createElement('div');
		this.#htmlWeaponsDiv.className = 'weaponsDiv';
		this.#htmlPaintsDiv = document.createElement('div');
		this.#htmlPaintsDiv.className = 'paintsDiv';

		if (container) {
			container.appendChild(this.#htmlWeaponsDiv);
			container.appendChild(this.#htmlPaintsDiv);
		}
	}

	static #addWarpaint(warpaint: any, descToken: string) {
		let cMsgWarpaintDefinition = this.#protoElements[9][warpaint.header.defindex];
		let warpaintItemDefinitions = this.#protoElements[8];
		if (cMsgWarpaintDefinition) {
			let itemList = this.getItemList(cMsgWarpaintDefinition);
			for (let weaponName in itemList) {
				let itemDefinition = warpaintItemDefinitions[itemList[weaponName]];
				if (itemDefinition) {
					this.#addWeapon(warpaint, warpaint.header.defindex, weaponName, itemList[weaponName], itemDefinition.itemDefinitionIndex ?? itemDefinition.item_definition_index, descToken);
				}
			}
		}
		return;
	}

	static #addWeapon(warpaint: any, weaponPaint: number, weapon: string, defindex: number, itemDefinitionIndex: number, descToken: string) {
		//let wep = this.itemsDef?.[itemDefinitionIndex] || this.itemsDef?.[itemDefinitionIndex + '~0'] ;
		let wep = { name: weapon };
		if (wep) {
			var weaponDiv = this.containerPerWeapon[wep.name];
			if (!weaponDiv) {
				weaponDiv = document.createElement('div');
				weaponDiv.className = 'weaponDiv';
				this.#htmlPaintsDiv?.appendChild(weaponDiv);
				this.containerPerWeapon[wep.name] = weaponDiv;
				//weaponDiv.innerHTML = wep.name;

				let input = document.createElement('input');
				input.className = 'displayNone';
				input.id = 'weapon-' + this.weaponId;
				input.name = 'accordion';
				input.type = 'radio';

				let label = document.createElement('label');
				label.htmlFor = 'weapon-' + this.weaponId;
				label.innerText = wep.name;

				let subContainer = document.createElement('div');
				subContainer.className = 'paintsDiv';
				weaponDiv.subContainer = subContainer;
				weaponDiv.appendChild(input);
				weaponDiv.appendChild(label);
				weaponDiv.appendChild(subContainer);
				++this.weaponId;
			}
			let subContainer = weaponDiv.subContainer;

			//weaponDiv.weaponPaint = weaponPaint;
			weaponDiv.weapon = weapon;
			weaponDiv.itemDefinitionIndex = itemDefinitionIndex;
			this.#htmlWeaponsDiv?.appendChild(weaponDiv);
			this.dispatchEvent(new CustomEvent<AddWarpaintEvent>(WeaponManagerEvents.AddWarpaint, {
				detail: {
					p1: itemDefinitionIndex,
					p2: weaponPaint,
					p3: weapon,
					p4: descToken
				}
			}));
		} else {
			//throw 'Weapon not found ' + itemDefinitionIndex;
		}
	}

	static getItemList(cMsgWarpaintDefinition: any) {//TODOv3: rename parameter
		let itemList: any = {};
		for (let propertyName in cMsgWarpaintDefinition) {
			let warpaintDefinitionItem = cMsgWarpaintDefinition[propertyName];
			if (warpaintDefinitionItem) {
				if (propertyName == 'item') {
					for (let i = 0; i < warpaintDefinitionItem.length; i++) {
						let warpaintDefinitionItem2 = warpaintDefinitionItem[i];
						if (warpaintDefinitionItem2.itemDefinitionTemplate ?? warpaintDefinitionItem2.item_definition_template) {
							itemList['item' + i] = (warpaintDefinitionItem2.itemDefinitionTemplate ?? warpaintDefinitionItem2.item_definition_template).defindex;
						}
					}
				} else {
					if (warpaintDefinitionItem.itemDefinitionTemplate ?? warpaintDefinitionItem.item_definition_template) {
						itemList[propertyName] = (warpaintDefinitionItem.itemDefinitionTemplate ?? warpaintDefinitionItem.item_definition_template).defindex;
					}
				}
			}
		}
		return itemList;
	}

	static refreshWarpaint(item: WeaponManagerItem, clearQueue = false) {
		const textureName = `#warpaint_${item.id.replace(/\~\d+/, '')}_${item.warpaintId}_${item.warpaintWear}_${item.warpaintSeed}`;
		console.info(textureName);
		if (clearQueue) {
			this.#itemQueue = [];
		}
		this.#itemQueue.push(item);
		this.#processNextItemInQueue();
	}

	static #processNextItemInQueue(): void {
		const mc = new MessageChannel();
		mc.port1.onmessage = () => this.#processNextItemInQueue2();
		mc.port2.postMessage(null);
	}

	static async #processNextItemInQueue2(): Promise<void> {
		if (!this.currentItem && this.#itemQueue.length) {
			this.currentItem = this.#itemQueue.shift();
			let ci = this.currentItem!;

			const textureName = `#warpaint_${ci.id.replace(/\~\d+/, '')}_${ci.warpaintId}_${ci.warpaintWear}_${ci.warpaintSeed}`;

			const existingTexture = await Source1TextureManager.getTextureAsync(ci.model?.sourceModel.repository, textureName, 0, false);
			if (existingTexture) {
				ci.model?.setMaterialParam('WeaponSkin', textureName);
				this.currentItem = undefined;
				this.#processNextItemInQueue();
				return;
			}

			let { /*name: textureName,*/ texture } = Source1TextureManager.addInternalTexture(ci.model?.sourceModel.repository ?? '', textureName);
			texture.setAlphaBits(8);
			if (ci.warpaintId !== undefined) {
				this.dispatchEvent(new CustomEvent<WeaponManagerItem>(WeaponManagerEvents.Started, { detail: ci }));
				let promise = TextureCombiner.combinePaint(ci.warpaintId, ci.warpaintWear, ci.id.replace(/\~\d+/, ''), textureName, texture.getFrame(0)!, ci.team, ci.warpaintSeed, ci.textureSize);
				ci.model?.setMaterialParam('WeaponSkin', textureName);
				//this._textureCombiner.nodeImageEditor.setOutputTextureName(textureName);
				promise.then((e) => {
					this.dispatchEvent(new CustomEvent<WeaponManagerItem>(WeaponManagerEvents.Success, { detail: ci }));
					this.currentItem = undefined;
					this.#processNextItemInQueue();

				});
				promise.catch((e) => {
					this.dispatchEvent(new CustomEvent<WeaponManagerItem>(WeaponManagerEvents.Failure, { detail: ci }));
					console.error('Promise processNextItemInQueue KO');
					this.currentItem = undefined;
					this.#processNextItemInQueue();
				});
			} else {
				this.currentItem = undefined;
				this.#processNextItemInQueue();
			}
		}
	}
}

/*
const collections = {
'concealedkiller':'Concealed Killer Collection',
'craftsmann':'Craftsmann Collection',
'teufort':'Teufort Collection',
'powerhouse':'Powerhouse Collection',
'harvest':'Harvest',
'pyroland':'Pyroland',
'gentlemanne':'Gentlemanne',
'warbird':'Warbird',
'weaponcase':'Weapon cases',
}*/
/*
const wearLevel = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle Scarred'];

WeaponManager.weapons = {
flamethrower : 7,
grenadelauncher : 8,
knife : 9,
medigun : 10,
minigun : 11,
pistol : 12,
revolver : 13,
rocketlauncher : 14,
scattergun : 15,
shotgun : 16,
smg : 17,
sniperrifle : 18,
stickybomb_launcher : 19,
ubersaw : 20,
wrench : 21,
amputator : 22,
atom_launcher : 23,
back_scratcher : 24,
battleaxe : 25,
bazaar_sniper : 26,
blackbox : 27,
claidheamohmor : 28,
crusaders_crossbow : 29,
degreaser : 30,
demo_cannon : 31,
demo_sultan_sword : 32,
detonator : 33,
gatling_gun : 34,
holymackerel : 35,
jag : 36,
lochnload : 37,
powerjack : 38,
quadball : 39,
reserve_shooter : 40,
riding_crop : 41,
russian_riot : 42,
scimitar : 43,
scorch_shot : 44,
shortstop : 45,
soda_popper : 46,
tele_shotgun : 47,
tomislav : 48,
trenchgun : 49,
winger_pistol : 50
}
*/
