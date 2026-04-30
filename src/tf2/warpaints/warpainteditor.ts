import { NodeImageEditorGui } from 'harmony-3d';
import { TextureCombiner } from './texturecombiner';

export class WarpaintEditor {
	static #nodeImageEditorGui?: NodeImageEditorGui;

	static init(container: HTMLElement | ShadowRoot): void {
		container.append(this.#getGui().htmlElement);
		this.#getGui().setNodeImageEditor(TextureCombiner.nodeImageEditor);
	}

	static getGui(): NodeImageEditorGui {
		return this.#getGui();
	}

	static #getGui(): NodeImageEditorGui {
		if (!this.#nodeImageEditorGui) {
			this.#nodeImageEditorGui = new NodeImageEditorGui();
		}
		return this.#nodeImageEditorGui;
	}
}
