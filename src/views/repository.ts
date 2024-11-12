import { Repository, RepositoryEntry } from 'harmony-3d';
import { createElement, createShadowRoot, shadowRootStyle } from 'harmony-ui';
import { defineRepositoryEntry, RepositoryEntryElement } from './repositoryentry';
import repositoryCSS from '../css/repository.css';

export enum RepositoryDisplayMode {
	Flat = 'flat',
	Tree = 'tree',
}

export class RepositoryElement extends HTMLElement {
	#shadowRoot: ShadowRoot;
	#repository?: Repository;
	#displayMode: RepositoryDisplayMode = RepositoryDisplayMode.Flat;
	constructor(repository?: Repository) {
		super();

		this.#shadowRoot = this.attachShadow({ mode: 'closed' });
		shadowRootStyle(this.#shadowRoot, repositoryCSS);

		this.setRepository(repository);
	}

	setRepository(repository?: Repository) {
		this.#repository = repository;
		this.#updateHTML();
	}

	setDisplayMode(mode: RepositoryDisplayMode) {
		this.#displayMode = mode;
		this.#updateHTML();
	}

	async #updateHTML() {
		this.#shadowRoot.innerHTML = '';
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
		/*
		const entryview: RepositoryEntryElement = createElement('harmony3d-repository-entry', {
			parent: this.#shadowRoot,
		}) as RepositoryEntryElement;
*/
		//console.info(root.getAllChilds());
		for (const entry of root.getAllChilds()) {
			const entryview: RepositoryEntryElement = createElement('harmony3d-repository-entry', {
				parent: this.#shadowRoot,
			}) as RepositoryEntryElement;

			entryview.setRepositoryEntry(entry);
		}
	}

	async #updateTree(root: RepositoryEntry) {
		defineRepositoryEntry();
		const entryview: RepositoryEntryElement = createElement('harmony3d-repository-entry', {
			parent: this.#shadowRoot,
		}) as RepositoryEntryElement;

		entryview.setRepositoryEntry(root);
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
