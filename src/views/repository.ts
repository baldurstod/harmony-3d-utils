import { Repository, RepositoryEntry, RepositoryFilter } from 'harmony-3d';
import { cloneEvent, createElement, createShadowRoot, shadowRootStyle } from 'harmony-ui';
import { closeSVG } from 'harmony-svg';
import { defineRepositoryEntry, RepositoryEntryElement } from './repositoryentry';
import repositoryCSS from '../css/repository.css';

export enum RepositoryDisplayMode {
	Flat = 'flat',
	Tree = 'tree',
}

export class RepositoryElement extends HTMLElement {
	#shadowRoot: ShadowRoot;
	#htmlTitle: HTMLElement;
	#htmlEntries: HTMLElement;
	#repository?: Repository;
	#displayMode: RepositoryDisplayMode = RepositoryDisplayMode.Flat;
	#filter?: RepositoryFilter;
	constructor() {
		super();

		this.#shadowRoot = this.attachShadow({ mode: 'closed' });
		shadowRootStyle(this.#shadowRoot, repositoryCSS);

		createElement('div', {
			parent: this.#shadowRoot,
			class: 'header',
			childs: [
				this.#htmlTitle = createElement('div', {class: 'title'}),
				createElement('div', {
					class: 'close',
					parent: this.#shadowRoot,
					child: createElement('span', { innerHTML: closeSVG }),
					events: {
						click: () => {
							this.remove();
							this.dispatchEvent(new CustomEvent('close'));
						},
					},
				}),
			]
		});

		this.#htmlEntries = createElement('div', {
			parent: this.#shadowRoot,
		});
	}

	setRepository(repository?: Repository) {
		this.#repository = repository;
		this.#updateHTML();
	}

	setFilter(filter?: RepositoryFilter) {
		this.#filter = filter;
		this.#updateHTML();
	}

	setDisplayMode(mode: RepositoryDisplayMode) {
		this.#displayMode = mode;
		this.#updateHTML();
	}

	adoptStyleSheet(styleSheet: CSSStyleSheet) {
		this.#shadowRoot.adoptedStyleSheets.push(styleSheet);
	}

	async #updateHTML() {
		this.#htmlTitle.innerText = this.#repository?.name ?? '';
		this.#htmlEntries.innerText = '';
		if (!this.#repository) {
			return;
		}

		const response = await this.#repository.getFileList();
		if (response.error) {
			return;
		}

		if (!response.root) {
			return;
		}

		defineRepositoryEntry();
		switch (this.#displayMode) {
			case RepositoryDisplayMode.Flat:
				this.#updateFlat(response.root);
				break;
			case RepositoryDisplayMode.Tree:
				this.#updateTree(response.root);
				break;
		}
	}

	async #updateFlat(root: RepositoryEntry) {
		defineRepositoryEntry();

		for (const entry of root.getAllChilds(this.#filter)) {
			const entryview: RepositoryEntryElement = createElement('harmony3d-repository-entry', {
				parent: this.#htmlEntries,
				events: {
					fileclick: (event: Event) => this.dispatchEvent(cloneEvent(event)),
					directoryclick: (event: Event) => this.dispatchEvent(cloneEvent(event)),
				},
			}) as RepositoryEntryElement;

			entryview.setRepositoryEntry(entry);
			this.dispatchEvent(new CustomEvent('entrycreated', { detail: { entry: entry, view: entryview } }));
		}
	}

	async #updateTree(root: RepositoryEntry) {
		defineRepositoryEntry();
		const entryview: RepositoryEntryElement = createElement('harmony3d-repository-entry', {
			parent: this.#htmlEntries,
			events: {
				fileclick: (event: Event) => this.dispatchEvent(cloneEvent(event)),
				directoryclick: (event: Event) => this.dispatchEvent(cloneEvent(event)),
			},
		}) as RepositoryEntryElement;

		entryview.setRepositoryEntry(root);
		this.dispatchEvent(new CustomEvent('entrycreated', { detail: { entry: root, view: entryview } }));
	}

	attributeChangedCallback(name: string, oldValue: string, newValue: string) {
		switch (name) {
			case 'display-mode':
				this.setDisplayMode(newValue as RepositoryDisplayMode);
				break;
		}
	}

	static get observedAttributes() {
		return ['display-mode'];
	}
}
let definedRepository = false;
export function defineRepository() {
	if (window.customElements && !definedRepository) {
		customElements.define('harmony3d-repository', RepositoryElement);
		definedRepository = true;
	}
}
