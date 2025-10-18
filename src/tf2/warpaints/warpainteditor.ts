import { NodeImageEditorGui } from 'harmony-3d';
import { TextureCombiner } from './texturecombiner';

export class WarpaintEditor {
	static #nodeImageEditorGui: NodeImageEditorGui = new NodeImageEditorGui();

	static init(container: HTMLElement | ShadowRoot) {
		container.append(this.#nodeImageEditorGui.htmlElement);
		this.#nodeImageEditorGui.setNodeImageEditor(TextureCombiner.nodeImageEditor);
	}

	static getGui(): NodeImageEditorGui {
		return this.#nodeImageEditorGui;
	}
}
