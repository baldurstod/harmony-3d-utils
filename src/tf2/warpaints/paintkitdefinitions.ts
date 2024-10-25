const TYPE_STRING_TO_INT: any = {
	'DEF_TYPE_PAINTKIT_VARIABLES': 6,
	'DEF_TYPE_PAINTKIT_OPERATION': 7,
	'DEF_TYPE_PAINTKIT_ITEM_DEFINITION': 8,
	'DEF_TYPE_PAINTKIT_DEFINITION': 9,
	'DEF_TYPE_HEADER_ONLY': 10,
}

export interface ProtoDefID {
	type: number;
	defindex: number;
}

export class PaintKitDefinitions {
	static warpaintDefinitionsPromise: Promise<any>;
	static warpaintDefinitions: any;
	static #warpaintDefinitionsURL: string = '';

	static setWarpaintDefinitionsURL(url: string) {
		this.#warpaintDefinitionsURL = url;
	}

	static getWarpaintDefinitions(): Promise<any> {
		if (!this.warpaintDefinitionsPromise) {
			this.warpaintDefinitionsPromise = new Promise(async (resolve, reject) => {
				let reponse = await fetch(this.#warpaintDefinitionsURL);
				this.warpaintDefinitions = await reponse.json();
				resolve(this.warpaintDefinitions);
			});
		}
		return this.warpaintDefinitionsPromise;
	}

	static setWarpaintDefinitions(warpaintDefinitions: any) {
		this.warpaintDefinitionsPromise = new Promise(async resolve => {
			resolve(warpaintDefinitions);
		});
	}

	static async getDefinition(cMsgProtoDefID: any): Promise<any> {
		let warpaintDefinitions = await this.getWarpaintDefinitions();
		if (warpaintDefinitions) {
			let type = warpaintDefinitions[String(TYPE_STRING_TO_INT[String(cMsgProtoDefID.type)] ?? cMsgProtoDefID.type)];
			if (type) {
				return type[String(cMsgProtoDefID.defindex)];
			}
		}
		return null;
	}
}
