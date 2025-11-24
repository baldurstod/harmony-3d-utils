import { Repository, RepositoryEntry, RepositoryFilter } from 'harmony-3d';
import { closeSVG } from 'harmony-svg';
import { cloneEvent, createElement, HTMLHarmonySwitchElement, shadowRootStyle } from 'harmony-ui';
import repositoryCSS from '../css/repository.css';
import { defineRepositoryEntry, HTMLRepositoryEntryElement } from './repositoryentry';

export enum RepositoryDisplayMode {
	Flat = 'flat',
	Tree = 'tree',
}

export class HTMLRepositoryElement extends HTMLElement {
	#shadowRoot: ShadowRoot;
	#htmlTitle: HTMLElement;
	#htmlActive: HTMLHarmonySwitchElement;
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
				this.#htmlTitle = createElement('div', { class: 'title' }),
				this.#htmlActive = createElement('harmony-switch', {
					class: 'active',
					state: true,
					$change: (event: Event) => {
						if (this.#repository) {
							this.#repository.active = (event.target as HTMLHarmonySwitchElement).state as boolean;
						}
					},
				}) as HTMLHarmonySwitchElement,
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

	setRepository(repository?: Repository): void {
		this.#repository = repository;
		if (repository) {
			repository.active = this.#htmlActive.state as boolean;
		}
		this.#updateHTML();
	}

	setFilter(filter?: RepositoryFilter): void {
		this.#filter = filter;
		this.#updateHTML();
	}

	setDisplayMode(mode: RepositoryDisplayMode): void {
		this.#displayMode = mode;
		this.#updateHTML();
	}

	adoptStyleSheet(styleSheet: CSSStyleSheet): void {
		this.#shadowRoot.adoptedStyleSheets.push(styleSheet);
	}

	async #updateHTML(): Promise<void> {
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

	#updateFlat(root: RepositoryEntry): void {
		defineRepositoryEntry();

		for (const entry of root.getAllChilds(this.#filter)) {
			const entryview: HTMLRepositoryEntryElement = createElement('harmony3d-repository-entry', {
				parent: this.#htmlEntries,
				events: {
					fileclick: (event: Event) => this.dispatchEvent(cloneEvent(event)),
					directoryclick: (event: Event) => this.dispatchEvent(cloneEvent(event)),
				},
			}) as HTMLRepositoryEntryElement;

			entryview.setRepositoryEntry(entry);
			this.dispatchEvent(new CustomEvent('entrycreated', { detail: { entry: entry, view: entryview } }));
		}
	}

	#updateTree(root: RepositoryEntry): void {
		defineRepositoryEntry();
		const entryview: HTMLRepositoryEntryElement = createElement('harmony3d-repository-entry', {
			parent: this.#htmlEntries,
			events: {
				fileclick: (event: Event) => this.dispatchEvent(cloneEvent(event)),
				directoryclick: (event: Event) => this.dispatchEvent(cloneEvent(event)),
			},
		}) as HTMLRepositoryEntryElement;

		entryview.setRepositoryEntry(root);
		this.dispatchEvent(new CustomEvent('entrycreated', { detail: { entry: root, view: entryview } }));
	}

	attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
		switch (name) {
			case 'display-mode':
				this.setDisplayMode(newValue as RepositoryDisplayMode);
				break;
		}
	}

	static get observedAttributes(): string[] {
		return ['display-mode'];
	}
}
let definedRepository = false;
export function defineRepository(): void {
	if (window.customElements && !definedRepository) {
		customElements.define('harmony3d-repository', HTMLRepositoryElement);
		definedRepository = true;
	}
}
