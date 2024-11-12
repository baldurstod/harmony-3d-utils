import { RepositoryEntry } from 'harmony-3d';
import { createElement, hide, I18n, shadowRootStyle, show } from 'harmony-ui';
import repositoryEntryCSS from '../css/repositoryentry.css';

export class RepositoryEntryElement extends HTMLElement {
	#shadowRoot: ShadowRoot;
	#repositoryEntry?: RepositoryEntry;
	#htmlSelf: HTMLElement;
	#htmlChilds: HTMLElement;
	#expanded = false;
	constructor() {
		super();
		this.#shadowRoot = this.attachShadow({ mode: 'closed' });
		shadowRootStyle(this.#shadowRoot, repositoryEntryCSS);

		this.#htmlSelf = createElement('div', {
			class: 'self',
			parent: this.#shadowRoot,
			events: {
				click: () => this.#click(),
			}
		});

		this.#htmlChilds = createElement('div', {
			class: 'childs',
			parent: this.#shadowRoot,
			hidden: true
		});

		I18n.observeElement(this.#shadowRoot);
	}

	setRepositoryEntry(repositoryEntry?: RepositoryEntry) {
		this.#repositoryEntry = repositoryEntry;
		this.#updateHTML();
	}

	#updateHTML() {
		this.#htmlSelf.innerText = this.#repositoryEntry?.getName() ?? '';
		this.#htmlChilds.innerText = '';

		if (this.#repositoryEntry) {
			for (const entry of this.#repositoryEntry.getChilds()) {

				const entryview: RepositoryEntryElement = createElement('harmony3d-repository-entry', {
					parent: this.#htmlChilds,
				}) as RepositoryEntryElement;

				entryview.setRepositoryEntry(entry);

			}}
	}

	#click() {
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

	#toggle() {
		if (this.#expanded) {
			this.#collapse();
		} else {
			this.#expand();
		}
	}

	#collapse() {
		hide(this.#htmlChilds);
		this.#expanded = false;
		this.dispatchEvent(new CustomEvent('collapse', { detail: this.#repositoryEntry }));
	}

	#expand() {
		show(this.#htmlChilds);
		this.#expanded = true;
		this.dispatchEvent(new CustomEvent('expand', { detail: this.#repositoryEntry }));
	}
}

let definedRepositoryEntry = false;
export function defineRepositoryEntry() {
	if (window.customElements && !definedRepositoryEntry) {
		customElements.define('harmony3d-repository-entry', RepositoryEntryElement);
		definedRepositoryEntry = true;
	}
}
