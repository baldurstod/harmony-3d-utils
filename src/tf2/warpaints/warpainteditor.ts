import { NodeImageEditorGui } from 'harmony-3d';
import { TextureCombiner } from './texturecombiner';

export class WarpaintEditor {
	static #instance: WarpaintEditor;
	#nodeImageEditorGui: NodeImageEditorGui = new NodeImageEditorGui();
	constructor() {
		if (WarpaintEditor.#instance) {
			return WarpaintEditor.#instance;
		}
		WarpaintEditor.#instance = this;
	}

	init(container: HTMLElement) {
		container.append(this.#nodeImageEditorGui.htmlElement);
		if (!this.#nodeImageEditorGui) {
			this.#nodeImageEditorGui = new NodeImageEditorGui(TextureCombiner.nodeImageEditor);
		}
	}
}
