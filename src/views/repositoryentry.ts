import { RepositoryEntry } from 'harmony-3d';
import { createElement, hide, I18n, shadowRootStyle, show } from 'harmony-ui';
import repositoryEntryCSS from '../css/repositoryentry.css';

export class HTMLRepositoryEntryElement extends HTMLElement {
	#shadowRoot: ShadowRoot;
	#repositoryEntry?: RepositoryEntry;
	#htmlSelf: HTMLElement;
	#htmlChilds: HTMLElement;
	#expanded = false;

	constructor() {
		super();
		this.#shadowRoot = this.attachShadow({ mode: 'closed' });
		shadowRootStyle(this.#shadowRoot, repositoryEntryCSS);

		createElement('div', {
			class: 'header',
			parent: this.#shadowRoot,
			childs: [
				this.#htmlSelf = createElement('div', {
					class: 'self',
					events: {
						click: () => this.#click(),
					},
				}),
				createElement('slot', {
					class: 'custom',
					name: 'custom',
					parent: this.#shadowRoot,
				})
			],
		});

		this.#htmlChilds = createElement('div', {
			class: 'childs',
			parent: this.#shadowRoot,
			hidden: true
		});

		I18n.observeElement(this.#shadowRoot);
	}

	setRepositoryEntry(repositoryEntry?: RepositoryEntry): void {
		this.#repositoryEntry = repositoryEntry;
		this.#updateHTML();
	}

	#updateHTML(): void {
		this.#htmlSelf.innerText = this.#repositoryEntry?.getName() ?? '';
		this.#htmlChilds.innerText = '';

		if (this.#repositoryEntry) {
			for (const entry of this.#repositoryEntry.getChilds()) {

				const entryview: HTMLRepositoryEntryElement = createElement('harmony3d-repository-entry', {
					parent: this.#htmlChilds,
				}) as HTMLRepositoryEntryElement;

				entryview.setRepositoryEntry(entry);

			}
		}
	}

	#click(): void {
		if (!this.#repositoryEntry) {
			return;
		}

		if (this.#repositoryEntry.isDirectory()) {
			this.#toggle();
			this.dispatchEvent(new CustomEvent('directoryclick', { detail: this.#repositoryEntry }));
		} else {
			this.dispatchEvent(new CustomEvent('fileclick', { detail: this.#repositoryEntry }));
		}
	}

	#toggle(): void {
		if (this.#expanded) {
			this.#collapse();
		} else {
			this.#expand();
		}
	}

	#collapse(): void {
		hide(this.#htmlChilds);
		this.#expanded = false;
		this.dispatchEvent(new CustomEvent('collapse', { detail: this.#repositoryEntry }));
	}

	#expand(): void {
		show(this.#htmlChilds);
		this.#expanded = true;
		this.dispatchEvent(new CustomEvent('expand', { detail: this.#repositoryEntry }));
	}
}

let definedRepositoryEntry = false;
export function defineRepositoryEntry(): void {
	if (window.customElements && !definedRepositoryEntry) {
		customElements.define('harmony3d-repository-entry', HTMLRepositoryEntryElement);
		definedRepositoryEntry = true;
	}
}
