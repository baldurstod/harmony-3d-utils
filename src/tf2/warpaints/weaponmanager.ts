import { Source1TextureManager } from 'harmony-3d';
import { PaintKitDefinitions } from './paintkitdefinitions';
import { TextureCombiner } from './texturecombiner';

export const WeaponManagerEventTarget = new EventTarget();

const definitionsPerType = {
	6: { s: 'CMsgVariableDefinition', d: null },
	7: { s: 'CMsgPaintKit_Operation', d: null },
	8: { s: 'CMsgPaintKit_ItemDefinition', d: null },
	9: { s: 'CMsgPaintKit_Definition', d: null },
	10: { s: 'CMsgHeaderOnly', d: null },
};

export class WeaponManager {
	static #htmlWeaponsDiv: HTMLElement;
	static #htmlPaintsDiv: HTMLElement;

	static weapons = {};
	static collections = {};

	static weaponName = '';
	static paintkitName = '';
	static asyncRequestId = 0;
	static _protoElements: any = {};
	static protoDefs = null;
	static shouldRequestItems = true;
	static itemsDef = null;

	static itemsReady = false;

	static containerPerWeapon: any = {};
	static itemQueue: Array<any> = [];
	static currentItem: any;
	static weaponId = 0;

	static async initPaintKitDefinitions(url: string) {
		let response = await fetch(url);
		this.protoDefs = await response.json();

		let definitions = await PaintKitDefinitions.getWarpaintDefinitions();
		if (definitions) {
			this._protoElements = definitions;
			let paintKitDefinitions = definitions[9];
			for (let paintKitDefId in paintKitDefinitions) {
				let definition = paintKitDefinitions[paintKitDefId];
				let token = this.protoDefs ? this.protoDefs[definition.locDesctoken] || definition.locDesctoken : definition.locDesctoken;

				this.#addPaintKit(definition, token);
			}
		}
	}

	static initView(container?: HTMLElement, editorContainer?: HTMLElement) {
		this.#htmlWeaponsDiv = document.createElement('div');
		this.#htmlWeaponsDiv.className = 'weaponsDiv';
		this.#htmlPaintsDiv = document.createElement('div');
		this.#htmlPaintsDiv.className = 'paintsDiv';

		if (container) {
			container.appendChild(this.#htmlWeaponsDiv);
			container.appendChild(this.#htmlPaintsDiv);
		}

		if (editorContainer) {
			editorContainer.append(TextureCombiner.nodeImageEditorGui.htmlElement);
		}
	}

	static #addPaintKit(paintKit: any, descToken: string) {
		let cMsgPaintKit_Definition = this._protoElements[9][paintKit.header.defindex];
		let paintKitItemDefinitions = this._protoElements[8];
		if (cMsgPaintKit_Definition) {
			let itemList = this.getItemList(cMsgPaintKit_Definition);
			for (let weaponName in itemList) {
				let itemDefinition = paintKitItemDefinitions[itemList[weaponName]];
				if (itemDefinition) {
					this._addWeapon(paintKit, paintKit.header.defindex, weaponName, itemList[weaponName], itemDefinition.itemDefinitionIndex, descToken);
				}
			}
		}
		return;
	}

	static _addWeapon(paintKit: any, weaponPaint: number, weapon: string, defindex: number, itemDefinitionIndex: number, descToken: string) {
		//let wep = this.itemsDef?.[itemDefinitionIndex] || this.itemsDef?.[itemDefinitionIndex + '~0'] ;
		let wep = { name: weapon };
		if (wep) {
			var weaponDiv = this.containerPerWeapon[wep.name];
			if (!weaponDiv) {
				weaponDiv = document.createElement('div');
				weaponDiv.className = 'weaponDiv';
				this.#htmlPaintsDiv.appendChild(weaponDiv);
				this.containerPerWeapon[wep.name] = weaponDiv;
				//weaponDiv.innerHTML = wep.name;

				let input = document.createElement('input');
				input.className = 'displayNone';
				input.id = 'weapon-' + this.weaponId;
				input.name = 'accordion';
				input.type = 'radio';

				let label = document.createElement('label');
				label.htmlFor = 'weapon-' + this.weaponId;
				label.innerHTML = wep.name;

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
			this.#htmlWeaponsDiv.appendChild(weaponDiv);
			//this.#addPaintKit2(paintKit, subContainer, weapon, itemDefinitionIndex);
			WeaponManagerEventTarget.dispatchEvent(new CustomEvent('addpaintkit', {
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
	/*
		static #addPaintKit2(paintKit, parent, weapon, itemDefinitionIndex) {
			var paintKitDiv = document.createElement('div');
			parent.appendChild(paintKitDiv);
			paintKitDiv.className = 'paintDiv';
			//paintKitDiv.weaponPaint = paintKit.header.defindex;
			paintKitDiv.setAttribute('data-weapon-paint', paintKit.header.defindex);
			paintKitDiv.innerText = paintKit.header.name;
			//paintKitDiv.itemDefinitionIndex = itemDefinitionIndex;
			paintKitDiv.setAttribute('data-item-definition-index', itemDefinitionIndex);
			//paintKitDiv.weapon = weapon;
			paintKitDiv.setAttribute('data-weapon', weapon);
			/*paintKitDiv.modelplayer = paintKit.modelplayer;
			paintKitDiv.weaponName = paintKit.name;* /
			paintKitDiv.addEventListener('click', (event) => handlePaintClick());

		}
		/*
	/*
		static handlePaintClick() {
			let currentModel = '';
			if (this.itemDefinitionIndex) {
				let itemDef = this.itemsDef[this.itemDefinitionIndex] || this.itemsDef[this.itemDefinitionIndex + '~0'];
				if (itemDef && itemDef.model_player) {
					currentModel = itemDef.model_player;
				}
			}
			weaponName = this.weaponName;
			this.paintkitName = this.innerHTML;
			setupModels();
			weaponPaint = this.weaponPaint;
			weapon = this.weapon;
			this.refreshPaint();
		}*/
	/*
		static handleWeaponClick() {
			currentModel = '';
			if (this.itemDefinitionIndex) {
				let itemDef = this.itemsDef[this.itemDefinitionIndex] || this.itemsDef[this.itemDefinitionIndex + '~0'];
				if (itemDef && itemDef.model_player) {
					currentModel = itemDef.model_player;
				}
			}
			weaponName = this.weaponName;
			this.paintkitName = this.innerHTML;
			setupModels();
			weaponPaint = this.weaponPaint;
			weapon = this.weapon;
			this.refreshPaint();
		}
	*/
	static getItemList(cMsgPaintKit_Definition: any) {//TODOv3: rename parameter
		let itemList: any = {};
		for (let propertyName in cMsgPaintKit_Definition) {
			let paintKitDefinitionItem = cMsgPaintKit_Definition[propertyName];
			if (paintKitDefinitionItem) {
				if (propertyName == 'item') {
					for (let i = 0; i < paintKitDefinitionItem.length; i++) {
						let paintKitDefinitionItem2 = paintKitDefinitionItem[i];
						if (paintKitDefinitionItem2.itemDefinitionTemplate) {
							//itemList.push(paintKitDefinitionItem2.itemDefinitionTemplate.defindex);
							itemList['item' + i] = paintKitDefinitionItem2.itemDefinitionTemplate.defindex;
						}
					}
				} else {
					if (paintKitDefinitionItem.itemDefinitionTemplate) {
						//itemList.push(paintKitDefinitionItem.itemDefinitionTemplate.defindex);
						itemList[propertyName] = paintKitDefinitionItem.itemDefinitionTemplate.defindex;
					}
				}
			}
		}
		return itemList;
	}

	static refreshPaint(item: any) {
		this.refreshItem(item);
	}
	/*
		static handleCollectionClick(event) {
			if (this.collectionBody.style.display == 'none') {
				this.collectionBody.style.display = null;
				this.collectionBody.style.display = '';
			} else {
				this.collectionBody.style.display = 'none';
			}
		}*/
	/*
		static setWeapon(weapon) {
			this.weapon = weapon;
			this.refreshPaint();
		}*/

	static refreshItem(item: any) {
		this.itemQueue.push(item);
		this.processNextItemInQueue();
	}

	static processNextItemInQueue() {
		if (!this.currentItem && this.itemQueue.length) {
			this.currentItem = this.itemQueue.shift();
			let ci = this.currentItem;

			let { name: textureName, texture } = Source1TextureManager.addInternalTexture();
			texture.setAlphaBits(8);
			if (ci.paintKitId !== null) {
				let promise = TextureCombiner.combinePaint(ci.paintKitId, ci.paintKitWear, ci.id.replace(/\~\d+/, ''), textureName, texture, ci.paintKitSeed);
				ci.sourceModel.materialsParams['WeaponSkin'] = textureName;
				//this._textureCombiner.nodeImageEditor.setOutputTextureName(textureName);
				promise.then((e) => {
					//console.error('Promise processNextItemInQueue OK');
					this.currentItem = null; this.processNextItemInQueue();

				});
				promise.catch((e) => {
					console.error('Promise processNextItemInQueue KO');
					this.currentItem = null; this.processNextItemInQueue();
				});
			} else {
				this.currentItem = null;
				this.processNextItemInQueue();
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